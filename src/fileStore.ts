import fs from "node:fs";
import readline from "node:readline";
import { AppendOnlyStore } from "./store";
import { AuditRecord } from "./types";

export class FileStore implements AppendOnlyStore {
  constructor(private readonly filePath: string) {}

  async exists(): Promise<boolean> {
    try {
      const info = await fs.promises.lstat(this.filePath);
      if (!info.isFile()) throw new Error("Ledger must be a regular file (no symlinks)");
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }

  async append(record: AuditRecord): Promise<void> {
    const line = JSON.stringify(record);
    await fs.promises.appendFile(this.filePath, line + "\n", { encoding: "utf-8", mode: 0o600 });
  }

  async *readAllLines(): AsyncIterable<string> {
    if (!fs.existsSync(this.filePath)) return;

    const stream = fs.createReadStream(this.filePath, { encoding: "utf-8" });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    for await (const line of rl) {
      const trimmed = String(line).trim();
      if (trimmed.length) yield trimmed;
    }
  }
}
