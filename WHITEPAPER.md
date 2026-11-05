# BOT Network Health: An On-Chain Attestation & Distributed Telemetry Protocol for Botchain

**Protocol Specification & Architectural Whitepaper**  
**Version:** 1.0.0  
**Target Network:** Botchain Testnet (Chain ID: `968`, Native Token: `BOT`)  
**Core Contract:** `0xa29f5d84fd689d93793c6656c0c5af83ab7a489c`  
**Explorer:** [https://scan.bohr.life/](https://scan.bohr.life/)  

---

## Abstract

Decentralized applications (dApps), smart contract automated agents, and decentralized finance (DeFi) primitives rely fundamentally on the availability, consistency, and low latency of JSON-RPC gateway infrastructure. However, traditional blockchain monitoring frameworks suffer from two acute deficiencies: (1) isolated, subjective off-chain observations that lack cryptographic verifiability, and (2) inability to enforce Service Level Agreements (SLAs) or maintain an immutable audit trail directly on-chain.

**BOT Network Health** introduces a hybrid telemetry architecture specifically engineered for Botchain. By combining high-precision, batch-optimized off-chain network probes with an immutable EVM commitment ledger (`BOTNetworkHealth.sol`), the protocol provides verifiable, multi-point network observability, throughput calculation, gas utilization analysis, block synchronization comparison, and permanent cryptographic attestation.

---

## 1. Introduction & Motivation

As blockchain ecosystems scale, decentralized nodes and remote procedure call (RPC) providers experience variable performance characteristics, including peer desynchronization, packet dropped bursts, memory-pool congestion, and abnormal block production intervals. 

On **Botchain** (Bohr Network), where smart contracts govern rapid execution workflows, relying on unverified status pages or centralized synthetic monitors introduces systemic risk. An agent or user experiencing degraded performance cannot prove whether the failure stemmed from network-wide partition, RPC endpoint desynchronization, or client-side transport issues.

### Core Objectives
1. **Verifiable Telemetry**: Compute precise metrics across arbitrary block ranges (block production intervals, transaction throughput, gas utilization, request error rates).
2. **Dual-Node Synchronization Verification**: Concurrently benchmark primary RPC gateways against secondary or validator peers to expose node lag ($H_{primary} - H_{peer}$) and chain ID divergence.
3. **On-Chain Audit Commitment**: Anchor inspection parameters and canonical summary hashes onto Botchain via `BOTNetworkHealth.sol`, creating a tamper-resistant historical record of network health.
4. **Resilient Transport**: Utilize JSON-RPC batch pipelining and adaptive fallback mechanisms to avoid client-side choking during network congestion.

---

## 2. System Architecture

The BOT Network Health protocol operates across three distinct operational layers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        User & Inspection Client                        │
│   - Network Dashboard (Real-time Latency, TPS, Gas, Block Times)       │
│   - Inspection Form (Config, Comparison Endpoint, Custom Ranges)       │
│   - Cryptographic Commitment Interface (Reown AppKit / Wagmi)         │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │                                 │
     (1) JSON-RPC Queries              (2) Off-Chain Hashing &
    (Batch-Engineered Fetch)                 Commitment Submission
                   │                                 │
                   ▼                                 ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│        Botchain RPC Node(s)          │  │     BOTNetworkHealth.sol     │
│   - Primary: https://rpc.bohr.life   │  │  - requestNetworkInspection  │
│   - Comparison: Peer / Secondary     │  │  - publishResult             │
│   - Methods: eth_blockNumber,        │  │  - getRequest                │
│              eth_getBlockByNumber    │  │  - On-Chain Audit Trail      │
└──────────────────────────────────────┘  └──────────────────────────────┘
```

### 2.1. Layer 1: Off-Chain Telemetry & Sampling Engine
Smart contracts cannot initiate outbound HTTP/WebSocket network calls due to EVM determinism. Consequently, measurement is executed by an off-chain inspector (browser client or node relayer) utilizing:
- **Round-Trip Time (RTT) Benchmarking**: High-resolution timestamps (`performance.now()`) measuring end-to-end transport latency.
- **JSON-RPC Pipelined Batching**: Grouping block range queries (`eth_getBlockByNumber`) into contiguous array payloads, reducing TCP handshakes and bypassing RPC connection stalls.
- **Adaptive Execution Routing**: Attempting direct client-side execution to measure genuine user-to-node network conditions, with automated fallback to backend worker proxies if cross-origin or mixed-content policies interfere.

### 2.2. Layer 2: Cryptographic Commitment Engine
To guarantee auditability without burdening the blockchain state with megabytes of raw JSON logs, the protocol creates cryptographic digest commitments:
1. **Endpoint Configuration Hash ($H_{cfg}$)**:
   $$\mathcal{H}_{cfg} = \text{keccak256}\left(\text{rpcUrl} \parallel \text{comparisonRpcUrl} \parallel \text{fromBlock} \parallel \text{toBlock}\right)$$
2. **Canonical Report Hash ($H_{rpt}$)**:
   $$\mathcal{H}_{rpt} = \text{keccak256}\left(\text{JSON.canonical}(\mathcal{R})\right)$$
   Where $\mathcal{R}$ encompasses the deterministic tuple: `(endpoint, fromBlock, toBlock, chainId, latestBlock, avgLatency, avgBlockInterval, throughputTps, avgGasUtilization, failedRequestRate, totalTransactions)`.

### 2.3. Layer 3: On-Chain Commitment Ledger (`BOTNetworkHealth.sol`)
The contract acts as a decentralized registry maintaining:
- A non-fungible request registry indexed by a unique `bytes32 requestId`.
- Requester authentication and timestamp logging.
- Status progression: $\text{Created} \rightarrow \text{Committed}$.

---

## 3. Mathematical & Telemetry Formulations

### 3.1. Block Production Interval & Variance
For an inspected window of sequential blocks $\mathcal{B} = \{B_k, B_{k+1}, \dots, B_{k+N}\}$ where block $B_i$ has unix timestamp $t_i$:

$$\Delta t_i = t_i - t_{i-1}, \quad \forall i \in \{k+1, \dots, k+N\}$$

The mean block interval $\bar{\Delta t}$ and variance $\sigma_{\Delta t}^2$ are defined as:

$$\bar{\Delta t} = \frac{1}{N} \sum_{i=1}^N \Delta t_i$$

$$\sigma_{\Delta t}^2 = \frac{1}{N} \sum_{i=1}^N (\Delta t_i - \bar{\Delta t})^2$$

A surge in $\sigma_{\Delta t}^2$ indicates block production jitter, validator scheduling latency, or consensus delays.

### 3.2. Transaction Throughput (TPS)
Given the total transaction count $\sum_{i=1}^N |Tx(B_i)|$ over total elapsed wall-clock block time:

$$TPS = \begin{cases} 
\frac{\sum_{i=1}^N |Tx(B_i)|}{t_{k+N} - t_k}, & \text{if } (t_{k+N} - t_k) > 0 \\ 
\frac{\frac{1}{N} \sum_{i=1}^N |Tx(B_i)|}{\bar{\Delta t}}, & \text{otherwise} 
\end{cases}$$

### 3.3. Gas Utilization Efficiency
For each block $B_i$ with gas consumed $G_u(B_i)$ and block gas limit $G_l(B_i)$:

$$U_{gas}(B_i) = \frac{G_u(B_i)}{G_l(B_i)} \times 100\%$$

$$\bar{U}_{gas} = \frac{1}{N} \sum_{i=1}^N U_{gas}(B_i)$$

### 3.4. Node Synchronization Lag
When benchmarking against a comparison endpoint with latest observed block height $H_{peer}$ against primary height $H_{primary}$:

$$\Lambda_{lag} = H_{primary} - H_{peer}$$

$$\text{SyncStatus}(\Lambda_{lag}) = \begin{cases} 
\text{Synchronized}, & |\Lambda_{lag}| \le 2 \\ 
\text{Lagging}, & \Lambda_{lag} > 2 \\ 
\text{Leading / Partitioned}, & \Lambda_{lag} < -2 
\end{cases}$$

---

## 4. Smart Contract Specification

The smart contract `BOTNetworkHealth.sol` is written in Solidity `^0.8.20` and compiled with 200 optimizer runs.

```solidity
struct InspectionRequest {
    bytes32 requestId;
    address requester;
    bytes32 endpointConfigurationHash;
    uint256 fromBlock;
    uint256 toBlock;
    uint256 requestedAt;
    bytes32 reportHash;
    uint256 publishedAt;
    bool isCompleted;
    bool exists;
}
```

### Core Interface Methods
1. **`requestNetworkInspection`**:
   ```solidity
   function requestNetworkInspection(
       bytes32 endpointConfigurationHash,
       uint256 fromBlock,
       uint256 toBlock
   ) external returns (bytes32 requestId);
   ```
   Validates `toBlock >= fromBlock`, computes a pseudo-random unique `requestId` combining caller identity, entropy, and monotonically increasing nonces, and records the active request.

2. **`publishResult`**:
   ```solidity
   function publishResult(
       bytes32 requestId,
       bytes32 reportHash
   ) external;
   ```
   Validates that the request exists, has not yet been marked completed, and assigns the canonical `reportHash` alongside block timestamp.

3. **`getRequest`**:
   ```solidity
   function getRequest(bytes32 requestId)
       external
       view
       returns (
           bytes32 id,
           address requester,
           bytes32 endpointConfigurationHash,
           uint256 fromBlock,
           uint256 toBlock,
           uint256 requestedAt,
           bytes32 reportHash,
           uint256 publishedAt,
           bool isCompleted
       );
   ```
   Provides deterministic point-lookup for audit verification by off-chain explorers or dApp clients.

---

## 5. Security & Privacy Considerations

1. **Credential Isolation**: Client configuration uses `REOWN_ID` strictly encapsulated on the server environment. It is never exposed via static frontend bundle injection (e.g., preventing public token scraping).
2. **Deterministic Canonical Hashing**: Reports adhere to strict alphabetical JSON serialization before hashing to ensure reproducibility across different operating systems and browser architectures.
3. **Sybil & Gas DoS Resistance**: All write transactions on Botchain require native `BOT` gas tokens, ensuring that rogue actors cannot spam invalid request allocations on-chain without economic cost.
4. **Cryptographic Immutability**: Once `publishResult` commits a `reportHash`, the state transitions to `isCompleted = true`, preventing modification or rewriting of historical SLAs.

---

## 6. Live Testnet Reference & Deployment

| Attribute | Specification |
| :--- | :--- |
| **Network** | Botchain Testnet |
| **Chain ID** | `968` |
| **Native Token** | `BOT` (18 Decimals) |
| **RPC Gateway** | `https://rpc.bohr.life` |
| **Block Explorer** | `https://scan.bohr.life/` |
| **Contract Address** | `0xa29f5d84fd689d93793c6656c0c5af83ab7a489c` |
| **Deployment Tx** | `0x0c07cc168b61fb57e9f92e43cbf81246d0a30945fc60fbacaca4647eb58b0ab8` |

---

## 7. Roadmap & Future Enhancements

- **Decentralized Inspector Network (DIN)**: Transitioning from single-client inspection to multi-party consensus sampling using threshold BLS signatures.
- **Zero-Knowledge SLA Attestations**: Generating zk-SNARK proofs of latency distributions without disclosing sensitive internal infrastructure endpoints.
- **Automated Slashing & Reward Oracle**: Integration with Botchain validator pools to incentivize high-availability RPC provision.

---

*Copyright &copy; 2026 BOT Network Health Protocol Contributors.*
