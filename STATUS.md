# STATUS — cachorro-solana → submissão Colosseum Crypto World's Fair
Prazo: 12/10/2026 23:59 PT. Trilha Solana + gerais + Trilha Brasil (US$5k) + Darwin (inscrição até 10/10).
Pitch: auditor agêntico de programas Solana/Anchor que entrega PoC executável, não parecer.

## Feito
- 15/09: git init do repo; decisão: casca web NOVA em `web/` reaproveitando o visual vaporwave do jazzweb3audit (globals.css + tailwind + Terminal/AgentFlow/Navbar). NÃO reviver jazzweb3audit (backend divergente, mixed-content).
- Engine: scripts/fetch-target.sh (--repo | --program-id) e scripts/static-scan.sh funcionam sem IA. opencode com credencial `oci` (api).

## M0 — FEITO 15/09
- `web/`: Next 15 + Tailwind (visual vaporwave transplantado do jazzweb3audit), 1 tela: input program-id/repo → `POST /api/scan` → `scripts/run-job.sh` (fetch + static) → AgentFlow com polling 2s → relatório estático (summary tiles + seções de lint colapsáveis + conta on-chain). Jobs em `cachorro-out/runs/<id>/status.json`. Sem DB, só filesystem.
- No ar na Hermes: systemd `cachorro-web.service` :8790, **só pela tailnet** → http://100.83.230.76:8790
- Smoke E2E: coral-xyz/sealevel-attacks (repo, 12s, 8 seções de lint / 55 entradas) e Tokenkeg… (program-id mainnet, 1s, conta on-chain + static skipped). Limite de 3 jobs simultâneos (429) validado.
- Estágios RESEARCH/ANALYZE/DEVIL/POC/REVIEW aparecem como `pending-ai` — entram no M1.

## Próximo
1. M1: estágios com IA (ANALYZE/DEVIL/POC) via opencode headless dentro do job.
2. M2: programa Anchor de atestado on-chain (hash do relatório) — integração Solana real.
3. 3 alvos auditados com commits datados na janela; 1 bug real.
4. Última semana: vídeo 3min + demo 3min + GTM. Submissão em inglês.
