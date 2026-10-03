# EVM vuln atlas — Solidity (EthL1 / Base / Arbitrum / Robinhood / HyperEVM / Tempo)

Used when TARGET_DIR contains `*.sol`. The same spine applies — cite real code, kill on sight what the code disproves. PoC tooling on the box: `forge`/`cast`/`anvil` (foundry) — if absent, mark `detected-not-proven`, never fake it.

## T1 — fund movement
- **reentrancy** — external call before state update; `call{value:}` then write; cross-function reentrancy (view used as lock); read-only reentrancy in other contracts consuming stale state. Check CEI ordering + nonReentrant coverage on EVERY payable/external-with-state fn.
- **access control** — public/external fn mutating funds without `onlyOwner`/role; missing `initializer` on upgradeables (implementation takeover); `tx.origin` auth; unprotected `selfdestruct`/`delegatecall` reachable.
- **oracle manipulation** — spot-price reads (pool reserves, `getReserves`, univ2/v3 instantaneous), missing staleness bounds, single-source price, decimals mismatch, inverse-quote confusion.
- **accounting** — share inflation / first-depositor (ERC-4626 `totalAssets==0` donate-then-mint), rounding direction (mulDivDown vs up), fee-on-transfer / deflationary tokens breaking balances, interest accrual order.
- **signature** — missing nonce/chainid/deadline in signed digest → replay & cross-chain replay; `ecrecover` without zero-address check; permit front-running; signature malleability (s-value).
- **approval/transferFrom abuse** — unrestricted `transferFrom` of others' allowances; `permit`/`approve` race; arbitrary spender in callback params.
- **delegatecall / arbitrary call** — user-controlled target or calldata in `call`/`delegatecall`; multicall(msg.value) reuse (all subcalls see the same value — classic payable-multicall drain).
- **proxy/upgrade** — storage-slot collision, uninitialized implementation, UUPS upgrade fn unguarded, `selfdestruct` in implementation.
- **bridge / cross-chain (Robinhood/Arbitrum-relevant)** — message verification skipped, unbound sender on L2-side callback, replayable proofs, wrong source-chain check.
- **flash-loan surface** — prices/votes/limits that a same-tx loan can move; callback authentication on flashloan receivers (initiator not checked).
- **MEV/ordering** — commit-less reveals, tx-order-dependent settlement, deadlineless swaps.

## T2 — denial / lock / griefing
- push-loops over unbounded arrays (DoS by gas), external-call revert bricks queue, underflow on `unchecked`, dust blocking settle, grief-by-inflation.
- `block.timestamp`/`blockhash` as randomness; `gasleft()` semantics; create2 address squat on deploys.

## T3 — token specifics
- ERC-777 hooks, fee-on-transfer, rebasing tokens vs cached balances, `transfer` return value unchecked (USDT-style missing bool), decimals assumptions, `approve` non-zero-first (USDT requires reset-to-zero).
- Permit2 / Permit signatures, token approve-in-constructor of implementation.

## Rules of engagement for EVM PoCs
- anvil fork if RPC provided (`anvil --fork-url`), else local litesvm-style unit with forge `vm.*`.
- PoC must end with the attacker holding the funds / the invariant violated in the test assertion — not "theoretically".
- Same gate: bounded time — a broken toolchain is `detected-not-proven`, not a failed hunt.
