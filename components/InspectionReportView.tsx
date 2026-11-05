'use client';

import React, { useState } from 'react';
import { NetworkHealthReport } from '@/lib/types';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { BOT_NETWORK_HEALTH_ABI } from '@/lib/contractAbi';
import { useAppConfig } from './Web3Provider';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  ArrowRightLeft,
  ShieldCheck,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface InspectionReportViewProps {
  report: NetworkHealthReport;
}

export function InspectionReportView({ report }: InspectionReportViewProps) {
  const { isConnected, address } = useAccount();
  const { config } = useAppConfig();
  const [showBlockTable, setShowBlockTable] = useState(false);
  const [activeRequestId, setActiveRequestId] = useState<`0x${string}` | null>(null);
  const [lookupRequestId, setLookupRequestId] = useState<string>('');
  const [queriedRequest, setQueriedRequest] = useState<any>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  const contractAddress = (config?.contractAddress || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`;

  // Smart contract writes
  const {
    writeContract: requestInspectionWrite,
    data: requestTxHash,
    isPending: isRequestingTx,
    error: requestTxError,
  } = useWriteContract();

  const {
    writeContract: publishResultWrite,
    data: publishTxHash,
    isPending: isPublishingTx,
    error: publishTxError,
  } = useWriteContract();

  const { isLoading: isRequestConfirming, isSuccess: isRequestSuccess } = useWaitForTransactionReceipt({
    hash: requestTxHash,
  });

  const { isLoading: isPublishConfirming, isSuccess: isPublishSuccess } = useWaitForTransactionReceipt({
    hash: publishTxHash,
  });

  // Handle on-chain requestNetworkInspection
  const handleRequestOnChain = () => {
    if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') {
      alert('Contract address is not set in .env. Please run "npm run deploy" first.');
      return;
    }
    requestInspectionWrite({
      address: contractAddress,
      abi: BOT_NETWORK_HEALTH_ABI,
      functionName: 'requestNetworkInspection',
      args: [report.endpointConfigHash, BigInt(report.fromBlock), BigInt(report.toBlock)],
    });
  };

  // Handle on-chain publishResult
  const handlePublishOnChain = () => {
    if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') {
      alert('Contract address is not set in .env.');
      return;
    }
    const targetRequestId = activeRequestId || report.endpointConfigHash;
    publishResultWrite({
      address: contractAddress,
      abi: BOT_NETWORK_HEALTH_ABI,
      functionName: 'publishResult',
      args: [targetRequestId, report.reportHash],
    });
  };

  // Query request from contract
  const handleQueryRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setQueryError(null);
    setQueriedRequest(null);
    if (!lookupRequestId.startsWith('0x') || lookupRequestId.length !== 66) {
      setQueryError('Invalid Request ID format. Must be a 32-byte hex string (0x...).');
      return;
    }

    try {
      const res = await fetch(config?.rpcUrl || 'https://rpc.bohr.life', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 99,
          method: 'eth_call',
          params: [
            {
              to: contractAddress,
              // getRequest(bytes32) function selector: 0xd82980fa
              data: `0xd82980fa${lookupRequestId.slice(2)}`,
            },
            'latest',
          ],
        }),
      });
      const data = await res.json();
      if (data.error || !data.result || data.result === '0x') {
        throw new Error(data.error?.message || 'Request not found on-chain or reverted.');
      }
      setQueriedRequest({
        raw: data.result,
        id: lookupRequestId,
      });
    } catch (err: any) {
      setQueryError(err.message || 'Failed to query request.');
    }
  };

  return (
    <div className="space-y-5 rounded border border-gray-800 bg-[#111827] p-5">
      {/* Report Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-emerald-600 text-white">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Network Inspection Report</h3>
            <p className="text-xs text-gray-400">
              Generated at {new Date(report.timestamp).toLocaleString()} &bull; Primary RPC: {report.endpoint}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="rounded border border-gray-700 bg-gray-800 px-2.5 py-1 text-xs font-mono text-gray-300">
            Chain ID: <strong className="text-white">{report.chainId}</strong>
          </span>
          <span className="rounded border border-gray-700 bg-gray-800 px-2.5 py-1 text-xs font-mono text-gray-300">
            Blocks: <strong className="text-white">{report.fromBlock} &rarr; {report.toBlock}</strong>
          </span>
        </div>
      </div>

      {/* Primary Performance Measurements Grid */}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Core Performance Measurements
        </h4>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {/* Latency */}
          <div className="rounded border border-gray-800 bg-gray-900/90 p-3">
            <span className="text-[11px] text-gray-400">Avg Response Time</span>
            <div className="mt-1 font-mono text-lg font-bold text-white">
              {report.avgLatencyMs} <span className="text-xs font-normal text-gray-400">ms</span>
            </div>
            <span className="text-[10px] text-gray-500">
              Min: {report.minLatencyMs}ms / Max: {report.maxLatencyMs}ms
            </span>
          </div>

          {/* Latest Block */}
          <div className="rounded border border-gray-800 bg-gray-900/90 p-3">
            <span className="text-[11px] text-gray-400">Latest Observed Block</span>
            <div className="mt-1 font-mono text-lg font-bold text-blue-400">
              #{report.latestBlock.toLocaleString()}
            </div>
            <span className="text-[10px] text-gray-500">
              Range: {report.blocksInspected} blocks
            </span>
          </div>

          {/* Block Interval */}
          <div className="rounded border border-gray-800 bg-gray-900/90 p-3">
            <span className="text-[11px] text-gray-400">Avg Block Interval</span>
            <div className="mt-1 font-mono text-lg font-bold text-emerald-400">
              {report.avgBlockIntervalSec} <span className="text-xs font-normal text-gray-400">sec</span>
            </div>
            <span className="text-[10px] text-gray-500">
              Min: {report.minBlockIntervalSec}s / Max: {report.maxBlockIntervalSec}s
            </span>
          </div>

          {/* Throughput */}
          <div className="rounded border border-gray-800 bg-gray-900/90 p-3">
            <span className="text-[11px] text-gray-400">Throughput (TPS)</span>
            <div className="mt-1 font-mono text-lg font-bold text-amber-400">
              {report.throughputTps} <span className="text-xs font-normal text-gray-400">tx/s</span>
            </div>
            <span className="text-[10px] text-gray-500">
              Avg {report.avgTransactionsPerBlock} tx/block
            </span>
          </div>

          {/* Gas Utilization */}
          <div className="rounded border border-gray-800 bg-gray-900/90 p-3">
            <span className="text-[11px] text-gray-400">Avg Gas Utilization</span>
            <div className="mt-1 font-mono text-lg font-bold text-indigo-400">
              {report.avgGasUtilization}%
            </div>
            <span className="text-[10px] text-gray-500">
              Total tx: {report.totalTransactions}
            </span>
          </div>

          {/* RPC Error Rate */}
          <div className="rounded border border-gray-800 bg-gray-900/90 p-3">
            <span className="text-[11px] text-gray-400">RPC Error Rate</span>
            <div
              className={`mt-1 font-mono text-lg font-bold ${
                report.failedRequestRate === 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {report.failedRequestRate}%
            </div>
            <span className="text-[10px] text-gray-500">
              {report.failedRequestRate === 0 ? 'Zero failures' : 'Errors detected'}
            </span>
          </div>
        </div>
      </div>

      {/* Block Synchronization Comparison (if comparison endpoint provided) */}
      {report.syncComparison && (
        <div className="rounded border border-gray-800 bg-[#0d131f] p-4">
          <div className="flex items-center space-x-2">
            <ArrowRightLeft className="h-4 w-4 text-blue-400" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-300">
              Block Synchronization & Comparison Report
            </h4>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4 text-xs">
            <div className="rounded border border-gray-800 bg-gray-900 p-2.5">
              <span className="text-gray-400">Primary Endpoint Block</span>
              <p className="mt-1 font-mono font-bold text-white">
                #{report.syncComparison.primaryLatestBlock.toLocaleString()}
              </p>
              <span className="text-[10px] text-gray-500">
                Latency: {report.syncComparison.primaryLatencyMs}ms
              </span>
            </div>

            <div className="rounded border border-gray-800 bg-gray-900 p-2.5">
              <span className="text-gray-400">Comparison Endpoint Block</span>
              <p className="mt-1 font-mono font-bold text-white">
                #{report.syncComparison.comparisonLatestBlock.toLocaleString()}
              </p>
              <span className="text-[10px] text-gray-500">
                Latency: {report.syncComparison.comparisonLatencyMs}ms
              </span>
            </div>

            <div className="rounded border border-gray-800 bg-gray-900 p-2.5">
              <span className="text-gray-400">Block Lag (Primary - Comparison)</span>
              <p
                className={`mt-1 font-mono font-bold ${
                  Math.abs(report.syncComparison.blockLag) <= 1
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                }`}
              >
                {report.syncComparison.blockLag > 0 ? `+${report.syncComparison.blockLag}` : report.syncComparison.blockLag} blocks
              </p>
              <span className="text-[10px] text-gray-500">
                {report.syncComparison.isSynced ? 'In sync (within tolerance)' : 'Node desynchronized'}
              </span>
            </div>

            <div className="rounded border border-gray-800 bg-gray-900 p-2.5">
              <span className="text-gray-400">Chain ID Consistency</span>
              <p
                className={`mt-1 font-mono font-bold ${
                  report.syncComparison.chainMatch ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {report.syncComparison.chainMatch ? 'MATCH (968)' : 'MISMATCH'}
              </p>
              <span className="text-[10px] text-gray-500">
                Comparison Chain ID: {report.syncComparison.comparisonChainId}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Cryptographic Commitment & On-chain Interaction */}
      <div className="rounded border border-blue-900/60 bg-[#0d1424] p-4">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="h-5 w-5 text-blue-400" />
          <h4 className="text-sm font-semibold text-white">
            Smart Contract Commitment (BOTNetworkHealth.sol)
          </h4>
        </div>
        <p className="mt-1 text-xs text-gray-400">
          The Solidity contract records the inspection request and commits the inspection report hash on Botchain Testnet.
        </p>

        {/* Cryptographic Hashes */}
        <div className="mt-3 space-y-2 text-xs font-mono">
          <div className="rounded border border-gray-800 bg-gray-950 p-2.5">
            <span className="text-gray-500">endpointConfigurationHash:</span>
            <div className="break-all text-blue-300 font-semibold">{report.endpointConfigHash}</div>
          </div>
          <div className="rounded border border-gray-800 bg-gray-950 p-2.5">
            <span className="text-gray-500">reportHash:</span>
            <div className="break-all text-emerald-300 font-semibold">{report.reportHash}</div>
          </div>
        </div>

        {/* Contract Actions */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={handleRequestOnChain}
            disabled={!isConnected || isRequestingTx || isRequestConfirming}
            className="flex items-center space-x-1.5 rounded bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <span>
              {isRequestingTx || isRequestConfirming
                ? 'Requesting On-Chain...'
                : '1. requestNetworkInspection()'}
            </span>
          </button>

          <button
            onClick={handlePublishOnChain}
            disabled={!isConnected || isPublishingTx || isPublishConfirming}
            className="flex items-center space-x-1.5 rounded bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <span>
              {isPublishingTx || isPublishConfirming
                ? 'Publishing Result...'
                : '2. publishResult()'}
            </span>
          </button>

          {!isConnected && (
            <span className="text-xs text-amber-400">
              Connect wallet to interact with BOTNetworkHealth.sol
            </span>
          )}
        </div>

        {/* Contract Action Status Feedbacks */}
        {requestTxHash && (
          <div className="mt-3 rounded border border-gray-700 bg-gray-900 p-2 text-xs text-gray-300">
            <span>Inspection Requested Tx: </span>
            <a
              href={`https://scan.bohr.life/tx/${requestTxHash}`}
              target="_blank"
              rel="noreferrer"
              className="text-blue-400 underline font-mono inline-flex items-center space-x-1"
            >
              <span>{requestTxHash.slice(0, 16)}...</span>
              <ExternalLink className="h-3 w-3" />
            </a>
            {isRequestSuccess && <span className="ml-2 text-emerald-400 font-bold">&#10003; Confirmed</span>}
          </div>
        )}

        {publishTxHash && (
          <div className="mt-2 rounded border border-gray-700 bg-gray-900 p-2 text-xs text-gray-300">
            <span>Result Published Tx: </span>
            <a
              href={`https://scan.bohr.life/tx/${publishTxHash}`}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 underline font-mono inline-flex items-center space-x-1"
            >
              <span>{publishTxHash.slice(0, 16)}...</span>
              <ExternalLink className="h-3 w-3" />
            </a>
            {isPublishSuccess && <span className="ml-2 text-emerald-400 font-bold">&#10003; Confirmed</span>}
          </div>
        )}

        {/* Lookup getRequest() form */}
        <div className="mt-4 border-t border-gray-800 pt-3">
          <span className="text-xs font-medium text-gray-300">
            Query on-chain record: <code className="text-blue-400">getRequest(requestId)</code>
          </span>
          <form onSubmit={handleQueryRequest} className="mt-1.5 flex gap-2">
            <input
              type="text"
              value={lookupRequestId}
              onChange={(e) => setLookupRequestId(e.target.value.trim())}
              placeholder="Paste bytes32 requestId (0x...)"
              className="flex-1 rounded border border-gray-700 bg-gray-950 px-3 py-1.5 text-xs font-mono text-gray-200 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-gray-700"
            >
              Lookup
            </button>
          </form>

          {queryError && (
            <p className="mt-1 text-xs text-red-400">{queryError}</p>
          )}

          {queriedRequest && (
            <div className="mt-2 rounded border border-gray-800 bg-gray-950 p-2 font-mono text-xs text-gray-300">
              <span className="text-emerald-400 font-bold">On-Chain Record Found:</span>
              <div className="mt-1 break-all text-gray-400">
                Raw data: {queriedRequest.raw}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toggle Block Inspection Details Table */}
      <div className="border-t border-gray-800 pt-3">
        <button
          onClick={() => setShowBlockTable(!showBlockTable)}
          className="flex items-center space-x-1 text-xs font-medium text-gray-400 hover:text-white"
        >
          {showBlockTable ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <span>{showBlockTable ? 'Hide' : 'Show'} Sampled Block Breakdown ({report.blockMetrics.length} blocks)</span>
        </button>

        {showBlockTable && (
          <div className="mt-3 overflow-x-auto rounded border border-gray-800">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-gray-800 bg-gray-900 text-gray-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Block #</th>
                  <th className="px-3 py-2 font-medium">Timestamp</th>
                  <th className="px-3 py-2 font-medium">Interval (s)</th>
                  <th className="px-3 py-2 font-medium">Tx Count</th>
                  <th className="px-3 py-2 font-medium">Gas Used</th>
                  <th className="px-3 py-2 font-medium">Gas Limit</th>
                  <th className="px-3 py-2 font-medium">Gas Util</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 bg-gray-950 font-mono text-gray-300">
                {report.blockMetrics.map((b) => (
                  <tr key={b.number} className="hover:bg-gray-900/60">
                    <td className="px-3 py-1.5 text-blue-400 font-bold">#{b.number}</td>
                    <td className="px-3 py-1.5 text-gray-400">
                      {new Date(b.timestamp * 1000).toLocaleTimeString()}
                    </td>
                    <td className="px-3 py-1.5">{b.intervalSec ?? 0}s</td>
                    <td className="px-3 py-1.5">{b.transactionsCount}</td>
                    <td className="px-3 py-1.5">{Number(b.gasUsed).toLocaleString()}</td>
                    <td className="px-3 py-1.5">{Number(b.gasLimit).toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-indigo-400">{b.gasUtilization}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

