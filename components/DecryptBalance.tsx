"use client";

import {
  useConfidentialBalance,
  useGrantPermit,
  useHasPermit,
} from "@zama-fhe/react-sdk";
import { useState } from "react";
import { erc20Abi, formatUnits } from "viem";
import { sepolia } from "viem/chains";
import { useConnection, useReadContract } from "wagmi";

import type { RegistryPair, SupportedChainId } from "../lib/registry";

export const PERMIT_EXPLAINER =
  "Sign a gas-free EIP-712 permit so that only your wallet can decrypt your own balances. Nothing is sent on-chain.";

type Props = {
  pair: RegistryPair;
  chainId: SupportedChainId;
};

export function DecryptBalance({ pair, chainId }: Props) {
  const [isRevealed, setIsRevealed] = useState(false);

  const isTestnet = chainId === sepolia.id;
  const { address, status } = useConnection();
  const isConnected = status === "connected" && Boolean(address);

  const wrapperAddress = pair.confidentialTokenAddress;

  const { data: hasPermit } = useHasPermit(
    { contractAddresses: [wrapperAddress] },
    { enabled: isTestnet && isConnected },
  );
  const { mutate: grantPermit, isPending: isGranting } = useGrantPermit();

  const { data: wrapperDecimals } = useReadContract({
    address: wrapperAddress,
    abi: erc20Abi,
    functionName: "decimals",
    chainId,
    query: { enabled: isTestnet && isRevealed },
  });

  const {
    data: balance,
    isFetching,
    isError,
    refetch,
  } = useConfidentialBalance(
    { address: wrapperAddress, account: address },
    { enabled: isTestnet && isConnected && isRevealed && hasPermit === true },
  );

  if (!isTestnet || !isConnected) {
    return (
      <span
        className="text-xs text-zinc-400 dark:text-zinc-600"
        title={isTestnet ? "Connect your wallet" : "Testnet only"}
      >
        —
      </span>
    );
  }

  if (hasPermit === false) {
    return (
      <button
        type="button"
        onClick={() => grantPermit([wrapperAddress])}
        disabled={isGranting}
        title={PERMIT_EXPLAINER}
        className="whitespace-nowrap rounded-full border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950"
      >
        {isGranting ? "Signing…" : "Enable decryption"}
      </button>
    );
  }

  if (!isRevealed) {
    return (
      <button
        type="button"
        onClick={() => setIsRevealed(true)}
        title="Decrypts your balance only — other accounts stay private."
        className="whitespace-nowrap rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        Decrypt balance
      </button>
    );
  }

  if (isFetching) {
    return (
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        Decrypting…
      </span>
    );
  }

  if (isError) {
    return (
      <button
        type="button"
        onClick={() => void refetch()}
        className="whitespace-nowrap text-xs font-medium text-red-600 underline-offset-2 hover:underline dark:text-red-400"
      >
        Decrypt failed — retry
      </button>
    );
  }

  if (balance === undefined) {
    return (
      <span className="text-xs text-zinc-400 dark:text-zinc-600">—</span>
    );
  }

  return (
    <span className="whitespace-nowrap font-mono text-xs text-zinc-900 dark:text-zinc-100">
      {formatUnits(balance, wrapperDecimals ?? pair.token.decimals)}{" "}
      {pair.wrapper.symbol}
    </span>
  );
}
