# Hyperliquid vuln atlas — HyperCore ↔ HyperEVM boundary

Use when `TARGET_DIR` contains `*.sol` referencing the 0x800-range precompiles / `0x3333…3333`, JS/TS/Python bots handling `approveAgent`/EIP-712 `Exchange`-domain signatures, HIP-1 spot-deploy scripts, or HIP-3 deployer tooling. The money sits on **two layers of one chain**; almost every interesting bug is a boundary assumption. Companion to `evm-atlas.md` (all standard EVM classes still apply).

## Ground truth — networks & addresses

| Thing | Value |
|---|---|
| Mainnet chain id | `999` — RPC `https://rpc.hyperliquid.xyz/evm` (100 req/min/IP, no WS) |
| Testnet chain id | `998` — RPC `https://rpc.hyperliquid-testnet.xyz/evm`, alt `https://rpcs.chain.link/hyperevm/testnet` |
| Core API | `https://api.hyperliquid.xyz/info` `…/exchange`; testnet `api.hyperliquid-testnet.xyz` |
| CoreWriter | `0x3333333333333333333333333333333333333333` (`sendRawAction(bytes)`) |
| Read precompiles | `0x0000000000000000000000000000000000000800`–`0x813` (staticcall, abi-encoded) |
| Token system addr | `0x20` + zeros + token index BE — e.g. index 200 → `0x2000…00c8`; USDC (index 0) → `0x2000…0000` |
| HYPE system addr | `0x2222222222222222222222222222222222222222` (HYPE token index 150 mainnet, **1105 testnet**) |
| USDC on HyperEVM | `0xb88339CB7199b77E23DB6E890353E22632Ba630f` (native Circle USDC); testnet `0x2B3370eE501B4a559b57D449569354196457D8Ab` |
| CoreDepositWallet | `0x6B9E773128f453f5c2C60935Ee2DE2CBc5390A24`; testnet `0x0B80659a4076E9E93C7DbE0f10675A16a3e5C206` |
| WHYPE | `0x5555555555555555555555555555555555555555`; USDT0 `0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb` |
| Token registry | `0x0b51d1A9098cf8a72C325003F44C194D41d7A85B` (evmContract ↔ tokenIndex, hyper-evm-lib) |
| Arbitrum Bridge2 | `0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7` (mainnet), `0x08cfc1B6b2dCF36A1480b99353A354AA8AC56f89` (testnet); native Arb USDC `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`; min deposit 5 USDC, credited to **sender** |

## Architecture — where the bugs live

One HyperBFT L1 runs two execution surfaces:

- **HyperCore** — the exchange: perp books (validator-operated + HIP-3 builder dexes), spot order books (HIP-1 tokens), vaults, staking, margin engine, system state. Closed source, driven by signed `/exchange` actions.
- **HyperEVM** — Cancun EVM (no blobs, EIP-1559, base+priority fees burned; pre-EIP-155 txs accepted). HYPE is gas. EVM blocks are *built inside* L1 blocks.

**L1 block ordering (memorize — this is the bug surface):**
1. L1 block built → 2. EVM block built → 3. EVM→Core transfers processed → 4. CoreWriter actions processed.
- Core→EVM transfers are **queued until the NEXT EVM block**.
- **The CoreWriter caller's Core account must exist BEFORE the EVM block is built.** An EVM→Core transfer that initializes the contract's account in the same block still gets its actions **rejected** — atomically bridging-then-trading silently fails on first use.
- CoreWriter is async fire-and-forget: it burns ~25k gas and emits a `RawAction` log (~47k gas total). If the action is rejected on Core, **the EVM tx does NOT revert**. No receipt, no callback.
- Read precompiles return state as of **EVM block start** — a CoreWriter action in the same block is invisible to same-block reads. Precompile gas = `2000 + 65*(in+out)`; **invalid input consumes ALL gas passed into the call frame**.
- Dual blocks: small 1s/3M gas, big 1min/30M gas. Deployments & big txs need `usingBigBlocks` (`{"type":"evmUserModify","usingBigBlocks":true}` Core action — requires an existing Core user). On-chain mempool accepts only next 8 nonces/address; >1-day-old txs pruned.
- The contract IS the Core actor: every action executes as **the calling contract's own Core account** — no user delegation exists at the EVM layer. Custody is always contract-level.

**CoreWriter action IDs** (payload = `0x01` version byte + `uint24` BE id + abi.encode):
`1` limitOrder `(asset u32, isBuy, limitPx u64, sz u64, reduceOnly, tif u8{1ALO/2GTC/3IOC}, cloid u128)` · `2` vaultTransfer `(vault, isDeposit, usd)` · `3` tokenDelegate `(validator, wei, isUndelegate)` · `4` stakingDeposit · `5` stakingWithdraw · `6` spotSend `(dest, token u64, wei)` · `7` usdClassTransfer `(ntl, toPerp)` · `8` finalizeEvmContract `(token, variant{1Create/2FirstStorageSlot/3CustomStorageSlot}, createNonce)` · `9` addApiWallet `(wallet, name)` · `10` cancelByOid · `11` cancelByCloid · `12` approveBuilderFee `(maxFeeRate, builder)` · `13` sendAsset `(dest, subAccount, srcDex u32, dstDex u32, token, wei)` (`0xFFFFFFFF` = spot) · `15` borrowLend `(op{0supply/1withdraw}, …)` · `16` setAbstraction `{1disabled/2unified/3portfolioMargin}`.

**Bridge directions (sender-bound):** EVM→Core = transfer ERC20 to its `0x20…{index}` system address → credited to the **sender's** Core account (Core trusts the `Transfer` event). Core→EVM = `sendAsset`/spotSend to the system address → a system tx calls `transfer(sender, amount)` on the linked ERC20 — arrives at **sender's own** EVM address. USDC exception: `CoreDepositWallet.deposit(amount, dex)` / `depositFor(recipient, amount, dex)` lets you pick recipient + destination dex (`0xFFFFFFFF` spot, `0` default perp).

## PoC toolchain

- **Foundry works** (forge/cast standard). `anvil --fork-url https://rpc.hyperliquid.xyz/evm` forks EVM state **but precompiles revert and 0x3333 is empty code** — naive forks silently "succeed" CoreWriter calls with zero effect. Never trust a CoreWriter call inside a plain fork.
- **Correct local PoC path — `hyper-evm-lib` (Obsidian Audits):** `forge install hyperliquid-dev/hyper-evm-lib`; in test: `vm.createSelectFork("https://rpc.hyperliquid.xyz/evm"); CoreSimulatorLib.init();` → `CoreSimulatorLib.nextBlock()` executes queued CoreWriter actions + bridging against a simulated `HyperCore` (reads initial state via RPC, etches mock precompiles at 0x800–0x813). This is the only sane way to prove boundary exploits locally.
- **Testnet (chain 998):** get testnet USDC via `app.hyperliquid-testnet.xyz` faucet (address must have prior mainnet activation); trade→HYPE→transfer to EVM at `0x2222…`. Deploy via big blocks (LayerZero: `npx @layerzerolabs/hyperliquid-composer set-block --size big --network testnet`). Explorer `testnet.purrsec.com`; verify `--verifier sourcify --verifier-url https://sourcify.parsec.finance/verify --chain-id 998`.
- Driving Core state off-chain: `POST /info` (`spotMeta`, `clearinghouseState`, `spotClearinghouseState`, `maxBuilderFee`), `POST /exchange` with EIP-712 sigs — L1 actions domain `"Exchange"` chainId **1337** (both nets), user-signed actions domain `"HyperliquidSignTransaction"` chainId **0x66eee**; nonce = ms timestamp, top-100 nonces per signer.
- HyperEVM-specific JSON-RPC: `eth_bigBlockGasPrice`, `eth_usingBigBlocks`, `eth_getSystemTxsByBlockNumber/Hash` (system txs = Core→EVM credits). Boundary revert = error code **10055**.
- **Never** send attack txs to mainnet (AGENTS rule); prove on fork+simulator or testnet only.

## What a "program" is here — where the money is

- **Solidity contracts on HyperEVM** holding EVM assets AND Core state (spot/perp margin/vault equity of the contract's own Core account). A vault contract's real funds may live on Core — EVM balances understate custody.
- **Core accounts as contract actors** — the contract's core balance is reachable ONLY via CoreWriter/sendAsset paths; if the contract exposes no exfil path, deposited core assets are stranded (or stuck until someone calls the right action).
- **Agent/API wallets** — off-chain secp256k1 keys approved via master-signed `approveAgent`. Can sign **L1 actions only** (order/cancel/modify/twap/updateLeverage/updateIsolatedMargin/vaultTransfer/subAccountTransfer). Cannot: withdraw, spotSend/usdSend, approve agents/builder fees. `valid_until` embedded in agent name; dereg = re-approve same name. **Docs warn: once an agent is deregistered its nonce state is pruned → previously signed actions become REPLAYABLE.** Contracts can add API wallets to *their own* core account via action `9` — an off-chain key backdoor into contract funds.
- **Vaults** — community vaults: 100 USDC to create, leader ≥5% equity, 10% profit share, 1-day depositor lockup (resets on deposit). HLP: 4-day lock, backstops validator-perp liquidations. `vaultTransfer` is callable by agents AND by contracts (action 2).
- **Builder codes** — `approveBuilderFee(maxFeeRate, builder)` master-signed; caps 0.1% perp / 1% spot; builder needs ≥100 USDC perps + standard abstraction. Fee siphon if a contract approves an attacker builder at max rate.
- **HIP-1 spot deploys** — 31h Dutch auction (min 500 HYPE); `requestEvmContract` (core deployer) + `finalizeEvmContract` (the EVM contract itself calls CoreWriter action 8 — self-consent link, **irreversible**). Deployer controls szDecimals/weiDecimals, fee share, HIP-2 liquidity.
- **HIP-3 builder perp dexes** — 500k HYPE slashable stake, deployer sets `oracleUpdater`, margin tables, OI caps, fee recipient; per-dex backstop liquidator + ADL. **The deployer (or their key) controls the oracle** — trust assumption for anything building on a HIP-3 dex.
- **Arbitrum Bridge2** — the only fiat rail; deposits credit `msg.sender`, withdrawals need 2/3-validator signatures + dispute period. Source published (`hyperliquid-dex/contracts`, Bridge2.sol) — the one auditable protocol contract.

## Vuln classes — hunt order

### T1 — direct fund movement / silent loss

- **A. Unguarded CoreWriter reachability.** Any public/external fn that reaches `sendRawAction` with caller-influenced bytes or params: `spotSend`→drain contract core spot to attacker; `usdClassTransfer`/`sendAsset`→move perp collateral; `vaultTransfer(isDeposit=false)`→pull vault equity into contract then out; `limitOrder`→self-trade the contract's book against attacker quotes (the "agent drain" pattern, on-chain version); `tokenDelegate`+`stakingWithdraw`→unstake contract HYPE. Check modifiers on EVERY function in the call graph of the CoreWriter call.
- **B. `addApiWallet` (action 9) as persistent backdoor.** Unguarded/reachable → attacker registers THEIR key on the contract's core account → off-chain signed drain via trading, invisible to EVM state. Also flag intentional-but-unsafe designs: contract-managed API wallets with leaked/lost key handling.
- **C. Sender-bound bridge misattribution.** `usdc.transfer(0x2000…0000, amount)` or `IERC20(t).transfer(systemAddr, amt)` inside a contract credits the **contract's** Core account, not the user. Same on Arbitrum side (Bridge2 credits msg.sender). A "deposit router" that forwards user funds to a system address strands them on the contract's core account — irrecoverable unless the contract has a core-side recovery action. Legit cross-user credit only via `CoreDepositWallet.depositFor`.
- **D. First-interaction silent rejection.** bridgeToCore + CoreWriter action in one call on a contract that never existed on Core → action dropped (account must pre-exist at EVM-block build), funds bridged anyway, no revert. Contract with no retry/refund path = stuck funds. Same class: `spotSend`/`sendAsset` to a **destination that isn't a Core user** → rejected silently, EVM-side accounting already updated. Check for `coreUserExists` (0x810) pre-checks.
- **E. Decimal/wei truncation across the boundary.** Core uses `weiDecimals` (typically 8; HYPE 8 vs EVM 18 — `HYPE_EVM_EXTRA_DECIMALS=10`). Bridging `evmAmount` without `evmToWei` conversion: amount < 1 core-wei → converted amount `0` but tokens already transferred to system address = **permanent loss** (hyper-evm-lib reverts `EvmAmountTooSmall`; raw code won't). Also `uint64(amount)` silent truncation >u64.
- **F. Read-oracle manipulation between layers.** `spotPx`(0x808)/`bbo`(0x80e)/`markPx`(0x806) feed EVM-side valuation → attacker moves the Core book in the same L1 window (thin spot = cheap) then calls the EVM contract; stale-until-next-block reads mean the EVM contract prices off attacker-set prints. `oraclePx`(0x807) is validator-fed — stronger but still not manipulable-proof for dead pairs. Any lending/liquidation/settlement math on raw `spotPx`/`bbo` without bounds/TWAP is the JELLYJELLY pattern ported to EVM.
- **G. Precompile gas DoS.** Invalid token/asset/vault input → precompile **consumes all gas in the call frame**. Unvalidated user-supplied indices in loops → brick. Also missing `require(success)` on the staticcall → decoded garbage.
- **H. Same-block stale state.** Contract reads `spotBalance`/`withdrawable`/`accountMarginSummary`, then relies on a just-sent CoreWriter action having landed — it hasn't (block-start reads). Accounting that assumes synchronous core effects.

### T2 — authorization & cross-layer trust

- **I. finalizeEvmContract abuse (action 8).** Reachable from any fn in the linked contract → self-finalize to an unintended token index, or front-run `requestEvmContract`→`finalize` ordering. Link is irreversible → bricked token bridge. Also `FirstStorageSlot`/`CustomStorageSlot` variants: contract must actually hold the token index at the declared slot — slot mismatch = link that breaks bridging.
- **J. approveBuilderFee (action 12) / sendAsset subAccount (action 13).** Contract approving attacker builder at max fee = fee siphon on every fill. `sendAsset` with caller-controlled `subAccount`/`destination`/`destination_dex` = drain contract sub-accounts or route to attacker dex/sub-account.
- **K. Vault lockup & manager abuse.** `vaultTransfer` withdrawal reverts-core-side when inside `lockedUntilTimestamp` (precompile `userVaultEquity` exposes it) → silent fail. Contract-as-vault-leader patterns: leader trades depositor funds, 5% skin — soft-rug surface (see Hypervault). Deposits into vaults via unvalidated vault address = funds sent to attacker vault with 1-day lock.
- **L. Agent-key handling in bots/frontends (off-chain code in repo).** Agent key in repo/env/logs; approveAgent without `valid_until`; master key used where agent suffices; signed L1 actions cached and rebroadcast (nonce-prune replay); backend that signs `approveAgent`/`approveBuilderFee`/`spotSend` for users via blind signing endpoint.
- **M. HIP-3 deployer trust.** Contracts reading HIP-3 dex prices/positions inherit the deployer's oracleUpdater key — flag integrations that treat deployer-set `setOracle` prices as honest; deployer-set OI caps/margin tables can be changed under live positions.
- **N. Bridged-USDC trust boundary.** EVM USDC is native Circle, but its Core credit depends on the `Transfer`-event path: tokens with non-standard transfer semantics (fee-on-transfer, rebasing, double-emitting Transfer) break the credit accounting; a linked ERC20 that emits `Transfer(from→systemAddr)` without moving real value could mint unbacked Core credit — flag any custom token linked via `finalizeEvmContract` that isn't supply-locked at the system address on the other side (docs require system address to hold the full opposing supply).

### T3 — ecosystem/codebase patterns

- **O. Hardcoded mainnet/testnet mixups.** `block.chainid == 998` branches, testnet USDC `0x2B3370…`/CDW `0x0B80659a…`, HYPE index 150 vs 1105 — dev artifacts shipped to wrong net = real fund loss.
- **P. `tx.origin`/sender confusion at the boundary.** Core actions attribute to the CONTRACT, never the user: any per-user accounting the contract maintains on top (deposit→shares with core-custodied principal) is a multisig-of-one rug surface unless action paths are access-controlled and exfil is user-bound.
- **Q. Standard EVM classes still kill** (evm-atlas.md): reentrancy incl. callbacks from linked-ERC20 `transfer` in system txs, ERC-4626 inflation on HyperEVM vaults, proxy upgrade hijack, oracle misuse generally.
- **R. Mempool/ordering quirks.** Only 8 pending nonces/address — bots that burst-submit drop txs; pre-EIP-155 txs accepted (replay across envs if wallets reuse); big-block contracts only settle 1/min — liquidation-critical paths can't depend on big-block timing.

## Detection signatures — grep the repo

| Class | ripgrep patterns |
|---|---|
| A/B/J unguarded writer | `0x3333{3,}` · `sendRawAction` · `uint24\(6\)|uint24\(9\)|uint24\(12\)|uint24\(13\)` · `SPOT_SEND_ACTION|ADD_API_WALLET|APPROVE_BUILDER_FEE|FINALIZE_EVM_CONTRACT|SEND_ASSET` — then check enclosing fn visibility/modifiers |
| C misattribution | `transfer\(\s*(getSystemAddress|0x20[0-9a-fA-F]{38}|0x2222+)` · `systemAddress` near `transfer|safeTransfer|call\{value` without `depositFor` |
| D silent rejection | `sendRawAction` in same fn as `transfer(systemAddr` / `deposit(` without prior `0x0000000000000000000000000000000000000810` staticcall · missing core-user precheck before `spotSend`/`sendAsset` |
| E decimals | `uint64\(` casts on `amount`/`wei` near system-address or action-9..13 paths · `1e10|10\*\*10|HYPE_EVM_EXTRA_DECIMALS` assumptions · `weiDecimals|szDecimals` never read via `tokenInfo`(0x80c) |
| F oracle | `0x000000000000000000000000000000000000080[678e]` staticcall feeding `borrow|collateral|liquidat|mint` math without min/max bounds or staleness window · `bbo`/`spotPx` as sole price source |
| G gas DoS | staticcall to `0x…080[0-9a-f]` inside `for` over user input · missing `require\(success` after precompile staticcall |
| H stale state | precompile read after `sendRawAction` in same fn used for `require`/accounting |
| I finalize | `finalizeEvmContract|encodedVariant|FirstStorageSlot|createNonce` — visibility of the fn; does declared slot actually store index |
| K vaults | `vaultTransfer|VAULT_TRANSFER_ACTION|userVaultEquity` — check `lockedUntilTimestamp` honored, vault address pinned |
| L agents (JS/Py) | `approveAgent|agentName|valid_until` · `"Exchange".*1337` · `HyperliquidSignTransaction` · `privateKey|PRIVATE_KEY` in repo, keys in logs, sign-endpoints `signTypedData` unauthenticated |
| O net mixup | `0x2B3370eE501B4a559b57D449569354196457D8Ab|0x0B80659a4076E9E93C7DbE0f10675A16a3e5C206|chainid == 998|1105` in prod paths |
| rug patterns | `onlyOwner`/`onlyOperator` on fns that move EVM→Core or call `sendRawAction` (custody concentration — the Hypervault shape) |

## PoC rules of engagement

- Prove fund movement: attacker ends holding the assets (EVM side) or a test shows the core-side action queued with the attacker's destination — use `CoreSimulatorLib` so the core effect is observable.
- A broken toolchain = `detected-not-proven`. Never claim a CoreWriter path "executes" without sim/testnet evidence — silent drops are the norm, not the exception.
- Cross-layer PoCs must model the block boundary: actions land next block; account-existence is checked at block build. A PoC that ignores the boundary isn't a PoC.
