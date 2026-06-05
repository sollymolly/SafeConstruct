import { createPublicClient, createWalletClient, http, type Chain, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat, polygonAmoy, baseSepolia } from "viem/chains";

// CHAIN_TARGET selects the chain: "localhost" (local Hardhat node), "amoy"
// (Polygon Amoy testnet), or "baseSepolia" (Base Sepolia testnet).
const target = process.env.CHAIN_TARGET ?? "localhost";

function chainConfig(): { chain: Chain; rpcUrl: string; isLocal: boolean } {
  if (target === "amoy") {
    return {
      chain: polygonAmoy,
      rpcUrl: process.env.AMOY_RPC_URL ?? "https://rpc-amoy.polygon.technology",
      isLocal: false,
    };
  }
  if (target === "baseSepolia") {
    return {
      chain: baseSepolia,
      rpcUrl: process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org",
      isLocal: false,
    };
  }
  return {
    chain: hardhat,
    rpcUrl: process.env.LOCALHOST_RPC_URL ?? "http://127.0.0.1:8545",
    isLocal: true,
  };
}

const { chain, rpcUrl, isLocal } = chainConfig();

export const CHAIN = chain;
export const IS_LOCAL = isLocal;

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
