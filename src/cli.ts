#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { FileStore } from "./fileStore";
import { appendEvent, createKeyPair, verifyStore } from "./ledger";
import { AuditEvent } from "./types";

const program = new Command();

program
  .name("audit-ledger")
  .description("Tamper-evident audit log (hash-chained, optional Ed25519 signatures) — CLI")
  .version("0.1.0");

program
  .command("init")
  .description("Generate an Ed25519 key pair (PEM) for signing audit records")
  .option("--out <dir>", "Output directory", "./keys")
  .action((opts) => {
    const outDir = path.resolve(opts.out);
    fs.mkdirSync(outDir, { recursive: true });

    const kp = createKeyPair();
    const pubPath = path.join(outDir, "audit-ed25519-public.pem");
    const privPath = path.join(outDir, "audit-ed25519-private.pem");

    fs.writeFileSync(pubPath, kp.publicKeyPem, { encoding: "utf-8", mode: 0o644 });
    fs.writeFileSync(privPath, kp.privateKeyPem, { encoding: "utf-8", mode: 0o600 });

    process.stdout.write(`Created:\n- ${pubPath}\n- ${privPath}\nKeyId: ${kp.keyId}\n`);
  });

program
  .command("append")
  .description("Append an event to the ledger")
  .requiredOption("--file <path>", "Ledger file path (JSONL)")
  .requiredOption("--type <eventType>", "Event type, e.g. auth.login")
  .option("--actor-id <id>", "Actor id")
  .option("--actor-ip <ip>", "Actor IP")
  .option("--actor-ua <ua>", "Actor user agent")
  .option("--target-type <t>", "Target type")
  .option("--target-id <id>", "Target id")
  .option("--meta <json>", "Event metadata as JSON string")
  .option("--private-key <path>", "PEM private key to sign records")
  .option("--key-id <id>", "Key id to include in records (useful for rotation)")
  .option("--redact", "Enable default redaction for metadata", true)
  .action(async (opts) => {
    const store = new FileStore(path.resolve(opts.file));

    const event: AuditEvent = {
      type: String(opts.type),
      actor: opts.actorId || opts.actorIp || opts.actorUa ? { id: opts.actorId, ip: opts.actorIp, userAgent: opts.actorUa } : undefined,
      target: opts.targetType || opts.targetId ? { type: opts.targetType, id: opts.targetId } : undefined,
      metadata: opts.meta ? safeJsonParse(opts.meta) : undefined,
    };

    const privateKeyPem = opts.privateKey ? fs.readFileSync(path.resolve(opts.privateKey), "utf-8") : undefined;

    const record = await appendEvent(store, event, {
      privateKeyPem,
      keyId: opts.keyId,
      redact: opts.redact ? {} : undefined,
    });

    process.stdout.write(JSON.stringify(record, null, 2) + "\n");
  });

program
  .command("verify")
  .description("Verify ledger integrity (hash chain) and optional Ed25519 signatures")
  .requiredOption("--file <path>", "Ledger file path (JSONL)")
  .option("--public-key <path>", "PEM public key to verify signatures")
  .action(async (opts) => {
    const store = new FileStore(path.resolve(opts.file));
    const publicKeyPem = opts.publicKey ? fs.readFileSync(path.resolve(opts.publicKey), "utf-8") : undefined;

    const result = await verifyStore(store, { publicKeyPem });

    if (result.ok) {
      process.stdout.write(`OK — verified ${result.total} record(s).\n`);
      process.exit(0);
    }

    process.stderr.write(`FAIL — verified ${result.total} record(s).\n`);
    if (result.firstError) {
      process.stderr.write(`First error at index ${result.firstError.index}: ${result.firstError.reason}\n`);
    }
    process.exit(2);
  });

program
  .command("pretty")
  .description("Pretty-print the last N records (for quick inspection)")
  .requiredOption("--file <path>", "Ledger file path (JSONL)")
  .option("--tail <n>", "How many lines from the end", "20")
  .action(async (opts) => {
    const filePath = path.resolve(opts.file);
    const n = Math.max(1, Number(opts.tail) || 20);

    if (!fs.existsSync(filePath)) {
      process.stderr.write(`File not found: ${filePath}\n`);
      process.exit(1);
    }

    const lines = fs.readFileSync(filePath, "utf-8").split(/\r?\n/).filter(Boolean);
    const tail = lines.slice(-n);

    for (const line of tail) {
      try {
        const obj = JSON.parse(line);
        process.stdout.write(JSON.stringify(obj, null, 2) + "\n\n");
      } catch {
        process.stdout.write(line + "\n");
      }
    }
  });

program.parse(process.argv);

function safeJsonParse(s: string): any {
  try {
    return JSON.parse(s);
  } catch (e) {
    throw new Error(`Invalid JSON for --meta: ${(e as Error).message}`);
  }
}
