use anchor_lang::prelude::*;
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");
#[program]
pub mod basic_swap {
    use super::*;
    pub fn create_pool(ctx: Context<CreatePool>, token: Pubkey) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.token = token;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(token:Pubkey)]
pub struct CreatePool<'info> {
    #[account(
        init,
        payer=signer,
        space= 8 + 32
    )]
    pub pool: Pool,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info,System>
}

#[account]
pub struct Pool {
    pub token: Pubkey,
}

