# tamper-evident-audit-ledger

Tamper-evident (hash-chained) audit log for Node.js/TypeScript with optional Ed25519 signatures **plus a CLI verifier**.

This repository is designed to be a reference implementation: small surface area, strong defaults, clear threat model, and “copy-pasteable” operational guidance.

---

## Why this exists

Security events are only useful if they are:

1. **Collected consistently** (what happened, when, by whom, on what),
2. **Protected against tampering** (integrity), and
3. **Handled responsibly** (avoid logging sensitive data and protect access).

OWASP explicitly calls out protecting logs from tampering and avoiding unnecessary sensitive data in logs. This project implements integrity controls using a **hash chain** and optional cryptographic signatures.  
(See: OWASP Logging Cheat Sheet and OWASP Top 10 A09: Security Logging and Monitoring Failures.)

---

## What you get

- **Append-only JSONL ledger** (one JSON object per line)
- **Hash chaining** (SHA-256): each record includes `prevHash` → tampering becomes detectable
- **Optional Ed25519 signatures**: improves authenticity (prevents forging new records without private key)
- **Metadata redaction helper**: removes common secret keys (password, token, authorization, cookie, etc.)
- **CLI**:
  - `audit-ledger init` → generate keypair
  - `audit-ledger append` → append event
  - `audit-ledger verify` → verify chain (+ signatures if enabled)
  - `audit-ledger pretty` → inspect last records

---

## Installation

```bash
npm i tamper-evident-audit-ledger
```

Or clone this repo and install:

```bash
npm ci
npm test
npm run build
```

---

## Quick start (library)

```ts
import { FileStore, appendEvent, verifyStore } from "tamper-evident-audit-ledger";

const store = new FileStore("./audit.log");

await appendEvent(store, {
  type: "auth.login",
  actor: { id: "u1", ip: "203.0.113.10" },
  metadata: { ok: true, method: "password" }
}, { redact: {} });

const result = await verifyStore(store);
console.log(result.ok); // true
```

---

## Quick start (CLI)

### 1) Create a signing keypair (recommended)

```bash
npx audit-ledger init --out ./keys
```

This generates:
- `./keys/audit-ed25519-public.pem`
- `./keys/audit-ed25519-private.pem` (permission 0600)

### 2) Append an event

```bash
npx audit-ledger append   --file ./audit.log   --type auth.login   --actor-id u1   --actor-ip 203.0.113.10   --meta '{"ok":true,"method":"password","token":"SHOULD_NOT_BE_LOGGED"}'   --private-key ./keys/audit-ed25519-private.pem
```

If `--redact` is enabled (default), keys like `token` are replaced with `[REDACTED]`.

### 3) Verify integrity (and signatures)

```bash
npx audit-ledger verify --file ./audit.log --public-key ./keys/audit-ed25519-public.pem
```

---

## Ledger format (JSON Lines)

Each line is an `AuditRecord`:

```json
{
  "v": 1,
  "index": 0,
  "ts": "2026-01-25T00:00:00.000Z",
  "event": {
    "type": "auth.login",
    "actor": { "id": "u1", "ip": "203.0.113.10" },
    "target": { "type": "user", "id": "u1" },
    "metadata": { "ok": true }
  },
  "prevHash": "0000...0000",
  "hash": "8f3a...c9b1",
  "sig": "base64...",
  "keyId": "ed25519:abcd1234ef567890"
}
```

**Hash input** is the canonical JSON serialization of:

- `v`
- `index`
- `ts`
- `event`
- `prevHash`

Then:

- `hash = SHA256(canonical_payload)`
- if signing enabled: `sig = Ed25519_sign(hash_bytes)`

---

## Threat model

### Detects
- Modifying any record (payload changes → hash mismatch)
- Inserting/reordering/removing records in the middle (prev-hash mismatch / index mismatch)

### Improves authenticity (when signatures are enabled)
- Attacker cannot generate valid signatures for new records without the private key.

### Does NOT solve alone (important)
No local file-based solution can fully prevent:
- Deleting the entire file
- Rolling back to an older file snapshot
- Deleting the tail of the log and continuing from a previous state (if the attacker can also write)

To mitigate, combine with operational controls:

- Store logs in append-only / WORM-capable storage when possible.
- Ship logs to a remote system (SIEM, object storage with retention).
- Periodically “anchor” the last hash elsewhere (e.g., a separate system, a signed release, or a monitored datastore).
- Restrict OS and filesystem permissions (principle of least privilege).

---

## Security guidance (practical)

### Avoid sensitive data
Logs frequently become a data exfiltration target. Do not store passwords, raw tokens, secrets, or full card-like identifiers. Prefer stable IDs and minimal context. OWASP recommends minimizing sensitive data in logs and protecting logs from misuse and tampering.

### Protect access
Treat logs as sensitive:
- Limit read access (need-to-know).
- Encrypt at rest if your environment requires it.
- Ensure secure transport if logs are shipped elsewhere.

### Fail safely
If verification fails in a critical pipeline (for example, compliance export), treat it as a security incident:
- stop processing
- preserve evidence
- investigate the point of divergence

---

## Example (Express)

See `examples/express-demo/`:

```bash
cd examples/express-demo
npm i
npm start
```

Then:

```bash
curl -XPOST http://localhost:3000/login   -H "Content-Type: application/json"   -d '{"user":"u1"}'
```

A new `audit.log` JSONL file is created.

---

## CI and supply-chain hardening included

This repository ships with:
- CI workflow (lint, test, build, `npm audit`)
- CodeQL scanning workflow (security-extended queries)
- Dependency Review (PR gating)
- Dependabot for npm + GitHub Actions

These are recommended baseline controls for public repositories using GitHub Actions and CodeQL.

---

## Development

```bash
npm ci
npm test
npm run lint
npm run build
```

---

## Roadmap (optional ideas)

- Storage adapters: S3, stdout, syslog
- Merkle-tree checkpoints for batch verification
- Optional encryption of metadata fields (use-case dependent)
- Structured event vocabulary aligned with your org’s taxonomy

---

## License

MIT

---

## Responsible use

This project is defensive. It helps teams preserve and verify audit trail integrity and improve security logging quality. Do not use it to collect data you are not authorized to collect.
