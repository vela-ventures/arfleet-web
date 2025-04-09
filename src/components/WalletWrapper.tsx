import { ArweaveWalletKit } from "@arweave-wallet-kit/react";
import WanderStrategy from "@arweave-wallet-kit/wander-strategy";
import BrowserWalletStrategy from "@arweave-wallet-kit/browser-wallet-strategy";
import WebWalletStrategy from "@arweave-wallet-kit/webwallet-strategy";
import AoSyncStrategy from "@vela-ventures/aosync-strategy";

export default function WalletWrapper({ children }: { children: React.ReactNode }) {
    return (
        <ArweaveWalletKit
            config={{
                permissions: ["ACCESS_ADDRESS", "SIGN_TRANSACTION", "ACCESS_PUBLIC_KEY", "SIGNATURE"],
                ensurePermissions: true,
                strategies: [
                    new WanderStrategy(),
                    new AoSyncStrategy(),
                    new BrowserWalletStrategy(),
                    new WebWalletStrategy(),
                  ],
            }}

            theme={{
                // accent: { r: 30, g: 130, b: 200 },
                radius: "minimal",
            }}
        >
            {children}
        </ArweaveWalletKit>
    )
}