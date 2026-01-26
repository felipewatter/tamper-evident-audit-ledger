import fs from "node:fs";
import readline from "node:readline";
import { AppendOnlyStore } from "./store";
import { AuditRecord } from "./types";

export class FileStore implements AppendOnlyStore {
  constructor(private readonly filePath: string) {}

  async append(record: AuditRecord): Promise<void> {
    const line = JSON.stringify(record);
    await fs.promises.appendFile(this.filePath, line + "\n", { encoding: "utf-8" });
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
