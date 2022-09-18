import React, {useState} from 'react';
import {
    useAnchorWallet,
    useConnection,
    useWallet,
} from '@solana/wallet-adapter-react';
import {
    WalletModalProvider,
    WalletDisconnectButton,
    WalletMultiButton,
} from '@solana/wallet-adapter-react-ui';
import {Button} from "@solana/wallet-adapter-react-ui/lib/Button";
import {Keypair, PublicKey, SystemProgram, Transaction, TransactionCtorFields} from "@solana/web3.js";
import {BN, getProvider, Program, Provider} from "@project-serum/anchor";
import BasicSwapIdl from "./idl/basic_swap.json";
import * as anchor from "@project-serum/anchor";
import { TOKEN_PROGRAM_ID, Token, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";

const MyWallet: React.FC = () => {
    const {connection} = useConnection();
    const programId = '7GFXgchPpNAaysNviqMjDFD9kE4YbW1DAEaVCMoRnTCU'
    const moveAddress = 'DLdkyT6nKp2zS6iyJFj3faqSdHveiz7C6RGdte39YDHD'
    const poolAddress = '84hy58zLcaW4mVS3RtyrSHEP9w8A8WUiZreBEiYDdbo9'
    const initializerTokenAccountMove = 'LVYiNAsPmLbVdD4ZGSkknwBnSchzUCpMbgCbyyaB1Vd'
    const initializerReceiveWalletAccount = '7dDe6VZMuUvrWs9TV361Rp9Rv2m1JS7PZk2Cy6ExZysg'
    // let walletAddress = "";
    let [associatedTokenAddress, setAssociatedTokenAddress] = useState("");
    // if you use anchor, use the anchor hook instead
    const wallet = useAnchorWallet();
    const walletAddress = wallet?.publicKey.toString();
    const [solBalance, setSolBalance] = useState(0)
    const [swapAmount, setSwapAmount] = useState(10)
    const [moveBalance, setMoveBalance] = useState('0')

    // const wallet = useWallet();
    if (wallet?.publicKey) {
        Token.getAssociatedTokenAddress(ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, new PublicKey(moveAddress), wallet?.publicKey).then(
            (key) => {
                setAssociatedTokenAddress(key.toString())
                refreshBalance(wallet.publicKey, key)
            }
        )
    }
    const refreshBalance = async (publicKey: PublicKey, associatedTokenPublicKey: PublicKey) => {
        setSolBalance(await connection.getBalance(publicKey))
        try {
            const tokenBalance = await connection.getTokenAccountBalance(associatedTokenPublicKey)
            setMoveBalance(tokenBalance.value.amount)
        } catch (e) {
            const recentBlockhash = await connection.getRecentBlockhash();
            const options: TransactionCtorFields = {
                feePayer: publicKey,
                recentBlockhash: recentBlockhash.blockhash,
            };
            const transaction = new Transaction(options);
            transaction.add(
                Token.createAssociatedTokenAccountInstruction(
                    ASSOCIATED_TOKEN_PROGRAM_ID,
                    TOKEN_PROGRAM_ID,
                    new PublicKey(moveAddress),
                    new PublicKey(associatedTokenPublicKey),
                    publicKey,
                    publicKey
                )
            )
            const rawTx = await wallet?.signTransaction(transaction)
            await connection.sendRawTransaction(rawTx!.serialize())
        }
    }

    const createPool = async () => {
        const poolAccount = anchor.web3.Keypair.generate();
        console.log('poolAccount: ', poolAccount.publicKey.toString())
        if (wallet?.publicKey) {
            const provider = new anchor.Provider(connection, wallet, {
                preflightCommitment: "recent",
                commitment: "processed",
            });
            const program = new Program(BasicSwapIdl as any, programId, provider);
            await program.rpc.createPool(
                {
                    accounts: {
                        // initializerDepositTokenAccount: initializerTokenAccountMove,
                        initializerDepositTokenAccount: new PublicKey(associatedTokenAddress),
                        // initializerReceiveWalletAccount: initializerReceiveWalletAccount,
                        initializerReceiveWalletAccount: wallet.publicKey,
                        pool: poolAccount.publicKey,
                        systemProgram: SystemProgram.programId,
                        tokenProgram: TOKEN_PROGRAM_ID,
                        signer: wallet.publicKey
                    },
                    signers: [poolAccount],
                }
            );
        }
    }

    const swap = async () => {
        // const [_pda, _nonce] = await PublicKey.findProgramAddress(
        //     [Buffer.from(anchor.utils.bytes.utf8.encode("swap"))],
        //     new PublicKey(programId)
        // );
        // console.log('_pda: ', _pda.toString())
        if (wallet?.publicKey) {
            const provider = new anchor.Provider(connection, wallet, {
                preflightCommitment: "recent",
                commitment: "processed",
            });
            const program = new Program(BasicSwapIdl as any, programId, provider);
            const result = await program.rpc.swap(
                new BN(swapAmount),
                {
                    accounts: {
                        takerReceiveTokenAccount: new PublicKey(associatedTokenAddress),
                        pdaDepositTokenAccount: new PublicKey(initializerTokenAccountMove),
                        initializerReceiveWalletAccount: new PublicKey(initializerReceiveWalletAccount),
                        pool: new PublicKey(poolAddress),
                        pdaAccount: new PublicKey('H5fEF8bGvxhFmYKNRqan4XTeWX4uoghWJgwkXFHuXAsN'),
                        tokenProgram: TOKEN_PROGRAM_ID,
                        systemProgram: SystemProgram.programId,
                        signer: provider.wallet.publicKey
                    }
                }
            )
            console.log('result: ', result)
            refreshBalance(wallet.publicKey, new PublicKey(associatedTokenAddress))
        }
    }

    return (
        <>

            <p>
                ProgramId: {programId}
            </p>
            <p>
                MOVE address: {moveAddress}
            </p>
            <p>
                Pool: {poolAddress}
            </p>
            {wallet &&
            <p>Your wallet is {walletAddress}</p> ||
            <p>Hello! Click the button to connect</p>
            }
            <div className="multi-wrapper">
                <span className="button-wrapper">
                    <WalletModalProvider>
                        <WalletMultiButton />
                    </WalletModalProvider>
                </span>
                {wallet && <>
                    <WalletDisconnectButton />
                    <p>SOL balance: {solBalance}</p>
                    <p>MOVE balance: {moveBalance}</p>
                    <p>MOVE associated token address: {associatedTokenAddress && associatedTokenAddress}</p>
                    <input type='number' placeholder='number of SOL' onChange={(event) => setSwapAmount(Number(event.target.value))} value={swapAmount}/>
                    <Button onClick={() => swap()}>Swap</Button>
                    <Button onClick={() => createPool()}>Create pool</Button>
                </>}
            </div>
        </>
    );
};

export default MyWallet;
