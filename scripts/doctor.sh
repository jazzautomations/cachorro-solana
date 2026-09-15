#!/bin/bash
# Checa o ambiente do cachorro-solana. Sem IA.
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$HOME/.avm/bin:$HOME/.foundry/bin:$PATH"
ok=0; miss=0
chk(){ printf "%-14s " "$1"; if command -v "$1" >/dev/null 2>&1; then echo "OK  $($1 --version 2>&1 | head -1)"; ok=$((ok+1)); else echo "MISSING"; miss=$((miss+1)); fi; }
echo "=== cachorro-solana doctor ==="
chk git; chk node; chk cargo; chk rustc; chk solana; chk anchor; chk snarkjs; chk cargo-audit; chk cargo-clippy
echo "--- optional (EVM cross-use) ---"; chk forge; chk slither
echo "=== provider (opencode) ==="
opencode auth list 2>&1 | tail -3 || echo "opencode not on PATH"
echo "=== $ok present / $miss missing ==="
[[ $miss -gt 0 ]] && echo "Install missing: rustup (cargo/rustc/clippy), release.anza.xyz (solana), 'avm install latest' (anchor), 'npm i -g snarkjs', 'cargo install cargo-audit --locked'."
