import { cookieStorage, createConfig, createStorage, http, injected } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";

export function getConfig() {
  return createConfig({
    chains: [sepolia, mainnet],
    connectors: [injected()],
    ssr: true,
    storage: createStorage({
      storage: cookieStorage,
    }),
    transports: {
      [sepolia.id]: http(),
      [mainnet.id]: http(),
    },
  });
}
