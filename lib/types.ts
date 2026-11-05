export interface RPCStats {
  endpoint: string;
  isOnline: boolean;
  latencyMs: number;
  blockNumber: number;
  chainId: number;
  timestamp: number;
  errorRate: number; // percentage
  failedRequests: number;
  totalRequests: number;
}

export interface BlockMetric {
  number: number;
  hash: string;
  timestamp: number;
  transactionsCount: number;
  gasUsed: string;
  gasLimit: string;
  gasUtilization: number; // percentage
  intervalSec?: number;
}

export interface NetworkHealthReport {
  id: string;
  timestamp: number;
  endpoint: string;
  comparisonEndpoint?: string;
  fromBlock: number;
  toBlock: number;
  blocksInspected: number;
  chainId: number;
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  failedRequestRate: number;
  latestBlock: number;
  avgBlockIntervalSec: number;
  minBlockIntervalSec: number;
  maxBlockIntervalSec: number;
  avgTransactionsPerBlock: number;
  throughputTps: number;
  avgGasUtilization: number;
  totalTransactions: number;
  totalGasUsed: string;
  blockMetrics: BlockMetric[];
  syncComparison?: {
    primaryLatestBlock: number;
    comparisonLatestBlock: number;
    blockLag: number;
    primaryLatencyMs: number;
    comparisonLatencyMs: number;
    comparisonChainId: number;
    isSynced: boolean;
    chainMatch: boolean;
  };
  endpointConfigHash: `0x${string}`;
  reportHash: `0x${string}`;
}

