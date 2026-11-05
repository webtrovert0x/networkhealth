'use client';

import React, { useState } from 'react';
import { NetworkHealthReport } from '@/lib/types';
import { runNetworkInspection } from '@/lib/inspector';
import { Play, Sliders } from 'lucide-react';

interface InspectionFormProps {
  onReportGenerated: (report: NetworkHealthReport) => void;
  defaultRpcUrl?: string;
}

export function InspectionForm({
  onReportGenerated,
  defaultRpcUrl = 'https://rpc.bohr.life',
}: InspectionFormProps) {
  const [rpcUrl, setRpcUrl] = useState(defaultRpcUrl);
  const [comparisonRpcUrl, setComparisonRpcUrl] = useState('');
  const [rangeMode, setRangeMode] = useState<'latest' | 'custom'>('latest');
  const [blockCount, setBlockCount] = useState<number>(10);
  const [fromBlock, setFromBlock] = useState<string>('');
  const [toBlock, setToBlock] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsRunning(true);

    const payload: any = {
      rpcUrl: rpcUrl.trim(),
      comparisonRpcUrl: comparisonRpcUrl.trim() || undefined,
    };

    if (rangeMode === 'custom') {
      if (!fromBlock || !toBlock) {
        setErrorMessage('Please enter both From Block and To Block in custom mode.');
        setIsRunning(false);
        return;
      }
      if (Number(toBlock) < Number(fromBlock)) {
        setErrorMessage('To Block must be greater than or equal to From Block.');
        setIsRunning(false);
        return;
      }
      payload.fromBlock = Number(fromBlock);
      payload.toBlock = Number(toBlock);
    } else {
      payload.blockCount = Number(blockCount);
    }

    try {
      // 1. First try direct client-side execution for true user latency
      const report = await runNetworkInspection(payload);
      onReportGenerated(report);
    } catch (clientErr: any) {
      console.warn('Client-side inspection fallback to server:', clientErr);
      try {
        // 2. Fallback to API route
        const res = await fetch('/api/inspect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || clientErr.message || 'Inspection failed.');
        }

        onReportGenerated(data);
      } catch (serverErr: any) {
        setErrorMessage(clientErr.message || serverErr.message || 'Inspection failed.');
      }
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="rounded border border-gray-800 bg-[#111827] p-5">
      <div className="flex items-center space-x-2 border-b border-gray-800 pb-3">
        <Sliders className="h-5 w-5 text-blue-500" />
        <h3 className="text-base font-semibold text-white">Inspection Form</h3>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {/* RPC Endpoint Configuration */}
        <div>
          <label className="block text-xs font-medium text-gray-300">
            Primary RPC Endpoint Configuration <span className="text-red-400">*</span>
          </label>
          <div className="mt-1">
            <input
              type="text"
              required
              value={rpcUrl}
              onChange={(e) => setRpcUrl(e.target.value)}
              placeholder="https://rpc.bohr.life"
              className="w-full rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <p className="mt-1 text-xs text-gray-400">
            Default endpoint: Botchain Testnet (<code className="text-blue-400">https://rpc.bohr.life</code>)
          </p>
        </div>

        {/* Optional Comparison Endpoint */}
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-gray-300">
              Optional Comparison Endpoint
            </label>
            <span className="text-[11px] text-gray-500">For sync & latency delta</span>
          </div>
          <div className="mt-1">
            <input
              type="text"
              value={comparisonRpcUrl}
              onChange={(e) => setComparisonRpcUrl(e.target.value)}
              placeholder="https://... (e.g. secondary RPC or peer node)"
              className="w-full rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <p className="mt-1 text-xs text-gray-400">
            Leave blank if you only want to inspect the primary endpoint.
          </p>
        </div>

        {/* Block Range Mode */}
        <div>
          <label className="block text-xs font-medium text-gray-300">Block Range Mode</label>
          <div className="mt-1.5 flex space-x-3">
            <button
              type="button"
              onClick={() => setRangeMode('latest')}
              className={`rounded px-3 py-1.5 text-xs font-medium border ${
                rangeMode === 'latest'
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Latest N Blocks
            </button>
            <button
              type="button"
              onClick={() => setRangeMode('custom')}
              className={`rounded px-3 py-1.5 text-xs font-medium border ${
                rangeMode === 'custom'
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              Explicit Block Range (From / To)
            </button>
          </div>
        </div>

        {/* Block Range Input Selection */}
        {rangeMode === 'latest' ? (
          <div>
            <label className="block text-xs font-medium text-gray-300">
              Number of Blocks to Sample
            </label>
            <div className="mt-1 flex items-center space-x-2">
              {[5, 10, 15, 20, 30].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setBlockCount(n)}
                  className={`rounded border px-2.5 py-1 text-xs font-mono font-medium ${
                    blockCount === n
                      ? 'border-blue-500 bg-blue-950/80 text-blue-300'
                      : 'border-gray-700 bg-gray-900 text-gray-400 hover:bg-gray-800'
                  }`}
                >
                  {n} blocks
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-300">
                From Block Number
              </label>
              <input
                type="number"
                min="0"
                value={fromBlock}
                onChange={(e) => setFromBlock(e.target.value)}
                placeholder="e.g. 29379800"
                className="mt-1 w-full rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300">
                To Block Number
              </label>
              <input
                type="number"
                min="0"
                value={toBlock}
                onChange={(e) => setToBlock(e.target.value)}
                placeholder="e.g. 29379815"
                className="mt-1 w-full rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="rounded border border-red-800 bg-red-950/50 p-3 text-xs text-red-300">
            {errorMessage}
          </div>
        )}

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isRunning}
            className="flex w-full items-center justify-center space-x-2 rounded bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Running Network Inspection...</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-white" />
                <span>Click Run Network Inspection</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
