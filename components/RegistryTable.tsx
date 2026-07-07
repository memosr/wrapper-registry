"use client";

import { useQuery } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { sepolia } from "viem/chains";

import { shortenAddress } from "../lib/format";
import {
  REGISTRY_CHAINS,
  fetchRegistryPairs,
  type RegistryPair,
  type SupportedChainId,
} from "../lib/registry";
import { DecryptBalance } from "./DecryptBalance";
import { TransferPanel } from "./TransferPanel";
import { WrapPanel } from "./WrapPanel";

type Props = {
  chainId: SupportedChainId;
};

type PanelKind = "wrap" | "send";

type ExpandedRow = {
  key: string;
  panel: PanelKind;
};

const SKELETON_ROW_COUNT = 5;

export function RegistryTable({ chainId }: Props) {
  const [showRevoked, setShowRevoked] = useState(true);
  const [expanded, setExpanded] = useState<ExpandedRow | null>(null);

  const {
    data: pairs,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["registry-pairs", chainId],
    queryFn: () => fetchRegistryPairs(chainId),
    staleTime: 60_000,
  });

  const visiblePairs = pairs?.filter((pair) => showRevoked || pair.isValid);
  const revokedCount = pairs?.filter((pair) => !pair.isValid).length ?? 0;

  return (
    <section className="w-full" aria-label="Wrapper registry pairs">
      <div className="mb-3 flex items-center justify-between gap-4">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {isPending
            ? "Loading registry…"
            : isError
              ? ""
              : `${pairs?.length ?? 0} pair${(pairs?.length ?? 0) === 1 ? "" : "s"} on ${REGISTRY_CHAINS[chainId].label}` +
                (revokedCount > 0 ? ` (${revokedCount} revoked)` : "")}
        </p>
        <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={showRevoked}
            onChange={(event) => setShowRevoked(event.target.checked)}
            className="h-4 w-4 accent-zinc-900 dark:accent-zinc-100"
          />
          Show revoked
        </label>
      </div>

      {isError ? (
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center dark:border-red-900 dark:bg-red-950"
        >
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            Failed to load the registry
          </p>
          <p className="max-w-md text-sm text-red-600 dark:text-red-300">
            {error instanceof Error ? error.message : "Unexpected error"}
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-full border border-red-300 px-4 py-1.5 text-sm font-medium text-red-800 transition-colors hover:bg-red-100 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-900"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                <th scope="col" className="px-4 py-3 font-medium">
                  Token
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Wrapper
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Valid
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Explorer
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  My balance
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {isPending ? (
                <SkeletonRows />
              ) : visiblePairs && visiblePairs.length > 0 ? (
                visiblePairs.map((pair) => {
                  const rowKey = `${chainId}:${pair.tokenAddress}-${pair.confidentialTokenAddress}`;
                  const expandedPanel =
                    expanded?.key === rowKey ? expanded.panel : null;
                  return (
                    <Fragment key={rowKey}>
                      <PairRow
                        pair={pair}
                        chainId={chainId}
                        expandedPanel={expandedPanel}
                        onToggle={(panel) =>
                          setExpanded(
                            expandedPanel === panel
                              ? null
                              : { key: rowKey, panel },
                          )
                        }
                      />
                      {expandedPanel && (
                        <tr className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800/60">
                          <td colSpan={6} className="px-4 pb-4 pt-1">
                            {expandedPanel === "wrap" ? (
                              <WrapPanel pair={pair} chainId={chainId} />
                            ) : (
                              <TransferPanel pair={pair} chainId={chainId} />
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-zinc-500 dark:text-zinc-400"
                  >
                    No pairs registered on {REGISTRY_CHAINS[chainId].label}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PairRow({
  pair,
  chainId,
  expandedPanel,
  onToggle,
}: {
  pair: RegistryPair;
  chainId: SupportedChainId;
  expandedPanel: PanelKind | null;
  onToggle: (panel: PanelKind) => void;
}) {
  const { explorerUrl } = REGISTRY_CHAINS[chainId];
  const isTestnet = chainId === sepolia.id;

  return (
    <tr
      className={`border-b border-zinc-100 last:border-b-0 dark:border-zinc-800/60 ${
        pair.isValid ? "" : "opacity-45"
      }`}
    >
      <td className="px-4 py-3">
        <AssetCell
          symbol={pair.token.symbol}
          name={pair.token.name}
          address={pair.tokenAddress}
          explorerUrl={explorerUrl}
        />
      </td>
      <td className="px-4 py-3">
        <AssetCell
          symbol={pair.wrapper.symbol}
          name={pair.wrapper.name}
          address={pair.confidentialTokenAddress}
          explorerUrl={explorerUrl}
        />
      </td>
      <td className="px-4 py-3">
        {pair.isValid ? (
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            Valid
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            Revoked
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <a
          href={`${explorerUrl}/address/${pair.confidentialTokenAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
        >
          Etherscan ↗
        </a>
      </td>
      <td className="px-4 py-3">
        <DecryptBalance pair={pair} chainId={chainId} />
      </td>
      <td className="px-4 py-3">
        {isTestnet ? (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onToggle("wrap")}
              aria-expanded={expandedPanel === "wrap"}
              className="whitespace-nowrap rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {expandedPanel === "wrap" ? "Close" : "Wrap / Unwrap"}
            </button>
            <button
              type="button"
              onClick={() => onToggle("send")}
              aria-expanded={expandedPanel === "send"}
              className="whitespace-nowrap rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {expandedPanel === "send" ? "Close" : "Send"}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-0.5">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled
                title="Testnet only"
                className="cursor-not-allowed whitespace-nowrap rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-400 opacity-60 dark:border-zinc-800 dark:text-zinc-600"
              >
                Wrap / Unwrap
              </button>
              <button
                type="button"
                disabled
                title="Testnet only"
                className="cursor-not-allowed whitespace-nowrap rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-400 opacity-60 dark:border-zinc-800 dark:text-zinc-600"
              >
                Send
              </button>
            </div>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-600">
              Testnet only
            </span>
          </div>
        )}
      </td>
    </tr>
  );
}

function AssetCell({
  symbol,
  name,
  address,
  explorerUrl,
}: {
  symbol: string;
  name: string;
  address: string;
  explorerUrl: string;
}) {
  return (
    <div className="flex flex-col">
      <span
        className="font-medium text-zinc-900 dark:text-zinc-100"
        title={name}
      >
        {symbol}
      </span>
      <a
        href={`${explorerUrl}/address/${address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-xs text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
      >
        {shortenAddress(address)}
      </a>
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
        <tr
          key={index}
          className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800/60"
        >
          {Array.from({ length: 6 }, (_, cell) => (
            <td key={cell} className="px-4 py-3">
              <div className="h-4 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              {cell < 2 && (
                <div className="mt-1.5 h-3 w-20 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800/60" />
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
