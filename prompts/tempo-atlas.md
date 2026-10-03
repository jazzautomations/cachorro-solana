# Tempo vuln atlas — payments-first EVM L1 (Stripe/Paradigm). Solidity + protocol-AA surface.

Used when TARGET_DIR targets Tempo (chainId 4217 mainnet / 42431 Moderato testnet; foundry also
recognizes 42429). Tempo is full-EVM (Reth SDK, Osaka hf) so all of `evm-atlas.md` applies —
this file is the **delta**: enshrined TIP-20 precompiles, native AA (type `0x76` txs), fee
sponsorship, payment lanes. Full deep-dive: `/tmp/research-tempo.md`.

PoC tooling: `anvil --tempo` or `anvil --fork-url https://rpc.moderato.tempo.xyz` (auto-detects);
`foundry.toml: network = "tempo"`; cast flags `--tempo.fee-token/--tempo.nonce-key/--tempo.valid-before`;
`cast batch-send`; faucet `cast rpc tempo_fundAddress <addr> --rpc-url https://rpc.moderato.tempo.xyz`;
fork info `cast rpc tempo_forkSchedule`. Sponsored/keychain txs need `viem/tempo` or the python SDK
for envelope encoding — if the SDK isn't on the box, mark `detected-not-proven`, never fake it.

## Fixed addresses (memorize; cite in findings)

| What | Address |
|---|---|
| TIP-20 tokens (prefix) | `0x20C0…` + 8B from `keccak256(sender,salt)`; pathUSD = `0x20c0…0000`; testnet: AlphaUSD `…01`, BetaUSD `…02`, ThetaUSD/GammaUSD `…03`, DeltaUSD `…04` |
| TIP20Factory | `0x20Fc000000000000000000000000000000000000` |
| FeeManager (Fee AMM) | `0xfeeC000000000000000000000000000000000000` |
| StablecoinDEX | `0xdeC0000000000000000000000000000000000000` |
| TIP403Registry | `0x403C000000000000000000000000000000000000` |
| ReceivePolicyGuard | `0xB10C000000000000000000000000000000000000` |
| SignatureVerifier | `0x5165300000000000000000000000000000000000` |
| AddressRegistry (virtual addrs) | `0xFDC0000000000000000000000000000000000000` |
| NonceManager (2D nonces) | `0x4E4F4E4345000000000000000000000000000000` ("NONCE") |
| AccountKeychain | `0xAAAAAA00000000000000000000000000000000` |
| TIP20ChannelReserve (MPP) | `0x4D50500000000000000000000000000000000000` ("MPP") |
| Zones | Factory `0x5AF2…`, Portal impl `0x5AD1…`, verifier `0x5a56…`, Messenger `0x5A4d…` |

No native gas token — `eth_getBalance` returns a fake constant; fees paid in USD TIP-20s only.
`Call.value`/`msg.value`/`address(this).balance` economics are suspect — probe on fork before
claiming. Docs drift (tx type `0x76` in spec vs `0x54` on RPC page; token list at `…03`) —
verify constants on-chain.

## T1 — payments-chain fund movement (hunt FIRST)

- **Redirect-not-revert (highest yield)**: since T6, a TIP-20 `transfer`/`mint` blocked by the
  receiver's receive policy **succeeds** but lands in ReceivePolicyGuard — `Transfer` event shows
  `to = 0xB10C…`. Any contract crediting deposits on `transfer()` success, or any indexer crediting
  on Transfer-to-address, is mis-accountable: over-credit a deposit whose funds sit in the guard,
  or strand funds the app can't claim (receipts are non-enumerable — need `TransferBlocked` events).
  Grep: `transfer(`/`safeTransfer` followed by ledger credit; event-driven crediting.
- **Virtual-address two-hop**: deposits to a `0xFDC0`-registered virtual address emit TWO
  `Transfer` events in one tx (alias → master). Indexers double-count or miss; contracts keying
  `to == expected` break. Non-TIP-20 tokens do NOT forward — stuck funds.
- **Memo replay**: `bytes32 memo` is an indexed topic, never delivered to a receiver contract.
  Off-chain "memo ⇒ invoice/account" mappings are forgeable — anyone can send a transfer with a
  victim's memo → double-credit. Check `invoices[memo]`, memo-as-commitment, >32B truncation.
- **Sponsorship drain**: a sponsor backend signing the `0x78` fee-payer envelope pays for
  whatever is in `calls[]` — no allowlist = gas drain. `key_authorization` is inside the
  payer's hash — sponsored txs can smuggle access-key provisioning. `fee_token` is chosen by the
  PAYER, not committed by the sender. `chain_id`/`valid_before` bound or replayable.
- **Access-key limit bypass**: keychain spending limits bind ONLY direct calls
  (`msg.sender == tx.origin`) and ONLY TIP-20 `transfer`/`transferWithMemo`/`approve`-increase/
  `startReward`. A contract that moves user tokens on a session-key's behalf voids the limits —
  flag apps claiming key limits protect in-contract flows. `approve` in a call scope w/o spender
  restriction = approve anyone. `chain_id=0` key auth = replayable on every chain. Expiry field:
  omit = never; hand-rolled `0`/`0x00` trailing = rejected — decoder footguns in app code.
- **Batch atomicity**: `calls[]` all-or-nothing. One TIP-403-blocked/paused recipient reverts the
  whole payroll — DoS leverage (induce a block, grief the run). Intra-batch reentrancy: later
  calls see earlier post-state; per-call try/catch emulation is false.
- **TIP-403 both-sides check**: token policy checks sender AND recipient; receive policy checks
  receiver-configured sender/token filters. Contract assuming "transfer works for anyone holding
  tokens" breaks under custom policies; `changeTransferPolicyId`/`setPolicyAdmin`/
  `setRoleAdmin`/`setReceivePolicy` are the admin hijack surface.
- **DEX/ledger divergence**: StablecoinDEX keeps an internal balance ledger — `balanceOf` misses
  escrowed DEX funds; pre-T2, internal-balance moves bypassed token pause (class: alternate
  movement paths skip token guards — check channel reserve, fee post-tx, reroute claims the same
  way). Flip orders rewrite `orderId` to the opposite side on fill — keeper/cancel logic keying
  orderId breaks. Fee AMM is fixed-price (0.9970/0.9985) — not a price oracle; two-hop fee route
  via `quoteToken()`.
- **TIP-20 ≠ ERC-20 details**: `decimals()==6` always; `supplyCap` uint128; transfers to
  `0x20C0…` addresses revert `InvalidRecipient`; `permit` requires v∈{27,28} (0/1 not
  normalized); implicit approvals — listed precompiles (DEX, FeeAMM, ChannelReserve) pull with
  NO prior `approve` (still TIP-403 + limit-checked); pause blocks transfers but NOT
  `transferFeePostTx` refunds.
- **Zone/bridge**: portal proxies + shared verifier + messenger callbacks; docs themselves warn
  "addresses alone do not establish execution-proof enforcement" — hunt message-auth/replay/
  premature-settlement. `consensus` notarized ≠ finalized — settlement on notarization is a bug.
- **Native-AA signature surface**: WebAuthn clientDataJSON checked by **substring**
  (`"type":"webauthn.get"`, `"challenge":"<b64url(txhash)>"`) not JSON parse; `pre_hash` flag;
  Keychain sig = `0x03||user_addr||inner` — check any contract reimplementing/verifying these.

## T2 — denial / lock / griefing

- Fee-token liquidity gate: sponsored/alt-token fee txs fail validation if Fee AMM pool reserves
  are short → wallets/apps defaulting to illiquid fee tokens wedge; grief by draining the
  pair's rebalance side (permissionless `rebalanceSwap`).
- Whole-batch revert via one poisoned recipient (see T1) — also `valid_before` expiry on queued
  signed txs; reserved nonce keys (MSB `0x5b`); new-nonce-key gas +22,100.
- Receive-policy weaponization: a contract that must receive tokens but lets callers influence
  its TIP-403 receive policy (or an upstream that sets it) silently diverts settlement.
- Role-admin rotation on shared TIP-403 policies (`setPolicyAdmin`) — one policy can govern many
  tokens; hijack blocks an ecosystem.

## T3 — token specifics (Tempo flavor)

- 6-decimals hardcoded: `1e18` scaling, `decimals()` caching from other tokens, cross-token
  amount reuse — all suspect.
- `systemTransferFrom`/`transferFeePreTx`/`transferFeePostTx` are precompile-only — a contract
  "calling" them for accounting is reading a lie; conversely treat their events as trusted
  system moves in indexers.
- `TransferWithMemo` fires on mint/burn too (`from`/`to` = 0) — check before attributing to
  user payments.
- Quote-token two-phase (`setNextQuoteToken`→`completeQuoteTokenUpdate`): mid-update routing
  and fee two-hop paths shift under in-flight txs.

## Detection signatures (greps)

```
# crediting patterns → redirect/virtual/two-hop bugs
transfer\(|safeTransfer|Transfer\(|balanceOf\(|deposit|credit|ledger|invoices?\[|memo
# sponsorship / AA plumbing
fee_payer|feePayer|sponsor|0x78|key_authorization|keyAuthorization|access.?key|keychain|0xAAAAAA|4E4F4E4345|nonce_key|nonceKey|valid_?(before|after)|validUntil|getTransactionKey|tx\.origin
# policy / compliance surface
transferPolicyId|policyId|TIP403|0x403C|receivePolicy|ReceivePolicyGuard|0xB10C|blacklist|whitelist|isAuthorized
# enshrined precompile interaction
0x20[cC]0|0x20[fF]c|0xfeeC|0xdeC0|0x516530|0xFDC0|4D5050|0x5AF2|0x5AD1|0x5a56|0x5A4d
# virtual addresses / memos / DEX
virtual|0xFDC0|transferWithMemo|TransferWithMemo|bytes32.*memo|flip|orderId|quoteToken
# native-token mirage
msg\.value|\.balance\b|call\{value|payable|send\(|transfer\(.*\.balance
# off-chain (ts/py sponsor/indexer services)
viem/tempo|tempo_fund|fee_token|feeToken|sign.*0x78|chain_id.*0|chainId.*0
```

## Runbook — how the pack hunts a Tempo target

1. **FETCH** repo; inventory `*.sol` + services (`viem/tempo`, `web3` tempo ext, sponsor
   endpoints, indexers). Note pinned hardfork / chain id.
2. **STATIC**: solc/forge build + slither (plain EVM) + signature greps above. Map every
   TIP-20 call site: who credits, who reads events, who assumes receipt.
3. **RESEARCH**: pull relevant TIPs (`tips.sh/<n>` or `tips/` in tempoxyz/tempo — esp.
   tx-type, keychain, receive-policy, channel-reserve state machines); `tempo_forkSchedule`
   for active fork; confirm predeploy addresses on-chain.
4. **ANALYZE**: every finding = (contract line) × (which Tempo semantic breaks it). Prioritize:
   deposit-credit vs redirect/virtual/memo; sponsor services vs envelope scope; session-key
   claims vs contract-mediation bypass; batch atomicity vs per-call failure.
5. **DEVIL** — kill on sight:
   - "blocked transfer doesn't revert" **alone** = intended T6 behavior, not a bug — the bug is
     the app's mis-accounting; show the divergence or kill.
   - `transferFeePostTx` working while paused — spec'd.
   - `distributeFees` anyone-callable — pays the validator, not the caller.
   - Fixed-rate Fee AMM "mispricing" — by design; need a concrete drain path.
   - Anything requiring mainnet, validator keys, or protocol-internal mutation — out of scope;
     L1 finds go to SECURITY.md disclosure (no bounty yet).
6. **POC**: `anvil --tempo` fork of Moderato → faucet → deploy target → assertion =
   attacker funds up OR ledger/token-balance divergence (+guard receipt accounting). Sponsored/
   keychain paths need viem/tempo or python SDK; missing ⇒ `detected-not-proven`.
7. **REVIEW/REPORT**: severity realistic — most hits are integration bugs in the product
   (still valid hackathon-grade findings), a few are protocol-grade. Cite TIP + fork version.
