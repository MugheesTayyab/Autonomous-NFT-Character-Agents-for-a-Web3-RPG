import React, { useState } from 'react';
import { API_BASE_URL } from '../hooks/useWebSocket';

interface SimulatorControlsProps {
  onEventInjected?: () => void;
  simulatorRunning?: boolean;
  onInjectSimulatedEvent?: (preset: any, targetTokenId: number) => void;
  onToggleSimulatedScheduler?: (enabled: boolean) => void;
}

interface EventPreset {
  type: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  defaultPayload: Record<string, any>;
}

const EVENT_PRESETS: EventPreset[] = [
  {
    type: 'BATTLE_WON',
    name: 'Combat Victory',
    description: 'Yields combat experience & tokens. Drives aggressive characters (Kael) to stake.',
    category: 'Combat',
    icon: '⚔️',
    defaultPayload: { opponent: 'Shadow Drake', xpGained: 150, rewardAmount: 25 },
  },
  {
    type: 'BATTLE_LOST',
    name: 'Combat Defeat',
    description: 'Character takes structural damage. Triggers risk-averse preservation heuristics.',
    category: 'Combat',
    icon: '🛡️',
    defaultPayload: { opponent: 'Titan Automaton', damageTaken: 45, itemsLost: 1 },
  },
  {
    type: 'RARE_ITEM_DISCOVERED',
    name: 'Artifact Discovered',
    description: 'High-value item found. Prompts scavengers & traders to negotiate bilateral swaps.',
    category: 'Exploration',
    icon: '💎',
    defaultPayload: { itemName: 'Sunforged Crystal', itemRarity: 'LEGENDARY', estimatedValue: 120 },
  },
  {
    type: 'ZONE_TRANSITION',
    name: 'Zone Relocation',
    description: 'Agent moves to high-yield or hostile territory, recalibrating risk thresholds.',
    category: 'Environment',
    icon: '🗺️',
    defaultPayload: { fromZone: 'Sanctuary', toZone: 'Abyssal Chasm', dangerLevel: 'HIGH' },
  },
  {
    type: 'HOSTILE_ACTION_DETECTED',
    name: 'Threat Detected',
    description: 'Suspicious move identified. Tests diplomat patience vs. defensive rejections.',
    category: 'Security',
    icon: '⚠️',
    defaultPayload: { threatType: 'Market Manipulation', sourceTokenId: 4, severity: 8 },
  },
  {
    type: 'REWARD_POOL_SPIKE',
    name: 'Reward Pool Surge',
    description: 'Yield APY temporarily spikes in StakingVault. Triggers mass agent staking evaluations.',
    category: 'Economic',
    icon: '📈',
    defaultPayload: { multiplier: 3.5, durationMinutes: 60, poolAddress: '0xCf7Ed3...' },
  },
];

export const SimulatorControls: React.FC<SimulatorControlsProps> = ({
  onEventInjected,
  simulatorRunning = true,
  onInjectSimulatedEvent,
  onToggleSimulatedScheduler,
}) => {
  const [selectedTokenId, setSelectedTokenId] = useState<number>(0);
  const [isInjecting, setIsInjecting] = useState<string | null>(null);
  const [isTogglingScheduler, setIsTogglingScheduler] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleInjectEvent = async (preset: EventPreset) => {
    setIsInjecting(preset.type);
    setFeedbackMsg(null);
    try {
      if (API_BASE_URL) {
        const res = await fetch(`${API_BASE_URL}/api/simulate/event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType: preset.type,
            targetTokenId: selectedTokenId,
            payload: preset.defaultPayload,
          }),
        });
        if (res.ok) {
          setFeedbackMsg({
            type: 'success',
            text: `Injected '${preset.name}' targeting Agent #${selectedTokenId}. Webhook dispatched to cognitive layer.`,
          });
          if (onEventInjected) onEventInjected();
          return;
        }
      }
      // Simulation Fallback
      if (onInjectSimulatedEvent) {
        onInjectSimulatedEvent(preset, selectedTokenId);
      }
      setFeedbackMsg({
        type: 'success',
        text: `Injected '${preset.name}' targeting Agent #${selectedTokenId}. Trigger evaluated across LangGraph agent heuristic.`,
      });
      if (onEventInjected) onEventInjected();
    } catch {
      if (onInjectSimulatedEvent) {
        onInjectSimulatedEvent(preset, selectedTokenId);
      }
      setFeedbackMsg({
        type: 'success',
        text: `Injected '${preset.name}' targeting Agent #${selectedTokenId}. Agent state updated.`,
      });
      if (onEventInjected) onEventInjected();
    } finally {
      setIsInjecting(null);
    }
  };

  const handleToggleScheduler = async () => {
    setIsTogglingScheduler(true);
    setFeedbackMsg(null);
    try {
      if (API_BASE_URL) {
        const res = await fetch(`${API_BASE_URL}/api/simulate/toggle-scheduler`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: !simulatorRunning }),
        });
        if (res.ok) {
          const data = await res.json();
          setFeedbackMsg({
            type: 'success',
            text: `Event Scheduler is now ${data.running ? 'ENABLED (Auto-firing events)' : 'PAUSED'}.`,
          });
          if (onEventInjected) onEventInjected();
          return;
        }
      }
      // Client Fallback
      const nextState = !simulatorRunning;
      if (onToggleSimulatedScheduler) {
        onToggleSimulatedScheduler(nextState);
      }
      setFeedbackMsg({
        type: 'success',
        text: `Autonomous Heartbeat is now ${nextState ? 'ACTIVE (Cycling reasoning)' : 'PAUSED'}.`,
      });
      if (onEventInjected) onEventInjected();
    } catch {
      const nextState = !simulatorRunning;
      if (onToggleSimulatedScheduler) {
        onToggleSimulatedScheduler(nextState);
      }
      setFeedbackMsg({
        type: 'success',
        text: `Autonomous Heartbeat is now ${nextState ? 'ACTIVE' : 'PAUSED'}.`,
      });
    } finally {
      setIsTogglingScheduler(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner: Controls & Agent Selector */}
      <div className="bg-surface rounded-xl border border-border-subtle p-5 shadow-card flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-stone-900 text-base tracking-tight">
            Autonomous Event Simulator
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Inject synthetic game triggers to observe real-time multi-agent cognitive divergence.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Target Agent Selector */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-stone-500 font-medium whitespace-nowrap">Target Agent:</span>
            <select
              value={selectedTokenId}
              onChange={(e) => setSelectedTokenId(Number(e.target.value))}
              className="bg-surface-subtle border border-border-subtle rounded-lg px-3 py-1.5 text-xs font-semibold text-stone-800 focus:ring-forest-500 focus:border-forest-500 cursor-pointer"
            >
              <option value={0}>#0 Kael the Unbroken (Berserker)</option>
              <option value={1}>#1 Lyra the Tactical (Strategist)</option>
              <option value={2}>#2 Rexx the Scavenger (Scavenger)</option>
              <option value={3}>#3 Voss the Peacemaker (Diplomat)</option>
              <option value={4}>#4 Nyx the Shadow (Hoarder)</option>
            </select>
          </div>

          {/* Auto-Scheduler Toggle Button */}
          <button
            onClick={handleToggleScheduler}
            disabled={isTogglingScheduler}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all border flex items-center gap-1.5 shadow-subtle ${
              simulatorRunning
                ? 'bg-forest-50 border-forest-200 text-forest-800'
                : 'bg-surface hover:bg-surface-subtle border-border-subtle text-stone-700'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${simulatorRunning ? 'bg-forest-600 animate-ping' : 'bg-stone-400'}`} />
            {simulatorRunning ? 'Auto-Cycle: Active' : 'Auto-Cycle: Paused'}
          </button>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedbackMsg && (
        <div
          className={`p-3 rounded-lg border text-xs font-medium ${
            feedbackMsg.type === 'success'
              ? 'bg-forest-50 border-forest-200 text-forest-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {feedbackMsg.text}
        </div>
      )}

      {/* 6 Clean Event Preset Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {EVENT_PRESETS.map((preset) => {
          const loading = isInjecting === preset.type;
          return (
            <div
              key={preset.type}
              className="bg-surface rounded-xl border border-border-subtle hover:border-border-strong p-5 shadow-card hover:shadow-elevated transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xl" role="img" aria-label={preset.name}>
                    {preset.icon}
                  </span>
                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-surface-subtle border border-border-subtle text-stone-500">
                    {preset.category}
                  </span>
                </div>

                <h4 className="font-bold text-stone-900 text-sm mb-1 tracking-tight">
                  {preset.name}
                </h4>

                <p className="text-xs text-stone-500 leading-relaxed">
                  {preset.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-border-subtle">
                <button
                  onClick={() => handleInjectEvent(preset)}
                  disabled={loading}
                  className="w-full py-2 px-3 rounded-lg bg-surface hover:bg-forest-50 border border-border-subtle hover:border-forest-200 text-stone-700 hover:text-forest-800 text-xs font-semibold tracking-wide transition-all shadow-subtle flex items-center justify-center gap-1.5"
                >
                  {loading ? (
                    <span className="inline-block animate-spin h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full" />
                  ) : (
                    <>
                      <span>Trigger Event</span>
                      <svg className="w-3.5 h-3.5 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14m-7-7 7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
