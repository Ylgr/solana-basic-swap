import * as anchor from "@project-serum/anchor";
import {Program, AnchorProvider, Provider, BN} from "@project-serum/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import { BasicSwap } from "../target/types/basic_swap";
import { assert } from "chai";

describe("basic-swap", () => {
  // Configure the client to use the local cluster.
  const provider = AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.BasicSwap as Program<BasicSwap>;

  async function createUser(initBalance) {
    initBalance = initBalance ?? 10 * anchor.web3.LAMPORTS_PER_SOL;
    let user = anchor.web3.Keypair.generate();
    let airdropSignature = await provider.connection.requestAirdrop(user.publicKey, initBalance);
    await provider.connection.confirmTransaction(airdropSignature);

    let wallet = new anchor.Wallet(user);
    let userProvider = new AnchorProvider(provider.connection, wallet, provider.opts);
    return {
      key: user,
      wallet,
      provider: userProvider,
    };
  }

  function createUsers(num) {
    let promises = [];
    for(let i = 0; i < num; i++) {
      promises.push(createUser(null));
    }

    return Promise.all(promises);
  }

  let mintMove = null;
  let initializerTokenAccountMove: PublicKey = null;
  let initializer = null;
  let takerTokenAccountMove: PublicKey = null;
  let taker = null;
  let pda: PublicKey = null;

  const takerAmount = anchor.web3.LAMPORTS_PER_SOL;
  const initializerAmount = 500;

  const poolAccount = anchor.web3.Keypair.generate();
  const mintMoveAuthority = anchor.web3.Keypair.generate();

  it("Should prepare success",async () => {
    [initializer, taker] = await createUsers(2);
    mintMove = await Token.createMint(
        provider.connection,
        initializer.key,
        mintMoveAuthority.publicKey,
        null,
        0,
        TOKEN_PROGRAM_ID
    );

    initializerTokenAccountMove = await mintMove.createAccount(
        provider.wallet.publicKey
    );

    takerTokenAccountMove = await mintMove.createAccount(provider.wallet.publicKey);

    await mintMove.mintTo(
        initializerTokenAccountMove,
        mintMoveAuthority.publicKey,
        [mintMoveAuthority],
        initializerAmount
    );

    let _initializerTokenAccountMove = await mintMove.getAccountInfo(
        initializerTokenAccountMove
    );

    assert.ok(_initializerTokenAccountMove.amount.toNumber() == initializerAmount);
  })

  it("Should be initialized!", async () => {
    await program.rpc.createPool(
        {
          accounts: {
            initializerDepositTokenAccount: initializerTokenAccountMove,
            initializerReceiveWalletAccount: initializer.wallet.publicKey,
            pool: poolAccount.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            signer: provider.wallet.publicKey
          },
          signers: [poolAccount],
        }
    );

    // Get the PDA that is assigned authority to token account.
    const [_pda, _nonce] = await PublicKey.findProgramAddress(
        [Buffer.from(anchor.utils.bytes.utf8.encode("swap"))],
        program.programId
    );

    pda = _pda;

    let _initializerTokenAccountMove = await mintMove.getAccountInfo(
        initializerTokenAccountMove
    );

    let _poolAccount = await program.account.pool.fetch(poolAccount.publicKey);

    // Check that the new owner is the PDA.
    assert.ok(_initializerTokenAccountMove.owner.equals(pda));
    assert.equal(_poolAccount.initializer.toBase58(), initializer.wallet.publicKey.toBase58());
    assert.equal(_poolAccount.tokenAccount.toBase58(), initializerTokenAccountMove.toBase58());
    assert.equal(_poolAccount.rate, 10);
  });

  it("Swap", async () => {
    const _initializerSolAccountBefore = await provider.connection.getBalance(initializer.wallet.publicKey)

    let _takerTokenAccountMoveBefore = await mintMove.getAccountInfo(takerTokenAccountMove);
    assert.equal(_takerTokenAccountMoveBefore.amount.toNumber(), 0);
    let _initializerTokenAccountMoveBefore = await mintMove.getAccountInfo(initializerTokenAccountMove);
    assert.equal(_initializerTokenAccountMoveBefore.amount.toNumber(), 500);

    await program.rpc.swap(
        new BN(10),
        {
          accounts: {
            takerReceiveTokenAccount: takerTokenAccountMove,
            pdaDepositTokenAccount: initializerTokenAccountMove,
            initializerReceiveWalletAccount: initializer.wallet.publicKey,
            pool: poolAccount.publicKey,
            pdaAccount: pda,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            signer: provider.wallet.publicKey
          }
        }
    )
    const _initializerSolAccountAfter = await provider.connection.getBalance(initializer.wallet.publicKey)

    let _takerTokenAccountMoveAfter = await mintMove.getAccountInfo(takerTokenAccountMove);
    let _initializerTokenAccountMoveAfter = await mintMove.getAccountInfo(
        initializerTokenAccountMove
    );

    // Check that the initializer gets back ownership of their token account.
    assert.ok(_takerTokenAccountMoveAfter.owner.equals(provider.wallet.publicKey));

    assert.equal(_takerTokenAccountMoveAfter.amount.toNumber(), 100);
    assert.equal(_initializerTokenAccountMoveAfter.amount.toNumber(), 400);
    assert.equal(_initializerSolAccountAfter - _initializerSolAccountBefore, 10);

    await program.rpc.swap(
        new BN(11),
        {
          accounts: {
            takerReceiveTokenAccount: takerTokenAccountMove,
            pdaDepositTokenAccount: initializerTokenAccountMove,
            initializerReceiveWalletAccount: initializer.wallet.publicKey,
            pool: poolAccount.publicKey,
            pdaAccount: pda,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            signer: provider.wallet.publicKey
          }
        }
    )
    const _initializerSolAccountFinally = await provider.connection.getBalance(initializer.wallet.publicKey)

    let _takerTokenAccountMoveFinally = await mintMove.getAccountInfo(takerTokenAccountMove);
    let _initializerTokenAccountMoveFinally = await mintMove.getAccountInfo(
        initializerTokenAccountMove
    );

    assert.equal(_takerTokenAccountMoveFinally.amount.toNumber(), 210);
    assert.equal(_initializerTokenAccountMoveFinally.amount.toNumber(), 290);
    assert.equal(_initializerSolAccountFinally - _initializerSolAccountBefore, 21);
  })
});
