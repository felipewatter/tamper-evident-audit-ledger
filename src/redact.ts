import { JsonValue } from "./types";
import { sha256Hex } from "./crypto";

export interface RedactOptions {
  /**
   * Keys to be removed/redacted anywhere in the object tree (case-insensitive).
   */
  denyKeys?: string[];

  /**
   * Replace sensitive values with a deterministic hash instead of "[REDACTED]".
   * This can be useful for correlation without storing raw data.
   */
  hashValues?: boolean;

  /**
   * Token used as salt when hashValues is true.
   * If omitted, hashing is still deterministic but not salted.
   */
  hashSalt?: string;
}

const DEFAULT_DENY_KEYS = [
  "password",
  "pass",
  "pwd",
  "secret",
  "token",
  "access_token",
  "refresh_token",
  "authorization",
  "cookie",
  "set-cookie",
  "api_key",
  "apikey",
  "private_key",
  "client_secret",
];

export function redact(input: JsonValue, options: RedactOptions = {}): JsonValue {
  const deny = new Set((options.denyKeys ?? DEFAULT_DENY_KEYS).map((k) => k.toLowerCase()));
  return walk(input, deny, options);
}

function walk(value: JsonValue, deny: Set<string>, options: RedactOptions): JsonValue {
  if (value === null) return null;
  if (Array.isArray(value)) return value.map((v) => walk(v, deny, options));
  if (typeof value === "object") {
    const obj = value as Record<string, JsonValue>;
    const out: Record<string, JsonValue> = Object.create(null);
    for (const [k, v] of Object.entries(obj)) {
      if (deny.has(k.toLowerCase())) {
        out[k] = options.hashValues ? hashAny(v, options.hashSalt) : "[REDACTED]";
      } else {
        out[k] = walk(v, deny, options);
      }
    }
    return out;
  }
  return value;
}

function hashAny(value: JsonValue, salt?: string): string {
  const payload = typeof value === "string" ? value : JSON.stringify(value);
  const s = salt ? `${salt}:${payload}` : payload;
  return `sha256:${sha256Hex(s)}`;
}
