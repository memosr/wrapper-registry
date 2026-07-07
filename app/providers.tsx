"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ZamaProvider } from "@zama-fhe/react-sdk";
import { createConfig as createZamaConfig } from "@zama-fhe/react-sdk/wagmi";
import {
  mainnet as zamaMainnet,
  sepolia as zamaSepolia,
} from "@zama-fhe/sdk/chains";
import { web } from "@zama-fhe/sdk/web";
import { type ReactNode, useState } from "react";
import { type State, WagmiProvider } from "wagmi";

import { getConfig } from "./config";

type Props = {
  children: ReactNode;
  initialState: State | undefined;
};

export function Providers({ children, initialState }: Props) {
  const [config] = useState(() => getConfig());
  const [queryClient] = useState(() => new QueryClient());
  const [zamaConfig] = useState(() =>
    createZamaConfig({
      chains: [zamaSepolia, zamaMainnet],
      relayers: {
        [zamaSepolia.id]: web(),
        [zamaMainnet.id]: web(),
      },
      wagmiConfig: config,
    }),
  );

  return (
    <WagmiProvider config={config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <ZamaProvider config={zamaConfig}>{children}</ZamaProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
