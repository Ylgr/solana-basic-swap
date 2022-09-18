import * as anchor from "@project-serum/anchor";
import { Program, AnchorProvider, Provider } from "@project-serum/anchor";
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

  let mintA = null;
  let initializerTokenAccountA: PublicKey = null;
  let initializer = null;
  let takerTokenAccountA: PublicKey = null;
  let taker = null;
  let pda: PublicKey = null;

  const takerAmount = anchor.web3.LAMPORTS_PER_SOL;
  const initializerAmount = 500;

  const poolAccount = anchor.web3.Keypair.generate();
  const mintAuthority = anchor.web3.Keypair.generate();

  it("Should prepare success",async () => {
    [initializer, taker] = await createUsers(2);
    mintA = await Token.createMint(
        provider.connection,
        initializer.key,
        mintAuthority.publicKey,
        null,
        0,
        TOKEN_PROGRAM_ID
    );

    initializerTokenAccountA = await mintA.createAccount(
        provider.wallet.publicKey
    );

    takerTokenAccountA = await mintA.createAccount(provider.wallet.publicKey);

    await mintA.mintTo(
        initializerTokenAccountA,
        mintAuthority.publicKey,
        [mintAuthority],
        initializerAmount
    );

    let _initializerTokenAccountA = await mintA.getAccountInfo(
        initializerTokenAccountA
    );

    assert.ok(_initializerTokenAccountA.amount.toNumber() == initializerAmount);
  })

  it("Should be initialized!", async () => {
    await program.rpc.createPool(
        {
          accounts: {
            initializerDepositTokenAccount: initializerTokenAccountA,
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

    let _initializerTokenAccountA = await mintA.getAccountInfo(
        initializerTokenAccountA
    );

    let _poolAccount = await program.account.pool.fetch(poolAccount.publicKey);

    // Check that the new owner is the PDA.
    assert.ok(_initializerTokenAccountA.owner.equals(pda));

  });

  it("Swap", async () => {

  })
});
