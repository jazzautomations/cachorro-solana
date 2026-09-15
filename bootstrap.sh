#!/bin/bash
# ============================================
#   Cachorro (opencode) — Bootstrap Kali/Debian
#   Instala opencode + Foundry + Slither. Idempotente.
#   NAO configura provider — voce faz isso com '/connect' dentro do opencode.
# ============================================
set -uo pipefail
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
log(){ echo -e "${CYAN}[*]${NC} $*"; } ; ok(){ echo -e "${GREEN}[+]${NC} $*"; } ; warn(){ echo -e "${YELLOW}[!]${NC} $*"; }

SUDO=""; [[ "$(id -u)" -ne 0 ]] && SUDO="sudo"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${CYAN}${BOLD}\n  Cachorro/opencode — bootstrap (Kali/Debian)\n${NC}"

# 1) Sistema
log "1/4 Pacotes de sistema..."
if command -v apt-get >/dev/null 2>&1; then
  $SUDO apt-get update -y
  # pipx: jeito correto de instalar apps Python CLI no Kali (PEP 668 / externally-managed)
  $SUDO apt-get install -y --no-install-recommends git curl ca-certificates unzip pipx python3
  pipx ensurepath >/dev/null 2>&1 || true
  export PATH="$HOME/.local/bin:$PATH"
  ok "Pacotes de sistema OK"
else
  warn "apt-get nao encontrado — instale git, curl, pipx manualmente."
fi

# 2) opencode
log "2/4 opencode..."
if command -v opencode >/dev/null 2>&1; then
  ok "opencode ja instalado: $(opencode --version 2>/dev/null | head -1)"
else
  curl -fsSL https://opencode.ai/install | bash
  export PATH="$HOME/.opencode/bin:$HOME/.local/bin:$PATH"
  command -v opencode >/dev/null 2>&1 && ok "opencode instalado" \
    || warn "opencode nao no PATH ainda — abra um shell novo. (alt: npm i -g opencode-ai)"
fi

# 3) Foundry
log "3/4 Foundry (forge/cast/anvil)..."
export PATH="$HOME/.foundry/bin:$PATH"
if command -v forge >/dev/null 2>&1; then
  ok "Foundry ja instalado: $(forge --version | head -1)"
else
  curl -L https://foundry.paradigm.xyz | bash
  "$HOME/.foundry/bin/foundryup" || foundryup || warn "rode 'foundryup' manualmente"
  command -v forge >/dev/null 2>&1 && ok "Foundry instalado" || warn "forge nao no PATH — export PATH=\"\$HOME/.foundry/bin:\$PATH\""
fi

# 4) Slither + solc (via pipx — isolado, sem brigar com o PEP 668)
log "4/4 Slither + solc-select (pipx)..."
if command -v slither >/dev/null 2>&1; then
  ok "slither ja instalado"
else
  pipx install slither-analyzer || warn "falha no slither via pipx"
fi
if command -v solc-select >/dev/null 2>&1; then
  ok "solc-select ja instalado"
else
  pipx install solc-select || warn "falha no solc-select via pipx"
fi
if command -v solc-select >/dev/null 2>&1; then
  solc-select install 0.8.25 >/dev/null 2>&1 || true
  solc-select use 0.8.25 >/dev/null 2>&1 || true
  ok "solc 0.8.25 configurado (solc-select use <versao> pra trocar)"
fi

chmod +x "$SCRIPT_DIR/scripts/"*.sh 2>/dev/null || true

echo ""
echo -e "${GREEN}${BOLD}============================================${NC}"
echo -e "${GREEN}${BOLD}  AMBIENTE PRONTO${NC}"
echo -e "${GREEN}${BOLD}============================================${NC}"
echo ""
echo -e "${YELLOW}Confira:${NC}  bash scripts/doctor.sh"
echo ""
echo -e "${YELLOW}1) Conecte SEU provider/modelo (uma vez) dentro do opencode:${NC}"
echo -e "   ${CYAN}opencode${NC}   ->  ${CYAN}/connect${NC}   (ex: Ollama local, OpenRouter, Groq, etc.)"
echo -e "   (Este projeto NAO configura provider — a escolha e sua.)"
echo ""
echo -e "${YELLOW}2) (Opcional) fork de mainnet pra PoCs que precisam de estado real:${NC}"
echo -e "   ${CYAN}export FORK_URL='https://eth-mainnet.alchemy.com/v2/...'${NC}"
echo ""
echo -e "${YELLOW}3) Caçar — abra o opencode na pasta do projeto e rode:${NC}"
echo -e "   ${CYAN}/cachorro https://github.com/ALVO/contratos${NC}"
echo ""
