import { NextRequest, NextResponse } from 'next/server';
import { runNetworkInspection } from '@/lib/inspector';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rpcUrl, comparisonRpcUrl, fromBlock, toBlock, blockCount } = body;

    if (!rpcUrl) {
      return NextResponse.json({ error: 'Missing primary rpcUrl' }, { status: 400 });
    }

    const report = await runNetworkInspection({
      rpcUrl,
      comparisonRpcUrl: comparisonRpcUrl || undefined,
      fromBlock: fromBlock ? Number(fromBlock) : undefined,
      toBlock: toBlock ? Number(toBlock) : undefined,
      blockCount: blockCount ? Number(blockCount) : undefined,
    });

    return NextResponse.json(report);
  } catch (err: any) {
    console.error('Inspection API error:', err);
    return NextResponse.json({ error: err.message || 'Inspection failed' }, { status: 500 });
  }
}

