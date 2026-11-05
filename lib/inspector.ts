import { keccak256, toHex } from 'viem';
import { NetworkHealthReport, BlockMetric } from './types';

interface InspectionParams {
  rpcUrl: string;
  comparisonRpcUrl?: string;
  fromBlock?: number;
  toBlock?: number;
  blockCount?: number;
}

/**
 * Executes a single JSON-RPC call and tracks RTT latency and success.
 */
async function callRpc(url: string, method: string, params: any[] = [], timeoutMs = 8000): Promise<{ result: any; latencyMs: number; ok: boolean; error?: string }> {
  const start = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Math.floor(Math.random() * 100000),
        method,
        params,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - start);

    if (!res.ok) {
      return { result: null, latencyMs, ok: false, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    if (data.error) {
      return { result: null, latencyMs, ok: false, error: data.error.message || 'RPC Error' };
    }
    return { result: data.result, latencyMs, ok: true };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - start);
    return { result: null, latencyMs, ok: false, error: err.name === 'AbortError' ? 'Timeout' : err.message || 'Connection failed' };
  }
}

/**
 * Executes a batch JSON-RPC call for high performance.
 */
async function callRpcBatch(url: string, calls: { id: number; method: string; params: any[] }[], timeoutMs = 12000): Promise<{ results: any[]; latencyMs: number; ok: boolean }> {
  const start = performance.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        calls.map((c) => ({
          jsonrpc: '2.0',
          id: c.id,
          method: c.method,
          params: c.params,
        }))
      ),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - start);

    if (!res.ok) {
      return { results: [], latencyMs, ok: false };
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      data.sort((a, b) => a.id - b.id);
      return { results: data.map((d) => d.result), latencyMs, ok: true };
    }
    return { results: [], latencyMs, ok: false };
  } catch {
    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - start);
    return { results: [], latencyMs, ok: false };
  }
}

/**
 * Runs a complete network health inspection over an RPC endpoint.
 */
export async function runNetworkInspection(params: InspectionParams): Promise<NetworkHealthReport> {
  const { rpcUrl, comparisonRpcUrl } = params;
  let totalRequests = 0;
  let failedRequests = 0;
  const latencies: number[] = [];

  // 1. Probe chain ID and latest block concurrently
  totalRequests += 2;
  const [chainIdRes, latestBlockRes] = await Promise.all([
    callRpc(rpcUrl, 'eth_chainId'),
    callRpc(rpcUrl, 'eth_blockNumber'),
  ]);

  if (chainIdRes.ok) latencies.push(chainIdRes.latencyMs);
  else failedRequests++;

  if (latestBlockRes.ok) latencies.push(latestBlockRes.latencyMs);
  else failedRequests++;

  const chainId = chainIdRes.ok ? parseInt(chainIdRes.result, 16) : 968;
  const latestBlock = latestBlockRes.ok ? parseInt(latestBlockRes.result, 16) : 0;

  if (latestBlock === 0 && !latestBlockRes.ok) {
    throw new Error(`Unable to fetch latest block from ${rpcUrl}: ${latestBlockRes.error || 'Network request failed'}`);
  }

  // Determine block range
  let toBlock = params.toBlock ? Math.min(params.toBlock, latestBlock) : latestBlock;
  let blockCount = params.blockCount || (params.fromBlock ? toBlock - params.fromBlock + 1 : 10);
  blockCount = Math.max(2, Math.min(blockCount, 30));
  let fromBlock = params.fromBlock ?? Math.max(0, toBlock - blockCount + 1);
  if (fromBlock > toBlock) {
    fromBlock = Math.max(0, toBlock - 5);
  }

  // 2. Collect block data using batching
  const blockMetrics: BlockMetric[] = [];
  const calls: { id: number; method: string; params: any[]; blockNum: number }[] = [];

  for (let b = fromBlock; b <= toBlock; b++) {
    calls.push({
      id: calls.length,
      method: 'eth_getBlockByNumber',
      params: ['0x' + b.toString(16), false],
      blockNum: b,
    });
  }

  // Try batch first (faster)
  totalRequests += calls.length;
  const batchRes = await callRpcBatch(rpcUrl, calls);

  let rawBlocks: (BlockMetric | null)[] = [];

  if (batchRes.ok && batchRes.results.length === calls.length) {
    latencies.push(Math.round(batchRes.latencyMs / calls.length));
    rawBlocks = batchRes.results.map((block, idx) => {
      if (!block) {
        failedRequests++;
        return null;
      }
      const gasUsed = BigInt(block.gasUsed || '0x0');
      const gasLimit = BigInt(block.gasLimit || '0x1');
      const gasUtil = gasLimit > 0n ? Number((gasUsed * 10000n) / gasLimit) / 100 : 0;
      return {
        number: calls[idx].blockNum,
        hash: block.hash,
        timestamp: parseInt(block.timestamp, 16),
        transactionsCount: Array.isArray(block.transactions) ? block.transactions.length : 0,
        gasUsed: gasUsed.toString(),
        gasLimit: gasLimit.toString(),
        gasUtilization: gasUtil,
      };
    });
  } else {
    // Fallback to sequential chunks of 3 if batching fails
    for (let i = 0; i < calls.length; i += 3) {
      const chunk = calls.slice(i, i + 3);
      const chunkResults = await Promise.all(
        chunk.map(async (c) => {
          const res = await callRpc(rpcUrl, c.method, c.params);
          if (res.ok && res.result) {
            latencies.push(res.latencyMs);
            const block = res.result;
            const gasUsed = BigInt(block.gasUsed || '0x0');
            const gasLimit = BigInt(block.gasLimit || '0x1');
            const gasUtil = gasLimit > 0n ? Number((gasUsed * 10000n) / gasLimit) / 100 : 0;
            return {
              number: c.blockNum,
              hash: block.hash,
              timestamp: parseInt(block.timestamp, 16),
              transactionsCount: Array.isArray(block.transactions) ? block.transactions.length : 0,
              gasUsed: gasUsed.toString(),
              gasLimit: gasLimit.toString(),
              gasUtilization: gasUtil,
            };
          } else {
            failedRequests++;
            return null;
          }
        })
      );
      rawBlocks.push(...chunkResults);
    }
  }

  const validBlocks = rawBlocks.filter((b): b is BlockMetric => b !== null);
  validBlocks.sort((a, b) => a.number - b.number);

  // Calculate block intervals
  const intervals: number[] = [];
  for (let i = 0; i < validBlocks.length; i++) {
    if (i > 0) {
      const diff = validBlocks[i].timestamp - validBlocks[i - 1].timestamp;
      validBlocks[i].intervalSec = Math.max(0, diff);
      intervals.push(validBlocks[i].intervalSec!);
    } else {
      validBlocks[i].intervalSec = 0;
    }
    blockMetrics.push(validBlocks[i]);
  }

  // Calculations
  const avgLatencyMs = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  const minLatencyMs = latencies.length ? Math.min(...latencies) : 0;
  const maxLatencyMs = latencies.length ? Math.max(...latencies) : 0;
  const failedRequestRate = totalRequests > 0 ? Number(((failedRequests / totalRequests) * 100).toFixed(2)) : 0;

  const avgBlockIntervalSec = intervals.length
    ? Number((intervals.reduce((a, b) => a + b, 0) / intervals.length).toFixed(2))
    : 0;
  const minBlockIntervalSec = intervals.length ? Math.min(...intervals) : 0;
  const maxBlockIntervalSec = intervals.length ? Math.max(...intervals) : 0;

  const totalTx = validBlocks.reduce((acc, b) => acc + b.transactionsCount, 0);
  const avgTxPerBlock = validBlocks.length ? Number((totalTx / validBlocks.length).toFixed(2)) : 0;

  let totalTimeSec = 0;
  if (validBlocks.length > 1) {
    totalTimeSec = validBlocks[validBlocks.length - 1].timestamp - validBlocks[0].timestamp;
  }
  const throughputTps = totalTimeSec > 0
    ? Number((totalTx / totalTimeSec).toFixed(2))
    : (avgBlockIntervalSec > 0 ? Number((avgTxPerBlock / avgBlockIntervalSec).toFixed(2)) : 0);

  const avgGasUtil = validBlocks.length
    ? Number((validBlocks.reduce((acc, b) => acc + b.gasUtilization, 0) / validBlocks.length).toFixed(2))
    : 0;
  const totalGasUsed = validBlocks.reduce((acc, b) => acc + BigInt(b.gasUsed), 0n).toString();

  // 3. Comparison endpoint check if provided
  let syncComparison: NetworkHealthReport['syncComparison'] = undefined;
  if (comparisonRpcUrl && comparisonRpcUrl.trim().length > 0) {
    try {
      totalRequests += 2;
      const [compChainRes, compBlockRes] = await Promise.all([
        callRpc(comparisonRpcUrl, 'eth_chainId', [], 5000),
        callRpc(comparisonRpcUrl, 'eth_blockNumber', [], 5000),
      ]);

      if (compBlockRes.ok) {
        const compBlock = parseInt(compBlockRes.result, 16);
        const compChain = compChainRes.ok ? parseInt(compChainRes.result, 16) : 0;
        const blockLag = latestBlock - compBlock;
        syncComparison = {
          primaryLatestBlock: latestBlock,
          comparisonLatestBlock: compBlock,
          blockLag,
          primaryLatencyMs: avgLatencyMs,
          comparisonLatencyMs: compBlockRes.latencyMs,
          comparisonChainId: compChain,
          isSynced: Math.abs(blockLag) <= 2,
          chainMatch: compChain === chainId,
        };
      }
    } catch {
      // Comparison failed silently or marked partial
    }
  }

  // Calculate cryptographic hashes
  const endpointConfigString = `${rpcUrl.trim()}|${(comparisonRpcUrl || '').trim()}|${fromBlock}|${toBlock}`;
  const endpointConfigHash = keccak256(toHex(endpointConfigString));

  const canonicalReportSummary = {
    endpoint: rpcUrl,
    fromBlock,
    toBlock,
    chainId,
    latestBlock,
    avgLatencyMs,
    avgBlockIntervalSec,
    throughputTps,
    avgGasUtilization: avgGasUtil,
    failedRequestRate,
    totalTransactions: totalTx,
  };
  const reportHash = keccak256(toHex(JSON.stringify(canonicalReportSummary)));

  return {
    id: `rpt-${Date.now()}`,
    timestamp: Date.now(),
    endpoint: rpcUrl,
    comparisonEndpoint: comparisonRpcUrl,
    fromBlock,
    toBlock,
    blocksInspected: validBlocks.length,
    chainId,
    avgLatencyMs,
    minLatencyMs,
    maxLatencyMs,
    failedRequestRate,
    latestBlock,
    avgBlockIntervalSec,
    minBlockIntervalSec,
    maxBlockIntervalSec,
    avgTransactionsPerBlock: avgTxPerBlock,
    throughputTps,
    avgGasUtilization: avgGasUtil,
    totalTransactions: totalTx,
    totalGasUsed,
    blockMetrics,
    syncComparison,
    endpointConfigHash,
    reportHash,
  };
}
