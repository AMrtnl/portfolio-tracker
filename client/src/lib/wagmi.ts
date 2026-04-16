import { connectorsForWallets } from '@rainbow-me/rainbowkit'
import {
  rainbowWallet,
  rabbyWallet,
  metaMaskWallet,
  walletConnectWallet,
  coinbaseWallet,
  ledgerWallet,
} from '@rainbow-me/rainbowkit/wallets'
import { createConfig, http } from 'wagmi'
import { mainnet, arbitrum, base, optimism } from 'wagmi/chains'

const PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? 'YOUR_PROJECT_ID'

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [rabbyWallet, rainbowWallet, metaMaskWallet],
    },
    {
      groupName: 'More',
      wallets: [walletConnectWallet, coinbaseWallet, ledgerWallet],
    },
  ],
  { appName: 'FinVault', projectId: PROJECT_ID }
)

export const wagmiConfig = createConfig({
  connectors,
  chains: [mainnet, arbitrum, base, optimism],
  transports: {
    [mainnet.id]:  http(),
    [arbitrum.id]: http(),
    [base.id]:     http(),
    [optimism.id]: http(),
  },
})
