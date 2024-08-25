import { ArweaveWalletKit } from "arweave-wallet-kit";

export default function WalletWrapper({ children }: { children: React.ReactNode }) {
    return (
        <ArweaveWalletKit
            config={{
                permissions: ["ACCESS_ADDRESS", "SIGN_TRANSACTION", "ACCESS_PUBLIC_KEY", "SIGNATURE"],
                ensurePermissions: true,
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