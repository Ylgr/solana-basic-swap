import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { BasicSwap } from "../target/types/basic_swap";

describe("basic-swap", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.BasicSwap as Program<BasicSwap>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
