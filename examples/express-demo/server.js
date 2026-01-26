const express = require("express");
const helmet = require("helmet");
const { FileStore, appendEvent } = require("tamper-evident-audit-ledger");

const app = express();
app.use(helmet());
app.use(express.json());

const store = new FileStore("./audit.log");

/**
 * Demo endpoint: simulates a login (DO NOT use as real auth).
 * Try:
 *   curl -XPOST http://localhost:3000/login -H "Content-Type: application/json" -d '{"user":"u1"}'
 */
app.post("/login", async (req, res) => {
  const user = String(req.body?.user ?? "unknown");

  // Example: log a security-relevant event.
  const record = await appendEvent(store, {
    type: "auth.login",
    actor: {
      id: user,
      ip: req.ip,
      userAgent: req.get("user-agent") || undefined,
    },
    metadata: {
      ok: true,
      // Do not log passwords/tokens. If you do, redaction can help, but prefer not to collect.
    },
  }, { redact: {} });

  res.json({ ok: true, record });
});

app.listen(3000, () => console.log("Express demo on http://localhost:3000"));
