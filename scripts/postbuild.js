/**
 * scripts/postbuild.js
 *
 * Purpose:
 * - Ensure the generated CLI entrypoint has a Node shebang
 * - Make the CLI file executable on *nix (chmod 0755)
 *
 * Security note:
 * - Uses a file descriptor (FD) to avoid TOCTOU/path-based race conditions
 *   flagged by static analyzers (e.g., CodeQL CWE-367).
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

const SHEBANG = "#!/usr/bin/env node\n";

/**
 * Ensures the CLI file starts with the Node shebang.
 * Uses FD-based read/write to avoid check-then-use race conditions on pathnames.
 *
 * @param {string} cliPath Absolute or relative path to the CLI file.
 */
function ensureShebangFD(cliPath) {
  const fd = fs.openSync(cliPath, fs.constants.O_RDWR);

  try {
    // Read via FD to avoid pathname TOCTOU
    const content = fs.readFileSync(fd, { encoding: "utf8" });

    if (!content.startsWith(SHEBANG)) {
      const updated = SHEBANG + content;

      // Rewrite via FD: truncate then write from start
      fs.ftruncateSync(fd, 0);
      fs.writeSync(fd, updated, 0, "utf8");
    }
  } finally {
    fs.closeSync(fd);
  }

  // Apply executable bit on Unix-like systems; ignore errors on Windows
  try {
    fs.chmodSync(cliPath, 0o755);
  } catch {
    // no-op
  }
}

/**
 * Main: locate the built CLI file and patch it.
 * Assumes TypeScript build outputs to /dist and the CLI entry is dist/cli.js.
 *
 * You can adjust this if your build output differs.
 */
function main() {
  const repoRoot = path.resolve(__dirname, "..");

  // Default expected location for the built CLI entry.
  // Adjust if your project uses a different path/name.
  const cli = path.join(repoRoot, "dist", "cli.js");

  if (!fs.existsSync(cli)) {
    console.warn(`[postbuild] CLI not found at: ${cli}`);
    console.warn("[postbuild] Skipping shebang patch.");
    return;
  }

  ensureShebangFD(cli);

  console.log(`[postbuild] Shebang ensured and permissions set on: ${cli}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  ensureShebangFD,
};
