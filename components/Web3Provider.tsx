'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http, useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { botchainTestnet } from '@/lib/botchain';

interface AppConfig {
  reownId: string;
  contractAddress: string;
  rpcUrl: string;
  chainId: number;
  explorerUrl: string;
  hasReownConfigured: boolean;
  hasContractConfigured: boolean;
}

const ConfigContext = createContext<{
  config: AppConfig | null;
  refreshConfig: () => Promise<void>;
}>({
  config: null,
  refreshConfig: async () => {},
});

export const useAppConfig = () => useContext(ConfigContext);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

// Default Wagmi config targeting Botchain Testnet
export const wagmiConfig = createConfig({
  chains: [botchainTestnet],
  connectors: [injected()],
  transports: {
    [botchainTestnet.id]: http('https://rpc.bohr.life'),
  },
  ssr: true,
});

export function Web3Provider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [appKitLoaded, setAppKitLoaded] = useState(false);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);

        // Dynamically initialize Reown AppKit if REOWN_ID is provided
        if (data.reownId && !appKitLoaded && typeof window !== 'undefined') {
          try {
            const { createAppKit } = await import('@reown/appkit');
            const { WagmiAdapter } = await import('@reown/appkit-adapter-wagmi');

            const wagmiAdapter = new WagmiAdapter({
              projectId: data.reownId,
              networks: [botchainTestnet],
            });

            createAppKit({
              adapters: [wagmiAdapter],
              networks: [botchainTestnet],
              projectId: data.reownId,
              metadata: {
                name: 'BOT Network Health',
                description: 'Inspection and Telemetry on Botchain Testnet',
                url: window.location.origin,
                icons: ['https://scan.bohr.life/favicon.ico'],
              },
              features: {
                analytics: false,
              },
              themeMode: 'dark',
            });
            setAppKitLoaded(true);
          } catch (e) {
            console.warn('Reown AppKit client initialization notice:', e);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load /api/config', err);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return (
    <ConfigContext.Provider value={{ config, refreshConfig: fetchConfig }}>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    </ConfigContext.Provider>
  );
}
