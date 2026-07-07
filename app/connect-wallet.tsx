"use client";

import { useConnect, useConnection, useDisconnect } from "wagmi";

import { shortenAddress } from "../lib/format";

export function ConnectWallet() {
  const { address, status } = useConnection();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();

  const injectedConnector = connectors[0];

  if (status === "connected" && address) {
    return (
      <div className="flex items-center gap-3">
        <span className="rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 font-mono text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          {shortenAddress(address)}
        </span>
        <button
          type="button"
          onClick={() => disconnect()}
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => connect({ connector: injectedConnector })}
        disabled={isPending || !injectedConnector}
        className="rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {isPending ? "Connecting…" : "Connect Wallet"}
      </button>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {error.message}
        </p>
      )}
    </div>
  );
}
