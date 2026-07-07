import { RegistryExplorer } from "../components/RegistryExplorer";
import { ConnectWallet } from "./connect-wallet";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-4xl flex-col items-center gap-8 py-16 px-6 sm:px-16">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Wrapper Registry
        </h1>
        <p className="max-w-md text-center text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Confidential token wrapper registry. Connect your wallet to get
          started.
        </p>
        <ConnectWallet />
        <RegistryExplorer />
      </main>
    </div>
  );
}
