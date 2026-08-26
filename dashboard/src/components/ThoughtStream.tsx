import React, { useState, useRef, useEffect } from 'react';
import { AgentThought } from '../types';

interface ThoughtStreamProps {
  thoughts: AgentThought[];
}

export const ThoughtStream: React.FC<ThoughtStreamProps> = ({ thoughts }) => {
  const [selectedAgent, setSelectedAgent] = useState<number | 'ALL'>('ALL');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const filteredThoughts = selectedAgent === 'ALL'
    ? thoughts
    : thoughts.filter((t) => t.tokenId === selectedAgent);

  // Auto-scroll ONLY within the container without scrolling the browser window
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [filteredThoughts, autoScroll]);

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts * 1000);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getSentimentDot = (sentiment?: string) => {
    switch (sentiment) {
      case 'POSITIVE':
        return (
          <span className="relative flex h-2.5 w-2.5 shrink-0" title="Positive Outcome">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-forest-400 opacity-60"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-forest-600"></span>
          </span>
        );
      case 'NEGATIVE':
        return <span className="w-2.5 h-2.5 rounded-full bg-[#9e3b25] shrink-0" title="Defensive / Cautious" />;
      default:
        return <span className="w-2.5 h-2.5 rounded-full bg-stone-400 shrink-0" title="Neutral Evaluation" />;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action?.toLowerCase()) {
      case 'stake':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-forest-50 text-forest-700 border border-forest-200 uppercase whitespace-nowrap">
            STAKE
          </span>
        );
      case 'unstake':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sand-200 text-stone-700 border border-sand-300 uppercase whitespace-nowrap">
            UNSTAKE
          </span>
        );
      case 'proposetrade':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 uppercase whitespace-nowrap">
            PROPOSE TRADE
          </span>
        );
      case 'respondtrade':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-800 border border-sky-200 uppercase whitespace-nowrap">
            RESPOND TRADE
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-surface-subtle text-stone-500 border border-border-subtle uppercase whitespace-nowrap">
            HOLD / NOOP
          </span>
        );
    }
  };

  return (
    <div className="bg-surface rounded-xl border border-border-subtle shadow-card flex flex-col h-[580px] overflow-hidden">
      
      {/* Header & Filter Controls */}
      <div className="p-4 border-b border-border-subtle bg-surface flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-forest-600"></div>
          <h3 className="font-bold text-stone-900 text-sm tracking-tight">
            Cognitive Reasoning Log
          </h3>
          <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-subtle border border-border-subtle text-stone-600">
            {filteredThoughts.length} cycles
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Agent Filter Pills */}
          <div className="flex items-center bg-surface-subtle p-1 rounded-lg border border-border-subtle">
            <button
              onClick={() => setSelectedAgent('ALL')}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                selectedAgent === 'ALL'
                  ? 'bg-surface text-stone-900 font-semibold shadow-subtle'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              All
            </button>
            {[0, 1, 2, 3, 4].map((id) => (
              <button
                key={id}
                onClick={() => setSelectedAgent(id)}
                className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                  selectedAgent === id
                    ? 'bg-surface text-stone-900 font-semibold shadow-subtle'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                #{id}
              </button>
            ))}
          </div>

          {/* Auto-scroll checkbox */}
          <label className="flex items-center gap-1.5 cursor-pointer text-stone-500 hover:text-stone-800 select-none ml-1">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded border-border-subtle text-forest-700 focus:ring-forest-500"
            />
            <span className="text-[11px] font-medium">Auto-scroll</span>
          </label>
        </div>
      </div>

      {/* Thought Stream Scrollable Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 font-sans overscroll-contain"
      >
        {filteredThoughts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-stone-400 space-y-2 py-12">
            <svg className="w-8 h-8 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p className="text-xs font-medium">No cognitive thoughts recorded yet.</p>
            <span className="text-[11px] text-stone-400">Trigger events in the simulator or await autonomous heartbeat cycles.</span>
          </div>
        ) : (
          filteredThoughts.map((thought, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-lg bg-surface-subtle border border-border-subtle/80 hover:border-border-strong transition-all space-y-2"
            >
              {/* Meta row */}
              <div className="flex flex-wrap items-center justify-between text-xs gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {getSentimentDot(thought.sentiment)}
                  <span className="font-bold text-stone-900">
                    {thought.characterName}
                  </span>
                  <span className="font-mono text-[11px] text-stone-400">
                    #{thought.tokenId}
                  </span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-sand-200 text-stone-700 uppercase">
                    {thought.archetype}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {thought.isSimulated && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-forest-50 text-forest-800 border border-forest-200">
                      SIMULATOR
                    </span>
                  )}
                  {getActionBadge(thought.actionTaken)}
                  <span className="font-mono text-[11px] text-stone-400">
                    {formatTimestamp(thought.timestamp)}
                  </span>
                </div>
              </div>

              {/* Justification quote */}
              <p className="text-xs text-stone-700 leading-relaxed pl-3 border-l-2 border-forest-600/70 font-sans break-words">
                {thought.reasoningSummary}
              </p>

              {/* Observation & details */}
              {(thought.observationSummary || thought.transactionHash) && (
                <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-stone-500 font-mono">
                  {thought.transactionHash && (
                    <span className="truncate max-w-[200px] text-stone-600">
                      Tx: <span className="font-semibold text-stone-800">{thought.transactionHash}</span>
                    </span>
                  )}
                  {thought.observationSummary && (
                    <span className="text-stone-500 font-sans text-xs break-words">
                      {thought.observationSummary}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

    </div>
  );
};
