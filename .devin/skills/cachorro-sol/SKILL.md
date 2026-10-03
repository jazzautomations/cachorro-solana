---
name: cachorro-sol
description: "Auditoria de programa Solana pra bug bounty — Devin é o motor. Arg: <github-url|--program-id PUBKEY [cluster]> [RUN_DIR=<id>]"
---

# /cachorro-sol — Devin dirige a matilha

Você é o **motor do cachorro-solana**: conduz o pipeline de auditoria de ponta a ponta.
Antes de qualquer coisa, leia `AGENTS.md` do repo e siga as REGRAS DE USO sem exceção
(só alvo autorizado/bounty; PoC só em validador local/litesvm/fork local; NUNCA tx de
ataque na mainnet; entrega = candidatos validados pra revisão humana — você não submete nada).

## Contrato de observabilidade (o produto é isso)

A web UI lê DOIS arquivos dentro de `RUN_DIR` e renderiza ao vivo:

1. `status.json` — transições de estágio. A cada início/fim de estágio:
   `bash scripts/jset.sh RUN_DIR/status.json "stage=<stage>" "stage.<stage>=running"` … `"stage.<stage>=done"`
   (estágios: `fetch static research analyze devil poc review report`; use `skipped`/`error` quando couber)
2. `events.jsonl` — o feed do que a matilha está pensando. **Emita um evento a cada passo
   significativo**, não só no fim do estágio:
   `bash scripts/emit-event.sh RUN_DIR <stage> <agent> <kind> "<texto curto, 1-3 linhas>"`

   kinds: `action` (começou a fazer X), `thought` (raciocínio/hipótese), `obs` (achou algo no código),
   `finding` (candidato confirmado), `verdict` (devil/oráculo decidiu), `poc` (resultado de PoC),
   `note` (contexto/aviso), `error`.

   agent = `devin-<estágio>` (ex: `devin-analyzer`). O texto é o que o humano lê — escreva
   como um auditor pensando em voz alta, em pt-BR técnico, citando arquivo:linha reais.

## Execução

Resolva os argumentos:
- Se a mensagem trouxer `RUN_DIR=<path>` com fetch/static já feitos → TARGET_DIR=`RUN_DIR/repo`
  (ou `RUN_DIR/onchain`), vá direto pro estágio 3.
- Senão: `RUN_DIR=cachorro-out/run_$(date +%Y%m%d_%H%M%S)` e rode 1-2 primeiro.

1. **FETCH** — `bash scripts/fetch-target.sh --repo <url> RUN_DIR` ou `--program-id <PUBKEY> <cluster> RUN_DIR`. Bytecode-only? avise num `note` que sem fonte a análise fica rasa.
2. **STATIC** — `SKIP_CLIPPY=1 bash scripts/static-scan.sh TARGET_DIR RUN_DIR` (pule se não houver fonte).  `static/semgrep.json` (corpus/semgrep-anchor.yml hits) feeds the same pass.
3. **RESEARCH** (`devin-researcher`) — spec em `prompts/researcher.md`. Primeiro `bash scripts/context-deep.sh TARGET_DIR RUN_DIR` — OSINT mecânico: lockfile→OSV CVEs, program ids→on-chain status, fork hints, surface map (`RUN_DIR/context/`). Depois produza `RUN_DIR/research_context.md`: tipo de protocolo, lineage de fork, exploits conhecidos na família, superfície. Emita `thought` com o modelo mental do protocolo e `obs` com o que mudou sua prioridade. **Contexto errado mata a caçada** — se os fatos mecânicos contradizem o que o repo diz ser, o repo está mentindo, não o fato.
4. **ANALYZE** (`devin-analyzer`) — spec em `prompts/analyzer.md` + atlas `prompts/vuln-atlas.md`. **Stack routing** — detecte e carregue o atlas certo:
   - `*.sol` genérico → `prompts/evm-atlas.md` (EthL1/Base/Arbitrum/Robinhood-Orbit)
   - Tempo signals (TIP-20 precompiles `0x20C0…`, `0x76` envelope, `tempo` deps, `moderato`) → TAMBÉM `prompts/tempo-atlas.md`
   - Hyperliquid signals (HyperEVM chain id 998/999, CoreWriter `0x3333…`, agent wallets, vaults) → TAMBÉM `prompts/hyperliquid-atlas.md`
   - Zcash signals (librustzcash, zebra, zaino, zallet, ZIP-321, unified addresses, `zcashd`, darksidewalletd) → `prompts/zcash-atlas.md` — é superfície de wallet/tooling, não drain de contract
   - agentes/LLM no repo (prompts, tool-call, MCP, `/api/chat`) → seção AI-attack do vuln-atlas.md
   - site (`RUN_DIR/site/`) → o BRIDGE adaptado do runner; PoC = curl reproduzível
   Mesma espinha sempre: cita código real, mata o que o código nega, `detected-not-proven` quando a toolchain falta — nunca finge. Mapeie TODA a superfície de instruções antes de caçar. Alvo grande (>15 handlers)? Faça fan-out com `run_subagent` por cluster (access-control / CPI-DeFi / zk / token-math) — cada subagente lê o atlas. Escreva `RUN_DIR/findings.json` no schema do spec. Emita `thought` por cluster varrido e `finding` por candidato real.
5. **DEVIL** (`devil-advocate`) — spec em `prompts/devil.md`. Tente MATAR cada finding relendo o código real. Sobreviventes → `RUN_DIR/survivors.json`. Emita `verdict` por finding (survived/killed + motivo em 1 linha).
   Antes do devil ler: `bash scripts/check-citations.sh TARGET_DIR RUN_DIR` — verifica mecanicamente que `file` existe e `code_snippet` grepa literal no clone. Finding que falha morre na hora com `hallucination: true` — o modelo nunca leu aquele código. O devil só gasta tempo em citações que batem.
6. **BRIDGE** (`devin-bridge`) — web2↔web3 surface. Se o repo contém superfície off-chain (frontend/, api/, server/, keeper/bot/, scripts de deploy, .env.example, vercel/next config, program IDs hardcoded, chaves de signing, endpoints de webhook, oracle wiring): mapeie as fronteiras de confiança — o que um comprometimento web2 vira on-chain. Emita `RUN_DIR/bridge_map.md` + findings em `findings.json` com `"domain": "web2-bridge"`, `"tier": "amarelo"` por default (verde só se executável localmente). Classes: authority reassignment via API, keeper-key single point, admin-op sem timelock, env/secret vazando programId ou seeds, webhook→instruction sem auth, oracle path fora do programa. SwissBorg perdeu $41M nessa camada — é onde scans não olham. Se não houver superfície web2 no repo: `note` dizendo e pule.
7. **POC** (`devin-pocsmith`) — spec em `prompts/pocsmith.md`. **Não tente PoC de tudo**: pegue os **top 3 survivors** por severidade (critical > high > …) e vá fundo neles. PoC em `RUN_DIR/pocs/`: prefira **surfpool** (`surfpool start --no-tui --no-studio` → fork mainnet lazy em :8899), **litesvm/Rust** ou `solana-test-validator` local; nunca build com `build.rs` de terceiro não-auditado — se o alvo exigir build não-confiável, marque o estágio `skipped` com `note` explicando o gate M2 (runsc) em vez de compilar às cegas. Bound each attempt — a PoC that needs >20min of build/debug gets noted and skipped, not nursed.
   **Toolchain pivot rule**: if the target won't build after **2 bounded attempts** (old Anchor, edition2024 crates, yanked deps — a real-world situation), do NOT keep fighting Cargo. Either (a) write the PoC as a `.mjs`/web3.js script against surfpool with the program deployed from the cloned binary/IDL, or (b) mark the finding `detected-not-proven` with the toolchain note and move on. A build loop that kills the session is a failed hunt — a marked-unproven finding is honest data.
8. **REVIEW** (`devin-reviewer`) — spec em `prompts/reviewer.md`. Rode cada PoC via `bash scripts/poc-run.sh`, classifique VERDE/AMARELO/VERMELHO por reprodutibilidade, salve em `RUN_DIR/pocs_reviewed/` + `poc_review_report.md`. Emita `poc` com o resultado e números (lamports drenados, erro do controle). **Dup-check por finding VERDE**: (a) `websearch` por `"<projeto> <classe-da-vuln>" bug bounty|disclosed|immunefi|exploit` — se já foi reportado/pago publicamente, marque `dup: true` no finding e anote a fonte no report (finding continua válido como prova, mas perde valor de bounty — diga isso); (b) `grep` a classe/arquivo nos `findings.json`/`report_*.md` de runs anteriores do mesmo alvo em `cachorro-out/runs/*/` — dedup interno. Emita `obs` com o resultado do dup-check. Budget each PoC: if a single repro/build takes >20min, note it, mark skipped, move to the next survivor — never let one PoC eat the session.

9. **REPORT** (`devin-reporter`) — spec em `prompts/reporter.md`. `RUN_DIR/report_<id>.md` pronto pra revisão humana + `bash scripts/jset.sh RUN_DIR/status.json "reportFile=report_<id>.md" "stage=done" "status=done"`. **Write the report in English** — judges and buyers read EN; the live feed can stay PT.

## Disciplina

- **Zero falso positivo** vale mais que finding inflado. Se a classe está mitigada, diga
  explicitamente num `obs` — honestidade é o pitch.
- Cite código REAL (arquivo:linha). Nunca invente função/handler.
- PoCs rolam fundos falsos em validador local — se algo pedir mainnet, PARE e reporte.
- Se um estágio quebrar: `stage.<x>=error`, `emit-event ... error`, e continue se o erro
  for local (ex: PoC falhou mas findings seguem). `status=error` só se o pipeline morrer.
