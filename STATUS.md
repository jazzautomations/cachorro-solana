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

## M1 — Verticalização da espinha v3 — FEITO 15/09 (o "framework fodido")
- **`engine/`**: espinha pentest-agent **v3 vendorizada** (journal hash-chain, evidence vault SHA-256, research graph tipado, capability broker, oracle determinístico, promotion gates, reporting). Valida (`python3 engine/runtime/validate_bundle.py engine` → VALID, 14 agents) e **39/39 unit tests v3 passam** dentro de `engine/`. Edições só de relocação (2 fixtures apontavam `/root/pentest-agent` → `/root/cachorro-solana`; lista de agentes +`solana-experiment-runner`); runtime AS-IS, 0 reescrita.
- **Toolpack Solana** (`engine/toolpacks/adapters/`, mesmo contrato de `common.py`): `anchor-static-scan` (embrulha `scripts/static-scan.sh`, `workspace_write`, não builda alvo), `solana-program-dump` (`scripts/fetch-target.sh`, `network_read`, RPC DNS-pinado, nunca assina tx), `litesvm-poc` (PoC diferencial Rust como **processo confiável** em corpus que NÓS compilamos — sem runsc/validador/faucet no M1). Registrados em `registry.yaml` (packs `solana-core`/`solana-dynamic`) e no dispatcher `run_adapter.py`.
- **UM finding pela espinha real** (`engine/runtime/solana_round.py`, corpus `spike/vault/` = par vulnerável/fixed self-authored): static→observation → hipótese/experimento (prosa scriptada) → `litesvm-poc` ×2 → `binary_differential_oracle` **supports** (treatment 2/2 drenou **5.000.000.000 lamports** → vault 0; control 0/2 bloqueado com `Custom(1)=ERR_INCORRECT_AUTHORITY`, vault intacto) → `add_evidence` → `verify_primitive` (candidate→verified) → clean-room → `add_finding`. Journal (5 records) e graph verificados independentemente. **A gate roda de verdade — LLM não promove opinião a finding.**
- **Atestação ancorada no journal head real**: `journal.verify()` head `1a44a53f…` → `attest digest` → digest `24037a60d04d…`, memo `cachorro:v1:24037a60…`, recibo local `attest/receipts/<digest>.json` (`status: pending_anchor_faucet_blocked`); evento `attestation.anchored` encadeado de volta no journal (head final `b94cbb55…`). Envio devnet ao vivo = faucet-bloqueado (mesmo 429), digest é anchor-ready. Doc: `docs/ENGINE.md`.
- **Live vs scriptado**: runtime (journal/vault/graph/oracle/gate/report/attest) = código v3 real; só a **prosa dos agentes de raciocínio** é scriptada (provider de modelo ao vivo = M2).
- **Scoped-down conscientemente**: (a) sem `CommandProvider` ao vivo — próximo passo; (b) `litesvm-poc` só em corpus confiável (alvo de 3º = runsc + `code_execution` + approval no M2); (c) adapter `snarkjs` adiado; (d) anchor devnet ao vivo espera faucet.

## M1.5 — Devin como motor + feed ao vivo — EM ANDAMENTO 16/09
- **Devin CLI é o cérebro do pipeline** (substitui opencode nos estágios de IA): skill `.devin/skills/cachorro-sol/SKILL.md` porta o pipeline do `opencode.json`; roda headless via `devin -p --permission-mode bypass`.
- **Observabilidade = o produto**: `scripts/emit-event.sh` → `RUN_DIR/events.jsonl` (kind: action/thought/obs/finding/verdict/poc/note/error) + `scripts/jset.sh` (status.json atômico, extraído do run-job.sh). UI renderiza `AgentFeed.tsx` ("PACK MIND") com o raciocínio ao vivo — o que cada agente está pensando/achando.
- `scripts/run-job-devin.sh`: fetch+static determinísticos → `devin -p` toca RESEARCH→REPORT. Fallback: `CACHORRO_ENGINE=static` ou devin ausente → runner antigo. Timeout 7200s (IA: `CACHORRO_AI_TIMEOUT`, padrão 3600s).
- `prompts/vuln-atlas.md`: atlas de vulns Solana (T1: signer/owner, substitution, CPI arbitrária, PDA/reinit, introspection, accounting/share-inflation, close; T2: oracle/staleness, remaining_accounts, upgrade-auth, Token-2022, gov; T3: DoS, ordering, zk) com exploits reais como referência (Wormhole sysvar, Cashio collateral, Crema flash-loan, Mango oracle).
- **E2E provado 16/09**: `run_1789547662_fca40c` (sealevel-attacks via UI) — fetch+static 5s, devin assumiu, feed ao vivo mostrando researcher/analyzer pensando.
- **Pendente**: rodada completa até REPORT; runsc (M2) pra build de 3º; Trident + solana-verify; faucet devnet p/ atestado ao vivo.

## Próximo
1. **Live model `CommandProvider`** guiando os agentes via `agent_runner.py` (substitui a prosa scriptada) — torna o round agent-driven.
2. **Alvo real de bounty** (Superteam/Immunefi) pela mesma espinha, com o scope receipt codificando as regras do programa.
3. **Gate M2: runsc/PoC de 3º** — rodar `litesvm-poc` de alvo não-compilado-por-nós em sandbox isolada (gVisor/runsc, `code_execution` + approval Ed25519 por causa do `build.rs`).
3. Anchor ao vivo assim que o faucet devnet liberar (comando acima) → assinatura real + explorer URL no pitch.
4. 3 alvos auditados com commits datados na janela; 1 bug real.
5. Última semana: vídeo 3min + demo 3min + GTM. Submissão em inglês.

## Bounty board (módulo novo)
- `scripts/update-bounties.mjs` indexa bounties: scrape do `/bug-bounty/` da Immunefi (RSC payload server-rendered), + página de escopo de cada programa Solana p/ extrair repos in-scope (rankeados: solana-first, evm/docs por último, cap 8). Saída: `web/data/bounties.json` (175 programas, 12 Solana, ~$6.2M).
- `/bounties` = board expansível (filtro SOLANA/ALL, badges KYC/PoC REQUIRED, HUNT por repo → `/?target=<repo>#hunt` prefaz o ScanInput via `?target=`).
- Landing: seção LIVE BOUNTY BOARD com top 6 + link pro board.
- Refresh: `cachorro-bounties.timer` diário 06:00 UTC.
- Fontes futuras: Superteam Earn (earnapi não resolve DNS desta VPS — conferir), Cantina, HackenProof, Sherlock. Script já é multi-source: falha de fonte mantém dados velhos, não derruba.
