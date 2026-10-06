# WIN-PLAN — como o Cachorro ganha o Crypto World's Fair

> Consolidado 06/10/2026. Fontes: Copilot `/me` (estado do draft), histórico de winners
> Colosseum (via Copilot research), artefatos de hunts reais, concorrentes mapeados.
> Deadline: **12/10 23:59 PT**. Plano de submissão: **11/10**.

---

## 1. Tese de vitória

Não competir em métricas (Clawpump ganhou com $65M volume — não temos). Competir em
**Insight + Execution**, onde a tese pesa mais que o número:

**Reframe: não é "audit tool", é a camada de prova da segurança Solana.**
Audit é a cunha de entrada; a empresa é o registry de attestations on-chain. TAM maior,
soa startup e não produto.

**Narrativa premiada que já existe no ecossistema:** Agent Arc ganhou 3º AI com
"performance is provable, not promised". O Cachorro é isso aplicado a segurança —
**"the audit you can verify on-chain"** (PITCH.md §1).

## 2. As quatro provas (o que ninguém mais tem)

1. **Demo que se auto-demonstra** — juiz clica UNLEASH num repo público → feed PACK MIND
   ao vivo → PoC executa → receipt no explorer. Funcionando hoje (run pública
   `run_1791309832_6ebedb` validada 06/10).
2. **O pack construiu o pack** — commits co-authored pelos agentes. Solo founder vira
   meta-prova: *"the product IS the team"*.
3. **Self-audit público** — o pack caçou o próprio repo, achou 3 bugs reais, corrigiu
   no mesmo dia, report aberto com badge. Nenhum concorrente replica.
4. **Disclosure responsável como feature** — reports selados + `/claim` (assinatura da
   upgrade authority on-chain, ou `CACHORRO.md` no repo) + slot de bounty payout.
   Testado 06/10: nonce emitido, verify rejeita sem o arquivo, program claim valida
   upgrade authority on-chain.

## 3. Evidências de campo (todas verificadas, com artefato)

| Fato | Artefato | Status |
|---|---|---|
| Bido (`usebido/x402`) auditado — SSRF unauth + forwardHeaders leak, 2 HIGH | `run_1790962213_a1f16f/report_usebido_x402_2026-10-02.md`, PoC VERDE `CRITICAL_CONFIRMED` | entregue 02/10 |
| Cloak — 8 findings, incl. **surfpool `loadPlugin` RCE** (confirmado no source: `crates/core/src/rpc/admin.rs`, middleware sem auth, `cors(Disabled)`, docstring admite privilegiado) | grupo WA, relatório 03/10 | entregue |
| Indicação boca-a-boca: Bellu (Bido) → CTO Cloak | thread WA | — |
| Juiz do hackathon unleashed na própria startup | 2 HIGHs provados | — |
| PoE (serviço $5k/audit) pediu a engine como ferramenta | conversa direta | LOI pendente |
| 20+ hunts, 3+ criticals em programas da cohort (um com 6 audits humanas) | `cachorro-out/runs/` | — |
| 5 receipts ANCORADOS devnet | explorer | ✅ |
| E2E EVM validado (fetch→slither→forge, exploit executado) | jazz-oracle 06/10 | ✅ |

**Silêncio dos times = prova de mordida, não de alucinação.** Padrão clássico de
disclosure informal: receberam exploit executado → discussão interna/correção quieta.
Protocolo não registra "sim temos critical" em texto — é exatamente por isso que o
produto sela reports. Pitch-line: *"teams go silent on vulnerabilities — the seal
keeps the evidence."*

## 4. Mapa de campos do portal (rascunhos — palavra final é do time)

### traction
> 20+ hunts on live cohort programs. 3+ proven criticals — including a lending
> protocol that passed 6 professional audits (4 novel bugs found). A hackathon judge
> unleashed the pack on their own startup (2 HIGHs). Two protocols requested audits
> in person at Solana House — reports delivered with executable PoCs. Proof of
> Exploit ($5k/audit service) asked to run their audits on the engine.

### marketValidation
> Audit firm (Proof of Exploit) as design partner. Public self-audit with verifiable
> badge. In-person demand at Solana House: teams asked for hunts, delivered sealed
> reports with on-chain receipts. Responsible-disclosure flow (`/claim`) live.

### competition
> Human audit firms ($50–150k, weeks): 6 audits passed a program the pack broke in
> hours. Proof of Exploit ($5k hybrid): working exploits but "trust our researchers"
> — no on-chain receipt, human-bottlenecked. Jelleo (pipeline+attestation): registry
> layer, doesn't execute exploits. Static scanners / AI-auditors: false negatives /
> false positives — nobody proves. **We're the only engine that executes the exploit
> and anchors the verdict on-chain.**

### monetization
> SNIFF (free QUICK hunt — viral demo, live). HUNT ($99–499/mo — whitehats & teams;
> a hunter's crit pays a decade of subscription). SERVICE (audit-as-a-service,
> PoE-validated $5k/engagement anchor). ENTERPRISE (engine licensing for audit firms
> — PoE already asked). COGS ≈ $3–6/hunt → >95% gross margin.

### teamCommitment / teamLocationDetails
> Solo founder, full-time through the hackathon. São Paulo, Brazil. Daily repo
> sessions, dated commits — product co-built by the agent pack itself.

### Links / toggles
- website + liveProductLink → `https://cachorro.jazzautomations.com.br`
- pitchVideo/demoVideo/presentation/technicalDemo → colar links (usuário tem)
- tracks[] → **7 tracks**: Solana + Ethereum + Base + Arbitrum + Robinhood + Tempo +
  Hyperliquid. Evidência feita 06/10: exploit treatment/control executado em fork de
  estado real das 6 chains (logs em `chain-evidence/` no VPS, bloco real por chain).
  Zcash fora (sem program layer auditável)
- acceleratorOptIn → **true**
- twitter/telegram → preencher
- weekly update 1min → gravar

## 5. Empilháveis — ordem: portal primeiro, Earn depois (todos pedem link do projeto)

| Canal | O quê | Geo | Quando |
|---|---|---|---|
| Superteam Brasil × SolarEcoFund | $5k USDG + $1k USDC | 🇧🇷 | inscrever na Earn **após** submit |
| CertiK Audit Credits | 10 × $10k créditos | aberto | form + framing mainnet |
| Adevar Pre-Audit | 5 × $4k in-kind | aberto | form + tweet |
| RPC Fast Infra | 21 × ~$500 crédito RPC | aberto | form + X follow (resolve FORK_URL!) |
| Privacy Week | — | — | ✅ inscrito, resultado 10/10 |
| Darwin Startups | aceleração | — | ~10/10 |

## 6. Semana (06 → 11/10)

- **Eu (Devin):** WIN-PLAN ✅, claim flow testado ✅, site sondado ✅. Resta: hunts
  EVM por chain se decidido, smoke pass final no site.
- **Humano:** preencher portal (campos acima), colar vídeos, Earn + Darwin, mandar
  follow-up Bido/Cloak (rascunhos na conversa — oferta de attestation no nome deles,
  não cobrança), pedir LOI escrito pro PoE, **SUBMIT dia 11**.
- Regra de tracks: só marcar onde há evidência rodando na chain. Solana hoje; EVM
  condicional.
