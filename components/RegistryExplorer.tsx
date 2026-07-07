"use client";

import { useState } from "react";
import { sepolia } from "viem/chains";

import {
  REGISTRY_CHAINS,
  SUPPORTED_CHAIN_IDS,
  type SupportedChainId,
} from "../lib/registry";
import { Faucet } from "./Faucet";
import { RegistryTable } from "./RegistryTable";

export function RegistryExplorer() {
  const [chainId, setChainId] = useState<SupportedChainId>(sepolia.id);

  return (
    <div className="flex w-full flex-col gap-4">
      <div
        role="tablist"
        aria-label="Select network"
        className="flex w-fit gap-1 rounded-full border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900"
      >
        {SUPPORTED_CHAIN_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={chainId === id}
            onClick={() => setChainId(id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              chainId === id
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {REGISTRY_CHAINS[id].label}
          </button>
        ))}
      </div>
      {chainId === sepolia.id ? (
        <Faucet />
      ) : (
        <p className="text-xs text-zinc-400 dark:text-zinc-600">
          Testnet Faucet — Sepolia only
        </p>
      )}
      <RegistryTable chainId={chainId} />
    </div>
  );
}
