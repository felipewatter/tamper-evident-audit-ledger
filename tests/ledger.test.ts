import { describe, expect, test } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FileStore } from "../src/fileStore";
import { appendEvent, createKeyPair, verifyStore } from "../src/ledger";

function tmpFile(name: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-ledger-"));
  return path.join(dir, name);
}

describe("tamper-evident-audit-ledger", () => {
  test("creates a hash chain that verifies", async () => {
    const file = tmpFile("audit.log");
    const store = new FileStore(file);

    await appendEvent(store, { type: "auth.login", actor: { id: "u1" }, metadata: { ok: true } });
    await appendEvent(store, { type: "user.created", actor: { id: "admin" }, target: { type: "user", id: "u2" } });

    const res = await verifyStore(store);
    expect(res.ok).toBe(true);
    expect(res.total).toBe(2);
  });

  test("detects tampering", async () => {
    const file = tmpFile("audit.log");
    const store = new FileStore(file);

    await appendEvent(store, { type: "auth.login", actor: { id: "u1" }, metadata: { ok: true } });
    await appendEvent(store, { type: "user.created", actor: { id: "admin" }, target: { type: "user", id: "u2" } });

    // Tamper with the file by changing one line
    const lines = fs.readFileSync(file, "utf-8").split(/\r?\n/).filter(Boolean);
    const obj = JSON.parse(lines[0]);
    obj.event.type = "auth.logout"; // modify
    lines[0] = JSON.stringify(obj);
    fs.writeFileSync(file, lines.join("\n") + "\n", "utf-8");

    const res = await verifyStore(store);
    expect(res.ok).toBe(false);
    expect(res.firstError?.reason).toMatch(/hash_mismatch|prev_hash_mismatch/);
  });

  test("verifies Ed25519 signatures when enabled", async () => {
    const file = tmpFile("audit.log");
    const store = new FileStore(file);

    const kp = createKeyPair();

    await appendEvent(
      store,
      { type: "auth.login", actor: { id: "u1" }, metadata: { ok: true } },
      { privateKeyPem: kp.privateKeyPem, keyId: kp.keyId }
    );

    // Correct key => should verify
    const ok = await verifyStore(store, { publicKeyPem: kp.publicKeyPem });
    expect(ok.ok).toBe(true);

    // Different key => signature must fail deterministically
    const kp2 = createKeyPair();
    const bad = await verifyStore(store, { publicKeyPem: kp2.publicKeyPem });
    expect(bad.ok).toBe(false);
    expect(bad.firstError?.reason).toBe("invalid_signature");
  });

  test("missing ledger is not a verified empty history", async () => {
    const result = await verifyStore(new FileStore(tmpFile("missing.jsonl")));
    expect(result.ok).toBe(false);
    expect(result.firstError?.reason).toBe("store_missing");
  });

  test("refuses to append to tampered chain", async () => {
    const file = tmpFile("tampered.jsonl");
    const store = new FileStore(file);
    await appendEvent(store, { type: "auth.login", metadata: { success: true } });
    const original = fs.readFileSync(file, "utf8");
    const forged = original.replace("auth.login", "auth.logout");
    expect(forged).not.toBe(original);
    fs.writeFileSync(file, forged);
    await expect(appendEvent(store, { type: "another" })).rejects.toThrow(/Refusing to append/);
    expect(fs.readFileSync(file, "utf8")).toBe(forged);
  });

  test("rejects malformed prior records when appending", async () => {
    const file = tmpFile("invalid.jsonl");
    const store = new FileStore(file);
    await appendEvent(store, { type: "first" });
    fs.appendFileSync(file, "not-json\n");
    const snapshot = fs.readFileSync(file, "utf8");
    await expect(appendEvent(store, { type: "second" })).rejects.toThrow(/invalid_json/);
    expect(fs.readFileSync(file, "utf8")).toBe(snapshot);
  });

  test("malformed JSON value fails closed", async () => {
    const file = tmpFile("primitive.jsonl");
    fs.writeFileSync(file, "null\n");
    const result = await verifyStore(new FileStore(file));
    expect(result.ok).toBe(false);
    expect(result.firstError?.reason).toBe("invalid_record");
  });

  test("genuinely new ledger starts at genesis", async () => {
    const store = new FileStore(tmpFile("new.jsonl"));
    await appendEvent(store, { type: "created" });
    expect((await verifyStore(store)).ok).toBe(true);
  });

  test("symlinks are not accepted as audit files", async () => {
    const target = tmpFile("target.jsonl");
    fs.writeFileSync(target, "");
    const link = target + ".link";
    try { fs.symlinkSync(target, link); } catch { return; }
    const store = new FileStore(link);
    await expect(appendEvent(store, { type: "nope" })).rejects.toThrow(/regular file/);
    await expect(verifyStore(store)).rejects.toThrow(/regular file/);
  });
});
