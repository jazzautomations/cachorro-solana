import { createHash } from "node:crypto";

/**
 * Deterministically canonicalize a JSON value:
 *  - object keys sorted lexicographically, recursively
 *  - no insignificant whitespace
 *  - arrays keep order
 * Produces the exact byte string that gets hashed, so two callers on two
 * machines derive the identical attestation digest from identical fields.
 */
export function canonicalize(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  const keys = Object.keys(value).sort();
  const parts = keys.map(
    (k) => JSON.stringify(k) + ":" + canonicalize(value[k])
  );
  return "{" + parts.join(",") + "}";
}

/** sha256 hex of a Buffer/string/Uint8Array. */
export function sha256Hex(input) {
  return createHash("sha256").update(input).digest("hex");
}

/** sha256 hex of the canonical bytes of a JSON value. */
export function canonicalSha256(value) {
  return sha256Hex(Buffer.from(canonicalize(value), "utf8"));
}
