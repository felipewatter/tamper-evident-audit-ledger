export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [k: string]: JsonValue };

export interface AuditEvent {
  /**
   * A machine-friendly event type, e.g. "auth.login", "user.created", "config.changed".
   */
  type: string;

  /**
   * Actor context (avoid PII; prefer stable identifiers).
   */
  actor?: {
    id?: string;
    ip?: string;
    userAgent?: string;
  };

  /**
   * Target context (what was acted on).
   */
  target?: {
    type?: string;
    id?: string;
  };

  /**
   * Additional metadata. Prefer non-sensitive, structured data.
   */
  metadata?: { [k: string]: JsonValue };
}

export interface AuditRecord {
  v: 1;
  index: number;
  ts: string; // ISO 8601
  event: AuditEvent;

  prevHash: string; // hex SHA-256
  hash: string; // hex SHA-256

  /**
   * Optional Ed25519 signature over the `hash` bytes.
   */
  sig?: string; // base64
  keyId?: string;
}

export interface VerifyResult {
  ok: boolean;
  total: number;
  firstError?: {
    index: number;
    reason: string;
    line: string;
  };
}
