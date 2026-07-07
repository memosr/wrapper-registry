import {
  http,
  createPublicClient,
  type Address,
  type Chain,
  type PublicClient,
} from "viem";
import { mainnet, sepolia } from "viem/chains";

export type SupportedChainId = typeof sepolia.id | typeof mainnet.id;

type RegistryChain = {
  chain: Chain;
  label: string;
  registryAddress: Address;
  rpcUrl: string;
  explorerUrl: string;
};

/**
 * Registry addresses from docs.zama.org/protocol/protocol-apps/addresses
 * (they match the `registryAddress` constants shipped in @zama-fhe/sdk/chains).
 */
export const REGISTRY_CHAINS: Record<SupportedChainId, RegistryChain> = {
  [sepolia.id]: {
    chain: sepolia,
    label: "Sepolia",
    registryAddress: "0x2f0750Bbb0A246059d80e94c454586a7F27a128e",
    rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
    explorerUrl: "https://sepolia.etherscan.io",
  },
  [mainnet.id]: {
    chain: mainnet,
    label: "Mainnet",
    registryAddress: "0xeb5015fF021DB115aCe010f23F55C2591059bBA0",
    rpcUrl: "https://ethereum-rpc.publicnode.com",
    explorerUrl: "https://etherscan.io",
  },
};

export const SUPPORTED_CHAIN_IDS: SupportedChainId[] = [
  sepolia.id,
  mainnet.id,
];

const SLICE_BATCH_SIZE = 50n;

const registryAbi = [
  {
    inputs: [],
    name: "getTokenConfidentialTokenPairsLength",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "fromIndex", type: "uint256" },
      { internalType: "uint256", name: "toIndex", type: "uint256" },
    ],
    name: "getTokenConfidentialTokenPairsSlice",
    outputs: [
      {
        components: [
          { internalType: "address", name: "tokenAddress", type: "address" },
          {
            internalType: "address",
            name: "confidentialTokenAddress",
            type: "address",
          },
          { internalType: "bool", name: "isValid", type: "bool" },
        ],
        internalType:
          "struct ConfidentialTokenWrappersRegistry.TokenWrapperPair[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

const erc20MetadataAbi = [
  {
    inputs: [],
    name: "name",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export type TokenWrapperPair = {
  tokenAddress: Address;
  confidentialTokenAddress: Address;
  isValid: boolean;
};

export type TokenMetadata = {
  name: string;
  symbol: string;
  decimals: number;
};

export type RegistryPair = TokenWrapperPair & {
  token: TokenMetadata;
  wrapper: Pick<TokenMetadata, "name" | "symbol">;
};

const clients = new Map<SupportedChainId, PublicClient>();

function getPublicClient(chainId: SupportedChainId): PublicClient {
  const existing = clients.get(chainId);
  if (existing) return existing;

  const { chain, rpcUrl } = REGISTRY_CHAINS[chainId];
  const client = createPublicClient({
    chain,
    transport: http(rpcUrl, { batch: true }),
  });
  clients.set(chainId, client);
  return client;
}

async function fetchRawPairs(
  client: PublicClient,
  registryAddress: Address,
): Promise<TokenWrapperPair[]> {
  const length = await client.readContract({
    address: registryAddress,
    abi: registryAbi,
    functionName: "getTokenConfidentialTokenPairsLength",
  });

  const pairs: TokenWrapperPair[] = [];
  for (let from = 0n; from < length; from += SLICE_BATCH_SIZE) {
    const to = from + SLICE_BATCH_SIZE > length ? length : from + SLICE_BATCH_SIZE;
    const slice = await client.readContract({
      address: registryAddress,
      abi: registryAbi,
      functionName: "getTokenConfidentialTokenPairsSlice",
      args: [from, to],
    });
    pairs.push(...slice);
  }
  return pairs;
}

const UNKNOWN_METADATA: TokenMetadata = {
  name: "Unknown",
  symbol: "???",
  decimals: 0,
};

async function fetchPairMetadata(
  client: PublicClient,
  pairs: TokenWrapperPair[],
): Promise<RegistryPair[]> {
  const contracts = pairs.flatMap((pair) => [
    { address: pair.tokenAddress, abi: erc20MetadataAbi, functionName: "name" },
    { address: pair.tokenAddress, abi: erc20MetadataAbi, functionName: "symbol" },
    { address: pair.tokenAddress, abi: erc20MetadataAbi, functionName: "decimals" },
    { address: pair.confidentialTokenAddress, abi: erc20MetadataAbi, functionName: "name" },
    { address: pair.confidentialTokenAddress, abi: erc20MetadataAbi, functionName: "symbol" },
  ] as const);

  const results = await client.multicall({ contracts, allowFailure: true });

  const CALLS_PER_PAIR = 5;
  return pairs.map((pair, index) => {
    const base = index * CALLS_PER_PAIR;
    const [tokenName, tokenSymbol, tokenDecimals, wrapperName, wrapperSymbol] =
      results.slice(base, base + CALLS_PER_PAIR);

    return {
      ...pair,
      token: {
        name:
          tokenName.status === "success"
            ? String(tokenName.result)
            : UNKNOWN_METADATA.name,
        symbol:
          tokenSymbol.status === "success"
            ? String(tokenSymbol.result)
            : UNKNOWN_METADATA.symbol,
        decimals:
          tokenDecimals.status === "success"
            ? Number(tokenDecimals.result)
            : UNKNOWN_METADATA.decimals,
      },
      wrapper: {
        name:
          wrapperName.status === "success"
            ? String(wrapperName.result)
            : UNKNOWN_METADATA.name,
        symbol:
          wrapperSymbol.status === "success"
            ? String(wrapperSymbol.result)
            : UNKNOWN_METADATA.symbol,
      },
    };
  });
}

/**
 * Fetch every (ERC-20 ↔ ERC-7984) pair registered on the given chain,
 * enriched with on-chain name/symbol/decimals metadata.
 */
export async function fetchRegistryPairs(
  chainId: SupportedChainId,
): Promise<RegistryPair[]> {
  const client = getPublicClient(chainId);
  const { registryAddress } = REGISTRY_CHAINS[chainId];

  const rawPairs = await fetchRawPairs(client, registryAddress);
  if (rawPairs.length === 0) return [];

  return fetchPairMetadata(client, rawPairs);
}
