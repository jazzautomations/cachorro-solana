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

## M2 — Atestado on-chain — FEITO 15/09 (o moat)
- `attest/`: recibo verificável de auditoria ancorado no Solana **devnet**. Sem programa Anchor próprio (avm não instalado) → usa **SPL Memo** (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`), nada pra deployar.
- Payload canônico `{schema, report_sha256, audited_commit, verified_build_digest, journal_head, target, cluster, created_at}` → `sha256` dos bytes canônicos = digest da atestação. Só o digest vai on-chain como `cachorro:v1:<digest>`; JSON completo fica no recibo local.
- CLI Node ESM (`@solana/web3.js` 1.99.0 pinado; sem build step): `attest anchor <report.json>` (airdrop→memo tx→recibo em `receipts/<hash>.json`) e `attest verify <sig|hash>` (recomputa digest do recibo, busca a tx no devnet, compara o memo → PASS/FAIL). Devnet hardcoded; `--cluster mainnet` recusado. Keypair throwaway em `attest/.devnet-keypair.json` (gitignored).
- Provado: 5/5 unit tests (canonicalização + lógica de verify contra tx mockada); `fetchMemoTx` validado contra tx real de memo no devnet (parse do log OK). ⚠️ **anchor ao vivo bloqueado hoje** pelo faucet devnet (429 "airdrop limit today" por IP nesta VPS, RPC e CLI). Rodar quando o faucet liberar (ou financiar manual): `solana airdrop 1 $(solana address -k attest/.devnet-keypair.json) --url https://api.devnet.solana.com` e então `node attest/bin/attest.js anchor attest/fixtures/sample-report.json`.

## Próximo
1. M1: estágios com IA (ANALYZE/DEVIL/POC) via opencode headless dentro do job.
2. **Gate: runsc/PoC** — rodar os PoCs de auditoria em sandbox isolada (gVisor/runsc) via litesvm/solana-test-validator, provar 1 bug real reproduzível; amarrar o `report.json` (report_sha256/journal_head) ao recibo on-chain de ponta a ponta.
3. Anchor ao vivo assim que o faucet devnet liberar (comando acima) → assinatura real + explorer URL no pitch.
4. 3 alvos auditados com commits datados na janela; 1 bug real.
5. Última semana: vídeo 3min + demo 3min + GTM. Submissão em inglês.
