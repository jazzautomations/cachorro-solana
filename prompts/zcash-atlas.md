# Zcash atlas — no smart contracts; hunt consensus delta, the light-client trust boundary, and integration glue

Used when TARGET_DIR is Zcash-flavored: `zcash_*`/`librustzcash`/`orchard`/`zebra`/`zaino`/`lightwalletd`/
`zallet` deps, `CompactTxStreamer`/gRPC :9067, `zcash:` URIs, UA/`zs1`/`u1`/TEX addresses, memo handling,
ZEC wallet/checkout/swap/viewkey products. Full deep-dive: `/tmp/research-zcash.md`.

**Frame (say it in REPORT):** the Colosseum Zcash track is a *product* prize — there is no contract to
exploit. Findings land in (a) the submission's own integration code — that's the hunt — or (b) upstream
core repos, which go to Signal/GitHub-advisory disclosure (ZCG bounty program closed 2026-05; payout
discretionary). **Never mainnet, never real ZEC.**

PoC tooling (cheapest→heaviest):
- `lightwalletd --darkside-very-insecure` ("darksidewalletd") — mock node + `DarksideStreamer` gRPC:
  `Reset`/`StageBlocks(Create)`/`StageTransactions`/`ApplyStaged`; auto-dies in 30 min. Test data:
  `zcash-hackworks/darksidewalletd-test-data`. **This is our local-validator equivalent for the
  server-lies class — point a real wallet/SDK at it.**
- Regtest: `ZcashFoundation/z3` docker-compose (Zebra+Zallet+rpc-router+Zaino, NUs at height 2);
  `zingolabs/ztest` (k8s); `zingo-infra` localnet; zcashd `-regtest -nuparams=…` (`generate`);
  zebra `[network] network="Regtest"` + `internal-miner` (skips PoW).
- Crafted txs: librustzcash builders + byte mutation → `sendrawtransaction`; `QED-it/zcash_tx_tool`.
- `cargo fuzz` on `zcash_encoding`/address/URI/memo/PCZT parsers; `halo2` `MockProver` iff a target
  ships circuit code. `cargo audit` + `clippy` on every Rust dep tree. If a tool's missing:
  `detected-not-proven`, never fake it.

## T1 — the lightwalletd/Zaino trust boundary (hunt FIRST)

Server sees the chain for the wallet; anything it serves is unverified unless the client checks:
- **Omission/censorship** — drop a real incoming tx: merchant ships against "no payment," or hide a
  payment then double-spend. Check: does the wallet verify `hashFinalSaplingRoot`/commitment roots or
  trust `GetTreeState`? Any `min_conf=0` crediting? (lightwalletd#316 open for years.)
- **Fabrication/anchor lies** — staged blocks, fake tree state → wallet builds spends against a bad
  anchor (rejected txs = DoS) or misstates balances. PoC: darkside-serve junk, watch the SDK.
- **Sandblasting** — flood outputs to grind sync. Per-implementation; Ywallet/custom-sync code resurfaces it.
- **Privacy harvest** — `SendTransaction` + fetch pattern = who-pays-who graph; `GetAddressUtxos`/
  `GetTaddressTxids` hands the server the user's t-addrs; no Tor/Nym/proxy = IP↔wallet. WebZjs adds a
  **gRPC-web proxy hop** — a second trusted party integrations treat as invisible.
- **Transport/config** — `no-tls`, `InsecureChannel`, bundled expired CA (real audit finding), missing
  cert pinning, `darkside-very-insecure`/`regtest` flags shipped to prod, h2c on public interfaces.

## T2 — integration glue (where cohort submissions bleed)

- **ZIP-321 URI parsing** — `addr.N` multi-recipient, `req-*` params that MUST hard-fail if unsupported
  (ignoring = spec bug), decimal-vs-zatoshi amount confusion, b64url memo smuggling, Unicode/RTL tricks.
  Parser differential vs `zip321` reference = finding.
- **UA receiver selection (ZIP-316)** — receivers ordered Orchard>Sapling>transparent; a buggy sender
  falling back to the transparent receiver **deanonymizes the payment silently**. TEX (ZIP-320):
  transparent-source-only deposit addresses — treating TEX as `t1` and sending shielded-sourced funds
  = funds stuck at an exchange.
- **Key custody** — seed/FVK/IVK/UFVK in logs/env/telemetry/IndexedDB-plaintext; UFVK leak = permanent
  surveillance (no forward secrecy). `pczt` files carry FVK+note randomness+`ock` — logging/forwarding
  PCZTs leaks everything. `z_export(viewing)?key` behind RPC auth.
- **Memos (ZIP-302)** — 512B, leading-byte semantics (≤0xF4 UTF-8, 0xF5 arbitrary, ≥0xF6 reserved):
  parse divergence = smuggling; **memo→UI rendering = XSS/phishing in web wallets**; memo conventions
  (`refund-to`, commands, contacts — Ywallet's interception bug was High) parsed downstream = injection.
  NU7 ZIP-231 memo bundles = fresh parser territory.
- **Payment disclosures (ZIP-311)** — "prove-you-paid" flows that don't actually verify the proof.
- **Pool boundary** — auto-shield inside shielded sends (zecwallet-lite-cli precedent: dusting the
  t-addr links every shielded tx); any silent t↔z crossing; dust/poison flows.
- **Money math** — hardcoded fees vs ZIP-317 (`marginal_fee×max(2,actions)`), `nExpiryHeight` mishandling
  → stuck funds, zatoshi/decimal slip, `as i64`/`unwrap()` on amounts.
- **Panic-on-untrusted** — `.unwrap()`/`!!`/panic on server proto fields = remote DoS from hostile server.

## T3 — protocol delta (bounded, proven findable)

- **Verification-path ordering** — the 2026-03 Sprout bug: `fChecked` cache skipped proof verification
  on tip-connect (v3.1.0–v6.11.x, found by AI-assisted white-hat). Shape: checks disabled in pass 1,
  cached as "done," skipped in pass 2. Hunt this *shape* in zebra/zaino/zallet validation pipelines.
- **Consensus divergence** — `zcash_script` vs spec/reference; zcashd is gone → **Zebra has no second
  implementation catching it**; Zaino vs lightwalletd API-parity bugs; v6-tx (ZIP-229/230) edge cases.
- **Pool-transition rules** — NU6.3: Orchard spend-only (ZIP-2006), Ironwood gating, migration (ZIP-318);
  NU7 drafts: v4-disallow kills Sprout (ZIP-2003), NSM value accounting (233/234/235), explicit fees
  (2002). Turnstile invariant (ZIP-209): pool balances never negative — cite it as the blast-door bound.
- **Fuzz surfaces** — tx/address/block deserialization; `MockProver` underconstraint on shipped circuits.

## T4 — node/infra misconfig

`rpcuser/rpcpassword` + `rpcallowip=0.0.0.0/0` + :8232 → wallet-RPC theft (zcashd-era keys);
post-EOL zcashd (auto-halted, dead integrations); zebra `internal-miner`/regtest in prod; lightwalletd/
zaino `--no-tls-very-insecure`, open gRPC-web proxy, CORS `*`; `i-am-aware` flag semantics;
`txindex`/`experimentalfeatures` gaps; vendored `git = fork-branch` deps (WebZjs does it legit —
verify, don't assume).

## DEVIL — kill on sight

- "lightwalletd can lie" restated generically — documented threat model; a finding needs the *specific*
  client that fails to check X, or the product that ships a crediting-on-lie flow.
- t→z→t linkage heuristics as "bugs" — baseline privacy model unless the product adds a leak.
- Transparent-address visibility — by design; shielded-vs-transparent confusion only counts with a
  concrete routing/selection bug.
- Mainnet-requiring, miner-key, cryptanalytic, or sustained-fuzz claims — `detected-not-proven`.
- Anything the turnstile already bounds (pool-negative) — cite the bound, don't overstate; overstated
  severity disqualifies reporters per `zcash/SECURITY.md`.

## Runbook

1. FETCH: inventory deps (`zcash_*` versions, fork pins), gRPC clients, URI/memo/key codepaths, configs.
2. STATIC: clippy/audit/vet + signature greps (research doc §5) + `.unwrap()` census on server-fed fields.
3. RESEARCH: which ZIPs the code claims to implement; check NU6.3/NU7 deltas vs impl; upstream issue trackers.
4. ANALYZE: every finding = (file:line) × (which trust assumption/spec rule it violates).
5. DEVIL: kill per list above; keep only concrete funds/privacy/consensus-invariant paths.
6. POC: darkside > regtest/compose > crafted-tx > unit; assert the victim-visible divergence.
7. REPORT: severity realistic — most hits are integration-grade (still valid for the track); upstream-grade
   gets a disclosure note, not a bounty promise.
