# EVM vuln atlas — Solidity (EthL1 / Base / Arbitrum / Robinhood / HyperEVM / Tempo)

Used when TARGET_DIR contains `*.sol`. The same spine applies — cite real code, kill on sight what the code disproves. PoC tooling on the box: `forge`/`cast`/`anvil` (foundry) — if absent, mark `detected-not-proven`, never fake it. Full per-chain deep-dive: `/tmp/research-evm.md`.

## T1 — fund movement
- **reentrancy** — external call before state update; `call{value:}` then write; cross-function reentrancy (view used as lock); read-only reentrancy in other contracts consuming stale state. Check CEI ordering + nonReentrant coverage on EVERY payable/external-with-state fn.
- **access control** — public/external fn mutating funds without `onlyOwner`/role; missing `initializer` on upgradeables (implementation takeover); `tx.origin` auth; unprotected `delegatecall` reachable. (`selfdestruct` findings are post-EIP-6780: only same-tx-creation still works — verify before reporting.)
- **oracle manipulation** — spot-price reads (pool reserves, `getReserves`, univ2/v3 instantaneous), missing staleness bounds, single-source price, decimals mismatch, inverse-quote confusion. **On L2: Chainlink without the sequencer-uptime feed + grace period** is a live class (stale price right after sequencer recovery).
- **accounting** — share inflation / first-depositor (ERC-4626 `totalAssets==0` donate-then-mint), rounding direction (mulDivDown vs up), fee-on-transfer / deflationary tokens breaking balances, interest accrual order.
- **signature** — missing nonce/chainid/deadline in signed digest → replay & cross-chain replay; `ecrecover` without zero-address check; permit front-running; signature malleability (s-value). With multiple chains in scope (1/8453/42161/4663), `chainId` omitted or hardcoded wrong = free cross-chain replay.
- **approval/transferFrom abuse** — unrestricted `transferFrom` of others' allowances; `permit`/`approve` race; arbitrary spender in callback params.
- **delegatecall / arbitrary call** — user-controlled target or calldata in `call`/`delegatecall`; multicall(msg.value) reuse (all subcalls see the same value — classic payable-multicall drain).
- **proxy/upgrade** — storage-slot collision, uninitialized implementation, UUPS upgrade fn unguarded.
- **bridge / cross-chain** — see chain-specific classes below; the T1 core is: message verification skipped, sender provenance taken from a parameter instead of portal/outbox-verified source, replayable proofs, wrong source-chain check.
- **flash-loan surface** — prices/votes/limits that a same-tx loan can move; callback authentication on flashloan receivers (initiator not checked).
- **MEV/ordering** — commit-less reveals, tx-order-dependent settlement, deadlineless swaps. On L2 the "mempool" is the sequencer's: ordering/liveness assumptions = trust boundary, see below.

## T2 — denial / lock / griefing
- push-loops over unbounded arrays (DoS by gas), external-call revert bricks queue, underflow on `unchecked`, dust blocking settle, grief-by-inflation.
- `block.timestamp`/`blockhash` as randomness; `gasleft()` semantics; create2 address squat on deploys.
- `extcodesize == 0` as an auth/EOA check — bypassed from a constructor.
- On Nitro/Orbit L2s (`Arbitrum`, `Robinhood`): `block.number` returns the last-synced **L1** block — countdowns/rate-limits run ~100× slower or jump; `block.timestamp` is sequencer-assigned and can move **backwards** when delayed messages fold in. Any `>=`/`block.number`-elapsed gate is suspect.
- Cross-chain liveness: withdrawal/queue logic whose window is shorter than the challenge period (Base ~7d, Arb/RHC ~6.4d / 45818 blocks) or the force-inclusion delay (~24h Arb-family, ~12h OP) can be bricked by operator downtime — real but bounded, report honestly.

## T3 — token specifics
- ERC-777 hooks, fee-on-transfer, rebasing tokens vs cached balances, `transfer` return value unchecked (USDT-style missing bool), decimals assumptions (USDC=6 vs 18), `approve` non-zero-first (USDT requires reset-to-zero).
- Permit2 / Permit signatures, token approve-in-constructor of implementation.
- Bridged-token identity: an L2 bridged ERC-20 is a **different contract** (`calculateL2TokenAddress` on the gateway router, `OptimismMintableERC20` on Base) — code assuming the L1 address, or a token registry/gateway that lets anyone register a lookalike mapping, is a substitution bug.
- Gateway non-standards: tokens that break the standard-bridge path (fee-on-transfer, rebasing, pausable, double-entry like TUSD/SNX-style) need custom-gateway flows — apps assuming standard-bridge semantics strand or miscredit them.

## Chain-specific classes — Nitro/Orbit (Arbitrum One 42161, Robinhood 4663)
- **retryable lifecycle** — L1→L2 via `Inbox.createRetryableTicket` is NEVER atomic: ticket auto-redeems, and on failure sits ~7d for manual `ArbRetryableTx.redeem` then expires (`cancel` → refund). Hunt: crediting on ticket submission (not execution); no path for a late/failed/never-executed message; escrowed callvalue stranded on expiry; app-side `redeem` unauthenticated; `unsafeCreateRetryableTicket` skipping the re-deposit check; hardcoded `maxSubmissionCost`/`gasPriceBid` → underfunded (silent no-execute) or overcharged to an untracked refund address.
- **alias auth** — L2 `msg.sender` for an L1-originated call = `l1 + 0x1111000000000000000000000000000000001111` (mod 2^160). Raw `msg.sender == l1Contract` bricks the legit path, and a sloppy alias check (wrong offset sign, no mod, checking unaliased) lets an attacker forge the "L1 caller" on L2.
- **outbox / `l2ToL1Sender` spoof** — L1 withdrawal handler must read the Outbox-verified `l2ToL1Sender` and check `msg.sender == OUTBOX`; trusting a `sender` parameter = forgeable withdrawal. Check proof binding to (this rollup, this outbox, this chainid) — replay across lookalike outboxes.
- **ArbOS precompiles** (`0x64` ArbSys / `0x6E` ArbRetryableTx / `0x6C` ArbGasInfo / `0xC8` NodeInterface) — node-native, no bytecode on anvil forks. `sendTxToL1` callers are the L2→L1 message originators; any app wrapping them needs the same checks as raw callers.
- **force-inclusion** — delayed inbox (`sendL2Message`) bypasses the sequencer after ~24h; apps assuming sequencer ordering (auctions/liquidations/keeper-first) break, apps that gate against the delayed path can be bricked.

## Chain-specific classes — OP Bedrock (Base 8453)
- **portal withdrawals** — post-fault-proofs flow: `proveWithdrawalTransaction` (dispute-game root + 1h maturity) → `finalizeWithdrawalTransaction` (7d). The portal delivers `msg.sender = _tx.sender` to `_tx.target` — the receiving L1 contract must verify it expects that L2 sender. Hunt: wrong/unbound `l2Sender` in withdrawal data, finalize-before-window DoS of a queue, code still on the dead `L2OutputOracle` API.
- **failed-message replay** — XDM `relayMessage` failures are re-relayable by anyone (success is nonce-bound, no double-execute — but "it reverted so it's dead" is false). Handlers whose meaning changed under new state are exploitable via deliberate-fail → later replay; app-side retries must check the success record.
- **deposits** — `depositTransaction` is permissionless: anyone can enqueue an arbitrary L2 call; the L2 contract's whole L1-auth model is one aliased `msg.sender` compare (`0x1111…1111` scheme, same as Nitro).
- **portal direct-trust** — "I was called by the bridge because caller is whitelisted" is forgeable; the check is `msg.sender == portal/xdm` + reading `l2Sender()`/`xDomainMsgSender` — and `xDomainMsgSender` is only valid during the relayed call (caching it = bug).
- **L1Block staleness** — `0x4200…0015` scalars feed L2 fee math; post-Ecotone blob-fee fields drift.

## Chain-specific classes — sequencer / trust boundary (all L2s)
- **soft-confirmation ≠ final** — sequencer receipt/feed is not L1 finality; on-chain symptom is keeper/oracle/liquidation logic assuming instant inclusion & ordering.
- **sequencer-uptime oracle** — Chainlink on L2 without the uptime-feed grace-period check prices off the pre-downtime stale answer.
- **operator trust** — Robinhood (4663) runs sequencer+proposer with <5 external challengers (L2BEAT "Other"); Base and Arbitrum are single-sequencer too. "Sequencer could censor/reorder" alone is NOT a finding — known design. The finding is contract-level logic that *breaks* under a realistic sequencer behavior (downtime → force-inclusion, reorg → stale state credit).

## Detection signatures (greps — run per class)
```
# message-auth / bridge handlers — audit every hit's msg.sender check
onMessage|handleMessage|receiveFrom|onlyBridge|onlyMessenger|onlyPortal|onlyOutbox|onlyGateway|fromChainId|toChainId|l2ToL1Sender|xDomainMsgSender
# Nitro/Orbit (Arbitrum, Robinhood)
createRetryableTicket|unsafeCreateRetryableTicket|IInbox|ISequencerInbox|ArbRetryableTx|sendTxToL1|ArbSys|redeem\(|getTimeout|applyL1ToL2Alias|undoL1ToL2Alias|0x1111000000000000000000000000000000001111|0x00000000000000000000000000000000000000(64|6E|6C|65|66|68|6F|70|C8)
# OP Bedrock (Base)
OptimismPortal|depositTransaction|proveWithdrawalTransaction|finalizeWithdrawalTransaction|relayMessage|CrossDomainMessenger|L2ToL1MessagePasser|DisputeGameFactory|AnchorStateRegistry|L2OutputOracle|0x42000000000000000000000000000000000000(07|0F|10|12|15|16|06)
# alias math done by hand — check the arithmetic
0x1111|\+ 0x111|unchecked.*alias|address\(uint160
# sequencer/time trust
sequencerUptimeFeed|gracePeriod|GRACE_PERIOD|updatedAt|block\.number|block\.timestamp|blockhash|block\.coinbase
# chainid / replay
chainid|chainId|CHAIN_ID|DOMAIN_SEPARATOR|getChainId|\b(8453|42161|4663|46630|84532|421614)\b
# bridged-token identity
calculateL2TokenAddress|l1Token|l2Token|remoteToken|OptimismMintableERC20|IL2StandardToken|gateway|router
# value movement for the credit-on-call pattern
call\{value|sendValue|safeTransfer|transferFrom|deposit|withdraw|bridge|escrow
```

## Fork PoC recipes (anvil)
```bash
# per chain — pin a block, impersonate the bridge-side caller, mock what isn't bytecode
anvil --fork-url https://eth.llamarpc.com --fork-block-number <N> --auto-impersonate   # EthL1 (all L1 bridge halves live here)
anvil --fork-url https://mainnet.base.org --fork-block-number <N>                      # Base (predeploys have real code — work on fork)
anvil --fork-url https://arb1.arbitrum.io/rpc --fork-block-number <N>                  # Arbitrum (ArbOS precompiles EMPTY on fork)
anvil --fork-url https://rpc.mainnet.chain.robinhood.com --fork-block-number <N>       # Robinhood (same ArbOS caveat)
anvil --fork-url https://rpc.testnet.chain.robinhood.com                               # Robinhood testnet for stateful runs
# or: forge test --fork-url <RPC> --match-test testExploit -vvvv

# message delivery is simulated, not transported:
#   L1→L2 (Nitro):    vm.prank(applyL1ToL2Alias(l1Contract)) → l2Target.handler(payload)
#   L1→L2 (Bedrock):  vm.prank(L2XDM 0x4200…0007) → relayMessage; mockCall xDomainMsgSender
#   L2→L1:            on EthL1 fork, vm.prank(Outbox/Portal); mockCall(l2ToL1Sender / l2Sender)
# ArbOS precompiles absent on Nitro forks → vm.etch(addr, mockCode) or vm.mockCall(...):
#   vm.mockCall(0x64, abi.encodeWithSelector(ArbSys.sendTxToL1.selector), abi.encode(0))
# useful cast: anvil_impersonateAccount, anvil_setBalance, anvil_setCode, cast storage/proof
```

## Rules of engagement for EVM PoCs
- anvil fork if RPC provided (`anvil --fork-url`), else local litesvm-style unit with forge `vm.*`.
- PoC must end with the attacker holding the funds / the invariant violated in the test assertion — not "theoretically". For cross-chain classes: a forged-sender execution, recoverable stranded escrow, or asserted ledger-vs-balance divergence all count; "the message could fail" alone does not.
- **Detected-not-proven honesty rule**: if foundry (`forge`/`anvil`/`cast`) is absent, the fork can't emulate the semantics (ArbOS precompiles, real transport), or the chain's RPC is unreachable — mark the finding `detected-not-proven` with a written PoC outline. NEVER fabricate run output; a broken toolchain is `detected-not-proven`, not a failed hunt.
- DEVIL kills, EVM edition: "centralized sequencer could censor" (design), "cross-chain message can fail/delay" (design — the app-level mis-handling is the bug), "7-day withdrawal" (protocol property), post-EIP-6780 `selfdestruct` findings that can't move funds, `block.number`-is-L1 observations the code already handles.
