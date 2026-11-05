require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createWalletClient, createPublicClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const compile = require('./compile');

const botchainTestnet = {
  id: 968,
  name: 'Botchain Testnet',
  nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.BOTCHAIN_RPC_URL || 'https://rpc.bohr.life'] },
  },
  blockExplorers: {
    default: { name: 'Botchain Explorer', url: process.env.BOTCHAIN_EXPLORER_URL || 'https://scan.bohr.life/' },
  },
};

async function main() {
  // Ensure artifact exists
  const artifactPath = path.resolve(__dirname, '../contracts/BOTNetworkHealth.json');
  if (!fs.existsSync(artifactPath)) {
    compile();
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

  let privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('Error: PRIVATE_KEY not found in .env.');
    console.error('Please open .env and add your deployer private key: PRIVATE_KEY=0x...');
    process.exit(1);
  }

  if (!privateKey.startsWith('0x')) {
    privateKey = `0x${privateKey}`;
  }

  const account = privateKeyToAccount(privateKey);
  console.log(`Deployer address: ${account.address}`);

  const rpcUrl = process.env.BOTCHAIN_RPC_URL || 'https://rpc.bohr.life';
  const publicClient = createPublicClient({
    chain: botchainTestnet,
    transport: http(rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: botchainTestnet,
    transport: http(rpcUrl),
  });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Deployer balance: ${Number(balance) / 1e18} BOT`);

  if (balance === 0n) {
    console.warn('Warning: Balance is 0 BOT. Make sure the deployer address has testnet BOT for gas.');
  }

  console.log('Deploying BOTNetworkHealth to Botchain Testnet (Chain ID 968)...');
  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
  });

  console.log(`Deployment transaction submitted. Hash: ${hash}`);
  console.log(`Track at: ${botchainTestnet.blockExplorers.default.url}/tx/${hash}`);

  console.log('Waiting for receipt...');
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  const deployedAddress = receipt.contractAddress;
  console.log(`\n========================================`);
  console.log(`Contract deployed successfully!`);
  console.log(`Address: ${deployedAddress}`);
  console.log(`Explorer: ${botchainTestnet.blockExplorers.default.url}/address/${deployedAddress}`);
  console.log(`========================================\n`);

  // Update .env file
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    if (envContent.includes('BOTCHAIN_CONTRACT_ADDRESS=')) {
      envContent = envContent.replace(
        /BOTCHAIN_CONTRACT_ADDRESS=.*/,
        `BOTCHAIN_CONTRACT_ADDRESS=${deployedAddress}`
      );
    } else {
      envContent += `\nBOTCHAIN_CONTRACT_ADDRESS=${deployedAddress}\n`;
    }
    fs.writeFileSync(envPath, envContent);
    console.log('Updated BOTCHAIN_CONTRACT_ADDRESS in .env');
  }

  // Update lib/deployedAddress.json
  const libDir = path.resolve(__dirname, '../lib');
  if (!fs.existsSync(libDir)) fs.mkdirSync(libDir, { recursive: true });
  fs.writeFileSync(
    path.join(libDir, 'deployedAddress.json'),
    JSON.stringify({
      contractAddress: deployedAddress,
      chainId: 968,
      network: 'Botchain Testnet',
      deployedAt: new Date().toISOString(),
      transactionHash: hash,
    }, null, 2)
  );
}

main().catch((err) => {
  console.error('Deployment failed:', err);
  process.exit(1);
});

