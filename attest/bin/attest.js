#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPayload,
  reportSha256,
  attestationSha256,
  memoString,
  CLUSTER,
} from "../lib/attestation.js";
import {
  connect,
  loadOrCreateKeypair,
  ensureFunded,
  sendMemo,
  fetchMemoTx,
  DEVNET_RPC,
} from "../lib/solana.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const KEYPAIR_PATH = join(ROOT, ".devnet-keypair.json");
const RECEIPTS_DIR = join(ROOT, "receipts");
const EXPLORER = (sig) =>
  `https://explorer.solana.com/tx/${sig}?cluster=devnet`;

function parseFlags(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i++;
      }
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

function guardCluster(flags) {
  // Safety: devnet only. Refuse any attempt to point at mainnet.
  if (flags.cluster && flags.cluster !== "devnet") {
    console.error(
      `refusing --cluster ${flags.cluster}: cachorro attest is devnet-only (test-network receipt, not a real financial tx).`
    );
    process.exit(2);
  }
}

function readReport(reportPath) {
  const raw = readFileSync(reportPath, "utf8");
  let obj = {};
  try {
    obj = JSON.parse(raw);
  } catch {
    /* report may not be JSON; commit then must come from --commit */
  }
  return obj;
}

async function cmdAnchor(positional, flags) {
  guardCluster(flags);
  const reportPath = positional[0];
  if (!reportPath || !existsSync(reportPath)) {
    console.error("usage: attest anchor <report.json> [--commit <sha>] [--target <name>]");
    process.exit(2);
  }
  const report = readReport(reportPath);

  const auditedCommit =
    flags.commit || report.audited_commit || report.commit || null;
  if (!auditedCommit) {
    console.error("no audited commit: pass --commit <sha> or include commit/audited_commit in the report.");
    process.exit(2);
  }
  const target = flags.target || report.target || null;
  if (!target) {
    console.error("no target: pass --target <name> or include target in the report.");
    process.exit(2);
  }

  const payload = buildPayload({
    reportSha256: reportSha256(reportPath),
    auditedCommit,
    verifiedBuildDigest: flags["verified-build-digest"] || null,
    journalHead: flags["journal-head"] || null,
    target,
    createdAt: flags["created-at"] || new Date().toISOString(),
  });
  const attHash = attestationSha256(payload);
  const memo = memoString(attHash);

  console.log(`target           : ${target}`);
  console.log(`audited_commit   : ${auditedCommit}`);
  console.log(`report_sha256    : ${payload.report_sha256}`);
  console.log(`attestation_sha  : ${attHash}`);
  console.log(`memo             : ${memo}`);
  console.log(`cluster          : ${CLUSTER} (${DEVNET_RPC})`);

  const conn = connect();
  const payer = loadOrCreateKeypair(KEYPAIR_PATH);
  console.log(`payer            : ${payer.publicKey.toBase58()}`);

  console.log("funding (airdrop if needed)...");
  const balance = await ensureFunded(conn, payer);
  console.log(`balance          : ${balance} lamports`);

  console.log("anchoring memo on devnet...");
  const { signature, slot, blockTime } = await sendMemo(conn, payer, memo);

  const receipt = {
    ...payload,
    attestation_sha256: attHash,
    signature,
    slot,
    explorer_url: EXPLORER(signature),
    anchored_at: new Date().toISOString(),
    block_time: blockTime,
  };
  mkdirSync(RECEIPTS_DIR, { recursive: true });
  const receiptPath = join(RECEIPTS_DIR, `${attHash}.json`);
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\n");

  console.log("\nANCHORED");
  console.log(`signature        : ${signature}`);
  console.log(`slot             : ${slot}`);
  console.log(`explorer         : ${EXPLORER(signature)}`);
  console.log(`receipt          : ${receiptPath}`);
}

async function cmdDigest(positional, flags) {
  // Offline: compute the attestation digest from the real journal head and
  // write a local receipt WITHOUT a devnet send (faucet-blocked). The receipt
  // is anchor-ready: `attest anchor` can later put memo `cachorro:v1:<digest>`
  // on devnet, and `attest verify` recomputes the same digest.
  const reportPath = positional[0];
  if (!reportPath || !existsSync(reportPath)) {
    console.error("usage: attest digest <report.json> --journal-head <h> --commit <sha> --target <name> [--verified-build-digest <d>]");
    process.exit(2);
  }
  const report = readReport(reportPath);
  const auditedCommit = flags.commit || report.audited_commit || report.commit || null;
  const target = flags.target || report.target || null;
  if (!auditedCommit || !target) {
    console.error("digest needs --commit and --target (or fields in the report).");
    process.exit(2);
  }
  const createdAt = flags["created-at"] || new Date().toISOString();
  const payload = buildPayload({
    reportSha256: reportSha256(reportPath),
    auditedCommit,
    verifiedBuildDigest: flags["verified-build-digest"] || null,
    journalHead: flags["journal-head"] || null,
    target,
    createdAt,
  });
  const attHash = attestationSha256(payload);
  const memo = memoString(attHash);
  const receipt = {
    ...payload,
    attestation_sha256: attHash,
    memo,
    status: "pending_anchor_faucet_blocked",
    signature: null,
    slot: null,
    explorer_url: null,
  };
  mkdirSync(RECEIPTS_DIR, { recursive: true });
  const receiptPath = join(RECEIPTS_DIR, `${attHash}.json`);
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\n");
  console.log(JSON.stringify(
    { attestation_sha256: attHash, memo, report_sha256: payload.report_sha256, journal_head: payload.journal_head, receipt: receiptPath },
    null, 2
  ));
}

function findReceipt(arg) {
  // sha256 -> receipts/<hash>.json ; otherwise treat as a signature and scan.
  if (/^[0-9a-f]{64}$/.test(arg)) {
    const p = join(RECEIPTS_DIR, `${arg}.json`);
    if (existsSync(p)) return { path: p, receipt: JSON.parse(readFileSync(p, "utf8")) };
    return null;
  }
  if (!existsSync(RECEIPTS_DIR)) return null;
  for (const f of readdirSync(RECEIPTS_DIR)) {
    if (!f.endsWith(".json")) continue;
    const p = join(RECEIPTS_DIR, f);
    const r = JSON.parse(readFileSync(p, "utf8"));
    if (r.signature === arg) return { path: p, receipt: r };
  }
  return null;
}

async function cmdVerify(positional, flags) {
  guardCluster(flags);
  const arg = positional[0];
  if (!arg) {
    console.error("usage: attest verify <signature|attestation_sha256>");
    process.exit(2);
  }
  const found = findReceipt(arg);
  if (!found) {
    console.error(`no local receipt for ${arg} (looked in ${RECEIPTS_DIR}).`);
    process.exit(2);
  }
  const { receipt } = found;

  // Recompute the attestation hash from the receipt's payload fields.
  // Do NOT trust the stored attestation_sha256.
  const payload = buildPayload({
    reportSha256: receipt.report_sha256,
    auditedCommit: receipt.audited_commit,
    verifiedBuildDigest: receipt.verified_build_digest,
    journalHead: receipt.journal_head,
    target: receipt.target,
    createdAt: receipt.created_at,
  });
  const recomputed = attestationSha256(payload);

  const conn = connect();
  const onchain = await fetchMemoTx(conn, receipt.signature);
  if (!onchain) {
    console.error(`FAIL: tx ${receipt.signature} not found on devnet.`);
    process.exit(1);
  }

  const memoMatches = onchain.memoHash === recomputed;
  const storedMatches = receipt.attestation_sha256 === recomputed;

  console.log(`target           : ${receipt.target}`);
  console.log(`audited_commit   : ${receipt.audited_commit}`);
  console.log(`report_sha256    : ${receipt.report_sha256}`);
  console.log(`recomputed_att   : ${recomputed}`);
  console.log(`stored_att       : ${receipt.attestation_sha256} ${storedMatches ? "(matches)" : "(MISMATCH)"}`);
  console.log(`onchain_memo     : ${onchain.memo}`);
  console.log(`onchain_hash     : ${onchain.memoHash}`);
  console.log(`signature        : ${receipt.signature}`);
  console.log(`slot             : ${onchain.slot}`);
  console.log(`block_time       : ${onchain.blockTime ? new Date(onchain.blockTime * 1000).toISOString() : "n/a"}`);
  console.log(`explorer         : ${EXPLORER(receipt.signature)}`);

  if (memoMatches && storedMatches) {
    console.log("\nPASS: on-chain memo hash == recomputed attestation hash.");
    process.exit(0);
  }
  console.log("\nFAIL: hash mismatch (report/commit/fields do not reproduce the anchored digest).");
  process.exit(1);
}

async function main() {
  const [, , cmd, ...rest] = process.argv;
  const { flags, positional } = parseFlags(rest);
  if (cmd === "anchor") return cmdAnchor(positional, flags);
  if (cmd === "digest") return cmdDigest(positional, flags);
  if (cmd === "verify") return cmdVerify(positional, flags);
  console.error("cachorro attest — on-chain audit receipt (Solana devnet)");
  console.error("commands:");
  console.error("  attest anchor <report.json> [--commit <sha>] [--target <name>]");
  console.error("  attest verify <signature|attestation_sha256>");
  process.exit(2);
}

main().catch((e) => {
  console.error(`error: ${e.message}`);
  process.exit(1);
});
