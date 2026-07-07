"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { parseUnits, type Address } from "viem";
import { sepolia } from "viem/chains";
import {
  useConnection,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import {
  REGISTRY_CHAINS,
  fetchRegistryPairs,
  type TokenMetadata,
} from "../lib/registry";

/**
 * Official Zama mock underlying tokens on Sepolia with a public
 * mint(address,uint256) function (max 1,000,000 tokens per call) — from
 * docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia.
 * tGBP and steakcUSDC underlyings are NOT mocks (restricted minting).
 */
const MOCK_TOKEN_ADDRESSES = new Set(
  [
    "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF", // USDCMock
    "0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0", // USDTMock
    "0xff54739b16576FA5402F211D0b938469Ab9A5f3F", // WETHMock
    "0xFf021fB13cA64e5354c62c954b949a88cfDEb25E", // BRONMock
    "0x75355a85c6FB9df5f0C80FF54e8747EEe9a0BF57", // ZAMAMock
    "0x93c931278A2aad1916783F952f94276eA5111442", // tGBPMock
    "0x24377AE4AA0C45ecEe71225007f17c5D423dd940", // XAUtMock
  ].map((address) => address.toLowerCase()),
);

const MINT_AMOUNT = "1000";

const mintAbi = [
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export function Faucet() {
  const { address, chainId: walletChainId, status } = useConnection();
  const isConnected = status === "connected" && Boolean(address);
  const isOnSepolia = walletChainId === sepolia.id;
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const { data: pairs } = useQuery({
    queryKey: ["registry-pairs", sepolia.id],
    queryFn: () => fetchRegistryPairs(sepolia.id),
    staleTime: 60_000,
  });

  const mockTokens = pairs
    ?.filter((pair) => MOCK_TOKEN_ADDRESSES.has(pair.tokenAddress.toLowerCase()))
    .map((pair) => ({ address: pair.tokenAddress, ...pair.token }));

  return (
    <section
      aria-label="Testnet faucet"
      className="flex w-full flex-col gap-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 p-4 dark:border-zinc-700 dark:bg-zinc-900/40"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Testnet Faucet
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Mint {MINT_AMOUNT} units of the official Sepolia mock tokens to try
            the wrap flow.
          </p>
        </div>
        {isConnected && !isOnSepolia && (
          <button
            type="button"
            onClick={() => switchChain({ chainId: sepolia.id })}
            disabled={isSwitching}
            className="rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {isSwitching ? "Switching…" : "Switch to Sepolia"}
          </button>
        )}
        {!isConnected && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Connect your wallet to mint
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {mockTokens === undefined
          ? Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="h-9 w-36 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800"
              />
            ))
          : mockTokens.map((token) => (
              <FaucetItem
                key={token.address}
                token={token}
                recipient={address}
                isEnabled={isConnected && isOnSepolia}
              />
            ))}
      </div>
    </section>
  );
}

function FaucetItem({
  token,
  recipient,
  isEnabled,
}: {
  token: TokenMetadata & { address: Address };
  recipient: Address | undefined;
  isEnabled: boolean;
}) {
  const queryClient = useQueryClient();
  const { explorerUrl } = REGISTRY_CHAINS[sepolia.id];

  const {
    writeContract,
    data: txHash,
    isPending: isSigning,
    isError,
    error,
    reset,
  } = useWriteContract();

  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: sepolia.id,
  });

  useEffect(() => {
    if (isSuccess) {
      // Refresh every wagmi contract read (ERC-20 balances, allowances).
      void queryClient.invalidateQueries({ queryKey: ["readContract"] });
    }
  }, [isSuccess, queryClient]);

  function handleMint() {
    if (!recipient) return;
    reset();
    writeContract({
      address: token.address,
      abi: mintAbi,
      functionName: "mint",
      args: [recipient, parseUnits(MINT_AMOUNT, token.decimals)],
      chainId: sepolia.id,
    });
  }

  const isPending = isSigning || isMining;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleMint}
        disabled={!isEnabled || isPending}
        title={isEnabled ? `Mint ${MINT_AMOUNT} ${token.symbol}` : "Sepolia only"}
        className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {isSigning
          ? "Confirm in wallet…"
          : isMining
            ? "Minting…"
            : `Mint ${token.symbol}`}
      </button>
      {isSuccess && txHash && (
        <a
          href={`${explorerUrl}/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-center text-[10px] font-medium text-emerald-600 underline-offset-2 hover:underline dark:text-emerald-400"
        >
          Minted ✓ ↗
        </a>
      )}
      {isError && (
        <span
          className="max-w-36 truncate text-center text-[10px] text-red-600 dark:text-red-400"
          title={error instanceof Error ? error.message : "Mint failed"}
        >
          Mint failed
        </span>
      )}
    </div>
  );
}
