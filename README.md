# BOT Network Health

A network health inspection, telemetry dashboard, and on-chain ledger commitment system built specifically for **Botchain Testnet**.

- **Network Name**: Botchain Testnet
- **Chain ID**: `968`
- **RPC URL**: `https://rpc.bohr.life`
- **Native Currency**: `BOT`
- **Block Explorer**: [https://scan.bohr.life/](https://scan.bohr.life/)

---

## Features

### 1. Network Dashboard (Real-Time Telemetry)
- **RPC Endpoint Status**: Online / Offline indicator with live ping.
- **RPC Response Latency**: Real-time round-trip latency in milliseconds with latency history.
- **Latest Observed Block**: Continuously synced latest block height.
- **Block Production Intervals**: Time elapsed between consecutive blocks.
- **Transaction Throughput**: Current observed throughput (TPS) and transactions per block.
- **Gas Utilization**: Real-time percentage of block gas limit consumed.
- **Failed RPC Request Rate**: Real-time error rate tracking across JSON-RPC calls.

### 2. Inspection Form
- Primary RPC endpoint configuration (defaults to `https://rpc.bohr.life`).
- Optional comparison endpoint input (for checking synchronization and node lag against secondary peers).
- Block range selection:
  - Quick sample mode (Latest 5, 10, 15, 25, 50 blocks).
  - Explicit custom block range (`fromBlock` to `toBlock`).
- **Run Network Inspection** action.

### 3. Inspection Report
- **Endpoint Response Time**: Min, max, and average response times.
- **Chain ID**: Verifies returned Chain ID matches Botchain Testnet (`968`).
- **Latest Block & Block Range**: Comprehensive block metrics table with gas usage and intervals.
- **Block Synchronization Comparison**: If a comparison endpoint is provided, compares:
  - Block lag (primary vs. comparison).
  - Latency difference (ms).
  - Chain ID consistency.
  - Synchronization status.
- **RPC Error Rate**: Percentage of failed RPC requests.
- **Network Performance Measurements**: Average block time, TPS, and gas utilization.

### 4. Smart Contract (`BOTNetworkHealth.sol`)
Located at `contracts/BOTNetworkHealth.sol`:
- `requestNetworkInspection(bytes32 endpointConfigurationHash, uint256 fromBlock, uint256 toBlock)`: Logs inspection request on-chain.
- `publishResult(bytes32 requestId, bytes32 reportHash)`: Commits cryptographic hash of the off-chain inspection report.
- `getRequest(bytes32 requestId)`: Retrieves stored inspection records directly from the contract.

---

## Security & Environment Configuration

Your `.env` file is located at the project root:

```bash
# Botchain Testnet Deployment and Wallet Configuration
REOWN_ID=your_reown_cloud_project_id_here
PRIVATE_KEY=your_private_key_here

# Network settings
BOTCHAIN_RPC_URL=https://rpc.bohr.life
BOTCHAIN_CHAIN_ID=968
BOTCHAIN_EXPLORER_URL=https://scan.bohr.life/

# Deployed Contract Address (auto-populated by deploy script)
BOTCHAIN_CONTRACT_ADDRESS=
```

> **Security Note**: `REOWN_ID` is handled strictly on the server side via the Next.js API route (`/api/config`) and is **never** prefixed with `NEXT_PUBLIC_` or `VITE_`, preventing it from leaking into public client bundles.

---

## Quickstart

### 1. Compile the Smart Contract
```bash
npm run compile
```

### 2. Deploy to Botchain Testnet
Add your deployer private key to `.env` (`PRIVATE_KEY=0x...` with testnet BOT for gas), then run:
```bash
npm run deploy
```
The script will deploy `BOTNetworkHealth.sol`, print the transaction and contract explorer links, and automatically save the address into `.env` and `lib/deployedAddress.json`.

### 3. Start the Web Application
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

