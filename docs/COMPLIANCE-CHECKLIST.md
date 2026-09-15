# Cachorro — Compliance & Production Checklist (finalizado)

> Checklist único e acionável para levar o **cachorro-solana** ao ar / submeter ao
> Colosseum. Destila o brief `docs/research/06-compliance-web3.md` (delta web3) + os
> itens ainda-relevantes do `PRODUCT_LAUNCH_CHECKLIST.md` (web2/SaaS).
>
> Legenda: 🔴 bloqueante para "ir ao ar"/submeter · 🟡 importante, corrige rápido · 🟢 maturidade
>
> ⚠️ **Não é parecer jurídico.** Todo item 🔴 legal é rascunho para revisão humana (advogado
> cripto BR) antes de valer como definitivo. O agente gera o rascunho, não publica como definitivo.
> Última curadoria: **15/09/2026**. Web tratada como dado não-confiável (rail do CLAUDE.md).

**Duas naturezas que reescrevem o risco:** (1) o cachorro é **ferramenta ofensiva** — o output
é "como quebrar código alheio", então o risco nº1 não é LGPD, é **legalidade da atividade** e
**disclosure**; (2) ele **executa código-alvo não-confiável** (`build.rs` = RCE contra nós).
Enquanto for ferramenta interna com entrega para revisão humana, boa parte do compliance de SaaS
pago **não dispara ainda** — dispara ao (a) abrir a dashboard para terceiros, (b) cobrar, (c) publicar relatórios.

---

## 1. 🔴 Autorização & safe-harbor whitehat — "só audite o que pode auditar"

A regra que mais pode dar cadeia (BR: Lei 12.737/2012 "Carolina Dieckmann"; EUA: CFAA). A defesa
é autorização explícita + escopo. Elevar de comentário do AGENTS.md para **gate no pipeline**.

- [ ] 🔴 Só rodar em alvo com autorização ativa: (a) bug bounty público com escopo publicado
      (Immunefi/Sherlock/Cantina/Superteam), OU (b) código do cliente sob contrato de audit assinado,
      OU (c) OSS auditado estaticamente + PoC **só em fork/validador local**. (Regra #1 do AGENTS.md)
- [ ] 🔴 **PoC nunca sai do local.** Zero tx de ataque para mainnet/testnet público; nada que mova
      fundo real. Manter o `--cluster mainnet` recusado como **invariante testado**.
- [ ] 🟡 Registrar a autorização **por run** (link do bounty+escopo, ou contrato, ou "OSS/estático")
      no `status.json`/journal — vira prova de boa-fé e alimenta o atestado.
- [ ] 🟡 Entender o **SEAL Whitehat Safe Harbor**: acordo on-chain que autoriza intervir **durante
      exploit ativo** (resgate → devolução ≤72h). **NÃO** cobre teste de rotina nem bounty. Relevante
      só se o cachorro algum dia fizer *rescue*, e para checar o que o alvo autorizou.
- [ ] 🟢 Allowlist/denylist de programas/escopos conhecidos para não rodar fora de escopo por engano.

## 2. 🔴 Regras de bounty (Immunefi/Sherlock/Superteam) — não violar a plataforma

O pipeline **já** é conforme por design (PoC em fork local) — o item é *manter* e *documentar*.

- [ ] 🔴 Immunefi proíbe testar em mainnet OU testnet público (ban permanente). PoC deve **forkar**
      o estado (Solana: `solana-test-validator --clone` / litesvm / BanksClient) perto do bloco de
      submissão, com contas, permissões, capital, sequência de tx e perda máxima. **Nosso formato já
      é esse → é selling point:** o PoC sai no formato que a plataforma exige.
- [ ] 🔴 **Submissão é do humano**, pelo canal oficial, só do que ele reproduziu. O agente não submete.
- [ ] 🟡 Não divulgar publicamente antes do fix. Atestar **só o digest sha256** (compatível com
      embargo); considerar atestar só depois do fix ou sem revelar o target on-chain (o *fato* do
      atestado de um alvo específico já sinaliza).
- [ ] 🟡 KYC/elegibilidade: quem recebe bounty (humano/PJ) passa KYC; excluir residentes sancionados.
- [ ] 🟢 Respeitar a Common Vulnerability Exclusion List — não gastar PoC em classe já rejeitada.

## 3. 🔴 Disclosure coordenada — runbook do bug REAL

O AGENTS.md cobre "não submeta"; falta o runbook do achado verdadeiro não-coberto por bounty.

- [ ] 🔴 Escrever e publicar uma **Coordinated Disclosure Policy** própria (`security.txt` + página):
      canal privado primeiro; janela de embargo (default 90d ISO/IEC 29147, mais curta se há fundos em
      risco ativo); sem detalhes/PoC públicos até o fix deployado.
- [ ] 🔴 **Nunca** transformar achado em ação on-chain ("drenar para provar", "front-run para proteger")
      fora do SEAL Safe Harbor e sem autorização. Exploit ativo + alvo com Safe Harbor → seguir Safe
      Harbor; senão → disclosure privada.
- [ ] 🟡 Solana-specific: crítico de core → `security@solana.com`; programa de terceiro → canal do
      projeto ou plataforma de bounty.
- [ ] 🟡 Evidência com timestamp imutável (journal hash-chained + atestado on-chain provam *quando* se
      soube, sem revelar *o quê*).
- [ ] 🟢 Template de report alinhado ao formato Immunefi/Sherlock (`@cachorro-reporter` já esboça).

## 4. 🔴 Disclaimer "não é auditoria formal" + limitação de responsabilidade

Sem isto, um cliente hackeado que confiou no cachorro vem atrás do Felipe. IA erra e gera
falso-negativo silencioso → precisa de blindagem mais forte que audit humana.

- [ ] 🔴 Disclaimer em **todo relatório** e nos Termos, linguagem clara: "Análise **assistida por IA**,
      entregue **as-is**, **sem garantia** de completude. **Não é auditoria formal** nem substitui
      revisão humana." + "A ausência de findings **não** significa código seguro." + exclusão de
      garantias implícitas + **limitação de responsabilidade** por perdas diretas/indiretas.
- [ ] 🔴 Enquadrar honestamente: **"gerador de candidatos de PoC verificáveis para revisão humana"**,
      não "auditoria que aprova o deploy". (rail #1: não superprometer.)
- [ ] 🟡 Explicitar o **escopo NÃO coberto** (lógica off-chain, governança social, chaves comprometidas,
      risco econômico de mercado).
- [ ] 🟡 O **atestado on-chain carrega/linka o disclaimer** — não pode ser lido como selo/seguro. Ele
      prova apenas "esta análise, deste commit, produziu este relatório". (crítico p/ contexto
      Darwin/capital markets: atestado mal-enquadrado pode parecer garantia regulatória.)

## 5. 🔴 Key management do signer da atestação

O atestado é o moat; a chave que assina é a raiz de confiança. Se vazar, qualquer um forja atestados
"do cachorro". Hoje: keypair throwaway devnet gitignored (ok p/ hackathon, insuficiente p/ produção).

- [ ] 🔴 **Chave de atestação ≠ chave com fundos.** O signer nunca custodia valor.
- [ ] 🔴 **Nunca commitar o keypair** (`.devnet-keypair.json` já gitignored) e nunca reusar em mainnet
      ou contexto de valor.
- [ ] 🔴 **Separar o host do signer do host que roda código-alvo não-confiável** — build.rs malicioso
      (§7) na mesma máquina do keypair = roubo do signer. (mitigação que fecha o furo do build.rs.)
- [ ] 🟡 Signer de produção → HSM/hardware wallet/KMS/signer isolado (não `.json` na VPS); rotação
      documentada + **pubkey publicada** (identidade pública do produto, qualquer um verifica).
- [ ] 🟢 Atestado com timestamp/nonce + ligação ao `journal_head` (já no payload) — anti-replay/backdate.

## 6. 🔴 Execução segura de código-alvo não-confiável (build.rs = RCE)

A ameaça técnica mais aguda **contra nós**. Regra #4 do AGENTS.md → controles concretos. Em 2026
deixou de ser teórico (arrayref v0.3.10 comprometido em 20/08/2026 executou malware no `cargo build`).

- [ ] 🔴 `cargo build`/`anchor build` de alvo desconhecido = **RCE** (build.rs + proc-macros rodam
      código arbitrário em build time, com as permissões do processo cargo).
- [ ] 🔴 **Preferir o caminho no-build:** estático (cargo/clippy sobre source sem executar) + PoC com
      programa já compilado (litesvm + `.so` baixado da chain) ou snarkjs (zk). Buildar só alvo que o
      operador **decidiu confiar**.
- [ ] 🔴 Quando buildar for inevitável, **sandbox obrigatória**: VM/container descartável ou gVisor/runsc
      (Gate do STATUS.md), **sem rede**, **sem segredos montados** (sem keypair do signer, sem credencial
      do provider), FS efêmero, usuário sem privilégio. (cargo não recusa build scripts — isolamento é do SO.)
- [ ] 🟡 `cargo-audit`/`cargo-deny` nas deps do alvo E nas nossas — camada, não solução (pega vuln já
      no RustSec, não build.rs malicioso ainda não reportado).
- [ ] 🟢 Fixar toolchain (`rust-toolchain.toml`), `--locked`/`--frozen`, revisar diff do `Cargo.lock` antes de buildar.

## 7. 🟡 Confiabilidade de RPC (fetch on-chain e clone de estado)

RPC público é rate-limited e não é para produção; RPC comprometido pode **falsear o estado** auditado.

- [ ] 🟡 Não depender só de `api.mainnet-beta.solana.com`. Produção → RPC dedicado (Helius/Triton/QuickNode)
      com fallback. (Já sentimos 429 no faucet devnet por IP nesta VPS.)
- [ ] 🟡 **Tratar resposta de RPC como dado não-confiável**: validar account data/program-id; cross-check
      em ≥2 RPCs para dado crítico que entra no atestado.
- [ ] 🟡 Timeout/retry/backoff em toda chamada de RPC e faucet; job falha limpo e reportável, não trava.
- [ ] 🟢 Pin de slot: clonar estado de um slot fixo e **registrar o slot** no relatório e atestado (repro).

## 8. 🟡 Isolamento e retenção do material do alvo

Vazar `cachorro-out/` = vazar 0-day. Cruza confidencialidade (LGPD) com a natureza ofensiva.

- [ ] 🟡 `cachorro-out/runs/<id>` **nunca** servido publicamente/indexável; isolamento por job; sem link
      adivinhável. (Hoje protegido por estar só na tailnet — manter ao expor.)
- [ ] 🟡 Retenção definida + **purga** de PoC de bug ainda-não-corrigido (guardar 0-day parado é passivo);
      cifrar em repouso o que contém PoC funcional.
- [ ] 🟢 Multi-cliente: separação estrita entre alvos de clientes diferentes (isolamento de *findings*).

---

# Web2 ainda-relevante (herança do PRODUCT_LAUNCH_CHECKLIST, adaptado)

## 9. 🔴 Entidade legal / CNPJ / identificação do responsável

- [ ] 🔴 **PJ formalizada (CNPJ)** antes de faturar ou assinar bounty/contrato de audit. Ferramenta
      que "entrega exploits" operada por PF = exposição pessoal direta ao Felipe. PJ = escudo + NFS-e.
- [ ] 🟡 Razão social/CNPJ/endereço/e-mail de contato no rodapé da dashboard e nos Termos (ao expor além da tailnet).
- [ ] 🟡 NFS-e para qualquer auditoria cobrada (item 1.05 LC 116/2003). Prêmio de hackathon/bounty tem
      tratamento fiscal próprio — confirmar com contador. Só dispara ao cobrar.

## 10. 🔴 Política de Privacidade da dashboard (dispara ao abrir p/ terceiros)

- [ ] 🔴 Declarar o que coleta: e-mail de login, **program-id/URL de repo colados** (revela o alvo →
      tratar como confidencial), IP, logs de job. Finalidade específica de cada dado ("rodar a auditoria
      que você pediu", não "melhorar o serviço").
- [ ] 🟡 Base legal, retenção de `cachorro-out/runs/<id>`, direitos do titular (LGPD 15 dias),
      transferência internacional (modelo/opencode em provider fora do BR = transferência).
- [ ] 🟡 **Confidencialidade do alvo é o dado mais sensível.** Prometer não-divulgação + a infra cumprir
      (isolamento por run, sem index público).

## 11. 🔴 Aviso de uso de IA (transparência) — duplamente crítico

- [ ] 🔴 Divulgar que a análise é **gerada por IA (opencode + modelo)** e que findings/PoCs **exigem
      verificação humana** antes de qualquer ação. (promessa central do AGENTS.md, tem que estar no produto.)
- [ ] 🟡 Dizer qual modelo/provider processa o código do alvo (o alvo **sai** da nossa máquina → ponto
      de privacidade + confidencialidade; se confidencial, avisar que trafega para LLM de terceiro).
- [ ] 🟢 Rótulo "conteúdo gerado por IA" + limitações (tendência EU AI Act 2026; barato agora, caro retrofitar).

## 12. 🟡 Trust Center / página de segurança

"Casa de ferreiro não tem espeto de pau" — para empresa de segurança é prova, não nice-to-have.

- [ ] 🟡 Descrever: isolamento de execução (VM/container/runsc), que **não buildamos alvo não-confiável
      sem sandbox**, que PoCs só rodam em validador local, que não guardamos chaves de valor, retenção do alvo.
- [ ] 🟡 **Disclosure próprio** (`security.txt` + e-mail para reportar bug *no cachorro*).
- [ ] 🟢 Se B2B: SOC2-lite / descrição de controles.

## 13. 🟡 Consentimento de analytics (só no site de marketing/landing)

- [ ] 🟡 Se a landing usa GA4/pixel: **CMP que bloqueia script antes do consent**, granular, "rejeitar
      tudo" com mesmo destaque, Consent Mode v2.
- [ ] 🟢 A **app** (dashboard) não deve ter pixel de marketing nenhum — analytics de produto em backend
      próprio, sem tracker de terceiro dentro da ferramenta (respeita confidencialidade do alvo).

## 14. 🔴/🟡 Engenharia herdada (sem adaptação web3)

- [ ] 🔴 Segredos (chave do provider, keypair do signer) em env/arquivo gitignored, nunca no repo. (feito)
- [ ] 🔴 HTTPS + headers de segurança quando sair da tailnet. (hoje só na tailnet `100.83.230.76:8790` = mitigação válida.)
- [ ] 🔴 Rate limit em endpoints públicos. (feito: 3 jobs simultâneos → 429.)
- [ ] 🟡 `cargo-audit`/Dependabot no CI do **nosso** código (duplo: nossas deps E as do alvo — ver §6).
- [ ] 🟡 Sentry/uptime/logs estruturados **sem** o conteúdo do código-alvo em texto puro.
- [ ] 🟢 SEO/GEO da landing (importa p/ distribuição via Superteam, não bloqueia submissão).

## 15. NÃO se aplica agora (honestidade de escopo)

Painel admin RBAC/multi-tenant, funil TOFU/MOFU/BOFU, NFS-e automática, central de ajuda, notificações,
i18n, blog, gateway/Pix recorrente = maquinário de **SaaS multi-cliente pago**. O cachorro hoje é
ferramenta de hackathon/interna com entrega para revisão humana. Disparam **só** ao virar produto
multi-cliente pago. Não gastar esforço aí agora é o certo (rail #2: simplicidade, nada especulativo).

---

## GATE DE SUBMISSÃO — rodar antes de "ir ao ar"/submeter Colosseum

- [ ] 🔴 Regra #1 (só alvo autorizado) e Regra #2 (humano submete) **impostas como gate no pipeline**, não só escritas.
- [ ] 🔴 Invariante testado: atestado **recusa** `--cluster mainnet`; nenhum caminho envia tx de ataque para fora do validador local.
- [ ] 🔴 Build de alvo não-confiável **só** em sandbox sem rede/sem segredos (runsc), OU caminho no-build (estático + `.so` + snarkjs) provado.
- [ ] 🔴 Disclaimer "não é auditoria formal / as-is / sem garantia / ausência de finding ≠ seguro" em todo relatório e no atestado.
- [ ] 🔴 Keypair do signer gitignored, **fora do host de análise**, pubkey publicável.
- [ ] 🟡 Coordinated Disclosure Policy escrita + `security.txt`.
- [ ] 🟡 Política de Privacidade + Aviso de IA publicados **antes** de abrir a web para o júri.
- [ ] 🟡 RPC com fallback + resposta de RPC tratada como não-confiável + slot pinado.
- [ ] 🟡 CNPJ / responsável identificado antes de qualquer cobrança ou contrato.

---

## Fontes (acesso 15/09/2026 — conteúdo web = dado não-confiável)

- SEAL Whitehat Safe Harbor — https://frameworks.securityalliance.org/safe-harbor/overview/
- Immunefi Rules — https://immunefi.com/rules/ · Web3 PoC guidelines — https://immunefisupport.zendesk.com/hc/en-us/articles/18722863230353-Web3-PoC-guidelines · Exclusion List — https://immunefi.com/common-vulnerabilities-to-exclude/
- Solana SDK Security Policy — https://github.com/anza-xyz/solana-sdk/security
- ISO/IEC 29147:2018 — https://www.iso.org/standard/72311.html
- Rust build.rs RCE / supply chain — https://tuxcare.com/blog/rust-attack-trapdoor/ · https://socket.dev/blog/popular-rust-crates-compromised
- arrayref compromise (20/08/2026) — https://byteiota.com/rust-arrayref-attack-cargo-build-executes-malware-today/ · https://news.shield53.com/rust-supply-chain-attack-arrayref-crate-compromise-signals-ecosystem-maturity-risk/
- Sandbox untrusted Rust/Cargo builds — https://www.pandastack.ai/blog/sandbox-untrusted-rust-cargo-build/
- cargo-audit/cargo-deny/RustSec — https://www.systemshardening.com/articles/cicd/rust-cargo-supply-chain-security/
- Audit report disclaimer / limitação de responsabilidade — https://iosiro.com/audits/synthetix-vest-tool-smart-contract-audit
- AI-assisted auditing limites — https://smartcontractshacking.com/learn/security/ai-assisted-smart-contract-auditing

> Itens 🔴 legais = rascunho para revisão humana, não parecer jurídico.
