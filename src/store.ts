import { AuditRecord } from "./types";

export interface AppendOnlyStore {
  /** Allow implementations to distinguish a missing file from an empty ledger. */
  exists?(): Promise<boolean>;
  append(record: AuditRecord): Promise<void>;
  readAllLines(): AsyncIterable<string>;
}
