import { readFileSync } from "node:fs";
import { canonicalSha256, sha256Hex } from "./canonical.js";

export const SCHEMA = "cachorro-attestation/v1";
export const CLUSTER = "devnet";
export const MEMO_PREFIX = "cachorro:v1:";

/**
 * The canonical, ordered field set of a v1 attestation payload. Kept explicit
 * (and self-contained — not imported from pentest-agent) so the digest is a
 * stable function of exactly these fields. Shape mirrors an in-toto-ish
 * statement: what was audited, of what, on which network, when.
 */
export function buildPayload({
  reportSha256,
  auditedCommit,
  verifiedBuildDigest = null,
  journalHead = null,
  target,
  createdAt,
}) {
  return {
    schema: SCHEMA,
    report_sha256: reportSha256,
    audited_commit: auditedCommit,
    verified_build_digest: verifiedBuildDigest ?? null,
    journal_head: journalHead ?? null,
    target,
    cluster: CLUSTER,
    created_at: createdAt,
  };
}

/** sha256 hex of a report file's raw bytes. */
export function reportSha256(reportPath) {
  return sha256Hex(readFileSync(reportPath));
}

/** The attestation digest = sha256 of the canonical payload bytes. */
export function attestationSha256(payload) {
  return canonicalSha256(payload);
}

/** The compact on-chain memo string carrying only the digest. */
export function memoString(attHash) {
  return MEMO_PREFIX + attHash;
}

/** Parse a memo string; returns the hash or null if it isn't ours. */
export function parseMemo(memo) {
  if (typeof memo !== "string") return null;
  if (!memo.startsWith(MEMO_PREFIX)) return null;
  return memo.slice(MEMO_PREFIX.length).trim();
}
