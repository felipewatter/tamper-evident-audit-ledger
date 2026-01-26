# 🧾 Tamper-Evident Audit Ledger

![GitHub release](https://img.shields.io/github/v/release/felipewatter/tamper-evident-audit-ledger)
![GitHub](https://img.shields.io/badge/GitHub-Repository-black)
![GitHub language count](https://img.shields.io/github/languages/count/felipewatter/tamper-evident-audit-ledger)

A tamper-evident (hash-chained) audit ledger for Node.js/TypeScript with optional Ed25519 signatures + a CLI verifier.

* * *

## ✅ Features

- Append-only JSONL ledger (one JSON object per line)
- SHA-256 hash chain (`prevHash` → detects edits/inserts/removals in the middle)
- Optional Ed25519 signatures (authenticity: prevents forging new records without the private key)
- Built-in metadata redaction helper (avoid logging secrets by accident)
- Simple CLI for init / append / verify / pretty
- Ready-to-public baseline: CI, CodeQL, Dependabot, Dependency Review, SECURITY.md

* * *

## 📦 Installation

```bash
npm i tamper-evident-audit-ledger
```

Or, for local development:

```bash
npm ci
npm test
npm run build
```

* * *

## 🚀 Usage (CLI)

### 1) Generate signing keys (recommended)

```bash
npx audit-ledger init --out ./keys
```

This creates:

- `./keys/audit-ed25519-public.pem`
- `./keys/audit-ed25519-private.pem` (permission 0600)

### 2) Append an event

```bash
npx audit-ledger append \
  --file ./audit.log \
  --type auth.login \
  --actor-id u1 \
  --actor-ip 203.0.113.10 \
  --meta '{"ok":true,"method":"password","token":"SHOULD_NOT_BE_LOGGED"}' \
  --private-key ./keys/audit-ed25519-private.pem
```

> With redaction enabled (default), keys like `token`, `password`, `authorization`, `cookie`, etc. are replaced with `[REDACTED]`.

### 3) Verify integrity (and signatures)

```bash
npx audit-ledger verify \
  --file ./audit.log \
  --public-key ./keys/audit-ed25519-public.pem
```

### 4) Pretty print the last records

```bash
npx audit-ledger pretty --file ./audit.log --tail 10
```

* * *

## 🧩 Usage (Library)

```ts
import { FileStore, appendEvent, verifyStore } from "tamper-evident-audit-ledger";

const store = new FileStore("./audit.log");

await appendEvent(
  store,
  {
    type: "auth.login",
    actor: { id: "u1", ip: "203.0.113.10" },
    metadata: { ok: true, method: "password" },
  },
  { redact: {} } // enable default redaction
);

const result = await verifyStore(store);
console.log(result.ok); // true
```

* * *

## ⚙️ Supported files

- `audit.log` (JSON Lines / `.jsonl`) — append-only ledger file
- Works with Node.js 20+ (TypeScript library + CLI)

* * *

## 🔐 How it works (short)

Each record stores:

- `prevHash`: the previous record hash
- `hash`: `SHA256(canonical_json(record_payload))`
- optional `sig`: `Ed25519_sign(hash_bytes)`

If any record is edited, removed, inserted, or reordered (in the middle), verification fails.

* * *

## 🛡️ Best Practices

- **Do not log secrets** (passwords, raw tokens, cookies, auth headers). Prefer stable IDs.
- Store the ledger with **least-privilege** permissions (write-only for the app, read-only for auditors).
- For stronger guarantees, ship/replicate logs to **remote storage** (SIEM / object storage with retention).
- Treat verification failure as a **security incident**: stop processing, preserve evidence, investigate divergence.

* * *

## 🧪 Example (Express)

A minimal demo exists at `examples/express-demo/`:

```bash
cd examples/express-demo
npm i
npm start
```

Test:

```bash
curl -XPOST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"user":"u1"}'
```

* * *

## 🤝 Contributing

Pull requests and suggestions are welcome!

- Keep changes small and focused
- Add/adjust tests
- Avoid heavy dependencies (prefer Node built-ins)

* * *

## 📄 License

MIT License

* * *

## About

Tamper-evident audit ledger (hash chain + optional Ed25519 signatures) with CLI verification for Node.js/TypeScript.

### Topics

cli · security · audit · logging · tamper-evident · typescript · ed25519 · devsecops · integrity · hash-chain
