import { AuditRecord } from "./types";

export interface AppendOnlyStore {
  append(record: AuditRecord): Promise<void>;
  readAllLines(): AsyncIterable<string>;
}
