#!/bin/bash
# Static analysis for a Solana/Anchor/Rust target. Deterministic, no AI.
# Uso: bash scripts/static-scan.sh <target_dir> <run_dir>
# Produz: <run_dir>/static/{cargo_audit.txt, clippy.txt, grep_lints.txt, zk_surface.txt, summary.txt}
set -uo pipefail
TARGET="${1:?target dir}"; RUN="${2:?run dir}"
OUT="$RUN/static"; mkdir -p "$OUT"
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"

echo "[*] cargo-audit (dep CVEs)..."
if command -v cargo-audit >/dev/null 2>&1; then
  ( cd "$TARGET" && cargo audit 2>&1 ) | tee "$OUT/cargo_audit.txt" >/dev/null || true
  echo "[+] cargo audit -> $OUT/cargo_audit.txt"
else
  echo "[~] cargo-audit ausente (cargo install cargo-audit --locked)" | tee "$OUT/cargo_audit.txt" >/dev/null
fi

echo "[*] clippy (best-effort; anchor programs often need 'anchor build' toolchain)..."
if [[ "${SKIP_CLIPPY:-0}" == "1" ]]; then
  echo "[~] clippy pulado (SKIP_CLIPPY=1)" | tee "$OUT/clippy.txt" >/dev/null
elif command -v cargo >/dev/null 2>&1; then
  ( cd "$TARGET" && timeout "${CLIPPY_TIMEOUT:-90}" cargo clippy --workspace --all-targets 2>&1 ) | tee "$OUT/clippy.txt" >/dev/null || echo "[~] clippy timed out/failed (anchor toolchain needed) — grep lints still valid" | tee -a "$OUT/clippy.txt" >/dev/null
  echo "[+] clippy -> $OUT/clippy.txt (may be empty if it doesn't compile standalone)"
fi

echo "[*] grep-based Anchor/Solana lint heuristics..."
SRC="$TARGET"
{
  echo "### UncheckedAccount / AccountInfo (verify each is validated) ###"
  grep -rInE "UncheckedAccount|AccountInfo<" "$SRC" --include=*.rs 2>/dev/null | grep -v "/tests/" | head -80
  echo; echo "### init_if_needed (reinit risk) ###"
  grep -rInE "init_if_needed" "$SRC" --include=*.rs 2>/dev/null | head -40
  echo; echo "### CPI invoke/invoke_signed (check program id pinned) ###"
  grep -rInE "invoke_signed?\(|CpiContext::new" "$SRC" --include=*.rs 2>/dev/null | head -60
  echo; echo "### instruction introspection / sysvar instructions (atomicity) ###"
  grep -rInE "load_instruction_at_checked|get_instruction_relative|load_current_index|sysvar::instructions|instructions_sysvar" "$SRC" --include=*.rs 2>/dev/null | head -40
  echo; echo "### numeric casts (as u64 / as i64 / as u128 — overflow/sign) ###"
  grep -rInE " as (u64|i64|u128|usize|u32)\b" "$SRC" --include=*.rs 2>/dev/null | grep -viE "test|len\(\)" | head -60
  echo; echo "### .unwrap()/.expect()/panic in handlers (DoS) ###"
  grep -rInE "\.unwrap\(\)|\.expect\(|panic!" "$SRC" --include=*.rs 2>/dev/null | grep -v "/tests/" | head -40
  echo; echo "### close = / lamport moves ###"
  grep -rInE "close *=|try_borrow_mut_lamports|\*\*.*lamports|system_program::transfer" "$SRC" --include=*.rs 2>/dev/null | head -40
  echo; echo "### Signer / has_one / constraint (presence census) ###"
  grep -rcInE "Signer<|has_one *=|constraint *=" "$SRC" --include=*.rs 2>/dev/null | head -40
} > "$OUT/grep_lints.txt" 2>&1
echo "[+] grep lints -> $OUT/grep_lints.txt"

echo "[*] zk surface detection..."
{
  echo "### zk / crypto modules present? ###"
  grep -rIlE "groth16|alt_bn128|merkle|nullifier|Poseidon|verify.*proof|Groth16Verifier" "$SRC" --include=*.rs 2>/dev/null
  echo; echo "### verifying-key constants ###"
  grep -rInE "vk_ic|VK_IC|verifyingkey|verification_key|declare_id" "$SRC" --include=*.rs 2>/dev/null | head -20
} > "$OUT/zk_surface.txt" 2>&1
echo "[+] zk surface -> $OUT/zk_surface.txt"

{
  echo "STATIC SCAN SUMMARY ($(date))"
  echo "target: $TARGET"
  echo "rust files: $(find -L "$SRC" -name '*.rs' -not -path '*/tests/*' 2>/dev/null | wc -l)"
  echo "instruction handlers (pub fn): $(grep -rInE '^\s*pub fn ' "$SRC" --include=*.rs 2>/dev/null | wc -l)"
  echo "Accounts structs: $(grep -rInE '#\[derive\(Accounts\)\]' "$SRC" --include=*.rs 2>/dev/null | wc -l)"
  echo "UncheckedAccount/AccountInfo: $(grep -rInE 'UncheckedAccount|AccountInfo<' "$SRC" --include=*.rs 2>/dev/null | grep -vc '/tests/')"
  echo "zk modules: $(grep -rIlE 'groth16|alt_bn128|nullifier' "$SRC" --include=*.rs 2>/dev/null | wc -l)"
} > "$OUT/summary.txt"
cat "$OUT/summary.txt"
echo "[+] Static analysis in: $OUT"
