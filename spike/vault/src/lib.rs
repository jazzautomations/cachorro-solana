//! Minimal self-contained vulnerable/fixed pair for the cachorro-solana
//! differential-PoC de-risk spike.
//!
//! A "vault" is a program-owned account holding lamports. Its data stores, in
//! the first 32 bytes, the pubkey of the authority allowed to withdraw. A
//! `Withdraw` instruction moves lamports from the vault to a destination.
//!
//! Bug class: missing owner/authority check (has_one style). The vulnerable
//! `Withdraw` never verifies the caller against the stored authority, so ANY
//! caller drains the vault. The fixed version adds the single missing check.

use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    program_error::ProgramError,
    pubkey::Pubkey,
};

/// Custom error the FIXED program raises when the caller is not the vault's
/// stored authority. The oracle asserts on exactly this variant.
pub const ERR_INCORRECT_AUTHORITY: u32 = 1;

/// Instruction data = [tag: u8][amount: u64 LE]. tag 1 = Withdraw.
fn parse_withdraw(data: &[u8]) -> Result<u64, ProgramError> {
    if data.first() != Some(&1) || data.len() < 9 {
        return Err(ProgramError::InvalidInstructionData);
    }
    Ok(u64::from_le_bytes(data[1..9].try_into().unwrap()))
}

fn move_lamports(vault: &AccountInfo, dest: &AccountInfo, amount: u64) -> ProgramResult {
    let v = **vault.lamports.borrow();
    if v < amount {
        return Err(ProgramError::InsufficientFunds);
    }
    **vault.lamports.borrow_mut() = v - amount;
    **dest.lamports.borrow_mut() += amount;
    Ok(())
}

/// ---- VULNERABLE ----
/// Withdraw accounts: [vault (w), destination (w), authority].
/// BUG: authority is never checked — no signer check, no match against the
/// authority stored in the vault. Any caller drains the vault.
pub mod vulnerable {
    use super::*;
    pub fn process_instruction(
        _program_id: &Pubkey,
        accounts: &[AccountInfo],
        data: &[u8],
    ) -> ProgramResult {
        let amount = parse_withdraw(data)?;
        let iter = &mut accounts.iter();
        let vault = next_account_info(iter)?;
        let dest = next_account_info(iter)?;
        // authority intentionally ignored.
        move_lamports(vault, dest, amount)
    }
}

/// ---- FIXED ----
/// Same handler, plus the one missing constraint: the authority account must
/// sign AND must equal the pubkey stored in the vault's first 32 data bytes.
pub mod fixed {
    use super::*;
    pub fn process_instruction(
        _program_id: &Pubkey,
        accounts: &[AccountInfo],
        data: &[u8],
    ) -> ProgramResult {
        let amount = parse_withdraw(data)?;
        let iter = &mut accounts.iter();
        let vault = next_account_info(iter)?;
        let dest = next_account_info(iter)?;
        let authority = next_account_info(iter)?;
        // THE FIX (minimal delta): signer + stored-authority match.
        if !authority.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }
        let stored = Pubkey::new_from_array(
            vault.data.borrow()[..32].try_into().unwrap(),
        );
        if *authority.key != stored {
            return Err(ProgramError::Custom(ERR_INCORRECT_AUTHORITY));
        }
        move_lamports(vault, dest, amount)
    }
}
