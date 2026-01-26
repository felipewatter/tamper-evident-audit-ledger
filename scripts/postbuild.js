/**
 * Ensures the CLI output file keeps the shebang.
 * TypeScript preserves it, but some toolchains strip it; this is a defensive guard.
 */
const fs = require("node:fs");
const path = require("node:path");

const cli = path.join(__dirname, "..", "dist", "cli.js");
if (!fs.existsSync(cli)) process.exit(0);

const content = fs.readFileSync(cli, "utf-8");
if (!content.startsWith("#!/usr/bin/env node")) {
  fs.writeFileSync(cli, "#!/usr/bin/env node\n" + content, "utf-8");
}
try {
  fs.chmodSync(cli, 0o755);
} catch {}
