use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, system_instruction::transfer};
use anchor_spl::token::{self, SetAuthority, Token, TokenAccount, Transfer};
use spl_token::instruction::AuthorityType;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod basic_swap {
    use super::*;

    const SWAP_PDA_SEED: &[u8] = b"swap";

    pub fn create_pool(ctx: Context<CreatePool>, token: Pubkey) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.token_account = token;
        pool.rate = 10;
        pool.initializer = ctx.accounts.signer.key();

        let (pda, _bump_seed) = Pubkey::find_program_address(&[SWAP_PDA_SEED], ctx.program_id);
        token::set_authority(ctx.accounts.into_set_authority_context(), AuthorityType::AccountOwner, Some(pda))?;
        Ok(())
    }

    pub fn swap(ctx: Context<Swap>, amount:u64) -> Result<()> {
        let (_pda, bump_seed) = Pubkey::find_program_address(&[SWAP_PDA_SEED], ctx.program_id);
        let seeds = &[&SWAP_PDA_SEED[..], &[bump_seed]];

        invoke(
            &transfer(
                ctx.accounts.signer.to_account_info().key,
                ctx.accounts.initializer_receive_wallet_account.to_account_info().key,
                amount,
            ),
            &[
                ctx.accounts.signer.to_account_info(),
                ctx.accounts.initializer_receive_wallet_account.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        token::transfer(
            ctx.accounts
                .into_transfer_to_taker_context()
                .with_signer(&[&seeds[..]]),
            (ctx.accounts.pool.rate as u64) * amount,
        )?;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(token:Pubkey)]
pub struct CreatePool<'info> {
    #[account(
        init,
        payer=signer,
        space= 8 + 32 + 1
    )]
    pub pool: Account<'info,Pool>,
    #[account(mut)]
    pub pda_deposit_token_account: Account<'info, TokenAccount>,
    pub pda_account: AccountInfo<'info>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info,System>,
    pub token_program: Program<'info, Token>
}

impl<'info> CreatePool<'info> {
    fn into_set_authority_context(&self) -> CpiContext<'_, '_, '_, 'info, SetAuthority<'info>> {
        let cpi_accounts = SetAuthority {
            account_or_mint: self.pda_deposit_token_account.to_account_info().clone(),
            current_authority: self.pda_account.clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

#[derive(Accounts)]
#[instruction(amount:u64)]
pub struct Swap<'info> {
    #[account(
        mut
    )]
    pub pool: Account<'info,Pool>,
    #[account(mut)]
    pub taker_receive_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pda_deposit_token_account: Account<'info, TokenAccount>,
    pub pda_account: AccountInfo<'info>,
    #[account(mut)]
    pub initializer_receive_wallet_account: AccountInfo<'info>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info,System>,
    pub token_program: Program<'info, Token>
}

impl<'info> Swap<'info> {
    fn into_transfer_to_taker_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.pda_deposit_token_account.to_account_info().clone(),
            to: self.taker_receive_token_account.to_account_info().clone(),
            authority: self.pda_account.clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

#[account]
pub struct Pool {
    pub initializer: Pubkey,
    pub token_account: Pubkey,
    pub rate: u8,
}
