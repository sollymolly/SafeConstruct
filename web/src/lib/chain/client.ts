import { createPublicClient, createWalletClient, http, type Chain, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat, polygonAmoy } from "viem/chains";

// CHAIN_TARGET switches between the local Hardhat node and the Polygon Amoy testnet.
const target = process.env.CHAIN_TARGET ?? "localhost";

function chainConfig(): { chain: Chain; rpcUrl: string } {
  if (target === "amoy") {
    return {
      chain: polygonAmoy,
      rpcUrl: process.env.AMOY_RPC_URL ?? "https://rpc-amoy.polygon.technology",
    };
  }
  return {
    chain: hardhat,
    rpcUrl: process.env.LOCALHOST_RPC_URL ?? "http://127.0.0.1:8545",
  };
}

const { chain, rpcUrl } = chainConfig();

export const CHAIN = chain;
export const IS_LOCAL = target !== "amoy";

/** Read-only client for view calls. */
export const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });

/** A signing client bound to a specific private key. */
export function walletClientFor(privateKey: Hex) {
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({ account, chain, transport: http(rpcUrl) });
}

/** The platform relayer = contract admin + gas faucet (in local dev). */
export function relayerPrivateKey(): Hex {
  const pk = process.env.RELAYER_PRIVATE_KEY;
  if (!pk) throw new Error("RELAYER_PRIVATE_KEY is not set");
  return (pk.startsWith("0x") ? pk : `0x${pk}`) as Hex;
}

export function relayerClient() {
  return walletClientFor(relayerPrivateKey());
}
