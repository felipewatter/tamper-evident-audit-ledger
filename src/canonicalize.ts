import { JsonValue } from "./types";

/**
 * Deterministic JSON serialization by recursively sorting object keys.
 * This avoids hash drift due to key order differences.
 *
 * Note: arrays preserve order by design.
 */
export function canonicalize(value: JsonValue): string {
  const normalized = normalize(value);
  return JSON.stringify(normalized);
}

function normalize(value: JsonValue): JsonValue {
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "object") {
    const obj = value as Record<string, JsonValue>;
    const keys = Object.keys(obj).sort();
    const out: Record<string, JsonValue> = {};
    for (const k of keys) out[k] = normalize(obj[k]);
    return out;
  }
  return value;
}
