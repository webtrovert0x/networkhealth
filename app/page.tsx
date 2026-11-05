'use client';

import React, { useState } from 'react';
import { Dashboard } from '@/components/Dashboard';
import { InspectionForm } from '@/components/InspectionForm';
import { InspectionReportView } from '@/components/InspectionReportView';
import { NetworkHealthReport } from '@/lib/types';

export default function HomePage() {
  const [report, setReport] = useState<NetworkHealthReport | null>(null);

  return (
    <div className="space-y-8">
      {/* 1. Network Dashboard */}
      <Dashboard rpcUrl="https://rpc.bohr.life" />

      {/* 2. Inspection Section Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Inspection Form */}
        <div className="lg:col-span-5">
          <InspectionForm onReportGenerated={(r) => setReport(r)} />
        </div>

        {/* Right Column: Inspection Report */}
        <div className="lg:col-span-7">
          {report ? (
            <InspectionReportView report={report} />
          ) : (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded border border-dashed border-gray-800 bg-[#0e1626]/50 p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-800 text-gray-400">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-gray-200">
                No Inspection Report Generated Yet
              </h3>
              <p className="mt-1 max-w-sm text-xs text-gray-400">
                Configure your RPC endpoint and block range in the form to the left, then click{' '}
                <strong className="text-blue-400">Run Network Inspection</strong> to measure latency, throughput, intervals, and generate on-chain report hashes.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

