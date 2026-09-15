import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { parseMemo } from "./attestation.js";

export const DEVNET_RPC = "https://api.devnet.solana.com";
const RPC_TIMEOUT_MS = 30_000;

// SPL Memo program (v2). No on-chain program of our own to deploy — we ride
// the canonical memo program and put only the digest in its UTF-8 data.
export const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

/** Build a memo instruction carrying `memo`, signed by `signer`. */
function createMemoInstruction(memo, signer) {
  return new TransactionInstruction({
    keys: [{ pubkey: signer, isSigner: true, isWritable: false }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memo, "utf8"),
  });
}

export function connect() {
  return new Connection(DEVNET_RPC, "confirmed");
}

/** Load the throwaway devnet keypair, creating + persisting one if absent. */
export function loadOrCreateKeypair(path) {
  if (existsSync(path)) {
    const secret = JSON.parse(readFileSync(path, "utf8"));
    return Keypair.fromSecretKey(Uint8Array.from(secret));
  }
  const kp = Keypair.generate();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(Array.from(kp.secretKey)));
  return kp;
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Ensure the payer has SOL. If balance is 0, request an airdrop, retrying a
 * couple of times. On persistent faucet rate-limit, throws a clear error
 * (never hangs) so the caller can tell the operator to fund it manually.
 */
export async function ensureFunded(conn, payer, { retries = 3 } = {}) {
  let balance = await withTimeout(
    conn.getBalance(payer.publicKey),
    RPC_TIMEOUT_MS,
    "getBalance"
  );
  if (balance > 0) return balance;

  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const sig = await withTimeout(
        conn.requestAirdrop(payer.publicKey, LAMPORTS_PER_SOL),
        RPC_TIMEOUT_MS,
        "requestAirdrop"
      );
      const bh = await conn.getLatestBlockhash();
      await withTimeout(
        conn.confirmTransaction({ signature: sig, ...bh }, "confirmed"),
        RPC_TIMEOUT_MS,
        "airdrop confirm"
      );
      balance = await conn.getBalance(payer.publicKey);
      if (balance > 0) return balance;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw new Error(
    `devnet faucet unavailable / rate-limited (${lastErr?.message ?? "no SOL after retries"}). ` +
      `Fund manually: solana airdrop 1 ${payer.publicKey.toBase58()} --url ${DEVNET_RPC}`
  );
}

/** Send a memo transaction, confirm it, and return signature + slot. */
export async function sendMemo(conn, payer, memo) {
  const ix = createMemoInstruction(memo, payer.publicKey);
  const tx = new Transaction().add(ix);
  const signature = await withTimeout(
    sendAndConfirmTransaction(conn, tx, [payer], { commitment: "confirmed" }),
    RPC_TIMEOUT_MS * 2,
    "sendAndConfirm"
  );
  const parsed = await conn.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  return { signature, slot: parsed?.slot ?? null, blockTime: parsed?.blockTime ?? null };
}

/**
 * Fetch a confirmed tx and extract its cachorro memo hash + metadata.
 * Reads the memo from the program log lines (robust across web3.js versions).
 */
export async function fetchMemoTx(conn, signature) {
  const tx = await withTimeout(
    conn.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    }),
    RPC_TIMEOUT_MS,
    "getTransaction"
  );
  if (!tx) return null;
  const logs = tx.meta?.logMessages ?? [];
  let memo = null;
  for (const line of logs) {
    // e.g. Program log: Memo (len 76): "cachorro:v1:<hash>"
    const m = line.match(/Memo \(len \d+\): "(.*)"$/);
    if (m) {
      memo = m[1];
      break;
    }
  }
  return {
    signature,
    slot: tx.slot ?? null,
    blockTime: tx.blockTime ?? null,
    memo,
    memoHash: parseMemo(memo),
  };
}
