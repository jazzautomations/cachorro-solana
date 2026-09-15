import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildPayload,
  attestationSha256,
  memoString,
  parseMemo,
} from "../lib/attestation.js";
import { canonicalize } from "../lib/canonical.js";

// A fixed payload with fields deliberately out of alphabetical order in the
// literal; canonicalization must sort them so the digest is stable.
const fields = {
  reportSha256: "deadbeef".repeat(8),
  auditedCommit: "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
  verifiedBuildDigest: null,
  journalHead: null,
  target: "github.com/example-org/example-solana-program",
  createdAt: "2026-09-15T00:00:00.000Z",
};

test("canonicalize sorts keys deterministically", () => {
  const a = canonicalize({ b: 1, a: 2, c: { z: 1, y: 2 } });
  const b = canonicalize({ c: { y: 2, z: 1 }, a: 2, b: 1 });
  assert.equal(a, b);
  assert.equal(a, '{"a":2,"b":1,"c":{"y":2,"z":1}}');
});

test("attestation hash is stable and reproducible", () => {
  const p1 = buildPayload(fields);
  const p2 = buildPayload(fields);
  assert.equal(attestationSha256(p1), attestationSha256(p2));
  assert.match(attestationSha256(p1), /^[0-9a-f]{64}$/);
});

test("verify logic: on-chain memo hash matches recomputed hash (mocked tx)", () => {
  const payload = buildPayload(fields);
  const attHash = attestationSha256(payload);

  // Simulate what fetchMemoTx returns from a real devnet tx log line.
  const onchainMemo = memoString(attHash);
  const onchainHash = parseMemo(onchainMemo);

  // Recompute from receipt fields (don't trust a stored digest).
  const recomputed = attestationSha256(
    buildPayload({
      reportSha256: payload.report_sha256,
      auditedCommit: payload.audited_commit,
      verifiedBuildDigest: payload.verified_build_digest,
      journalHead: payload.journal_head,
      target: payload.target,
      createdAt: payload.created_at,
    })
  );

  assert.equal(onchainHash, recomputed, "PASS: memo hash == recomputed");
});

test("verify logic: tampered report field fails the match", () => {
  const payload = buildPayload(fields);
  const onchainHash = parseMemo(memoString(attestationSha256(payload)));

  // Attacker swaps the report hash in the local receipt.
  const tampered = attestationSha256(
    buildPayload({ ...fields, reportSha256: "cafebabe".repeat(8) })
  );
  assert.notEqual(onchainHash, tampered, "FAIL expected on tampered field");
});

test("parseMemo rejects foreign memos", () => {
  assert.equal(parseMemo("hello world"), null);
  assert.equal(parseMemo("cachorro:v1:abc"), "abc");
});
