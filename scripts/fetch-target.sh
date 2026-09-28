#!/bin/bash
# Fetch a Solana target. Deterministic, no AI.
# Uso:
#   bash scripts/fetch-target.sh --repo <git_url> <dest_dir>
#   bash scripts/fetch-target.sh --program-id <PUBKEY> <cluster> <dest_dir>   (cluster: mainnet|devnet|<rpc-url>)
set -euo pipefail
export HOME="${HOME:-/root}"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"
MODE="${1:-}"
case "$MODE" in
  --repo)
    REPO="${2:?repo url}"; DEST="${3:?dest dir}"; mkdir -p "$DEST"
    echo "[*] Clonando $REPO ..."
    if ! git clone --depth 1 "$REPO" "$DEST/repo" 2>/dev/null; then
      rm -rf "$DEST/repo"; git clone "$REPO" "$DEST/repo"
    fi
    echo "[+] Codigo em: $DEST/repo"
    echo "[+] Programs (Rust crates):"
    find "$DEST/repo" -name Cargo.toml -path '*programs*' 2>/dev/null | sed 's#/Cargo.toml##'
    echo "[+] declare_id! found:"
    grep -rInE 'declare_id!' "$DEST/repo" --include=*.rs 2>/dev/null | head
    ;;
  --program-id)
    PID="${2:?program pubkey}"; CLUSTER="${3:-mainnet}"; DEST="${4:?dest dir}"
    mkdir -p "$DEST/onchain"
    case "$CLUSTER" in
      mainnet|mainnet-beta) URL="https://api.mainnet-beta.solana.com";;
      devnet) URL="https://api.devnet.solana.com";;
      *) URL="$CLUSTER";;
    esac
    echo "[*] Dumping on-chain program $PID from $URL ..."
    solana program dump -u "$URL" "$PID" "$DEST/onchain/program.so" 2>&1 || echo "[!] program dump failed (may be non-upgradeable or RPC-limited)"
    echo "[*] Program account info:"
    solana account -u "$URL" "$PID" --output json 2>/dev/null | tee "$DEST/onchain/program_account.json" | head -20 || true
    echo "[*] Trying to fetch Anchor IDL on-chain..."
    if command -v anchor >/dev/null 2>&1; then
      anchor idl fetch -u "$URL" "$PID" > "$DEST/onchain/idl.json" 2>/dev/null && echo "[+] IDL -> $DEST/onchain/idl.json" || echo "[~] no on-chain IDL (private/absent)"
    fi
    echo "[+] On-chain material in: $DEST/onchain"
    echo "[!] NOTE: bytecode is not source. Find the source repo (github, verified build) for a real audit."
    ;;
  *)
    echo "Uso:"
    echo "  bash scripts/fetch-target.sh --repo <git_url> <dest_dir>"
    echo "  bash scripts/fetch-target.sh --program-id <PUBKEY> <cluster> <dest_dir>"
    exit 1
    ;;
esac
