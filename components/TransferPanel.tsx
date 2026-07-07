"use client";

import {
  useConfidentialTransfer,
  useGrantPermit,
  useHasPermit,
} from "@zama-fhe/react-sdk";
import { useState } from "react";
import { erc20Abi, isAddress, type Hex } from "viem";
import { sepolia } from "viem/chains";
import { useConnection, useReadContract, useSwitchChain } from "wagmi";

import {
  REGISTRY_CHAINS,
  type RegistryPair,
  type SupportedChainId,
} from "../lib/registry";
import { PERMIT_EXPLAINER } from "./DecryptBalance";
import { parseAmount, TxLink } from "./WrapPanel";

type TxStep = {
  label: string;
  txHash?: Hex;
};

type Props = {
  pair: RegistryPair;
  chainId: SupportedChainId;
};

export function TransferPanel({ pair, chainId }: Props) {
  const [recipientInput, setRecipientInput] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [steps, setSteps] = useState<TxStep[]>([]);

  const { explorerUrl } = REGISTRY_CHAINS[chainId];
  const isTestnet = chainId === sepolia.id;

  const { address, chainId: walletChainId, status } = useConnection();
  const isConnected = status === "connected" && Boolean(address);
  const isWalletOnChain = walletChainId === chainId;
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const { data: wrapperDecimals } = useReadContract({
    address: pair.confidentialTokenAddress,
    abi: erc20Abi,
    functionName: "decimals",
    chainId,
    query: { enabled: isTestnet },
  });

  const { data: hasPermit } = useHasPermit(
    { contractAddresses: [pair.confidentialTokenAddress] },
    { enabled: isTestnet && isConnected },
  );
  const { mutate: grantPermit, isPending: isGranting } = useGrantPermit();

  const transfer = useConfidentialTransfer({
    address: pair.confidentialTokenAddress,
  });

  const trimmedRecipient = recipientInput.trim();
  const isRecipientValid = isAddress(trimmedRecipient);
  const isRecipientSelf =
    isRecipientValid &&
    address !== undefined &&
    trimmedRecipient.toLowerCase() === address.toLowerCase();

  const decimals = wrapperDecimals ?? pair.token.decimals;
  const parsedAmount = parseAmount(amountInput, decimals);
  const isAmountInvalid = amountInput.trim() !== "" && parsedAmount === undefined;

  const canSubmit =
    isConnected &&
    isWalletOnChain &&
    isRecipientValid &&
    parsedAmount !== undefined &&
    parsedAmount > 0n &&
    !transfer.isPending;

  function addStep(step: TxStep) {
    setSteps((previous) => [...previous, step]);
  }

  async function handleSubmit() {
    if (!isRecipientValid || parsedAmount === undefined) return;
    setSteps([]);

    try {
      await transfer.mutateAsync({
        to: trimmedRecipient,
        amount: parsedAmount,
        onEncryptComplete: () =>
          addStep({ label: "Amount encrypted, submitting…" }),
        onTransferSubmitted: (txHash) =>
          addStep({ label: "Transfer submitted", txHash }),
      });
      setRecipientInput("");
      setAmountInput("");
    } catch {
      // Error surfaced via transfer.error below.
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Confidential transfer
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Send {pair.wrapper.symbol} privately. The amount is encrypted before
          it reaches the chain.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`transfer-recipient-${pair.confidentialTokenAddress}`}
          className="text-xs text-zinc-500 dark:text-zinc-400"
        >
          Recipient
        </label>
        <input
          id={`transfer-recipient-${pair.confidentialTokenAddress}`}
          type="text"
          value={recipientInput}
          onChange={(event) => setRecipientInput(event.target.value)}
          placeholder="0x…"
          disabled={transfer.isPending}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        {trimmedRecipient !== "" && !isRecipientValid && (
          <p className="text-xs text-red-600 dark:text-red-400">
            Not a valid 0x address.
          </p>
        )}
        {isRecipientSelf && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Recipient is your own address.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`transfer-amount-${pair.confidentialTokenAddress}`}
          className="text-xs text-zinc-500 dark:text-zinc-400"
        >
          Amount ({pair.wrapper.symbol})
        </label>
        <input
          id={`transfer-amount-${pair.confidentialTokenAddress}`}
          type="text"
          inputMode="decimal"
          value={amountInput}
          onChange={(event) => setAmountInput(event.target.value)}
          placeholder="0.0"
          disabled={transfer.isPending}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
        {isAmountInvalid && (
          <p className="text-xs text-red-600 dark:text-red-400">
            Not a valid amount.
          </p>
        )}
      </div>

      {isTestnet && isConnected && isWalletOnChain && hasPermit === false ? (
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
            Transfer checks your confidential balance before submitting.{" "}
            {PERMIT_EXPLAINER}
          </p>
        </div>
      ) : (
        <SendArea
          isTestnet={isTestnet}
          isConnected={isConnected}
          isWalletOnChain={isWalletOnChain}
          isSwitching={isSwitching}
          isPending={transfer.isPending}
          canSubmit={canSubmit}
          onSwitchChain={() => switchChain({ chainId: sepolia.id })}
          onSubmit={() => void handleSubmit()}
        />
      )}

      {steps.length > 0 && (
        <ol className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-300">
          {steps.map((step, index) => (
            <li key={index} className="flex items-center gap-2">
              <span>• {step.label}</span>
              {step.txHash && (
                <TxLink txHash={step.txHash} explorerUrl={explorerUrl} />
              )}
            </li>
          ))}
        </ol>
      )}

      {transfer.isSuccess && transfer.data && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          <span>Transfer confirmed ✓</span>
          <TxLink txHash={transfer.data.txHash} explorerUrl={explorerUrl} />
        </div>
      )}

      {transfer.isError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {transfer.error instanceof Error
            ? transfer.error.message
            : "Transfer failed"}
        </div>
      )}
    </div>
  );
}

function SendArea({
  isTestnet,
  isConnected,
  isWalletOnChain,
  isSwitching,
  isPending,
  canSubmit,
  onSwitchChain,
  onSubmit,
}: {
  isTestnet: boolean;
  isConnected: boolean;
  isWalletOnChain: boolean;
  isSwitching: boolean;
  isPending: boolean;
  canSubmit: boolean;
  onSwitchChain: () => void;
  onSubmit: () => void;
}) {
  const buttonClass =
    "rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

  if (!isTestnet) {
    return (
      <div className="flex items-center gap-2">
        <button type="button" disabled className={buttonClass}>
          Send
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
          Send
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
      {isPending ? "Sending…" : "Send"}
    </button>
  );
}
