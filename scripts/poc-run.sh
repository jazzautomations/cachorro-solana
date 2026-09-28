#!/bin/bash
# Runs ONE Solana PoC in isolation and prints a STATUS line. No AI.
# Auto-detects kind by extension/content:
#   *.mjs|*.cjs|*.js  -> node harness (zk/snarkjs or web3.js script)
#   *.ts              -> anchor test (isolated copy of TARGET) or ts-mocha vs local validator
#   contains --clone / mainnet-beta -> local fork validator note
# Uso: bash scripts/poc-run.sh <target_dir> <poc_file> <run_dir>
# Env opcional: SOLANA_FORK_URL=<rpc>  (for --clone harnesses)
# SECURITY: building an untrusted Rust target runs build.rs (arbitrary code). Only build targets you trust.
set -uo pipefail
TARGET="${1:?target dir}"; POC="${2:?poc file}"; RUN="${3:?run dir}"
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$HOME/.avm/bin:$PATH"
REVIEW="$RUN/review"; mkdir -p "$REVIEW"

# surfpool: drop-in validator with lazy mainnet forking — PoCs hit real
# deployed-program state on :8899 without clone lists or chain downloads.
SURF_STARTED=""
ensure_validator() {
  if curl -sf --max-time 2 -o /dev/null -X POST http://127.0.0.1:8899       -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"getVersion"}'; then
    say "[*] validator already answering on :8899"
    return 0
  fi
  if command -v surfpool >/dev/null 2>&1; then
    say "[*] starting surfpool (forks mainnet lazily)..."
    surfpool start --no-tui --no-studio >/dev/null 2>&1 &
    SURF_STARTED=$!
    for _ in $(seq 1 25); do
      curl -sf --max-time 2 -o /dev/null -X POST http://127.0.0.1:8899         -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"getVersion"}' && return 0
      sleep 1
    done
  fi
  return 1
}
cleanup_validator(){ [[ -n "$SURF_STARTED" ]] && kill "$SURF_STARTED" 2>/dev/null || true; }
LOG="$REVIEW/$(basename "$POC").log"
echo "== PoC: $(basename "$POC") ==" | tee "$LOG"

ext="${POC##*.}"
say(){ echo "$1" | tee -a "$LOG"; echo "$1"; }
trap cleanup_validator EXIT

case "$ext" in
  mjs|cjs|js)
    # ZK / snarkjs / web3 script harness. The harness itself decides success and should print
    # a line containing VERIFIES_INVALID (critical), SAFE, or BASELINE_OK.
    if grep -qiE "127\.0\.0\.1:8899|localhost:8899|mainnet-beta" "$POC"; then
      ensure_validator || say "[~] no validator on :8899 and surfpool missing — harness may fail"
    fi
    say "[*] node harness..."
    if node "$POC" >>"$LOG" 2>&1; then
      if grep -qiE "VERIFIES_INVALID|CRITICAL_CONFIRMED" "$LOG"; then say "STATUS=RODOU_E_PROVOU"
      elif grep -qiE "\bSAFE\b|range check|assert.*fail" "$LOG"; then say "STATUS=RODOU_NAO_PROVOU (target looks SAFE for this attack)"
      else say "STATUS=RODOU_NAO_PROVOU"; fi
    else
      say "STATUS=NAO_RODOU"
    fi
    tail -30 "$LOG"
    ;;
  ts)
    # Anchor test: copy target, drop PoC into tests/, run `anchor test` (skips local validator boot if configured).
    if grep -qiE "\-\-clone|mainnet-beta|127\.0\.0\.1:8899|localhost:8899" "$POC" && [[ -z "${SOLANA_FORK_URL:-}" ]]; then
      if ensure_validator; then
        say "[*] surfpool up — PoC runs against forked mainnet state on :8899"
      else
        say "STATUS=PRECISA_FORK (harness references a fork/local validator; provide clone list / SOLANA_FORK_URL)"
        exit 0
      fi
    fi
    TS="$(date +%s)"; WORK="$(mktemp -d "/tmp/cachorro_sol_${TS}_XXXX")"
    trap 'rm -rf "$WORK"; cleanup_validator' EXIT
    cp -r "$TARGET" "$WORK/proj" 2>/dev/null || { say "STATUS=NAO_RODOU (cannot copy target)"; exit 0; }
    mkdir -p "$WORK/proj/tests"
    cp "$POC" "$WORK/proj/tests/$(basename "$POC")"
    cd "$WORK/proj"
    if command -v anchor >/dev/null 2>&1 && [[ -f Anchor.toml ]]; then
      say "[*] anchor test ..."
      if timeout 900 anchor test >>"$LOG" 2>&1; then
        if grep -qiE "passing" "$LOG" && ! grep -qiE "failing" "$LOG"; then say "STATUS=RODOU_E_PROVOU"; else say "STATUS=RODOU_NAO_PROVOU"; fi
      else say "STATUS=NAO_RODOU"; fi
    else
      say "STATUS=NAO_RODOU (anchor CLI or Anchor.toml missing; run manually with ts-mocha + local validator)"
    fi
    tail -40 "$LOG"
    ;;
  *)
    say "STATUS=NAO_RODOU (unknown PoC kind .$ext — supported: .mjs/.js zk|web3 harness, .ts anchor test)"
    ;;
esac
