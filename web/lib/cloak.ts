import fs from 'fs'

// Cloak private payout rail — when a repo owner claims a finding, the
// bounty can be paid *privately*: treasury shields SOL into the Cloak
// pool, then withdraws to the claimant's public address. On-chain there's
// no link between cachorro's treasury and the hunter/owner.
//
// CACHORRO_TREASURY_KEYPAIR — path to the treasury keypair json on the box
// Requires @cloak.dev/sdk (npm). Fails soft — payout stays pending, never
// throws into the claim response.

export interface CloakPayoutResult {
  ok: boolean
  depositSig?: string
  withdrawSig?: string
  error?: string
}

export async function cloakPrivatePayout(recipientAddress: string, lamports: bigint): Promise<CloakPayoutResult> {
  try {
    const kpPath = process.env.CACHORRO_TREASURY_KEYPAIR
    if (!kpPath) return { ok: false, error: 'treasury keypair not configured' }

    const sdk = await import('@cloak.dev/sdk')
    const {
      CLOAK_PRODUCTION_RELAY_URL, CLOAK_PROGRAM_ID, NATIVE_SOL_MINT,
      createCloakRpc, createUtxo, createZeroUtxo, fullWithdraw, partialWithdraw,
      generateUtxoKeypair, serializeUtxo, signerFromSecretKey, transact,
    } = sdk

    const connection = createCloakRpc(process.env.CACHORRO_RPC || 'https://api.mainnet-beta.solana.com')
    const secret = Uint8Array.from(JSON.parse(fs.readFileSync(kpPath, 'utf8')) as number[])
    const signer = await signerFromSecretKey(secret)
    const relayUrl = CLOAK_PRODUCTION_RELAY_URL

    // 1. shield lamports into the pool
    const owner = await generateUtxoKeypair()
    const out = await createUtxo(lamports, owner, NATIVE_SOL_MINT)
    const deposited = await transact(
      {
        inputUtxos: [await createZeroUtxo(NATIVE_SOL_MINT)],
        outputUtxos: [out],
        externalAmount: lamports,
        depositor: signer.address,
      },
      {
        connection,
        programId: CLOAK_PROGRAM_ID,
        relayUrl,
        depositorKeypair: signer,
        walletPublicKey: signer.address,
      },
    )

    // persist notes so a crashed payout can be recovered
    const notes = deposited.outputUtxos.filter((u) => u.amount > 0n)
    fs.mkdirSync('data/cloak_notes', { recursive: true })
    for (const [i, n] of notes.entries()) {
      fs.writeFileSync(`data/cloak_notes/payout-${deposited.signature}-${i}.note`, serializeUtxo(n))
    }

    // 2. private withdrawal to the claimant — pool pays them, not us
    const wd = await fullWithdraw(deposited.outputUtxos, recipientAddress as Parameters<typeof fullWithdraw>[1], {
      connection,
      programId: CLOAK_PROGRAM_ID,
      relayUrl,
      depositorKeypair: signer,
      walletPublicKey: signer.address,
      cachedMerkleTree: deposited.merkleTree,
    })

    return { ok: true, depositSig: deposited.signature, withdrawSig: wd?.signature }
  } catch (e) {
    return { ok: false, error: (e as Error).message?.slice(0, 200) || 'cloak payout failed' }
  }
}
