import { canonicalize } from "./canonicalize";
import { generateEd25519KeyPair, keyIdFromPublicKey, sha256Hex, signEd25519, verifyEd25519 } from "./crypto";
import { redact, RedactOptions } from "./redact";
import { AppendOnlyStore } from "./store";
import { AuditEvent, AuditRecord, VerifyResult } from "./types";

export interface LedgerOptions {
  /**
   * Optional signing key. If provided, each record will include `sig` and `keyId`.
   */
  privateKeyPem?: string;

  /**
   * If signing is enabled, set a stable key identifier (recommended for rotation).
   * If omitted, it will be derived from the public key when available.
   */
  keyId?: string;

  /**
   * Optional redaction for event.metadata (recommended).
   */
  redact?: RedactOptions;
}

/**
 * Creates a new record by chaining SHA-256 hashes.
 * - The integrity claim: any change to any record (or reordering/removal in the middle) is detectable.
 * - The authenticity claim (optional): with Ed25519 signatures, an attacker can't forge new records without the private key.
 */
export async function appendEvent(
  store: AppendOnlyStore,
  event: AuditEvent,
  options: LedgerOptions = {}
): Promise<AuditRecord> {
  const { lastIndex, lastHash } = await getLastRecordPointer(store);

  const index = lastIndex + 1;
  const ts = new Date().toISOString();

  const sanitized: AuditEvent = {
    ...event,
    metadata: options.redact ? (redact(event.metadata ?? {}, options.redact) as any) : event.metadata,
  };

  const payload = {
    v: 1 as const,
    index,
    ts,
    event: sanitized,
    prevHash: lastHash,
  };

  const canonical = canonicalize(payload as any);
  const hash = sha256Hex(canonical);

  const record: AuditRecord = { ...payload, hash };

  if (options.privateKeyPem) {
    record.sig = signEd25519(hash, options.privateKeyPem);
    record.keyId = options.keyId ?? undefined;
  }

  await store.append(record);
  return record;
}

export async function verifyStore(
  store: AppendOnlyStore,
  options: { publicKeyPem?: string } = {}
): Promise<VerifyResult> {
  let expectedPrevHash = GENESIS_HASH;
  let expectedIndex = 0;

  let total = 0;

  for await (const line of store.readAllLines()) {
    total += 1;
    let parsed: AuditRecord;

    try {
      parsed = JSON.parse(line) as AuditRecord;
    } catch {
      return fail(expectedIndex, "invalid_json", line, total);
    }

    if (parsed.v !== 1) return fail(parsed.index, "unsupported_version", line, total);

    if (parsed.index !== expectedIndex) return fail(parsed.index, `unexpected_index_expected_${expectedIndex}`, line, total);
    if (parsed.prevHash !== expectedPrevHash) return fail(parsed.index, "prev_hash_mismatch", line, total);

    const payload = {
      v: 1 as const,
      index: parsed.index,
      ts: parsed.ts,
      event: parsed.event,
      prevHash: parsed.prevHash,
    };

    const canonical = canonicalize(payload as any);
    const recomputedHash = sha256Hex(canonical);

    if (recomputedHash !== parsed.hash) return fail(parsed.index, "hash_mismatch", line, total);

    if (options.publicKeyPem) {
      if (!parsed.sig) return fail(parsed.index, "missing_signature", line, total);
      const okSig = verifyEd25519(parsed.hash, parsed.sig, options.publicKeyPem);
      if (!okSig) return fail(parsed.index, "invalid_signature", line, total);
    }

    expectedPrevHash = parsed.hash;
    expectedIndex += 1;
  }

  return { ok: true, total };

  function fail(index: number, reason: string, line: string, count: number): VerifyResult {
    return { ok: false, total: count, firstError: { index, reason, line } };
  }
}

export function createKeyPair(): { publicKeyPem: string; privateKeyPem: string; keyId: string } {
  const { publicKeyPem, privateKeyPem } = generateEd25519KeyPair();
  return { publicKeyPem, privateKeyPem, keyId: keyIdFromPublicKey(publicKeyPem) };
}

async function getLastRecordPointer(store: AppendOnlyStore): Promise<{ lastIndex: number; lastHash: string }> {
  let last: AuditRecord | undefined;
  for await (const line of store.readAllLines()) {
    try {
      last = JSON.parse(line) as AuditRecord;
    } catch {
      // ignore, verification will catch; treat as no pointer
      break;
    }
  }
  if (!last) return { lastIndex: -1, lastHash: GENESIS_HASH };
  return { lastIndex: last.index, lastHash: last.hash };
}

export const GENESIS_HASH = "0".repeat(64);
