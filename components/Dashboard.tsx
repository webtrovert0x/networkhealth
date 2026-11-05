'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Activity, Clock, Cpu, AlertTriangle, Layers, Zap, RefreshCw } from 'lucide-react';

interface TelemetryData {
  endpoint: string;
  isOnline: boolean;
  latencyMs: number;
  blockNumber: number;
  blockIntervalSec: number;
  tps: number;
  gasUtilization: number;
  failedRequestRate: number;
  totalRequests: number;
  failedRequests: number;
  lastUpdated: number;
}

export function Dashboard({ rpcUrl = 'https://rpc.bohr.life' }: { rpcUrl?: string }) {
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    endpoint: rpcUrl,
    isOnline: false,
    latencyMs: 0,
    blockNumber: 0,
    blockIntervalSec: 0,
    tps: 0,
    gasUtilization: 0,
    failedRequestRate: 0,
    totalRequests: 0,
    failedRequests: 0,
    lastUpdated: Date.now(),
  });

  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [recentLatencies, setRecentLatencies] = useState<number[]>([]);

  const fetchTelemetry = useCallback(async () => {
    setIsLoading(true);
    const start = performance.now();
    try {
      // 1. Check latest block and measure latency
      const blockRes = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_blockNumber',
          params: [],
        }),
      });

      const latency = Math.round(performance.now() - start);

      if (!blockRes.ok) {
        throw new Error(`HTTP ${blockRes.status}`);
      }

      const blockData = await blockRes.json();
      if (blockData.error) throw new Error(blockData.error.message);

      const currentBlock = parseInt(blockData.result, 16);

      // 2. Fetch current block and previous block for interval and throughput
      const prevBlockHex = '0x' + Math.max(0, currentBlock - 1).toString(16);
      const currBlockHex = blockData.result;

      const [currBRes, prevBRes] = await Promise.all([
        fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'eth_getBlockByNumber',
            params: [currBlockHex, false],
          }),
        }).then((r) => r.json()),
        fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 3,
            method: 'eth_getBlockByNumber',
            params: [prevBlockHex, false],
          }),
        }).then((r) => r.json()),
      ]);

      const currB = currBRes.result;
      const prevB = prevBRes.result;

      let interval = 0;
      let tps = 0;
      let gasUtil = 0;

      if (currB && prevB) {
        const t1 = parseInt(currB.timestamp, 16);
        const t0 = parseInt(prevB.timestamp, 16);
        interval = Math.max(0, t1 - t0);

        const txCount = Array.isArray(currB.transactions) ? currB.transactions.length : 0;
        tps = interval > 0 ? Number((txCount / interval).toFixed(2)) : txCount;

        const gasUsed = BigInt(currB.gasUsed || '0x0');
        const gasLimit = BigInt(currB.gasLimit || '0x1');
        gasUtil = gasLimit > 0n ? Number((gasUsed * 10000n) / gasLimit) / 100 : 0;
      }

      setRecentLatencies((prev) => [...prev.slice(-9), latency]);

      setTelemetry((prev) => {
        const total = prev.totalRequests + 1;
        return {
          endpoint: rpcUrl,
          isOnline: true,
          latencyMs: latency,
          blockNumber: currentBlock,
          blockIntervalSec: interval,
          tps,
          gasUtilization: Number(gasUtil.toFixed(2)),
          failedRequestRate: Number(((prev.failedRequests / total) * 100).toFixed(1)),
          totalRequests: total,
          failedRequests: prev.failedRequests,
          lastUpdated: Date.now(),
        };
      });
    } catch (err) {
      setTelemetry((prev) => {
        const total = prev.totalRequests + 1;
        const failed = prev.failedRequests + 1;
        return {
          ...prev,
          endpoint: rpcUrl,
          isOnline: false,
          failedRequestRate: Number(((failed / total) * 100).toFixed(1)),
          totalRequests: total,
          failedRequests: failed,
          lastUpdated: Date.now(),
        };
      });
    } finally {
      setIsLoading(false);
    }
  }, [rpcUrl]);

  useEffect(() => {
    fetchTelemetry();
    if (!autoRefresh) return;
    const interval = setInterval(fetchTelemetry, 6000);
    return () => clearInterval(interval);
  }, [fetchTelemetry, autoRefresh]);

  const getLatencyBadge = (ms: number) => {
    if (!telemetry.isOnline) return 'text-red-400 bg-red-950/60 border-red-800';
    if (ms < 150) return 'text-emerald-400 bg-emerald-950/60 border-emerald-800';
    if (ms < 400) return 'text-blue-400 bg-blue-950/60 border-blue-800';
    return 'text-amber-400 bg-amber-950/60 border-amber-800';
  };

  return (
    <section className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Network Telemetry Dashboard</h2>
          <p className="text-xs text-gray-400">
            Real-time health indicators from Botchain RPC node ({telemetry.endpoint})
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <label className="flex items-center space-x-2 text-xs text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-700 bg-gray-900 text-blue-600 focus:ring-0"
            />
            <span>Auto-refresh (6s)</span>
          </label>

          <button
            onClick={fetchTelemetry}
            disabled={isLoading}
            className="flex items-center space-x-1.5 rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-gray-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: RPC Status */}
        <div className="rounded border border-gray-800 bg-[#111827] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">RPC Status</span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                telemetry.isOnline
                  ? 'border-emerald-800 bg-emerald-950/60 text-emerald-400'
                  : 'border-red-800 bg-red-950/60 text-red-400'
              }`}
            >
              <span
                className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                  telemetry.isOnline ? 'bg-emerald-400' : 'bg-red-400'
                }`}
              />
              {telemetry.isOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-white">
              {telemetry.isOnline ? 'Active' : 'Unreachable'}
            </div>
            <p className="mt-1 text-xs text-gray-400 truncate">
              {telemetry.endpoint}
            </p>
          </div>
        </div>

        {/* Card 2: RPC Response Latency */}
        <div className="rounded border border-gray-800 bg-[#111827] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Response Latency</span>
            <Activity className="h-4 w-4 text-gray-400" />
          </div>
          <div className="mt-3">
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-bold font-mono text-white">
                {telemetry.isOnline ? `${telemetry.latencyMs}` : '--'}
              </span>
              <span className="text-xs text-gray-400">ms</span>
            </div>
            <div className="mt-2 flex items-center space-x-1">
              {recentLatencies.map((lat, idx) => (
                <div
                  key={idx}
                  title={`${lat}ms`}
                  style={{ height: `${Math.min(24, Math.max(6, (lat / 500) * 24))}px` }}
                  className="w-2 rounded-sm bg-blue-500"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Card 3: Latest Observed Block */}
        <div className="rounded border border-gray-800 bg-[#111827] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Latest Observed Block</span>
            <Layers className="h-4 w-4 text-blue-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-white">
              {telemetry.blockNumber > 0 ? `#${telemetry.blockNumber.toLocaleString()}` : '--'}
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Updated {new Date(telemetry.lastUpdated).toLocaleTimeString()}
            </p>
          </div>
        </div>

        {/* Card 4: Block Production Interval */}
        <div className="rounded border border-gray-800 bg-[#111827] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Block Production Interval</span>
            <Clock className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-bold font-mono text-white">
                {telemetry.blockIntervalSec > 0 ? `${telemetry.blockIntervalSec}` : '--'}
              </span>
              <span className="text-xs text-gray-400">sec / block</span>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Delta between latest two blocks
            </p>
          </div>
        </div>

        {/* Card 5: Transaction Throughput */}
        <div className="rounded border border-gray-800 bg-[#111827] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Transaction Throughput</span>
            <Zap className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-3">
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-bold font-mono text-white">
                {telemetry.isOnline ? `${telemetry.tps}` : '--'}
              </span>
              <span className="text-xs text-gray-400">TPS</span>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Observed in latest block
            </p>
          </div>
        </div>

        {/* Card 6: Gas Utilization */}
        <div className="rounded border border-gray-800 bg-[#111827] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Gas Utilization</span>
            <Cpu className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="mt-3">
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-bold font-mono text-white">
                {telemetry.isOnline ? `${telemetry.gasUtilization}%` : '--'}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded bg-gray-800">
              <div
                className="h-1.5 rounded bg-indigo-500"
                style={{ width: `${Math.min(100, telemetry.gasUtilization)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 7: Failed RPC Request Rate */}
        <div className="rounded border border-gray-800 bg-[#111827] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Failed RPC Request Rate</span>
            <AlertTriangle className="h-4 w-4 text-red-400" />
          </div>
          <div className="mt-3">
            <div className="flex items-baseline space-x-2">
              <span
                className={`text-2xl font-bold font-mono ${
                  telemetry.failedRequestRate > 0 ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {telemetry.failedRequestRate}%
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              {telemetry.failedRequests} failed / {telemetry.totalRequests} total requests
            </p>
          </div>
        </div>

        {/* Card 8: Network Identification */}
        <div className="rounded border border-gray-800 bg-[#111827] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Network ID</span>
            <span className="font-mono text-xs text-blue-400">BOT-968</span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-white">
              968
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Botchain Testnet EVM
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

