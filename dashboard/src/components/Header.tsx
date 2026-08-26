import React from 'react';
import { SystemStats } from '../types';

interface HeaderProps {
  stats: SystemStats;
  isConnected: boolean;
  isReconnecting: boolean;
  isSimulated?: boolean;
  activeTab: 'mission' | 'thoughts' | 'simulator' | 'policy';
  setActiveTab: (tab: 'mission' | 'thoughts' | 'simulator' | 'policy') => void;
  onRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  stats,
  isConnected,
  isReconnecting,
  isSimulated = false,
  activeTab,
  setActiveTab,
  onRefresh,
}) => {
  return (
    <header className="relative z-30 border-b border-border-subtle bg-surface/95 backdrop-blur-md sticky top-0 transition-colors shadow-subtle">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap lg:flex-nowrap items-center justify-between min-h-[4rem] py-2 lg:py-0 gap-3">
          
          {/* Brand & Network Indicator */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-forest-800 flex items-center justify-center text-forest-50 shadow-subtle shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="4" />
                <path d="M9 9h6v6H9z" />
                <path d="M9 3v3m6-3v3M9 18v3m6-3v3M3 9h3m-3 6h3m12-6h3m-3 6h3" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm sm:text-base tracking-tight text-stone-900 whitespace-nowrap">
                  Autonomous Agents
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sand-200 text-stone-700 whitespace-nowrap border border-sand-300">
                  {stats.network || 'Polygon Amoy'}
                </span>
              </div>
              <p className="text-[11px] text-stone-500 hidden sm:block whitespace-nowrap">
                On-Chain Dynamic Traits & Session Key Delegations
              </p>
            </div>
          </div>

          {/* Center: Live Telemetry Badges (Shown on XL screens to keep layout spacious) */}
          <div className="hidden xl:flex items-center gap-2 text-xs font-medium shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-subtle border border-border-subtle text-stone-700 whitespace-nowrap">
              <span className="text-stone-400">Agents:</span>
              <span className="font-semibold text-stone-900 font-mono">{stats.totalCharacters}</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-subtle border border-border-subtle text-stone-700 whitespace-nowrap">
              <span className="text-stone-400">Vault Staked:</span>
              <span className="font-semibold text-forest-700 font-mono">
                {stats.totalStaked} <span className="text-stone-400 font-normal">/ {stats.totalCharacters}</span>
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-subtle border border-border-subtle text-stone-700 whitespace-nowrap">
              <span className="text-stone-400">Guardrails:</span>
              <span className="font-semibold text-forest-700">3-Tier Active</span>
            </div>
          </div>

          {/* Right Controls: Tab Switcher & Status */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
            {/* Segmented Tab Control */}
            <nav className="flex items-center p-1 bg-surface-subtle border border-border-subtle rounded-lg text-xs font-medium text-stone-600">
              <button
                onClick={() => setActiveTab('mission')}
                className={`px-3 py-1.5 rounded-md transition-all whitespace-nowrap ${
                  activeTab === 'mission'
                    ? 'bg-surface text-stone-900 shadow-subtle font-semibold'
                    : 'hover:text-stone-900 text-stone-500'
                }`}
              >
                Mission
              </button>
              <button
                onClick={() => setActiveTab('thoughts')}
                className={`px-3 py-1.5 rounded-md transition-all whitespace-nowrap ${
                  activeTab === 'thoughts'
                    ? 'bg-surface text-stone-900 shadow-subtle font-semibold'
                    : 'hover:text-stone-900 text-stone-500'
                }`}
              >
                Reasoning
              </button>
              <button
                onClick={() => setActiveTab('simulator')}
                className={`px-3 py-1.5 rounded-md transition-all whitespace-nowrap ${
                  activeTab === 'simulator'
                    ? 'bg-surface text-stone-900 shadow-subtle font-semibold'
                    : 'hover:text-stone-900 text-stone-500'
                }`}
              >
                Simulator
              </button>
              <button
                onClick={() => setActiveTab('policy')}
                className={`px-3 py-1.5 rounded-md transition-all whitespace-nowrap ${
                  activeTab === 'policy'
                    ? 'bg-surface text-stone-900 shadow-subtle font-semibold'
                    : 'hover:text-stone-900 text-stone-500'
                }`}
              >
                Security
              </button>
            </nav>

            {/* Connection Status Pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors bg-surface-subtle border-border-subtle shrink-0">
              {isConnected ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-forest-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-forest-600"></span>
                  </span>
                  <span className="text-forest-800 font-semibold text-[11px] whitespace-nowrap">Live Node</span>
                </>
              ) : isSimulated ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-forest-600"></span>
                  </span>
                  <span className="text-forest-800 font-semibold text-[11px] whitespace-nowrap">Autonomous Demo</span>
                </>
              ) : isReconnecting ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
                  <span className="text-amber-800 font-medium text-[11px] whitespace-nowrap">Connecting</span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-stone-400"></span>
                  <span className="text-stone-600 font-medium text-[11px] whitespace-nowrap">Synced</span>
                </>
              )}
            </div>

            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              title="Refresh Telemetry"
              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-surface-subtle border border-transparent hover:border-border-subtle transition-all shrink-0"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M3 21v-5h5" />
              </svg>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
