import React from 'react';
import { ChainEvent } from '../types';

interface ActivityFeedProps {
  events: ChainEvent[];
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ events }) => {
  const getEventBadge = (eventName: string) => {
    switch (eventName) {
      case 'Staked':
      case 'YieldClaimed':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-forest-50 text-forest-800 border border-forest-200 uppercase">{eventName}</span>;
      case 'Unstaked':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sand-200 text-stone-700 border border-sand-300 uppercase">{eventName}</span>;
      case 'TradeProposed':
      case 'TradeAccepted':
      case 'TradeSettled':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 uppercase">{eventName}</span>;
      case 'AgentRegistered':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-800 border border-sky-200 uppercase">DELEGATED</span>;
      case 'AgentRevoked':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-800 border border-red-200 uppercase">REVOKED</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-surface-subtle text-stone-600 border border-border-subtle uppercase">{eventName}</span>;
    }
  };

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts * 1000);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="bg-surface rounded-xl border border-border-subtle shadow-card p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-border-subtle pb-3">
        <div>
          <h3 className="font-bold text-stone-900 text-sm tracking-tight">
            On-Chain Ledger Activity
          </h3>
          <p className="text-xs text-stone-500">
            Real-time verified EVM contract logs on Polygon Amoy
          </p>
        </div>
        <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-surface-subtle border border-border-subtle text-stone-600">
          {events.length} transactions
        </span>
      </div>

      {events.length === 0 ? (
        <div className="py-6 text-center text-stone-400 text-xs">
          Listening for live on-chain smart contract events...
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[380px] overflow-y-auto">
          {events.map((ev, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg bg-surface-subtle border border-border-subtle flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2.5">
                {getEventBadge(ev.eventType)}
                <span className="text-stone-700 font-medium">
                  {ev.details || 'Smart Contract Event'}
                </span>
                {ev.tokenIds && ev.tokenIds.length > 0 && (
                  <span className="font-mono text-stone-400 text-[11px]">
                    Token #{ev.tokenIds.join(', #')}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 font-mono text-[11px]">
                {ev.blockNumber && (
                  <span className="text-stone-400">
                    Block #{ev.blockNumber}
                  </span>
                )}
                <span className="text-stone-400">
                  {formatTimestamp(ev.timestamp)}
                </span>
                {ev.transactionHash && (
                  <a
                    href={`https://amoy.polygonscan.com/tx/${ev.transactionHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-forest-700 hover:text-forest-900 font-semibold underline underline-offset-2 ml-1"
                  >
                    Scan ↗
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
