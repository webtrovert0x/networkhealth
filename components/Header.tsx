'use client';

import React from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useAppConfig } from './Web3Provider';
import { Activity, ExternalLink, ShieldCheck, Wallet, AlertCircle } from 'lucide-react';

export function Header() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { config } = useAppConfig();

  const handleConnect = () => {
    // If Reown AppKit is present on window, open it
    const modal = document.querySelector('appkit-button') as any;
    if (modal && typeof modal.click === 'function') {
      modal.click();
      return;
    }

    // Fallback to injected connector
    const injectedConnector = connectors.find((c) => c.id === 'injected') || connectors[0];
    if (injectedConnector) {
      connect({ connector: injectedConnector });
    }
  };

  const truncatedAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : '';

  return (
    <header className="border-b border-gray-800 bg-[#0d1424] px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        {/* Left: Branding & Network */}
        <div className="flex items-center space-x-4">
          <div className="flex h-9 w-9 items-center justify-center rounded bg-blue-600 text-white font-bold">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold tracking-tight text-white sm:text-lg">
                BOT Network Health
              </h1>
              <span className="rounded bg-blue-900/60 px-2 py-0.5 text-xs font-medium text-blue-300 border border-blue-700">
                Botchain Testnet
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Chain ID: 968 &bull; Native: BOT &bull; RPC: https://rpc.bohr.life
            </p>
          </div>
        </div>

        {/* Right: Contract & Wallet */}
        <div className="flex items-center space-x-3">
          <a
            href="https://scan.bohr.life/"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center space-x-1 rounded border border-gray-700 bg-gray-800/80 px-2.5 py-1.5 text-xs text-gray-300 hover:bg-gray-700 sm:flex"
          >
            <span>Explorer</span>
            <ExternalLink className="h-3 w-3" />
          </a>

          {/* Wallet Connection */}
          {isConnected ? (
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1.5 rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-mono text-gray-200">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>{truncatedAddress}</span>
              </div>
              <button
                onClick={() => disconnect()}
                className="rounded border border-red-900 bg-red-950/60 px-2.5 py-1.5 text-xs font-medium text-red-300 hover:bg-red-900/80"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              className="flex items-center space-x-1.5 rounded bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              <Wallet className="h-3.5 w-3.5" />
              <span>Connect Wallet</span>
            </button>
          )}
        </div>
      </div>

      {/* Warning banner if REOWN_ID or contract address not set */}
      {config && (!config.hasReownConfigured || !config.hasContractConfigured) && (
        <div className="mt-2 border-t border-gray-800 pt-2 text-xs text-gray-400 flex flex-wrap items-center justify-between gap-2">
          {!config.hasReownConfigured && (
            <div className="flex items-center space-x-1.5 text-amber-400">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>
                REOWN_ID is pending in .env (Injected wallet connection is active)
              </span>
            </div>
          )}
          {!config.hasContractConfigured && (
            <div className="flex items-center space-x-1.5 text-gray-400">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
              <span>
                Contract not yet deployed. Run `npm run deploy` to publish BOTNetworkHealth.sol to Botchain Testnet.
              </span>
            </div>
          )}
          {config.hasContractConfigured && (
            <div className="flex items-center space-x-1 text-emerald-400 font-mono">
              <span>Contract: {config.contractAddress.slice(0, 8)}...{config.contractAddress.slice(-6)}</span>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

