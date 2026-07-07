"use client";

import {
  useGrantPermit,
  useHasPermit,
  useShield,
  useUnderlyingAllowance,
  useUnshield,
} from "@zama-fhe/react-sdk";
import { useState } from "react";
import { erc20Abi, formatUnits, parseUnits, type Hex } from "viem";
import { sepolia } from "viem/chains";
import { useConnection, useReadContract, useSwitchChain } from "wagmi";

import {
  REGISTRY_CHAINS,
  type RegistryPair,
  type SupportedChainId,
} from "../lib/registry";
import { PERMIT_EXPLAINER } from "./DecryptBalance";

type Direction = "wrap" | "unwrap";

type TxStep = {
  label: string;
  txHash?: Hex;
};

type Props = {
  pair: RegistryPair;
  chainId: SupportedChainId;
};

export function WrapPanel({ pair, chainId }: Props) {
  const [direction, setDirection] = useState<Direction>("wrap");
  const [amountInput, setAmountInput] = useState("");
  const [steps, setSteps] = useState<TxStep[]>([]);

  const { explorerUrl } = REGISTRY_CHAINS[chainId];
  const isTestnet = chainId === sepolia.id;

  const { address, chainId: walletChainId, status } = useConnection();
  const isConnected = status === "connected" && Boolean(address);
  const isWalletOnChain = walletChainId === chainId;
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: pair.tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: isConnected && isTestnet },
  });

  const { data: wrapperDecimals } = useReadContract({
    address: pair.confidentialTokenAddress,
    abi: erc20Abi,
    functionName: "decimals",
    chainId,
    query: { enabled: isTestnet },
  });

  const { data: allowance, refetch: refetchAllowance } = useUnderlyingAllowance({
    address: pair.confidentialTokenAddress,
    owner: isTestnet ? address : undefined,
  });

  const { data: hasPermit } = useHasPermit(
    { contractAddresses: [pair.confidentialTokenAddress] },
    { enabled: isTestnet && isConnected },
  );
  const { mutate: grantPermit, isPending: isGranting } = useGrantPermit();

  const shield = useShield({ address: pair.confidentialTokenAddress });
  const unshield = useUnshield(pair.confidentialTokenAddress);

  const activeMutation = direction === "wrap" ? shield : unshield;
  const isPending = shield.isPending || unshield.isPending;

  const inputDecimals =
    direction === "wrap" ? pair.token.decimals : (wrapperDecimals ?? pair.token.decimals);

  const parsedAmount = parseAmount(amountInput, inputDecimals);
  const exceedsBalance =
    direction === "wrap" &&
    parsedAmount !== undefined &&
    balance !== undefined &&
    parsedAmount > balance;
  const needsApproval =
    direction === "wrap" &&
    parsedAmount !== undefined &&
    allowance !== undefined &&
    allowance < parsedAmount;

  const canSubmit =
    isConnected &&
    isWalletOnChain &&
    parsedAmount !== undefined &&
    parsedAmount > 0n &&
    !exceedsBalance &&
    !isPending;

  function addStep(step: TxStep) {
    setSteps((previous) => [...previous, step]);
  }

  function switchDirection(next: Direction) {
    setDirection(next);
    setSteps([]);
    shield.reset();
    unshield.reset();
  }

  async function handleSubmit() {
    if (parsedAmount === undefined) return;
    setSteps([]);

    try {
      if (direction === "wrap") {
        await shield.mutateAsync({
          amount: parsedAmount,
          onApprovalSubmitted: (txHash) =>
            addStep({ label: "Approval submitted", txHash }),
          onShieldSubmitted: (txHash) =>
            addStep({ label: "Wrap submitted", txHash }),
        });
      } else {
        await unshield.mutateAsync({
          amount: parsedAmount,
          onUnwrapSubmitted: (txHash) =>
            addStep({ label: "Unwrap submitted", txHash }),
          onFinalizing: () =>
            addStep({ label: "Waiting for decryption proof…" }),
          onFinalizeSubmitted: (txHash) =>
            addStep({ label: "Finalize submitted", txHash }),
        });
      }
      setAmountInput("");
      void refetchBalance();
      void refetchAllowance();
    } catch {
      // Error surfaced via activeMutation.error below.
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Direction"
          className="flex w-fit gap-1 rounded-full border border-zinc-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-800"
        >
          {(["wrap", "unwrap"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={direction === value}
              onClick={() => switchDirection(value)}
              className={`rounded-full px-4 py-1 text-sm font-medium capitalize transition-colors ${
                direction === value
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {direction === "wrap"
            ? `${pair.token.symbol} → ${pair.wrapper.symbol}`
            : `${pair.wrapper.symbol} → ${pair.token.symbol}`}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>Amount</span>
          {isConnected && balance !== undefined && (
            <span>
              Balance: {formatUnits(balance, pair.token.decimals)}{" "}
              {pair.token.symbol}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={amountInput}
            onChange={(event) => setAmountInput(event.target.value)}
            placeholder="0.0"
            disabled={isPending}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
          {direction === "wrap" && balance !== undefined && (
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                setAmountInput(formatUnits(balance, pair.token.decimals))
              }
              className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Max
            </button>
          )}
        </div>
        {exceedsBalance && (
          <p className="text-xs text-red-600 dark:text-red-400">
            Amount exceeds your {pair.token.symbol} balance.
          </p>
        )}
        {needsApproval && !exceedsBalance && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Approval needed — the wrap flow will first ask you to approve{" "}
            {pair.wrapper.symbol}.
          </p>
        )}
      </div>

      {direction === "unwrap" &&
      isTestnet &&
      isConnected &&
      isWalletOnChain &&
      hasPermit === false ? (
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => grantPermit([pair.confidentialTokenAddress])}
            disabled={isGranting}
            className="w-fit rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGranting ? "Signing…" : "Enable decryption first"}
          </button>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Unwrap checks your confidential balance before submitting.{" "}
            {PERMIT_EXPLAINER}
          </p>
        </div>
      ) : (
        <SubmitArea
          isTestnet={isTestnet}
          isConnected={isConnected}
          isWalletOnChain={isWalletOnChain}
          isSwitching={isSwitching}
          isPending={isPending}
          canSubmit={canSubmit}
          direction={direction}
          onSwitchChain={() => switchChain({ chainId: sepolia.id })}
          onSubmit={() => void handleSubmit()}
        />
      )}

      {steps.length > 0 && (
        <ol className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-300">
          {steps.map((step, index) => (
            <li key={index} className="flex items-center gap-2">
              <span>• {step.label}</span>
              {step.txHash && <TxLink txHash={step.txHash} explorerUrl={explorerUrl} />}
            </li>
          ))}
        </ol>
      )}

      {activeMutation.isSuccess && activeMutation.data && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          <span>{direction === "wrap" ? "Wrap" : "Unwrap"} confirmed ✓</span>
          <TxLink
            txHash={activeMutation.data.txHash}
            explorerUrl={explorerUrl}
          />
        </div>
      )}

      {activeMutation.isError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {activeMutation.error instanceof Error
            ? activeMutation.error.message
            : "Transaction failed"}
        </div>
      )}
    </div>
  );
}

function SubmitArea({
  isTestnet,
  isConnected,
  isWalletOnChain,
  isSwitching,
  isPending,
  canSubmit,
  direction,
  onSwitchChain,
  onSubmit,
}: {
  isTestnet: boolean;
  isConnected: boolean;
  isWalletOnChain: boolean;
  isSwitching: boolean;
  isPending: boolean;
  canSubmit: boolean;
  direction: Direction;
  onSwitchChain: () => void;
  onSubmit: () => void;
}) {
  const buttonClass =
    "rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

  if (!isTestnet) {
    return (
      <div className="flex items-center gap-2">
        <button type="button" disabled className={buttonClass}>
          {direction === "wrap" ? "Wrap" : "Unwrap"}
        </button>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Testnet only
        </span>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex items-center gap-2">
        <button type="button" disabled className={buttonClass}>
          {direction === "wrap" ? "Wrap" : "Unwrap"}
        </button>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Connect your wallet first
        </span>
      </div>
    );
  }

  if (!isWalletOnChain) {
    return (
      <button
        type="button"
        onClick={onSwitchChain}
        disabled={isSwitching}
        className={buttonClass}
      >
        {isSwitching ? "Switching…" : "Switch to Sepolia"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onSubmit}
      disabled={!canSubmit}
      className={buttonClass}
    >
      {isPending
        ? direction === "wrap"
          ? "Wrapping…"
          : "Unwrapping…"
        : direction === "wrap"
          ? "Wrap"
          : "Unwrap"}
    </button>
  );
}

function TxLink({ txHash, explorerUrl }: { txHash: Hex; explorerUrl: string }) {
  return (
    <a
      href={`${explorerUrl}/tx/${txHash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-xs text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
    >
      {`${txHash.slice(0, 10)}…`} ↗
    </a>
  );
}

function parseAmount(input: string, decimals: number): bigint | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  try {
    const value = parseUnits(trimmed, decimals);
    return value >= 0n ? value : undefined;
  } catch {
    return undefined;
  }
}
