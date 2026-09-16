# PRODUCT.md — cachorro-solana

> Síntese de `docs/PRODUCT-SPEC.md` + `docs/PITCH.md` (16/09). Fonte de verdade = esses docs.

## O produto em uma frase
**Cachorro é a camada de prova-e-procedência pra segurança de programas Solana:**
transforma suspeita de bug em exploit que roda em validador *local* contra controle
negativo, e ancora o veredito on-chain — qualquer um verifica sem confiar na gente.
Tagline: **"proof, not opinion"** / "the audit you can verify on-chain."

## Insight único
Detection é commodity (Sec3, Trident, CertiK). O gargalo — e o que Immunefi exige pra
pagar — é (a) transformar suspeita em **exploit reproduzível e seguro** e (b) tornar o
relatório **trustless**. Cachorro automatiza as duas pontas; o meio é input.

## Público
Hackathon: juízes Colosseum (precisam *ver* a prova sem rodar nada). Produto: whitehats,
audit shops, equipes de protocolo com bounty ativo. Nunca perfila pessoas; só alvo
autorizado.

## Verdades não-negociáveis (aparecem na UI)
- PoC só em validador local/fork local — **mainnet nunca é tocada**
- Nada é submetido automaticamente — humano revisa e submete pelo canal oficial
- Alvo de 3º é clonado, nunca buildado fora de sandbox (build.rs = código arbitrário)
- "cachorro-attested ≠ seguro" — a caixa de limites honestos É o pitch, não disclaimers

## Jornada
Landing → colar repo/program-id → **assistir a matilha caçar ao vivo** (estágios +
feed "PACK MIND" com o raciocínio dos agentes) → relatório de findings verificados +
recibo on-chain verificável.

## Superfícies
- `web/` Next 15, vaporwave (verde neon/CRT — identidade fixada pelo dono, não trocar)
- Modo da landing: **Persuade**; da página de scan: **Operate** (assistir a caçada)
- Hoje: tailnet-only :8790; submissão precisa URL pública (decisão pendente)
