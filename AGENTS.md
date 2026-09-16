# AGENTS.md — Cachorro-Solana (Devin-native, opencode legado)

Pipeline de auditoria de **programas Solana (Anchor/Rust, + zk)** para **bug bounty whitehat**
(Superteam / Immunefi / Sherlock). O **Devin CLI é o cérebro**: a skill
`.devin/skills/cachorro-sol` conduz o pipeline e narra cada passo em
`RUN_DIR/events.jsonl`, que a web UI renderiza ao vivo (feed "PACK MIND").
O caminho opencode (`opencode.json`, `/cachorro-sol`) segue disponível — o cérebro é
quem você conecta; este projeto não configura provider nem faz chamadas de API próprias.

Irmão do `cachorro-opencode` (EVM/Solidity). Mesma espinha (8 estágios, DEVIL, zero-falso-positivo),
corpo trocado pra Solana: static via cargo/clippy/cargo-audit + lint de padrões Anchor; PoC via
anchor-test / litesvm / `solana-test-validator --clone` / snarkjs (zk) — no lugar de Slither/Foundry.

## REGRAS DE USO (não-negociável)

1. **Só audite o que está autorizado.** Programa de bug bounty ativo, escopo definido. Auditar
   código é legal; **explorar programa em produção não é.** PoCs rodam só em **validador local /
   fork local / snarkjs local**; **NUNCA** envie transação de ataque pra mainnet nem mova fundo real.
2. **Validação humana obrigatória.** Entrega = "candidatos de PoC validados localmente, prontos pra
   revisão humana". **Não submeta nada** — quem submete é o humano, pelo canal oficial, só do que ele
   mesmo reproduziu.
3. **Research = contexto técnico, não pessoas.** Protocolo, lineage de fork, exploits parecidos,
   escopo do bounty, artefatos zk públicos. Nunca perfile desenvolvedores.
4. **Build de terceiro é perigoso.** `cargo build`/`anchor build` de um alvo desconhecido roda
   `build.rs` (comando arbitrário). Compile só alvo que você decidiu confiar; prefira análise
   estática + PoC que não precisa buildar o alvo (snarkjs, litesvm com programa já compilado).
5. **Ambiente isolado.** Rode em VM/container dedicado, sem carteiras/chaves de valor real.

Se algo conflitar com estas regras, pare e avise o operador.

## Como executar

Com Devin (motor principal — feed ao vivo na UI):
```
devin -p "/cachorro-sol https://github.com/ORG/programa"     # na raiz do repo
# ou pela UI: POST /api/scan spawna scripts/run-job-devin.sh
```

Dentro do opencode (legado):
```
/cachorro-sol https://github.com/ORG/programa
/cachorro-sol --program-id GYy4kM6...Ch7fFU mainnet
```
Não-interativo: `opencode run "/cachorro-sol <alvo>"`.
Primeiro conecte um modelo forte: `opencode auth login` (o analyzer/devil precisam de raciocínio bom).

## Pipeline (na ordem)

`RUN_DIR = cachorro-out/run_<timestamp>/`

| # | Etapa | Quem | Saída |
|---|-------|------|-------|
| 1 | FETCH | `scripts/fetch-target.sh` | `RUN_DIR/repo` ou `RUN_DIR/onchain` (TARGET_DIR) |
| 2 | STATIC | `scripts/static-scan.sh` | `RUN_DIR/static/` |
| 3 | RESEARCH | `@cachorro-researcher` | `RUN_DIR/research_context.md` |
| 4 | ANALYZE | `@cachorro-analyzer` (fan-out por cluster em alvo grande) | `RUN_DIR/findings.json` |
| 5 | DEVIL | `@cachorro-devil` | `RUN_DIR/survivors.json` |
| 6 | POC | `@cachorro-pocsmith` | `RUN_DIR/pocs/*` |
| 7 | REVIEW | `@cachorro-reviewer` (roda `poc-run.sh`) | `RUN_DIR/pocs_reviewed/`, `poc_review_report.md` |
| 8 | REPORT | `@cachorro-reporter` | `RUN_DIR/report_*.md` |

Etapas 1,2,7 são scripts determinísticos; as demais são subagentes que leem com `read`/`grep`,
pesquisam (`websearch`) e escrevem só em `cachorro-out/`.

## Superfície de bug Solana (o que o analyzer caça)
Missing signer / owner-check; account substitution & type confusion (has_one/constraint); PDA
seed/bump & reinit (`init_if_needed`); arbitrary CPI (program id não-pinado); introspecção de
instrução & atomicidade (sysvar instructions, índices hardcoded); close/rent theft; duplicate mutable
accounts; accounting/sign/cast/lamport math; SPL/token-2022 (mint↔vault↔ATA, transfer_checked,
hooks). **zk:** soundness do verificador on-chain, validação de root, double-spend de nullifier,
binding de extData/recipient, e — se `.zkey`/`.wasm` forem alcançáveis — soundness do circuito
(conservação de valor / range check / merkle-skip / mint binding) via snarkjs.

## Pré-requisitos
`./bootstrap-solana.sh` instala: rustup (cargo/rustc/clippy), Solana CLI (Anza/Agave), Anchor (avm),
snarkjs, cargo-audit. Confira com `bash scripts/doctor.sh`. Conecte o provider uma vez no opencode.
