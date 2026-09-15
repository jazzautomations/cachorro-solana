# 08 — Verticalizing cachorro-solana onto the pentest-agent v3 spine

Data: 2026-09-15. Autor: análise do código-fonte real em
`/root/pentest-agent/pentest-agent-v3` (runtime 0.3.0) + `/root/pentest-agent/docs/{zero-day-framework-v3-rfc.md,gap-matrix-v3.md}`
cruzado com `/root/cachorro-solana/{AGENTS.md,STATUS.md,scripts,attest}`.

> **Tese.** O v3 já é a espinha certa: journal hash-chained, evidence vault por SHA-256,
> grafo de pesquisa tipado, gates de promoção `candidate→verified` que **exigem oráculo +
> negative-control + reprodução**, capability broker e sandbox runsc. Nada disso é
> específico de web. O que é específico de web são **poucos adapters e ~2 skills**. Cachorro
> não precisa reconstruir arquitetura — precisa **trocar o corpo (toolpacks) e vestir o
> moat (atestação on-chain) num hook do journal**. Isso é exatamente o que a RFC v3 chama de
> "Especialização sob demanda" (princípio 10) e "The agent is the folder" (princípio 1).

O diferencial "prova, não parecer" **já está codificado como política** na v3: um finding só é
reportável depois de `observation → signal → hypothesis → candidate → verified → reportable`,
e a transição `candidate→verified` (`research_graph.verify_primitive`) recusa evidência cujo
`verdict != "supports"`, e `add_evidence` recusa evidência sem `≥1 reprodução bem-sucedida`.
Ou seja: a v3 **já não deixa** um LLM promover opinião a finding. Cachorro herda isso de graça.

---

## 1. Runtime v3 — o que é reutilizável AS-IS para Solana

Todos os módulos abaixo são **chain-agnostic**. Confirmei lendo o fonte: eles operam sobre
bytes, hashes, IDs e nós tipados — nunca sobre HTTP/DOM.

| Módulo runtime | Reuso | Por quê / onde entra em Solana |
|---|---|---|
| `journal.py` (append-only, hash chain, `fcntl` lock, `fsync`) | **AS-IS** | É onde o **atestado on-chain** ancora (§4). `verify()` devolve `(count, head_hash)` = `journal_head`. |
| `evidence_vault.py` (content-addressed SHA-256, write-once `O_EXCL`, receipts) | **AS-IS** | Guarda os artefatos brutos do PoC: `program.so` compilado (`verified_build_digest`), logs de tx do litesvm, `.zkey`/witness do snarkjs, stdout do `cargo audit`. Cada um vira `sha256:...` imutável. |
| `research_graph.py` (SQLite tipado, `STATUSES`, `TYPE_TRANSITIONS`, gates) | **AS-IS** | Os node types (`asset/component/function/invariant/trust_boundary/hypothesis/experiment/evidence/primitive/chain/finding/contradiction`) mapeiam 1:1 em Solana (§3). Nenhum tipo novo é preciso: uma "missing owner-check" é `hypothesis→primitive`, um account = `asset`, uma instrução = `function`, um invariante de conservação de valor = `invariant`. |
| `scheduler.py` (portfolio search, penaliza repetição, reserva lane ortogonal) | **AS-IS** | Score `info_gain × impact × reachability × novelty × exploration ÷ (cost × risk × difficulty)` vale igual pra bug de Solana. |
| `capabilities.py` (broker: liga capability+adapter+side-effect+scope ao digest do plano) | **AS-IS** | Só precisa que os **manifests dos novos adapters declarem** as capabilities novas. O código do broker não muda. |
| `execution.py` — `TrustedProcessExecutor` (allowlist de binários pinados, rlimits) e `ContainerSandbox` (runsc, `--network none`, `--read-only`, `cap-drop ALL`, imagem por `@sha256:`) | **AS-IS** | **Este é o motor de PoC.** `cargo/clippy/cargo-audit/solana` rodam no executor confiável; o **exploit** (litesvm / anchor-test / snarkjs) roda no `ContainerSandbox` runsc. Bate exato com a regra 5 do AGENTS.md ("ambiente isolado") e com o "Gate runsc/PoC" do STATUS.md. |
| `oracles.py` — `binary_differential_oracle(treatment, control, minimum_successes)` | **AS-IS** | Coração do "prova, não parecer": treatment = tx de exploit no programa-alvo; control = mesma tx no **sibling seguro / build patcheado**. `supports` só se treatment reproduz ≥2× e control = 0. |
| `reporting.py` (late-bound: só lê finding `verified/reported/accepted` do grafo) | **AS-IS** | `render_json` → o `report.json` cujo `sha256` alimenta o payload do atestado. Report nunca vaza candidato não-provado. |
| `scope_signing.py` (Ed25519, `public_key_id`) + `campaign.py` (`_tree_hash` pin do bundle, `initialize`) | **AS-IS** | Assinatura, validade temporal e pin do framework valem igual. Só o **matcher** de scope precisa variante (§2). |
| `approvals.py` (approval Ed25519 ligado a agent+scope+capability+target+plan digest) | **AS-IS, e crítico** | É o gate para o side-effect `code_execution` de **build de terceiro** — `anchor build`/`cargo build` roda `build.rs` (comando arbitrário; AGENTS.md regra 4). Compilar alvo desconhecido **exige** approval assinado. |
| `dossier.py` (contexto seletivo por vizinhança causal do grafo) | **AS-IS** | Alimenta os agentes de raciocínio com só o subgrafo relevante. |
| `crash_triage.py`, `ablation.py`, `bundle_attestation.py` (SBOM/Ed25519), `secret_vault.py`, `untrusted.py`, `run_adapter.py`, `run_agent.py`, `run_fuzz.py`, `doctor.py`, `validate_bundle.py`, `package_bundle.py` | **AS-IS** | Triagem de crash, ablações, empacotamento ZIP determinístico, redação de segredo, envelope de dado não-confiável. `run_adapter.py` é o dispatcher onde os 4 adapters novos entram (§3.5). |
| `dns_guard.py` (pin/revalidação, deny de IP privado) | **AS-IS mas quase inerte** | Só usado pelo adapter `solana-program-dump` ao falar com um RPC público (host/pin do endpoint RPC). PoC local não usa rede. |

**Veredito runtime:** 0 reescrita. A plataforma inteira do §"Implementado" da gap-matrix
(scope assinado, broker, evidence/journal/graph, gates, dossier, oracle, reporting,
supply-chain) transfere sem tocar em Python. Fonte da arquitetura:
`zero-day-framework-v3-rfc.md` (2026-09-07), seções "Motor multi-round", "Grafo de pesquisa",
"Gates".

---

## 2. O único ajuste de runtime: variante Solana do matcher de scope

`scope.py` casa `host/wildcard/URL/CIDR/filesystem`. Solana precisa de **duas classes de alvo**
que não são URL:

1. **program-id** (base58, 32 bytes) + **cluster** (`mainnet-beta/devnet/testnet/localnet`).
2. **repo git + commit** (já cabe no matcher `filesystem`/URL existente).

**O que muda:** adicionar um `ScopeMatcher` variante que reconhece `solana:program:<base58>@<cluster>`
e `solana:repo:<url>@<commit>` como assets autorizados, e — **regra dura** — um **deny
implícito e não-removível de `side_effect=target_state_change` em qualquer cluster != localnet**.
Isso codifica em política (não em prompt) a regra 1 do AGENTS.md: "explorar programa em produção
não é [legal]". O `attest/` de cachorro já recusa `--cluster mainnet`; aqui a recusa sobe pra
camada de scope, antes de qualquer plano ser autorizado pelo broker.

Espelhar `toolpacks` `bug-bounty-program-packs/eternal-pack` num **`superteam-solana-pack` /
`immunefi-solana-pack`**: um recibo de scope curto que codifica as regras do programa de bounty
(escopo, cluster permitido = só leitura/dump, identificação de pesquisador se exigida). Padrão
idêntico ao `eternal` já existente em `programs/eternal/`.

`scope_signing.py`, validade temporal e `campaign.initialize` ficam **AS-IS**.

---

## 3. Agentes de raciocínio — reuso, variante, e o único descartado

A v3 traz 13 agent packages (`agents/*/manifest.yaml`). Regra da RFC: **"the agent is the
folder"** e **"prompt não é enforcement"** — então o que muda entre EVM/web e Solana é
majoritariamente o **`skills/*/SKILL.md`** (método) e as **`tools`** declaradas no manifest,
não o `runtime`.

### 3.1 Reutilizáveis AS-IS (só trocam dossier/skill textual, código e contrato intactos)

| Agente | Capabilities | Por quê reusa direto |
|---|---|---|
| `round-director` | `schedule.portfolio/branch/stop` | Escalonamento é agnóstico. |
| `hypothesis-builder` | `hypothesis.generate/diversify/dedupe` | Sem tools (`tools: []`), puro raciocínio sobre dossier. As "lentes" (missing signer, PDA reinit, arbitrary CPI…) entram como conteúdo do skill, não como código. |
| `experiment-designer` | `experiment.design`, `oracle.design`, `controls.design` | Já produz treatment-control + oracle + stopping rule. O skill `oracle-engineering` ganha exemplos Solana (§3.3), mas o agente é o mesmo. |
| `skeptic` | `evidence.refute`, `oracle.audit`, `evidence.counterreview` | Ataca o candidato, procura explicação benigna. Agnóstico. |
| `chain-synthesizer` | `chain.compose/validate/reject` | Compõe primitives só quando precondições fecham (ex.: `init_if_needed` reinit **+** missing owner-check → drain). Agnóstico. |
| `coverage-analyst` | `coverage.analyze/blocker` | Converte cobertura/trace em blocker + context request. Consome saída do fuzzer Solana (§3.4). |

### 3.2 Precisam de **variante Solana** (mesmo runtime/contrato, skill+tools novos)

| Agente base | Variante | Mudança |
|---|---|---|
| `context-modeler` | `context-modeler` (skill `selective-context` → **`anchor-account-model`**) | `source-browser` (ripgrep) e `history-reader` continuam AS-IS. O que muda é o **modelo de arquitetura**: em vez de data/control-flow web, modela **contas Anchor** (`#[account]`, `has_one`, `constraint`, `seeds`/`bump`), **trust boundaries** = signer/owner/PDA, **invariantes** = conservação de lamports/supply. Novo tool declarado: `anchor-static-scan` (§3.5). |
| `cartographer` | `solana-cartographer` | Superfície deixa de ser HTTP/HexStrike e passa a ser **on-chain**: enumerar instruções do IDL, contas do programa, CPIs de saída, ATAs/mints. Troca `http-observe`+`hexstrike-passive` por **`solana-program-dump`** (§3.5). Emite coverage delta = "instruções ainda não modeladas". |
| `patch-archaeologist` | `patch-archaeologist` (skill `variant-analysis` → **`sealevel-variants`**) | `git-history`+`source-browser` AS-IS. O skill ganha o catálogo `sealevel-attacks` (coral-xyz) como seed de variantes: cada padrão inseguro conhecido vira uma semente de hipótese. |
| `harness-factory` | `solana-harness-factory` | Loop compilar→rodar→coverage→estabilidade AS-IS. Troca a imagem/tool: em vez de libFuzzer C, gera harness **Trident/cargo-fuzz** para o entrypoint da instrução. `runtime_requirements: [docker, runsc]` já declarado. |
| `fuzz-campaign` | `solana-fuzz-campaign` | Idem: coordena campanha coverage-guided, mas o corpus é `Vec<AccountInfo>`/instruction data. Adapter `container-fuzz` AS-IS, só muda a imagem pinada. |
| `clean-room-reproducer` | AS-IS estrutural, **aponta o tool `sandbox-replay` para a imagem litesvm** | Replay do zero em ambiente pinado + controles + variância. O `sandbox-replay` reusa `ContainerSandbox`; a imagem passa a ser a do litesvm-poc (§3.5). |

### 3.3 O único **descartado / substituído**

`web-experiment-runner` (tool `sqli-differential`, capability `experiment.web.differential`)
**não** se reaproveita — é HTTP puro. Ele é o **template** do agente que o substitui:
**`solana-experiment-runner`** (capability `experiment.solana.poc`), que roda o adapter
`litesvm-poc`/`snarkjs` em vez do `sqli-differential`. O padrão de código
(`plan → execute_and_capture → oracle → normalized com classification "candidate_only"`) é
copiado quase linha-a-linha de `sqli_differential.py`, que já implementa repetições,
treatment/control, dedupe de assinatura e stopping rule. **É o melhor molde do repo** para os
adapters de PoC.

---

## 4. Novos toolpack adapters — o "corpo" Solana

Padrão obrigatório (visto em `source_search.py`, `git_history.py`, `sqli_differential.py`):
cada adapter tem `plan()→ExecutionPlan`, roda via `execute_and_capture` (broker autoriza →
executor roda → vault captura stdout/stderr → journal `adapter.completed`), e devolve
`AdapterOutcome{normalized}`. Registrar cada um em `toolpacks/registry.yaml` e no dispatcher
`run_adapter.py`. Toolpack novo proposto: **`solana-core`** (estático) + **`solana-dynamic`** (PoC).

### 4.1 `anchor-static-scan` — toolpack `solana-core`, status→implemented
- **O quê:** embrulha o já-existente `scripts/static-scan.sh` de cachorro (cargo/clippy/cargo-audit
  + lint de padrões Anchor estilo sealevel-attacks). É o equivalente Solana do `source-browser`.
- **Execução:** `TrustedProcessExecutor` (binários pinados `cargo`,`clippy`,`cargo-audit`,`rg`).
  Side-effect `workspace_write`, `mutates_target: false`. **Sem** `code_execution` (só análise;
  não compila o alvo → não dispara `build.rs`). Capability nova `static.anchor.scan`.
- **Saída normalizada:** as "8 seções de lint / 55 entradas" que o smoke E2E do STATUS.md já
  produz, agora viram **observation nodes** no grafo (não findings). Consumido por
  `context-modeler`/`patch-archaeologist`.

### 4.2 `solana-program-dump` — toolpack `solana-core`, status→implemented
- **O quê:** leitura on-chain: `solana account <pubkey>`, `solana program dump <id> out.so`,
  `getAccountInfo` RPC, fetch de IDL. Alimenta `solana-cartographer`/`context-modeler` quando o
  alvo é um program-id (não repo).
- **Execução:** `TrustedProcessExecutor` com `solana` pinado; side-effect `network_read`,
  `mutates_target: false`, `network: true` → `dns_guard.pin` do endpoint RPC. Capability
  `surface.solana.dump`. **Nunca** assina/envia tx (não há keypair no plano).
- **Saída:** `program.so` (→ evidence vault, vira `verified_build_digest` de referência), lista
  de contas, IDL parseado como **envelope não-confiável** (`untrusted.py`).

### 4.3 `litesvm-poc` — toolpack `solana-dynamic`, status→implemented — **a joia**
- **O quê:** executa o exploit num **litesvm in-process** (10–100× mais rápido que
  `solana-test-validator`, backend default do Anchor v1.0.0 desde abr/2026 — [LiteSVM docs, solana.com](https://solana.com/docs/tools/litesvm), [Anchor LiteSVM](https://www.anchor-lang.com/docs/testing/litesvm)),
  **dentro** do `ContainerSandbox` runsc. Alternativas equivalentes no mesmo adapter:
  `solana-test-validator --clone <id> --url mainnet-beta --reset` (fork read-only de estado real
  — [QuickNode, fork to localnet](https://www.quicknode.com/guides/solana-development/accounts-and-data/fork-programs-to-localnet)),
  `anchor test`, ou `BanksClient`. Combo ideal: **litesvm como payload rodando dentro do runsc** —
  VM rápida in-process + isolamento forte de kernel.
- **Treatment/control (o oráculo):** treatment = tx de exploit contra o programa-alvo; **control =
  a mesma tx contra o sibling seguro / build com o guard ligado**. Resultado boolean por repetição
  → `binary_differential_oracle`. `supports` só se o exploit reproduz e o control resiste. Isso
  satisfaz **literalmente** o gate `verified primitive → requer oracle + negative control +
  reprodução` da RFC.
- **Execução:** `ContainerSandbox` (imagem pinada `@sha256:`, `--network none`, `--read-only`,
  `cap-drop ALL`, `runtime runsc`). Side-effect `code_execution` → **exige approval Ed25519**
  (`approvals.py`) por causa do `build.rs`. Capability `experiment.solana.poc`,
  `mutates_target: false` (muta só o estado do validador local, nunca o alvo real).
- **Saída:** logs de tx + estado antes/depois → evidence vault; `normalized.classification =
  candidate_solana_poc | no_deterministic_signal`, `candidate_only: true`. O nó de evidência
  gerado por `add_evidence` (que exige `≥1 reprodução`) é o que permite `verify_primitive`
  promover `candidate→verified`.

### 4.4 `snarkjs` — toolpack `solana-dynamic`, status→implemented
- **O quê:** soundness de circuito zk quando `.zkey`/`.wasm` são alcançáveis (superfície
  destacada no AGENTS.md e no Veilo). `snarkjs groth16 verify` / geração de witness forjado.
- **Treatment/control:** treatment = witness que viola conservação de valor / range / merkle-skip /
  mint-binding **é aceito** pelo verificador; control = witness honesto. Oracle binário idêntico.
- **Execução:** Node ESM (padrão já usado no `attest/`), **networkless**, dentro do runsc.
  Capability `experiment.zk.soundness`, side-effect `code_execution`, approval exigido.
- **Saída:** proof/witness → vault; verdict → oracle.

### 4.5 Wiring
- `toolpacks/registry.yaml`: dois packs novos (`solana-core`, `solana-dynamic`) com os 4 adapters,
  `selection_rule` = "prefira PoC diferencial reproduzível a volume de lint".
- `runtime/run_adapter.py`: 4 subcomandos novos (`anchor-static-scan`, `solana-program-dump`,
  `litesvm-poc`, `snarkjs`), cada um instanciando o adapter e roteando pro agente dono
  (`context-modeler`, `solana-cartographer`, `solana-experiment-runner`, `solana-experiment-runner`).
- Manifests declaram as capabilities novas; o broker (AS-IS) passa a autorizá-las porque estão no
  manifest — nenhuma exceção no código.

---

## 5. Onde a atestação on-chain engancha no journal hash-chained (o moat²)

Cachorro já tem `attest/` (payload canônico
`{schema, report_sha256, audited_commit, verified_build_digest, journal_head, target, cluster,
created_at}` → sha256 → memo SPL no devnet, verify recomputa). **O campo `journal_head` já existe
no schema do atestado — falta só conectá-lo ao journal real da v3.** O gancho é **bidirecional**:

1. **Journal → memo (ancorar a proveniência local no chain).** Ao fim da campanha,
   `reporting.render_json` materializa só findings `verified` → calcula `report_sha256`.
   `RoundJournal.verify()` devolve `(count, head_hash)`; `head_hash` **é** o `journal_head`. O
   `verified_build_digest` sai do evidence vault (o `program.so` do `litesvm-poc`). Monta-se o
   payload canônico e ancora-se no devnet via `attest/bin/attest.js anchor`. Só o digest
   (`cachorro:v1:<digest>`) vai on-chain; o JSON fica no recibo local. → **a cabeça da cadeia de
   hash local vira imutável e datada publicamente.**

2. **Memo → journal (ancorar o recibo on-chain de volta na cadeia).** Depois da tx confirmar,
   **append de um evento novo no journal**: `attestation.anchored` com
   `{attestation_digest, signature, cluster, explorer_url, report_sha256, journal_head_anchored}`.
   Como o journal é hash-chained, esse registro **encadeia a assinatura on-chain de volta** no log
   tamper-evident. Resultado: o report tem proveniência provada **nos dois sentidos** — a cadeia
   local aponta pro chain, o chain aponta pra cadeia. Alterar o report depois quebra `report_sha256`;
   alterar o journal quebra o hash-chain; alterar qualquer um dos dois diverge do memo devnet. **Esse
   é o moat que nem Trident Arena nem Sec3 X-Ray têm** (§7).

**Implementação:** módulo runtime novo `attestation_anchor.py` (ou extensão de
`bundle_attestation.py`, que já faz Ed25519/SLSA-style): funções `build_payload(campaign) →
canonical dict`, `anchor(payload) → subprocess pro attest.js`, `record(campaign, tx) → journal
append`. ~80 linhas, sem tocar em `journal.py`/`reporting.py` (usa as APIs públicas `verify()`,
`findings()`). Nota: `attest/` hoje trava no faucet devnet (429 por IP nesta VPS — STATUS.md);
rodar quando liberar ou financiar a keypair manualmente. O digest/verify já tem 5/5 unit tests.

---

## 6. O menor M1 que empurra **UM** finding provado pela espinha inteira

**Alvo:** `coral-xyz/sealevel-attacks` — já smoke-testado em cachorro (STATUS.md: "12s, 8 seções
de lint / 55 entradas"). **É o alvo perfeito para M1** porque cada lição ships um par
**`insecure/` + `secure/` do mesmo programa** — ou seja, o **negative control já vem pronto no
repo**, satisfazendo o gate de promoção sem precisar sintetizar um patch. Escolher **uma** lição
(ex.: `0-signer-authorization` ou `2-owner-checks`), que é a mais didática e determinística.

**Slice vertical (cada passo toca uma peça real da espinha):**

1. **Scope** — `campaign.initialize` com recibo assinado (variante §2) para o repo
   `sealevel-attacks@<commit>`, cluster=`localnet`, `target_state_change` deny. Repo de ensino →
   autorização trivial e legal (AGENTS.md regra 1).
2. **Static** — adapter `anchor-static-scan` (§4.1) → observation nodes no grafo (o lint que
   cachorro já produz, agora tipado).
3. **Context + Hypothesis** — `context-modeler` (variante) modela as contas + `hypothesis-builder`
   emite **uma** hipótese com falsificador: "a instrução X aceita `authority` sem checar signer/owner
   → transfere autoridade/fundos".
4. **Experiment** — `experiment-designer` define treatment (tx maliciosa no programa `insecure/`) +
   **control (mesma tx no `secure/`)** + oracle (estado de autoridade mudou / lamports moveram).
5. **PoC** — adapter `litesvm-poc` (§4.3) compila os dois programas (approval Ed25519 pelo
   `build.rs`), roda o exploit no runsc: **treatment passa, control falha** →
   `binary_differential_oracle = supports`.
6. **Promoção** — `add_evidence` (exige ≥1 reprodução) cria o evidence node; `verify_primitive`
   promove `candidate → verified`. **Aqui o "prova, não parecer" acontece em código.**
7. **Refutação + clean-room** — `skeptic` faz counterreview; `clean-room-reproducer` re-executa do
   zero em ambiente pinado e registra variância.
8. **Report** — `reporting.render_json` → `report.json` + `report_sha256` (só o finding verificado).
9. **Atestação** — `attestation_anchor` (§5): payload com `report_sha256` + `journal_head` →
   memo devnet → evento `attestation.anchored` de volta no journal.

**Entregável M1 = 1 finding, com:** cadeia de hash local verificável, PoC diferencial que roda em
runsc, recibo on-chain no devnet, e verify que recomputa tudo. **É o pitch inteiro do Colosseum
num único corte vertical** — e roda em minutos porque litesvm é in-process.

**Ordem de implementação (menor caminho):** (a) instalar runsc (§8); (b) `anchor-static-scan`
adapter (reusa script existente — 1 dia); (c) `litesvm-poc` adapter clonando o molde de
`sqli_differential.py` (2–3 dias, é o item de risco); (d) variante de scope Solana (0.5 dia);
(e) `attestation_anchor` (0.5 dia, reusa `attest/`); (f) skills textuais das variantes de agente
(dossier, não código). Os agentes de raciocínio, journal, vault, graph, broker, oracle, reporting,
sandbox, approvals **não são tocados**.

---

## 7. Honestidade competitiva — por que isto não é redundante

- **Sec3 X-Ray** = estático open-source. Cachorro produz **PoC executável diferencial**, não alerta
  de padrão. Categoria diferente.
- **Trident (Ackee, Solana Foundation)** = fuzzer Anchor maduro, achou críticos em Kamino/Marinade/
  Wormhole ([Ackee](https://ackee.xyz/blog/introducing-trident-the-first-open-source-fuzzer-for-solana-programs/), 2024→2026).
  **Não competir com o fuzzer — consumi-lo:** `solana-harness-factory`/`solana-fuzz-campaign` (§3.2)
  chamam Trident/cargo-fuzz como toolpack sob o broker. Trident é um sensor; cachorro é o oráculo +
  proveniência.
- **Trident Arena** (multi-agent AI, [Ackee](https://ackee.xyz/blog/trident-arena-multi-agent-ai-security-for-solana-programs/), 2026)
  reporta 70% de detecção de crit/high vs 37% do Opus 4.6, FP 26,56% vs ~86% de LLM puro. **É o
  competidor sério.** Diferença honesta de cachorro: Arena entrega **relatório**; cachorro entrega
  **relatório + PoC que roda no seu validador local + atestado on-chain que qualquer um verifica sem
  confiar em nós**. O moat não é "achar mais bug" (a v3 até admite que fuzzer específico compete com
  agente — Big Sleep/Project Zero) — é **não-repúdio verificável do achado provado**. Cachorro deve
  se posicionar como a **camada de prova e proveniência**, não como "o melhor detector".
- **CertiK AI Auditor / Solanaizer / HexStrike-AI / T3MP3ST** = harness/detector. A gap-matrix já
  trata harness como commodity mediada. O moat de cachorro é a **espinha oracle-driven + atestação**,
  exatamente o que a RFC v3 permite reivindicar publicamente ("framework híbrido, multi-round e
  oracle-driven") e o que a atestação on-chain acrescenta por cima.

Fonte competidores: [Solana Security Toolbox 2026 (dev.to)](https://dev.to/ohmygod/the-solana-security-toolbox-in-2026-a-practitioners-guide-to-fuzzing-static-analysis-and-5h7f),
[Ackee Trident Arena](https://ackee.xyz/blog/trident-arena-multi-agent-ai-security-for-solana-programs/) (2026).

---

## 8. Pré-requisito bloqueante: runsc/gVisor

A gap-matrix v3 (2026-09-07) diz explícito: **"Docker está disponível, mas `runsc`/gVisor não.
Execução de harness/fuzzer fica bloqueada em vez de cair silenciosamente para `runc`."** O
`ContainerSandbox.command()` **hardcoda `--runtime runsc`** e recusa imagem sem `@sha256:`. O
STATUS.md de cachorro lista isto como o próximo gate ("Gate: runsc/PoC"). **Nada dinâmico
(litesvm-poc, snarkjs, clean-room-reproducer, harness/fuzz) roda até `runsc` estar instalado na
Hermes.**

- **Instalar:** `runsc` é runtime OCI; registrar em `/etc/docker/daemon.json` (`"runtimes":
  {"runsc": {"path": "/usr/local/bin/runsc"}}`) → `systemctl restart docker` → validar
  `docker run --runtime=runsc --rm hello-world`. gVisor intercepta syscalls em user-space (kernel
  emulado), superfície muito menor que container comum — é exatamente o modelo de ameaça de "rodar
  código não-confiável de terceiro" (build.rs, PoC). Ref: [gVisor intro](https://gvisor.dev/docs/architecture_guide/intro/),
  [gVisor para untrusted workloads (2026)](https://oneuptime.com/blog/post/2026-02-09-gvisor-sandboxed-containers/view),
  [4 ways to sandbox untrusted code, 2026](https://dev.to/mohameddiallo/4-ways-to-sandbox-untrusted-code-in-2026-1ffb).
- **Fallback consciente:** se runsc não instalar a tempo na Hermes, rodar a etapa dinâmica no
  **Zo/VPS** (CLAUDE.md §2: trabalho pesado vai pro Zo, não pro contexto) — mas **sem cair pra
  `runc`**, que a v3 recusa por design (gap-matrix: "bloqueada em vez de cair silenciosamente").

---

## 9. Resumo de esforço

| Camada | Reescrita |
|---|---|
| Runtime (journal, vault, graph, scheduler, broker, execution/sandbox, oracle, reporting, scope-signing, approvals, dossier…) | **0** (AS-IS) |
| Scope matcher | variante pequena (program-id/cluster + deny mainnet) |
| Agentes de raciocínio (director, hypothesis, experiment, skeptic, chain, coverage) | **0 código** (só dossier) |
| Agentes com variante (context, cartographer, patch-arch, harness, fuzz, clean-room) | skill+tools no manifest, runtime AS-IS |
| `web-experiment-runner` | substituído por `solana-experiment-runner` (molde copiado de `sqli_differential.py`) |
| Adapters novos | 4: `anchor-static-scan`, `solana-program-dump`, `litesvm-poc`, `snarkjs` |
| Atestação | `attestation_anchor.py` (~80 linhas) + wire do `journal_head` real no `attest/` existente |
| Infra | **instalar runsc** (bloqueante) |

O trabalho é **integração e um adapter de PoC**, não arquitetura — coerente com o veredito da
gap-matrix: "não ficou faltando outro prompt secreto; o que resta é integração, isolamento
operacional e evidência experimental."

---

### Fontes (acessadas 2026-09-15)
- Código v3: `/root/pentest-agent/pentest-agent-v3/{runtime,agents,toolpacks,schemas}` + `docs/{zero-day-framework-v3-rfc.md,gap-matrix-v3.md}` (corte 2026-09-07).
- Cachorro: `/root/cachorro-solana/{AGENTS.md,STATUS.md,scripts,attest}`.
- [LiteSVM — solana.com/docs/tools/litesvm](https://solana.com/docs/tools/litesvm); [Anchor LiteSVM](https://www.anchor-lang.com/docs/testing/litesvm) (Anchor v1.0.0 default, abr/2026).
- [solana-test-validator --clone (QuickNode)](https://www.quicknode.com/guides/solana-development/accounts-and-data/fork-programs-to-localnet).
- [Ackee Trident](https://ackee.xyz/blog/introducing-trident-the-first-open-source-fuzzer-for-solana-programs/); [Trident Arena (2026)](https://ackee.xyz/blog/trident-arena-multi-agent-ai-security-for-solana-programs/); [Solana Security Toolbox 2026](https://dev.to/ohmygod/the-solana-security-toolbox-in-2026-a-practitioners-guide-to-fuzzing-static-analysis-and-5h7f).
- [gVisor intro](https://gvisor.dev/docs/architecture_guide/intro/); [gVisor untrusted workloads 2026](https://oneuptime.com/blog/post/2026-02-09-gvisor-sandboxed-containers/view); [4 ways to sandbox untrusted code 2026](https://dev.to/mohameddiallo/4-ways-to-sandbox-untrusted-code-in-2026-1ffb).
