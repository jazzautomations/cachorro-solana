# STATUS — cachorro-solana → submissão Colosseum Crypto World's Fair
Prazo: 12/10/2026 23:59 PT. Trilha Solana + gerais + Trilha Brasil (US$5k) + Darwin (inscrição até 10/10).
Pitch: auditor agêntico de programas Solana/Anchor que entrega PoC executável, não parecer.

## Semana final — verificado 06/10 (via Copilot /me + páginas oficiais)

**Portal Colosseum** — projeto existe como DRAFT "Cachorro", category Security Tools, country Brazil:
- [ ] **SUBMETER** — draft não compete
- [ ] tracks[] — vazio; marcar Solana (conferir se aceita multi-select pra EVM se port sair)
- [ ] website/liveProductLink → trocar ts.net por https://cachorro.jazzautomations.com.br
- [ ] acceleratorOptIn false → true ($250k, ≥10 vagas, winners entrevistados)
- [ ] pitchVideoLink + demoVideoLink + presentationLink + technicalDemoLink — todos vazios
- [ ] traction / marketValidation / competition / monetization / teamCommitment / teamLocationDetails — todos null
- [ ] twitterHandle/telegramHandle — vazios
- [ ] weekly update 1min (updates[] vazio) — "strongly recommended"
- [x] whatBuilding/whyNow/technologies/chainUsage/repoContext/externalContributors — preenchidos

**Empilháveis fora do portal** (mesma submission conta):
- [ ] Trilha Brasil Earn: superteam.fun/earn/listing/side-track-superteam-brasil — $5k USDG + $1k SolarEcoFund. DOIS passos: Colosseum + Earn. Deadline igual 12/10
- [ ] Darwin Startups (Florianópolis, capital markets on-chain) — inscrição ~10/10, framing = attestation como compliance artifact (PITCH.md §6)
- [x] Privacy Week — INSCRITO; resultado sai 10/10

**Multi-chain (decisão pendente):**
- Irmão EVM RESGATADO do jazz-oracle → ~/Projects/cachorro-evm/cachorro-opencode (estava em evidencegate/cachorro-opencode, não estava no GitHub)
- Pipeline EVM completo: fetch --address via cast etherscan-source, PoC forge fork (FFI off), mesma espinha 8 estágios — formato opencode, não integrado na engine/web
- foundry 1.8.5 + slither 0.11.6 instalados no jazz-oracle (ubuntu)
- **E2E EVM VALIDADO 06/10**: DeFiVulnLabs fetch+static (slither: 238 contratos, 686 findings) + forge PoC — exploit de reentrancy drenou EtherStore (treatment) e remediated bloqueou c/ "No re-entrancy" (control)
- **EVIDÊNCIA 6-CHAIN FEITA 06/10** (`~/evidencegate/chain-evidence/*.log` no jazz-oracle):
  mesmo exploit treatment/control (EtherStore reentrancy, `forge test --fork-url`) executado
  em fork de estado real de **ethereum, base, arbitrum, hyperliquid, tempo, robinhood** —
  [PASS] testReentrancy em todas, bloco real capturado por chain, remediated bloqueou ataque.
  Tempo mostrou gas divergente (Osaka) — diferença real de semântica detectada.
  → **marcar 7 tracks no portal**: Solana + as 6 EVM. Zcash fica fora (sem program layer).
- **HUNTS REPO REAL 06/10** (`chain-evidence/hunt_*.log`): fetch+slither em repos reais
  por chain — ethereum=Uniswap v4-core (120 contratos, 131 findings), tempo=tempo-std
  (39 contratos, 34 findings). base/aerodrome, arbitrum/gmx, hyperliquid/hyper-evm-lib e
  robinhood/nitro-contracts: fetch ok mas build upstream quebrado (stack-too-deep c/ via_ir,
  dep tree npm, remapping absoluto) — evidência = repo baixado + fork-exec já validado.
- Faltam pra aprofundar: ETHERSCAN_API_KEY (modo --address) — evidência extra, não bloqueante
- Regra: 1 submission por time. Tracks vazias sem integração real = só dilui

**COHORT SWEEP 06/10** — GitHub search enumerou 380 repos públicos criados pra edição
("colosseum"/"worlds fair" no nome/desc), 238 com código auditável (15 Rust, 3 Solidity,
153 TS, 38 JS, 27 Python, 2 Go). Sweep via `POST /api/scan mode=quick` no prod, throttle
90s, reports saem selados+anonimizados no feed — donos reivindicam grátis via /claim.
Wave 1 = 18 programas de verdade (Rust+Solidity). Lista: `~/cohort-juicy.json` no VPS.
Narrativa: "the pack audited the fair" — contador público de coverage + claims = traction
ao vivo durante o julgamento.

**Só o humano faz:** cliques do portal (login Colosseum), inscrição Earn, Darwin, gravar pitch/demo video, texto final da submission (Copilot não escreve texto pra colar — juiz lê como palavra do time).

## Hoje — 28/09 (onda web + infra)

- Attest real: run-job-devin.sh -> scripts/attest-run.sh ancora receipt
  pos-hunt; falha soft pra receipt pending quando a keypair ta seca
- cachorro-attest.timer (systemd horario) retenta receipts pending
- 5 receipts ANCORADOS no devnet (onre-sol 86d7ba5a / slot 505248105)
- /api/verify bugs: receipt ancorado nao tem campo memo (derivar do digest);
  path ?sig= recomputa payload canonico — verify agora prova memo on-chain
- scripts/tripwires-hunt.py: estagio SELF-AUDIT pre-anchor (port dos
  tripwires do pentest-agent v0.4.0) — promotion-without-proof, verificacao
  facil-demais, confirmation collapse, rubber-stamp devil, suspicious-clean
- semgrep pass no static-scan (corpus/semgrep-anchor.yml)
- /claim + /api/claim: OWNER-VERIFIED via assinatura da upgrade authority
- /api/scan/[id]/evidence: bundle .tar.gz (report+PoCs+events+receipt)
- web: visual Miami, /report vira certificado, pricing como servico,
  FAQ cetico, pass mobile, scoreboard de honestidade no ticker

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

## Labs (módulo novo — learn by hunting)
- `corpus/sealevel-attacks/` vendorado (33 lib.rs, variants insecure/secure/recommended por classe; fonte: coral-xyz/sealevel-attacks, Apache-2.0).
- `scripts/build-labs.mjs` → `web/data/labs.json`: 11 labs, copy autoral + código puxado do corpus (não drifta).
- `/labs` = currículo em 3 tiers (account model / CPI+PDA / lifecycle+sysvar); badges PACK-PROVEN nos labs que a engine já explorou de verdade.
- `/labs/[id]` = aula: conceito, "seen in the wild" (exploit real), code compare VULNERABLE/SECURE/RECOMMENDED, UNLEASH THE PACK → hunt preenchido, link pro run que provou.
- Roadmap de conteúdo: labs com alvo dedicado por classe (programa mínimo próprio por lab, não repo inteiro), trilhas além do Sealevel (share-inflation, oracle staleness, Token-2022), quiz/checklist "spot the bug" por lab.

## Gaps de plataforma (modo aveone-vertical)
- Modos de scan: quick/deep/full → POST /api/scan {mode} → runner ajusta AI timeout (40m/90m/2.5h) + guia de engine (top-1/top-3/todos survivors, devil 1 ou 2 passes).
- Dup-check: REVIEW faz websearch vs disclosures públicos + dedup interno vs runs anteriores do mesmo alvo. Finding dup vira prova sem valor de bounty.
- Alertas: emit-event dispara CACHORRO_ALERT_URL (webhook) em finding/verdict/poc crítico.
- Receipt staleness: fetch grava targetRev (git HEAD / sha do .so); `watch-targets.sh` + `cachorro-watch.timer` (6h) marcam stale → banner RECEIPT STALE + RE-HUNT na UI.
- Run FULL ao vivo: run_1789560920_177f62 em onre-finance/onre-sol ($100K, Immunefi).

## Deploy público (roadmap pós-demo)
Multi-tenant real fica pro launch: contas/wallet-login, run dir isolado por usuário, quota por plano, API key p/ CI. Pré-requisito duro: sandbox runsc antes de deixar estranho apontar alvo (build.rs arbitrário + exec de PoC = RCE na VPS). Rate limit já existe (3 concorrentes) mas é por IP anônimo — precisa de identidade.

## Billing (SOL-native)
- Planos: STRAY free (quick+deep, cap compartilhado) / HUNTER 0.5 SOL/mês (30 hunts, full) / ALPHA 2 SOL/mês (ilimitado + API). Store: `web/data/billing.json`.
- Fluxo: POST /api/billing/checkout {plan} → invoice {treasury, memo `cachorro:<plan>:<rand>`, lamports} → user paga com memo → POST /api/billing/verify {invoice, signature} confere via RPC getTransaction (jsonParsed: transfer ≥ amount pro treasury + memo presente, inner ixs inclusas) → emite `cch_*` key.
- Gate: POST /api/scan lê X-Cachorro-Key; FULL exige key paga (402), quota mensal por key (429). Anônimo = STRAY.
- Treasury: `.secrets/treasury.json` (gitignored), RPC via CACHORRO_RPC (devnet default p/ demo). Subir pra mainnet = env vars, zero código.

## Trustless proof surface (commit 85975b4)
- `/report/[id]` — página pública do relatório (renderer md próprio em `web/lib/markdown.tsx`), header com sha256 do report + link pra attestation.
- `/verify` — página trustless: cola attestation sha / report sha / tx sig → `GET /api/verify` re-executa a canonicalização (port do `attest/lib/canonical.js`) e confere memo on-chain via RPC. Verificação não depende de confiar no site.
- `/badge/[id].svg` — shield embutível p/ README (`HUNTED BY THE PACK · N proven findings`) linkando pro scan.
- `LiveFeedPreview` da landing agora faz polling `/api/scans`: se tem hunt rodando, mostra eventos REAIS ao vivo c/ link; senão, replay gravado.
- Stale receipts ganharam link WHAT CHANGED (compare auditedRev...liveRev no GitHub).
- Glitch CSS em finding/verdict critical no feed (`animate-glitch`).

## Fix: runner sobrevive restart do web (importante)
- POST /api/scan agora spawna via `systemd-run --collect --unit=cachorro-hunt-<id>` (envs HOME/PATH/CACHORRO_ROOT passadas via --setenv). Restart/deploy do cachorro-web não mata caçada em voo. Fallback setsid fora de systemd.
- BUG encontrado: run_1789560920_177f62 (onre-sol FULL) morreu no ANALYZE quando o web reiniciou — runner era filho do cgroup do serviço. Marcado error, relançado como run_1789568330_9453f2 (FULL, onre-sol $100K).
- Ops key mintada localmente p/ hunts internos: cch_640f…83b463 (plan pack, em billing.json).

## 28/09 — Service pivot + Miami pass (Devin, via tailscale)
- Attestation ligada de verdade: scripts/attest-run.sh roda pós-hunt (determinístico,
  nunca falha o run). Receipt pending = anchor-ready; mesmo digest sobe on-chain quando
  a keypair tiver saldo. BLOCKER: `97JjCwCNed53KNXxrokiWBWXoYbeHhDXZuUTN2tgEnd7`
  precisa ~0.2 SOL devnet (faucet 429 há dias). Depois: rodar attest-run.sh por run.
- Fix fetch-target.sh: HOME unbound matava clone (2 hunts perdidas).
- Design "miami phosphor": synthwave sun + grid animado, chroma, holo-frame, vapor
  strips. Verde fósforo segue identidade.
- /report/[id] virou audit certificate (verdict strip, ON-CHAIN RECEIPT card, findings
  index, badge embed). Entrega deixou de ser só .md.
- /pricing virou serviço: SNIFF free / THE HUNT 20 SOL-engagement / CONTINUOUS 6 SOL-mo
  / PAY-PER-PROOF pilot. Tabela "AUDIT INVOICE, COMPARED" ancora no $50k-500k da firma.
- Landing agora fala com o PROTOCOLO (buyer = quem segura TVL): threat-map board,
  "ship with a receipt", jornada em voz de comprador. Hunters seguem servidos (board,
  PoCs) mas como wedge, não como público.
- docs/BUSINESS-PLAN.md: plano completo com stats frescas (Immunefi: $6.5k competition
  vs $66k audit vs $24.5M exploit por critical; competitors AI todos EVM = Solana
  whitespace) + story arc do pitch.
