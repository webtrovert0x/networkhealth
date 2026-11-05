import type { Metadata } from 'next';
import './globals.css';
import { Web3Provider } from '@/components/Web3Provider';
import { Header } from '@/components/Header';

export const metadata: Metadata = {
  title: 'BOT Network Health | Botchain Testnet Telemetry',
  description: 'RPC endpoint latency, block production metrics, and on-chain inspection ledger on Botchain Testnet (Chain ID 968).',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0b1120] text-gray-100 antialiased">
        <Web3Provider>
          <div className="flex min-h-screen flex-col">
            <Header />
            <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-7xl">
                {children}
              </div>
            </main>
            <footer className="border-t border-gray-800 bg-[#0d1424] py-4 text-center text-xs text-gray-500">
              <div className="mx-auto max-w-7xl px-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  Botchain Testnet (Chain ID: 968) &bull; Native Token: BOT
                </div>
                <div>
                  RPC: <span className="font-mono text-gray-400">https://rpc.bohr.life</span> &bull; Explorer: <a href="https://scan.bohr.life/" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">scan.bohr.life</a>
                </div>
              </div>
            </footer>
          </div>
        </Web3Provider>
      </body>
    </html>
  );
}

