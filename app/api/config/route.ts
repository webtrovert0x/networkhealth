import { NextResponse } from 'next/server';

export async function GET() {
  const reownId = process.env.REOWN_ID?.trim() || '';
  const contractAddress = process.env.BOTCHAIN_CONTRACT_ADDRESS?.trim() || '';
  const rpcUrl = process.env.BOTCHAIN_RPC_URL?.trim() || 'https://rpc.bohr.life';
  const chainId = Number(process.env.BOTCHAIN_CHAIN_ID || '968');
  const explorerUrl = process.env.BOTCHAIN_EXPLORER_URL?.trim() || 'https://scan.bohr.life';

  return NextResponse.json({
    reownId,
    contractAddress,
    rpcUrl,
    chainId,
    explorerUrl,
    hasReownConfigured: !!reownId,
    hasContractConfigured: !!contractAddress,
  });
}

