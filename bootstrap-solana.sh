#!/usr/bin/env bash
# Bootstrap do cachorro-solana num Debian/Ubuntu/Kali. Instala o toolchain Solana/Anchor/zk.
# NAO conecta provider — faca isso uma vez no opencode (`opencode auth login`).
set -e
echo "== cachorro-solana bootstrap =="

if ! command -v cargo >/dev/null 2>&1; then
  echo "[*] Rust (rustup)..."; curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal
fi
export PATH="$HOME/.cargo/bin:$PATH"
rustup component add clippy 2>/dev/null || true

if ! command -v solana >/dev/null 2>&1; then
  echo "[*] Solana CLI (Anza/Agave)..."; sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
fi
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

if ! command -v cargo-audit >/dev/null 2>&1; then
  echo "[*] cargo-audit..."; cargo install cargo-audit --locked || true
fi

if ! command -v snarkjs >/dev/null 2>&1; then
  echo "[*] snarkjs (npm -g)..."; npm i -g snarkjs || true
fi

if ! command -v anchor >/dev/null 2>&1; then
  echo "[*] Anchor via avm (compila, demora)..."
  cargo install --git https://github.com/coral-xyz/anchor avm --locked || echo "[~] avm install falhou — anchor e' opcional (build/test); analise estatica + snarkjs funcionam sem ele."
  command -v avm >/dev/null 2>&1 && avm install latest && avm use latest || true
fi

echo "[+] Feito. Cheque: bash scripts/doctor.sh"
