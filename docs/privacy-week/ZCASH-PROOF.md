# Zcash shielded payout — reproducible proof (regtest)

**txid (z→z, Orchard→Orchard, fully shielded):**
`e8ef32d5640840a4ea46c2375cbe23e5603126f74ce4017c9e0d01946ab76f10`

amount: 0.5 ZEC · memo: `cachorro bounty` (hex-encoded)
payer: unified addr `uregtest10nt24n…yvk5a542` (account 0 — "treasury")
payee: unified addr `uregtest1hhd24g…eqgsdxxp` (account 1 — "claimant")
both Orchard pool — sender, receiver, amount and memo all shielded.

Shielding tx (coinbase → orchard):
`c99e03f689409e83f961bda2244bb402f86d140a8c389d7b441da7cbdf0242a5`

## What this proves for cachorro

The sealed-report claim flow pays the bug bounty / claim reward to the
repo owner over a fully shielded rail: on-chain there is no link between
the cachorro treasury and the claimant, no visible amount, no memo.
Same role the Cloak `transact` + `partialWithdraw` path plays on Solana
(`web/lib/cloak.ts`) — here demonstrated on Zcash Orchard.

## Reproduce

```bash
# 1. zcashd 6.20.0 regtest, all NUs at height 1
zcashd -regtest -daemon \
  -nuparams=76b809bb:1 -nuparams=2bb40e60:1 -nuparams=f5b9230b:1 \
  -nuparams=e9ff75a6:1 -nuparams=c2d6d0b4:1 -nuparams=c8e71055:1 \
  -txunpaidactionlimit=50 -blockunpaidactionlimit=50

# 2. mine past coinbase maturity
zcash-cli -regtest generate 110

# 3. two unified addresses (Orchard receivers)
zcash-cli -regtest z_getnewaccount                    # -> 0
zcash-cli -regtest z_getaddressforaccount 0 '["orchard"]'
zcash-cli -regtest z_getnewaccount                    # -> 1
zcash-cli -regtest z_getaddressforaccount 1 '["orchard"]'

# 4. shield coinbase into treasury UA
zcash-cli -regtest z_shieldcoinbase "*" <UA0> 0.0001
zcash-cli -regtest generate 5

# 5. the private payout — z->z, memo "cachorro bounty" (hex)
zcash-cli -regtest z_sendmany <UA0> \
  '[{"address":"<UA1>","amount":0.5,"memo":"636163686f72726f20626f756e7479"}]' \
  1 0.0001 AllowRevealedRecipients
zcash-cli -regtest generate 3
zcash-cli -regtest z_getbalanceforaccount 1   # -> 50000000 zats
```

Verified live: `z_getbalanceforaccount 1` → `orchard: 50000000 zats`.
