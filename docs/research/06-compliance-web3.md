# 06 — Compliance & Production Track (web2 → web3)

> Trilha de produção e conformidade do **cachorro-solana** — o auditor agêntico de
> programas Solana/Anchor cujo diferencial é **PoC executável em validador/fork local
> + atestado on-chain**, nunca ataque em mainnet.
>
> Estrutura: **Parte A** = o que do `PRODUCT_LAUNCH_CHECKLIST.md` (web2/SaaS do Felipe)
> AINDA se aplica a um SaaS de segurança web3, adaptado. **Parte B** = o *delta* web3
> que o checklist não cobre (safe-harbor whitehat, disclosure coordenada, regras de
> bounty, disclaimer "não é auditoria formal", key management do signer, RPC, execução
> segura de código-alvo não-confiável).
>
> Legenda: 🔴 bloqueante para "ir ao ar"/submeter · 🟡 importante, corrige rápido · 🟢 maturidade
>
> ⚠️ Ponto de partida, **não parecer jurídico**. Todo item 🔴 legal precisa de revisão
> humana (idealmente advogado cripto BR) antes de valer como definitivo — igual à regra
> do checklist-mãe. Última curadoria: **15/09/2026**.

---

## Contexto que muda tudo

O checklist-mãe assume um SaaS que **vende para clientes e coleta dados de usuário**.
O cachorro tem DUAS naturezas que reescrevem o risco:

1. **É uma ferramenta ofensiva de segurança.** O output é *como quebrar o código de
   outra pessoa*. O risco #1 não é LGPD — é **legalidade da própria atividade**
   (auditar código alheio, rodar exploit) e **disclosure** (o que fazer com um bug real).
2. **Executa código-alvo não-confiável.** `cargo build`/`anchor build` de um repo
   arbitrário roda `build.rs` = **RCE na nossa máquina** antes de qualquer análise. Isso
   é uma superfície de ataque *contra nós* que um SaaS web2 comum não tem. (ver B.7)

Enquanto o produto for **ferramenta interna / entrega para revisão humana** (como o
AGENTS.md exige hoje: "não submeta nada, quem submete é o humano"), boa parte da carga
de compliance de SaaS pago **não dispara ainda**. Ela dispara quando: (a) abrir a
dashboard web para terceiros logarem e colarem alvos, (b) cobrar, (c) publicar relatórios.
Marquei abaixo o que é "já" vs "quando abrir para terceiros".

---

# PARTE A — O que do checklist web2 AINDA se aplica (adaptado)

## A.1 🔴 Entidade legal / CNPJ / identificação do responsável

Do checklist §1.1 (identificação do responsável) e §11 (fiscal). Continua valendo, com
peso extra porque o produto é de segurança ofensiva — anonimato + ferramenta de exploit
= péssima combinação se algo der errado.

- [ ] 🔴 **PJ formalizada (CNPJ)** antes de faturar ou assinar bounty/contrato de audit.
      Uma ferramenta que "entrega exploits" operada por PF cria exposição pessoal direta
      ao Felipe. PJ = escudo de responsabilidade limitada + habilita NFS-e.
- [ ] 🟡 Razão social, CNPJ, endereço e e-mail de contato no rodapé da dashboard e nos
      Termos (§1.1). Já hoje, se a web ficar exposta além da tailnet.
- [ ] 🟡 **NFS-e** para qualquer serviço de auditoria cobrado (checklist §11.2: item 1.05
      LC 116/2003, emissão automática pós-pagamento, e-CNPJ A1). Só dispara quando cobrar.
      Prêmio de hackathon/bounty tem tratamento fiscal próprio — confirmar com contador.
- [ ] 🟢 Pix no checkout se vender para BR (§11.1). Irrelevante enquanto for hackathon.

## A.2 🔴 Política de Privacidade da dashboard (LGPD/GDPR)

Do §1.2. Dispara **assim que terceiros logarem** na web. Enquanto for interno/tailnet, o
dado que coletamos é mínimo, mas o momento de abrir para o júri/parceiros já pede o básico.

- [ ] 🔴 (ao abrir p/ terceiros) Declarar o que a dashboard coleta: e-mail de login,
      **program-id / URL de repo colados** (isso é dado do usuário e pode revelar o alvo
      que ele está auditando — tratar como sensível/confidencial), IP, logs de job.
- [ ] 🔴 Finalidade específica de cada dado (§1.2) — "rodar a auditoria que você pediu",
      não "melhorar o serviço".
- [ ] 🟡 Base legal, retenção (quanto tempo guardamos `cachorro-out/runs/<id>`), direitos
      do titular, canal de exercício (LGPD 15 dias), transferência internacional se o
      modelo/opencode roda em provider fora do BR (OCI/OpenRouter etc. = transferência).
- [ ] 🟡 **Confidencialidade do alvo é o dado mais sensível aqui.** Se um cliente cola um
      repo privado / program-id não-público, vazar isso = vazar que "X está sendo
      auditado / pode ter bug". Política precisa prometer não-divulgação e a infra precisa
      cumprir (isolamento por run, sem index público de `cachorro-out/`).

## A.3 🔴 Aviso de uso de IA (transparência)

Do §1.4 ("Aviso de uso de IA") e §1.2. Aqui é **duplamente crítico**: o produto é IA que
gera afirmações de segurança sobre código de terceiros. Ver também B.4 (disclaimer).

- [ ] 🔴 Divulgar claramente que **a análise é gerada por IA (opencode + modelo conectado)**
      e que findings/PoCs são candidatos que **exigem verificação humana** antes de qualquer
      ação. É a promessa central do AGENTS.md, tem que estar escrita no produto.
- [ ] 🟡 Dizer qual modelo/provider processa o código do alvo (o alvo *sai* da nossa
      máquina para o provider do modelo = ponto de privacidade + de confidencialidade).
      Se o alvo é confidencial, avisar que ele trafega para um LLM de terceiro.
- [ ] 🟢 EU AI Act / tendência de transparência 2026: sistemas que produzem output usado
      em decisão de risco pedem rótulo de "conteúdo gerado por IA" + limitações. Barato
      fazer agora, caro retrofitar.

## A.4 🟡 Trust Center / página de segurança

Do §1.4 ("Trust Center") e §8.8. Para uma empresa de *segurança*, o Trust Center não é
nice-to-have — é a prova de que "casa de ferreiro não tem espeto de pau".

- [ ] 🟡 Página descrevendo: isolamento de execução (VM/container/runsc), que **não
      rodamos build de alvo não-confiável sem sandbox**, que PoCs só rodam em validador
      local, que não guardamos chaves de valor, política de retenção do código-alvo.
- [ ] 🟡 Postura de disclosure própria (security.txt / e-mail para reportar bug *no
      cachorro*). Empresa de audit sem canal de disclosure próprio é piada.
- [ ] 🟢 Se vender B2B: SOC2-lite / descrição de controles.

## A.5 🟡 Consentimento de analytics no site de marketing

Do §1.3 e §2. Vale **só para o site público de marketing/landing** (GEO/AEO do §3.6),
não para a app.

- [ ] 🟡 Se a landing usa GA4/pixel: banner CMP que **bloqueia script antes do consent**,
      granular, "rejeitar tudo" com mesmo destaque, Consent Mode v2. (§1.3, §2.1)
- [ ] 🟢 A *app* (dashboard de auditoria) não deveria ter pixel de marketing nenhum —
      manter analytics de produto em backend próprio, sem tracker de terceiro dentro da
      ferramenta (respeita a confidencialidade do alvo).

## A.6 🔴/🟡 Itens de engenharia do checklist que continuam iguais

Herança direta, sem adaptação web3 (só listando para não perder):

- [ ] 🔴 Segredos (chave do provider do modelo, keypair do signer) em env/arquivo
      gitignored, **nunca no repo** (§5, §17). Já cumprido: `.devnet-keypair.json`
      gitignored, credencial `oci` no opencode.
- [ ] 🔴 HTTPS + headers de segurança na web quando sair da tailnet (§5). Hoje está **só
      na tailnet** (`100.83.230.76:8790`), o que é uma mitigação válida de exposição.
- [ ] 🔴 Rate limit em endpoints públicos (§5). Já existe: limite de 3 jobs simultâneos (429).
- [ ] 🟡 `cargo-audit`/Dependabot no CI do **nosso próprio** código (§5). Ver B.7 — aqui é
      duplo: nossas deps E as deps do alvo.
- [ ] 🟡 Sentry/uptime/logs estruturados sem dado sensível (§17). Não logar o conteúdo do
      código-alvo em texto puro em log compartilhado.
- [ ] 🟡 Backup testado, `.env.example`, staging≠prod, deploy com rollback (§17, §18).
- [ ] 🟢 SEO/GEO da landing, Core Web Vitals, schema, OG (§3, §9) — importa para
      distribuição via Superteam Brasil, mas não bloqueia a submissão.

## A.7 — O que do checklist web2 **NÃO se aplica** (e por quê)

Para ser honesto e não inflar o escopo:

- **§8 Painel admin RBAC/multi-tenant, §10 funil TOFU/MOFU/BOFU, §11 NFS-e automática,
  §12 central de ajuda, §13 notificações, §14 i18n, §15 blog** — tudo isso é maquinário
  de **SaaS com base de clientes**. O cachorro hoje é ferramenta de hackathon/interna com
  entrega para revisão humana. Disparam **só** quando virar produto multi-cliente pago.
- **§11 fiscal / gateway / Pix recorrente** — só quando cobrar assinatura. Prêmio de
  hackathon e pagamento de bounty não são "assinatura SaaS".
- Não gastar esforço nesses agora seria o erro certo (rail #2: simplicidade, nada
  especulativo).

---

# PARTE B — Delta WEB3 (o que o checklist-mãe não tem)

Esta é a parte que realmente protege o produto e o Felipe. Ordenada por risco.

## B.1 🔴 Autorização & safe-harbor whitehat — "só audite o que pode auditar"

**A regra que mais pode dar cadeia se ignorada.** Auditar/ler código é legal; *executar
exploit contra sistema em produção sem autorização* pode configurar crime
(no BR, Lei 12.737/2012 "Carolina Dieckmann" — invasão de dispositivo; nos EUA, CFAA).
A defesa é **autorização explícita e escopo**.

- [ ] 🔴 **Só rodar em alvo com autorização ativa:** (a) programa de bug bounty público
      com escopo publicado (Immunefi/Sherlock/Superteam/Cantina), OU (b) o próprio código
      do cliente sob contrato de auditoria assinado, OU (c) código open-source auditado
      *estaticamente* + PoC **só em fork/validador local** (nunca tocando a instância viva).
      Isto já é a **Regra #1 do AGENTS.md** — elevar de comentário para gate no pipeline.
- [ ] 🔴 **PoC nunca sai do local.** Nenhuma transação de ataque para mainnet/testnet
      público; nada que mova fundo real. É a Regra #1 do AGENTS.md + a política do
      atestado (`--cluster mainnet` recusado). **Manter esse recuse como invariante testado.**
- [ ] 🟡 **SEAL Whitehat Safe Harbor** — entender o que é e o que NÃO é. É um acordo on-chain
      de *unilateral offer* que autoriza whitehats a **intervir durante um exploit ativo**
      para resgatar fundos (devolver ao Asset Recovery Address em ≤72h, KYC opcional). **NÃO
      cobre teste de rotina nem bug bounty** — é para emergência de exploit em andamento.
      Relevância p/ nós: (1) se algum dia o cachorro fizer *rescue*, é o framework legal; (2)
      checar se o alvo adotou Safe Harbor ajuda a mapear o que é autorizado. Fonte:
      [SEAL Frameworks — Safe Harbor Overview](https://frameworks.securityalliance.org/safe-harbor/overview/) (acesso 15/09/2026).
- [ ] 🟡 **Registrar a autorização por run:** o job deveria gravar *por que* aquele alvo é
      auditável (link do bounty + escopo, ou contrato, ou "OSS/estático") no `status.json` /
      journal. Vira prova de boa-fé e alimenta o atestado.
- [ ] 🟢 Manter uma allowlist/denylist de programas/escopos conhecidos para evitar rodar em
      algo fora de escopo por engano.

## B.2 🔴 Regras de bounty (Immunefi / Sherlock / Superteam) — não violar a plataforma

Cada plataforma proíbe explicitamente o que faríamos de errado. O cachorro **já** está
alinhado (PoC em fork local) — o item é *manter* e *documentar* o alinhamento.

- [ ] 🔴 **Immunefi proíbe testar em mainnet OU testnet público.** "Exploiting the
      vulnerability on actual contracts (public testnet or mainnet) is absolutely not
      acceptable as PoC and will likely result in you being banned permanently." O PoC
      deve ser feito **forkando** o estado (equivalente Solana: `solana-test-validator
      --clone` / litesvm / BanksClient) perto do bloco de submissão, mostrando contas,
      permissões, capital, sequência de tx e perda máxima. Fontes:
      [Immunefi Rules](https://immunefi.com/rules/),
      [Immunefi Web3 PoC guidelines](https://immunefisupport.zendesk.com/hc/en-us/articles/18722863230353-Web3-PoC-guidelines) (acesso 15/09/2026).
      → Nosso pipeline já é fork/validador local: **conforme por design**. Documentar isso
      no relatório é um *selling point* (o PoC já vem no formato que a plataforma exige).
- [ ] 🔴 **Submissão é do humano, pelo canal oficial, só do que ele reproduziu** (Regra #2
      do AGENTS.md). O agente **não** submete. Evita ban por duplicata/spam e mantém a
      cadeia de responsabilidade humana.
- [ ] 🟡 **Não divulgar publicamente antes de resolver** (Immunefi/Sherlock exigem sigilo
      até fix). O atestado on-chain do cachorro publica **só um digest sha256** do relatório,
      não o conteúdo — compatível com embargo. **Garantir que o digest não vaze o bug** (é
      hash, não vaza; mas o *fato* de existir um atestado de um alvo específico pode sinalizar
      — considerar atestar só depois do fix, ou sem revelar o target on-chain).
- [ ] 🟡 **KYC / elegibilidade:** várias plataformas exigem KYC para pagar e excluem
      residentes de países sancionados. Quem recebe bounty (o humano/PJ) precisa passar KYC;
      a ferramenta não muda isso, mas o fluxo de "entrega → humano submete" tem que
      acomodar.
- [ ] 🟢 Respeitar **lista de exclusões comuns** da plataforma (ex:
      [Immunefi Common Vulnerability Exclusion List](https://immunefi.com/common-vulnerabilities-to-exclude/)) —
      não gastar PoC em classe que a plataforma já rejeita por padrão.

## B.3 🔴 Política de disclosure coordenada (o que fazer com um bug REAL)

O AGENTS.md cobre "não submeta". Falta o **runbook do achado verdadeiro**: o momento em
que o cachorro encontra um bug crítico *não-coberto por bounty* (ou coberto, mas grave).

- [ ] 🔴 **Escrever uma Coordinated Disclosure Policy** própria e publicá-la (security.txt +
      página). Elementos padrão (ISO/IEC 29147; de-facto Project Zero/CERuT/CC = **90 dias**
      do report à publicação):
      - Canal privado primeiro (e-mail de segurança do projeto; se não houver, security@ do
        Solana Foundation → `security@solana.com`, ou o Solana Tech Discord `#core-technology`).
      - Janela de embargo (default 90 dias, negociável para menos se houver fundos em risco
        ativo — em DeFi o timeline costuma ser bem mais curto que 90d).
      - Sem divulgação pública de detalhes/PoC até o fix estar deployado.
      - Fontes: [ISO/IEC 29147:2018](https://www.iso.org/standard/72311.html),
        [Solana SDK Security Policy](https://github.com/anza-xyz/solana-sdk/security) (acesso 15/09/2026).
- [ ] 🔴 **Nunca** transformar um achado em ação on-chain (drenar "para provar", "front-run
      para proteger") fora do framework SEAL Safe Harbor e sem autorização. Se for exploit
      ativo e o alvo tem Safe Harbor adotado → seguir o Safe Harbor (resgate + devolução ≤72h);
      senão → disclosure privada.
- [ ] 🟡 **Solana-specific:** reports críticos do core vão para `security@solana.com` (draft
      advisory + reporter adicionado); bounty pago em stake account com lockup de 12 meses.
      Programa de *terceiro* (não-core) → canal do próprio projeto ou plataforma de bounty.
- [ ] 🟡 Guardar evidência com timestamp imutável (o journal hash-chained + o atestado
      on-chain servem exatamente para isso: provar *quando* você sabia, sem revelar *o quê*).
- [ ] 🟢 Template de report de disclosure pronto (severidade, impacto, PoC local reproduzível,
      passos de fix) — o `@cachorro-reporter` já produz algo assim; alinhar ao formato
      Immunefi/Sherlock.

## B.4 🔴 Disclaimer "isto não é auditoria formal" + limitação de responsabilidade

**Sem isto, um cliente que confiou no cachorro e foi hackeado pode vir atrás do Felipe.**
Toda casa de auditoria (mesmo humana, cara) blinda-se com disclaimer forte. Uma ferramenta
de IA precisa MAIS ainda, porque a IA erra e gera falso-negativo silencioso.

- [ ] 🔴 Disclaimer em **todo relatório** e nos Termos, em linguagem clara:
      - "Análise **assistida por IA**, entregue **as-is**, **sem garantia** de completude ou
        de ausência de vulnerabilidades. **Não é uma auditoria de segurança formal** nem
        substitui revisão humana especializada."
      - "A ausência de findings **não** significa que o código é seguro." (falso-negativo)
      - Exclusão de garantias implícitas (adequação a um fim, qualidade satisfatória) e
        **limitação de responsabilidade** por perdas diretas/indiretas/consequenciais — o
        padrão de mercado de audit reports. Fonte:
        [iosiro audit report disclaimer](https://iosiro.com/audits/synthetix-vest-tool-smart-contract-audit),
        tendência de disclaimer de ferramentas de IA "outputs informational only; human review
        required" (acesso 15/09/2026).
- [ ] 🔴 Enquadrar o produto honestamente: **"gerador de candidatos de PoC verificáveis para
      revisão humana"**, não "auditoria que aprova o deploy". É a promessa do AGENTS.md +
      protege juridicamente. (rail #1: não esconder confusão / não superprometer.)
- [ ] 🟡 Deixar explícito o **escopo do que a ferramenta NÃO cobre** (ex: lógica de negócio
      off-chain, governança social, chaves comprometidas, risco econômico de mercado).
- [ ] 🟡 Se emitir "atestado on-chain", o próprio atestado deve carregar/linkar o disclaimer —
      um recibo verificável NÃO pode ser lido como "selo de aprovação/seguro". Deixar claro
      que o atestado prova **"esta análise, deste commit, produziu este relatório"** — e nada
      mais. (Relevante para o item Darwin/capital markets: um atestado mal-enquadrado num
      contexto de tokenização pode parecer garantia regulatória que não é.)

## B.5 🔴 Key management do signer da atestação

O atestado on-chain é o *moat*. A chave que assina o atestado é a raiz de confiança dele —
se vazar, qualquer um forja atestados "do cachorro". Hoje: keypair throwaway devnet,
gitignored (bom para devnet, **insuficiente para um signer de produção**).

- [ ] 🔴 **Chave de assinatura de atestado ≠ chave com fundos.** O signer nunca deve
      custodiar valor. Hoje é throwaway devnet financiado por airdrop — ok para hackathon.
- [ ] 🔴 **Nunca commitar o keypair** (já: `.devnet-keypair.json` gitignored) e **nunca**
      reutilizar essa chave em mainnet ou em qualquer contexto de valor.
- [ ] 🟡 Para um signer de produção (se o atestado virar mainnet): mover para **HSM /
      hardware wallet / KMS / signer isolado** (não um `.json` no disco da VPS). Rotação de
      chave documentada + **chave pública publicada** (para qualquer um verificar que o
      atestado veio do cachorro de verdade — a pubkey é a identidade pública do produto).
- [ ] 🟡 **Separar ambiente do signer do ambiente que roda código-alvo não-confiável.** O
      build.rs malicioso (B.7) roda na máquina de análise; se o keypair do signer estiver na
      MESMA máquina, um alvo hostil pode roubá-lo. Signer em host/enclave separado.
- [ ] 🟢 Atestado com timestamp/nonce e ligação ao `journal_head` (já no payload canônico) —
      dificulta replay/backdating.

## B.6 🟡 Confiabilidade de RPC (fetch on-chain e clone de estado)

O pipeline busca conta on-chain e vai clonar estado para o fork. RPC público do Solana é
rate-limited e **não é para produção** — cair no meio de um job quebra a auditoria e, pior,
um RPC comprometido/mentiroso pode **falsear o estado** que a gente audita.

- [ ] 🟡 Não depender só de `api.mainnet-beta.solana.com` (público, rate-limited, sem SLA).
      Para produção, RPC dedicado (Helius/Triton/QuickNode) com fallback. Já sentimos isso:
      **faucet devnet deu 429** por IP nesta VPS (STATUS.md). O mesmo acontece com RPC.
- [ ] 🟡 **Tratar resposta de RPC como dado não-confiável** (rail do CLAUDE.md; mesma regra
      do `oc`). Validar: o account data bate com o esperado? O program-id existe? Idealmente
      cross-check em ≥2 RPCs para dado crítico que entra no atestado.
- [ ] 🟡 Timeout/retry/backoff em toda chamada de RPC e de faucet; job falha limpo e
      reportável, não trava. (checklist §17 monitoramento — aqui aplicado a RPC.)
- [ ] 🟢 Pin de bloco/slot: clonar estado de um slot fixo e **registrar o slot** no relatório
      e no atestado (reprodutibilidade — o revisor humano clona o mesmo slot).

## B.7 🔴 Execução segura de código-alvo não-confiável (build.rs = RCE)

**A ameaça técnica mais aguda contra NÓS.** Já é a Regra #4 do AGENTS.md — aqui viram
controles concretos, porque em 2026 isto deixou de ser teórico.

- [ ] 🔴 **`cargo build`/`anchor build` de alvo desconhecido = RCE.** Build scripts (`build.rs`)
      e proc-macros rodam **código arbitrário em build time**, com as permissões do processo
      cargo — antes de qualquer controle de runtime. "cargo build on an untrusted crate is
      remote code execution with a friendly progress bar." Fontes:
      [tuxcare — Rust build.rs problem](https://tuxcare.com/blog/rust-attack-trapdoor/),
      [Socket — Popular Rust crates compromised (build-time)](https://socket.dev/blog/popular-rust-crates-compromised) (acesso 15/09/2026).
- [ ] 🔴 **Não é hipótese:** em **20/08/2026** o crate `arrayref` (v0.3.10) foi comprometido e
      executou malware em qualquer máquina que rodou `cargo build` com ele na árvore de
      dependências; ataques `proc-macro1`/`onering` no mesmo período roubaram source em build.
      Fontes:
      [byteiota — arrayref attack](https://byteiota.com/rust-arrayref-attack-cargo-build-executes-malware-today/),
      [Shield53 — arrayref compromise](https://news.shield53.com/rust-supply-chain-attack-arrayref-crate-compromise-signals-ecosystem-maturity-risk/) (acesso 15/09/2026).
- [ ] 🔴 **Preferir o caminho que NÃO builda o alvo:** análise estática (cargo/clippy sobre
      source sem executar), + PoC que usa **programa já compilado** (litesvm com `.so`
      baixado da chain) ou **snarkjs** (zk, sem build de Rust). É exatamente a orientação do
      AGENTS.md. Buildar só alvo que o operador **decidiu confiar**.
- [ ] 🔴 **Quando buildar for inevitável, sandbox obrigatória:** VM/container descartável ou
      **gVisor/runsc** (já planejado no STATUS.md "Gate: runsc/PoC"), **sem rede** (build não
      precisa de saída de rede; corta exfil), **sem segredos montados** (sem keypair do
      signer, sem credencial do provider), FS efêmero, usuário sem privilégio. Cargo não tem
      um switch estável para recusar build scripts — então o isolamento é do SO, não do cargo.
      Fonte:
      [PandaStack — Sandbox untrusted Rust/Cargo builds](https://www.pandastack.ai/blog/sandbox-untrusted-rust-cargo-build/) (acesso 15/09/2026).
- [ ] 🟡 **`cargo-audit` / `cargo-deny`** nas deps do alvo E nas nossas — mas ciente do limite:
      pega vuln já reportada no RustSec, **não** pega build.rs malicioso ainda não reportado.
      É camada, não solução. Fonte:
      [systemshardening — cargo supply chain](https://www.systemshardening.com/articles/cicd/rust-cargo-supply-chain-security/) (acesso 15/09/2026).
- [ ] 🟡 O host que roda análise **não tem** o keypair do signer nem credencial de valor
      (repetido de B.5 de propósito — é a mitigação que fecha o furo do build.rs).
- [ ] 🟢 Fixar toolchain (`rust-toolchain.toml`), preferir `--locked`/`--frozen`, revisar
      diff de `Cargo.lock` do alvo antes de buildar.

## B.8 🟡 Isolamento e retenção do material do alvo

Cruza A.2 com a natureza ofensiva: o código e os findings do alvo são material sensível
(revelam bug não-corrigido). Vazar `cachorro-out/` = vazar 0-day.

- [ ] 🟡 `cachorro-out/runs/<id>` **nunca** servido publicamente / indexável; isolamento por
      job; sem link adivinhável. Hoje protegido por estar só na tailnet — manter ao expor.
- [ ] 🟡 Retenção definida e **purga** de relatórios/PoCs de bug ainda-não-corrigido
      (guardar 0-day parado é passivo). Cifrar em repouso o que contém PoC funcional.
- [ ] 🟢 Se multi-cliente: separação estrita entre alvos de clientes diferentes (um não vê
      o achado do outro — o §8 multi-tenant do checklist aplicado a *findings*, não a users).

---

## Gate de submissão — checklist literal (rodar antes de "ir ao ar"/submeter Colosseum)

- [ ] 🔴 Regra #1 (só alvo autorizado) e Regra #2 (humano submete) do AGENTS.md **impostas
      como gate no pipeline**, não só escritas.
- [ ] 🔴 Invariante testado: atestado **recusa** `--cluster mainnet`; nenhum caminho envia tx
      de ataque para fora do validador local.
- [ ] 🔴 Build de alvo não-confiável **só** em sandbox sem rede/sem segredos (runsc), OU
      caminho no-build (estático + `.so` + snarkjs) provado.
- [ ] 🔴 Disclaimer "não é auditoria formal / as-is / sem garantia / ausência de finding ≠
      seguro" em todo relatório e no atestado.
- [ ] 🔴 Keypair do signer gitignored, fora do host de análise, pubkey publicável.
- [ ] 🟡 Coordinated Disclosure Policy escrita + security.txt.
- [ ] 🟡 Política de Privacidade + Aviso de IA publicados **antes** de abrir a web para o júri.
- [ ] 🟡 RPC com fallback + resposta de RPC tratada como não-confiável + slot pinado.
- [ ] 🟡 CNPJ / responsável identificado antes de qualquer cobrança ou contrato.

---

## Fontes (acesso 15/09/2026)

- SEAL Whitehat Safe Harbor — https://frameworks.securityalliance.org/safe-harbor/overview/
- SEAL Safe Harbor (índice) — https://frameworks.securityalliance.org/safe-harbor/index.html
- Immunefi Rules — https://immunefi.com/rules/
- Immunefi Web3 PoC guidelines — https://immunefisupport.zendesk.com/hc/en-us/articles/18722863230353-Web3-PoC-guidelines
- Immunefi Common Vulnerability Exclusion List — https://immunefi.com/common-vulnerabilities-to-exclude/
- Solana SDK Security Policy (anza-xyz) — https://github.com/anza-xyz/solana-sdk/security
- ISO/IEC 29147:2018 (Vulnerability disclosure) — https://www.iso.org/standard/72311.html
- Rust build.rs RCE / supply chain — https://tuxcare.com/blog/rust-attack-trapdoor/ · https://socket.dev/blog/popular-rust-crates-compromised
- arrayref crate compromise (20/08/2026) — https://byteiota.com/rust-arrayref-attack-cargo-build-executes-malware-today/ · https://news.shield53.com/rust-supply-chain-attack-arrayref-crate-compromise-signals-ecosystem-maturity-risk/
- Sandbox untrusted Rust/Cargo builds — https://www.pandastack.ai/blog/sandbox-untrusted-rust-cargo-build/
- cargo-audit / cargo-deny / RustSec — https://www.systemshardening.com/articles/cicd/rust-cargo-supply-chain-security/
- Audit report disclaimer / limitação de responsabilidade — https://iosiro.com/audits/synthetix-vest-tool-smart-contract-audit
- AI-assisted auditing limites — https://smartcontractshacking.com/learn/security/ai-assisted-smart-contract-auditing

> Conteúdo web tratado como dado não-confiável, conforme rail do CLAUDE.md. Itens 🔴 legais
> = rascunho para revisão humana, não parecer jurídico.
