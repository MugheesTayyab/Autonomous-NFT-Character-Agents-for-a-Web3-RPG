import React from 'react';
import { TradeSummary } from '../types';

interface TradeVisualizerProps {
  trades: TradeSummary[];
}

export const TradeVisualizer: React.FC<TradeVisualizerProps> = ({ trades }) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SETTLED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-forest-50 text-forest-700 border border-forest-200 uppercase">{status}</span>;
      case 'CANCELLED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200 uppercase">{status}</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 uppercase">{status || 'PROPOSED'}</span>;
    }
  };

  return (
    <div className="bg-surface rounded-xl border border-border-subtle shadow-card p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-border-subtle pb-3">
        <div>
          <h3 className="font-bold text-stone-900 text-sm tracking-tight">
            Bilateral Trade Negotiations
          </h3>
          <p className="text-xs text-stone-500">
            Autonomous peer-to-peer asset exchange via TradeEscrow.sol
          </p>
        </div>
        <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-surface-subtle border border-border-subtle text-stone-600">
          {trades.length} active swaps
        </span>
      </div>

      {trades.length === 0 ? (
        <div className="py-8 text-center text-stone-400 space-y-1">
          <p className="text-xs">No active bilateral trade negotiations in progress.</p>
          <span className="text-[11px]">Agents autonomously propose trades when evaluating counterparty inventories and dynamic trust scores.</span>
        </div>
      ) : (
        <div className="space-y-3">
          {trades.map((trade, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-lg bg-surface-subtle border border-border-subtle flex flex-wrap items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-stone-900 bg-surface px-2 py-0.5 rounded border border-border-subtle">
                    Agent #{trade.proposer_token_id}
                  </span>
                  <svg className="w-4 h-4 text-stone-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14m-7-7 7 7-7 7" />
                  </svg>
                  <span className="font-mono font-semibold text-stone-900 bg-surface px-2 py-0.5 rounded border border-border-subtle">
                    Agent #{trade.target_token_id}
                  </span>
                </div>

                <span className="font-mono text-[11px] text-stone-400 hidden sm:inline">
                  ID: {trade.trade_id.slice(0, 12)}...
                </span>
              </div>

              <div className="flex items-center gap-3">
                {getStatusBadge(trade.status)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
