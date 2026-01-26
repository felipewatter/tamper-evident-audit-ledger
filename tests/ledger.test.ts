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
});
