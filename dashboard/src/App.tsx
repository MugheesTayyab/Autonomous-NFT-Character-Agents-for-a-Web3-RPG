import React, { useState } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { Header } from './components/Header';
import { CharacterCard } from './components/CharacterCard';
import { ThoughtStream } from './components/ThoughtStream';
import { TradeVisualizer } from './components/TradeVisualizer';
import { ActivityFeed } from './components/ActivityFeed';
import { SimulatorControls } from './components/SimulatorControls';
import { SessionKeyPanel } from './components/SessionKeyPanel';
import { ParticleBackground } from './components/ParticleBackground';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'mission' | 'thoughts' | 'simulator' | 'policy'>('mission');
  const {
    snapshot,
    isConnected,
    isReconnecting,
    isSimulated,
    refreshSnapshot,
    injectSimulatedEvent,
    toggleSimulatedStake,
    revokeSimulatedKey,
    toggleSimulatedScheduler,
  } = useWebSocket();

  const {
    characters = [],
    activeTrades = [],
    recentThoughts = [],
    recentChainEvents = [],
    systemStats = {
      totalCharacters: 5,
      totalStaked: 3,
      totalTrades: 1,
      activeSessionKeys: 5,
      simulatorRunning: true,
      network: 'Polygon Amoy',
    },
  } = snapshot;

  return (
    <div className="min-h-screen bg-[#fbfaf7] text-stone-900 flex flex-col relative selection:bg-forest-800/15 selection:text-forest-900 font-sans">
      {/* Minimal Ambient Canvas */}
      <ParticleBackground />

      {/* Header */}
      <Header
        stats={systemStats}
        isConnected={isConnected}
        isReconnecting={isReconnecting}
        isSimulated={isSimulated}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onRefresh={refreshSnapshot}
      />

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 z-10 space-y-6 sm:space-y-8">
        
        {/* TAB 1: MISSION CONTROL OVERVIEW */}
        {activeTab === 'mission' && (
          <div className="space-y-6 sm:space-y-8 animate-fade-in">
            {/* Section Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900">
                  Autonomous Character Agents
                </h2>
                <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
                  Autonomous decision engines driven by dynamic on-chain traits & session key delegation.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-600 font-semibold bg-surface px-3 py-1.5 rounded-lg border border-border-subtle shadow-subtle">
                  5 Roster Personas
                </span>
                <span className="text-xs text-forest-800 font-semibold bg-forest-50 border border-forest-200 px-3 py-1.5 rounded-lg shadow-subtle">
                  {systemStats.totalStaked} / 5 Staked in Vault
                </span>
              </div>
            </div>

            {/* 5 Character Hero Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {characters.map((char) => (
                <CharacterCard
                  key={char.tokenId}
                  character={char}
                  onRefresh={refreshSnapshot}
                  onToggleStakeFallback={toggleSimulatedStake}
                  onRevokeFallback={revokeSimulatedKey}
                />
              ))}
            </div>

            {/* Split Section: Live Cognitive Log & On-Chain Swaps / Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7">
                <ThoughtStream thoughts={recentThoughts} />
              </div>

              <div className="lg:col-span-5 space-y-6">
                <TradeVisualizer trades={activeTrades} />
                <ActivityFeed events={recentChainEvents} />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: COGNITIVE REASONING STREAM */}
        {activeTab === 'thoughts' && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900">
                Cognitive State Cycles
              </h2>
              <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
                Full telemetry of LangGraph Observe ➔ Reason ➔ Act ➔ Remember state machines with OpenRouter LLM justification.
              </p>
            </div>

            <ThoughtStream thoughts={recentThoughts} />
          </div>
        )}

        {/* TAB 3: EVENT SIMULATOR */}
        {activeTab === 'simulator' && (
          <div className="animate-fade-in">
            <SimulatorControls
              onEventInjected={refreshSnapshot}
              simulatorRunning={systemStats.simulatorRunning}
              onInjectSimulatedEvent={injectSimulatedEvent}
              onToggleSimulatedScheduler={toggleSimulatedScheduler}
            />
          </div>
        )}

        {/* TAB 4: SECURITY & SESSION GUARDRAILS */}
        {activeTab === 'policy' && (
          <div className="animate-fade-in">
            <SessionKeyPanel
              characters={characters}
              policyBlocksSummary={snapshot.policyBlocksSummary}
              onRefresh={refreshSnapshot}
              onRevokeFallback={revokeSimulatedKey}
            />
          </div>
        )}

      </main>

      {/* Minimal Editorial Footer */}
      <footer className="border-t border-border-subtle bg-surface py-6 px-4 sm:px-6 lg:px-8 mt-auto z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-stone-800">Autonomous NFT Agents</span>
            <span>•</span>
            <span>EVM ERC-721 Traits + ERC-20 Staking + LangGraph Agent Layer</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-stone-400">
            <span>Polygon Amoy (80002)</span>
            <span>•</span>
            <span>Hardhat Local (31337)</span>
          </div>
        </div>
      </footer>

    </div>
  );
};
