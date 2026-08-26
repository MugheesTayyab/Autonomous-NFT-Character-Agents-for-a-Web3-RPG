import { useState, useEffect, useRef, useCallback } from 'react';
import {
  DashboardSnapshot,
  TradeSummary,
  AgentThought,
  ChainEvent,
  CharacterStatus,
  Archetype,
  Sentiment,
} from '../types';

const isBrowser = typeof window !== 'undefined';
const isLocalhost = isBrowser && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === '0.0.0.0'
);

const envApiUrl = import.meta.env.VITE_API_URL;
const envWsUrl = import.meta.env.VITE_WS_URL;

export const API_BASE_URL = envApiUrl || (isLocalhost ? `http://${window.location.hostname}:3001` : '');
export const WS_URL = envWsUrl || (isLocalhost ? `ws://${window.location.hostname}:3001/ws/dashboard` : '');

const INITIAL_CHARACTERS: CharacterStatus[] = [
  {
    tokenId: 0,
    name: 'Kael the Unbroken',
    archetype: 'BERSERKER',
    traits: { riskTolerance: 95, trustBaseline: 15, aggression: 90, patience: 10 },
    ownerAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    sessionKey: { walletAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', expiresAt: Math.floor(Date.now() / 1000) + 86400, isActive: true, policyHash: '0x1a2b3c' },
    staking: { isStaked: true, stakedAt: Math.floor(Date.now() / 1000) - 3600, estimatedPendingRewardsWei: '14500000000000000000', estimatedPendingRewardsFormatted: '14.5000', totalRewardsClaimedWei: '50000000000000000000' },
    openTrades: [],
    blockedActionCount: 0,
  },
  {
    tokenId: 1,
    name: 'Lyra the Tactical',
    archetype: 'STRATEGIST',
    traits: { riskTolerance: 30, trustBaseline: 80, aggression: 20, patience: 85 },
    ownerAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    sessionKey: { walletAddress: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', expiresAt: Math.floor(Date.now() / 1000) + 86400, isActive: true, policyHash: '0x2b3c4d' },
    staking: { isStaked: true, stakedAt: Math.floor(Date.now() / 1000) - 7200, estimatedPendingRewardsWei: '28000000000000000000', estimatedPendingRewardsFormatted: '28.0000', totalRewardsClaimedWei: '120000000000000000000' },
    openTrades: [],
    blockedActionCount: 0,
  },
  {
    tokenId: 2,
    name: 'Rexx the Scavenger',
    archetype: 'SCAVENGER',
    traits: { riskTolerance: 70, trustBaseline: 25, aggression: 60, patience: 40 },
    ownerAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    sessionKey: { walletAddress: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc', expiresAt: Math.floor(Date.now() / 1000) + 86400, isActive: true, policyHash: '0x3c4d5e' },
    staking: { isStaked: false, stakedAt: null, estimatedPendingRewardsWei: '0', estimatedPendingRewardsFormatted: '0.0000', totalRewardsClaimedWei: '35000000000000000000' },
    openTrades: [],
    blockedActionCount: 0,
  },
  {
    tokenId: 3,
    name: 'Voss the Peacemaker',
    archetype: 'DIPLOMAT',
    traits: { riskTolerance: 20, trustBaseline: 95, aggression: 5, patience: 90 },
    ownerAddress: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    sessionKey: { walletAddress: '0x976EA74026E726554dB657fA54763abd0C3a0aa9', expiresAt: Math.floor(Date.now() / 1000) + 86400, isActive: true, policyHash: '0x4d5e6f' },
    staking: { isStaked: true, stakedAt: Math.floor(Date.now() / 1000) - 1800, estimatedPendingRewardsWei: '7250000000000000000', estimatedPendingRewardsFormatted: '7.2500', totalRewardsClaimedWei: '10000000000000000000' },
    openTrades: [],
    blockedActionCount: 0,
  },
  {
    tokenId: 4,
    name: 'Nyx the Shadow',
    archetype: 'HOARDER',
    traits: { riskTolerance: 10, trustBaseline: 10, aggression: 15, patience: 95 },
    ownerAddress: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
    sessionKey: { walletAddress: '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955', expiresAt: Math.floor(Date.now() / 1000) + 86400, isActive: true, policyHash: '0x5e6f7a' },
    staking: { isStaked: false, stakedAt: null, estimatedPendingRewardsWei: '0', estimatedPendingRewardsFormatted: '0.0000', totalRewardsClaimedWei: '90000000000000000000' },
    openTrades: [],
    blockedActionCount: 0,
  },
];

const INITIAL_THOUGHTS: AgentThought[] = [
  {
    tokenId: 0,
    characterName: 'Kael the Unbroken',
    archetype: 'BERSERKER',
    observationSummary: 'High combat volatility detected across Polygon Amoy nodes. Staking pool APY yielding 18.4%.',
    reasoningSummary: 'High Aggression (90/100) and Maximum Risk Tolerance (95/100) mandate maintaining active staking in StakingVault.sol for maximum REWA extraction.',
    actionTaken: 'stake',
    transactionHash: '0x7f83b1657ff1...4a2b',
    sentiment: 'POSITIVE',
    timestamp: Math.floor(Date.now() / 1000) - 15,
  },
  {
    tokenId: 1,
    characterName: 'Lyra the Tactical',
    archetype: 'STRATEGIST',
    observationSummary: 'Evaluating bilateral trade liquidity and inventory valuation of Counterparty #2 (Rexx).',
    reasoningSummary: 'High Patience (85/100) dictates holding current position while counterparty trust baseline stabilizes.',
    actionTaken: 'hold',
    sentiment: 'NEUTRAL',
    timestamp: Math.floor(Date.now() / 1000) - 45,
  },
  {
    tokenId: 2,
    characterName: 'Rexx the Scavenger',
    archetype: 'SCAVENGER',
    observationSummary: 'Discovered rare artifact in Zone: Abyssal Chasm. Valued at ~120 REWA.',
    reasoningSummary: 'Scavenger heuristic prompts bilateral trade proposal to Lyra (#1) to exchange surplus gear for staked yield derivatives.',
    actionTaken: 'proposetrade',
    transactionHash: '0x9a8b7c6d5e4f...1234',
    sentiment: 'POSITIVE',
    timestamp: Math.floor(Date.now() / 1000) - 95,
  },
  {
    tokenId: 3,
    characterName: 'Voss the Peacemaker',
    archetype: 'DIPLOMAT',
    observationSummary: 'No rogue contract anomalies detected. Session key guardrails active and verified.',
    reasoningSummary: 'Diplomatic baseline (95/100 Trust) maintains steady staking state while keeping trade channels open for collaborative contracts.',
    actionTaken: 'stake',
    transactionHash: '0x4c5d6e7f8a9b...5678',
    sentiment: 'POSITIVE',
    timestamp: Math.floor(Date.now() / 1000) - 150,
  },
  {
    tokenId: 4,
    characterName: 'Nyx the Shadow',
    archetype: 'HOARDER',
    observationSummary: 'Unstaked state maintained. Asset vault reserves secured at 90.00 REWA claimed.',
    reasoningSummary: 'Extreme Low Risk Tolerance (10/100) rejects speculative locking. Hoarding primary assets in cold storage until market volatility subsides.',
    actionTaken: 'hold',
    sentiment: 'NEUTRAL',
    timestamp: Math.floor(Date.now() / 1000) - 220,
  },
];

const INITIAL_EVENTS: ChainEvent[] = [
  {
    eventType: 'Staked',
    tokenIds: [0],
    details: 'Token #0 (Kael) staked into StakingVault.sol',
    blockNumber: 4920145,
    transactionHash: '0x7f83b1657ff1654a2b918274aef12034981729381749',
    timestamp: Math.floor(Date.now() / 1000) - 15,
  },
  {
    eventType: 'TradeProposed',
    tokenIds: [2, 1],
    details: 'Agent #2 (Rexx) proposed swap to Agent #1 (Lyra) via TradeEscrow.sol',
    blockNumber: 4920138,
    transactionHash: '0x9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b',
    timestamp: Math.floor(Date.now() / 1000) - 95,
  },
  {
    eventType: 'AgentRegistered',
    tokenIds: [0, 1, 2, 3, 4],
    details: '5 Session Keys delegated with Scoped Policy Hash on AgentRegistry.sol',
    blockNumber: 4919800,
    transactionHash: '0x3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a',
    timestamp: Math.floor(Date.now() / 1000) - 1200,
  },
];

const INITIAL_TRADES: TradeSummary[] = [
  {
    trade_id: 'trade_9a8b7c6d',
    proposer_token_id: 2,
    target_token_id: 1,
    proposer_wallet: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
    target_wallet: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    status: 'PROPOSED',
    proposed_at: Math.floor(Date.now() / 1000) - 95,
    sentiment_proposer: 'POSITIVE',
    sentiment_target: 'NEUTRAL',
  },
];

const INITIAL_SNAPSHOT: DashboardSnapshot = {
  characters: INITIAL_CHARACTERS,
  activeTrades: INITIAL_TRADES,
  recentThoughts: INITIAL_THOUGHTS,
  recentChainEvents: INITIAL_EVENTS,
  policyBlocksSummary: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
  systemStats: {
    totalCharacters: 5,
    totalStaked: 3,
    totalTrades: 1,
    activeSessionKeys: 5,
    simulatorRunning: true,
    network: 'Polygon Amoy',
  },
};

export type ConnectionMode = 'LIVE_NODE' | 'CONNECTING' | 'SIMULATED';

export function useWebSocket() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(INITIAL_SNAPSHOT);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('CONNECTING');
  const [lastMessageTime, setLastMessageTime] = useState<number>(Date.now());
  const [latestSimEvent, setLatestSimEvent] = useState<any | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const retryCountRef = useRef<number>(0);
  const simulationIntervalRef = useRef<any>(null);

  // Helper to append thought and chain event locally
  const addLocalThoughtAndEvent = useCallback((thought: AgentThought, event?: ChainEvent) => {
    setSnapshot((prev) => {
      const updatedThoughts = [thought, ...prev.recentThoughts.slice(0, 49)];
      const updatedEvents = event ? [event, ...prev.recentChainEvents.slice(0, 49)] : prev.recentChainEvents;
      return {
        ...prev,
        recentThoughts: updatedThoughts,
        recentChainEvents: updatedEvents,
      };
    });
  }, []);

  // Autonomous Background Simulation Engine
  const runAutonomousCycle = useCallback(() => {
    setSnapshot((prev) => {
      // Pick an agent to perform reasoning
      const randomChar = prev.characters[Math.floor(Math.random() * prev.characters.length)];
      if (!randomChar) return prev;

      const { tokenId, name, archetype, traits, staking } = randomChar;
      const isStaked = staking.isStaked;
      let action = 'hold';
      let sentiment: Sentiment = 'NEUTRAL';
      let reasoning = '';
      let observation = '';
      let txHash: string | undefined = undefined;

      // Trait-driven heuristics
      if (archetype === 'BERSERKER') {
        if (!isStaked && traits.riskTolerance > 80) {
          action = 'stake';
          sentiment = 'POSITIVE';
          reasoning = `High Aggression (${traits.aggression}/100) & Risk Tolerance (${traits.riskTolerance}/100) mandate auto-staking into StakingVault for maximum REWA yield accrual.`;
          observation = `Evaluated StakingVault.sol contract. APY is optimal for high-risk persona.`;
          txHash = `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`;
        } else {
          action = 'hold';
          sentiment = 'POSITIVE';
          reasoning = `Berserker is actively staked and capturing continuous on-chain reward stream.`;
          observation = `Reward accrual rate healthy. No threat signals detected.`;
        }
      } else if (archetype === 'STRATEGIST') {
        if (isStaked) {
          action = 'hold';
          sentiment = 'NEUTRAL';
          reasoning = `High Patience (${traits.patience}/100) recommends compound interest accumulation over short-term speculative swaps.`;
          observation = `Assessed system state: 3-tier guardrails intact. Network congestion normal.`;
        } else {
          action = 'stake';
          sentiment = 'POSITIVE';
          reasoning = `Tactical model calculates staking yield exceeds opportunity cost of idle capital.`;
          observation = `Calculated risk-adjusted yield index at 14.8%.`;
          txHash = `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`;
        }
      } else if (archetype === 'SCAVENGER') {
        if (Math.random() > 0.5) {
          action = 'proposetrade';
          sentiment = 'POSITIVE';
          reasoning = `Scavenger identified trade surplus. Initiated bilateral asset negotiation via TradeEscrow.sol with counterparty.`;
          observation = `Scanned roster inventories. Found complementary gear match with Agent #1.`;
          txHash = `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`;
        } else {
          action = 'hold';
          sentiment = 'NEUTRAL';
          reasoning = `Scavenger observing market pricing before liquidating collected items.`;
          observation = `Zone scavenging in progress.`;
        }
      } else if (archetype === 'DIPLOMAT') {
        action = 'hold';
        sentiment = 'POSITIVE';
        reasoning = `High Trust Baseline (${traits.trustBaseline}/100) maintains diplomatic equilibrium across peer agents.`;
        observation = `All session key authorizations healthy. No policy blocks reported.`;
      } else {
        // HOARDER
        action = 'hold';
        sentiment = 'NEUTRAL';
        reasoning = `Low Risk Tolerance (${traits.riskTolerance}/100) dictates preserving capital in secure cold balance rather than locking in contracts.`;
        observation = `Safe reserve threshold confirmed.`;
      }

      const newThought: AgentThought = {
        tokenId,
        characterName: name,
        archetype,
        observationSummary: observation,
        reasoningSummary: reasoning,
        actionTaken: action,
        transactionHash: txHash,
        sentiment,
        isSimulated: true,
        timestamp: Math.floor(Date.now() / 1000),
      };

      // Increment pending rewards for staked characters
      const updatedChars = prev.characters.map((c) => {
        if (c.tokenId === tokenId && action === 'stake' && !c.staking.isStaked) {
          return {
            ...c,
            staking: {
              ...c.staking,
              isStaked: true,
              stakedAt: Math.floor(Date.now() / 1000),
            },
          };
        }
        if (c.staking.isStaked) {
          const currentFormatted = parseFloat(c.staking.estimatedPendingRewardsFormatted || '0');
          const increment = (Math.random() * 0.25 + 0.1);
          const nextVal = (currentFormatted + increment).toFixed(4);
          return {
            ...c,
            staking: {
              ...c.staking,
              estimatedPendingRewardsFormatted: nextVal,
            },
          };
        }
        return c;
      });

      const updatedThoughts = [newThought, ...prev.recentThoughts.slice(0, 49)];
      let updatedEvents = prev.recentChainEvents;

      if (action === 'stake' && txHash) {
        const newEvent: ChainEvent = {
          eventType: 'Staked',
          tokenIds: [tokenId],
          details: `Token #${tokenId} (${name}) staked into StakingVault.sol`,
          blockNumber: (prev.recentChainEvents[0]?.blockNumber || 4920150) + 1,
          transactionHash: txHash,
          timestamp: Math.floor(Date.now() / 1000),
        };
        updatedEvents = [newEvent, ...prev.recentChainEvents.slice(0, 49)];
      }

      const totalStakedCount = updatedChars.filter((c) => c.staking.isStaked).length;

      return {
        ...prev,
        characters: updatedChars,
        recentThoughts: updatedThoughts,
        recentChainEvents: updatedEvents,
        systemStats: {
          ...prev.systemStats,
          totalStaked: totalStakedCount,
        },
      };
    });
  }, []);

  // Fetch REST snapshot from backend
  const fetchSnapshot = useCallback(async () => {
    if (!API_BASE_URL) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/dashboard/snapshot`);
      if (res.ok) {
        const data = await res.json();
        setSnapshot((prev) => ({
          ...prev,
          ...data,
          characters: data.characters && data.characters.length > 0 ? data.characters : prev.characters,
        }));
      }
    } catch {
      // Gracefully fallback to simulated data
    }
  }, []);

  // Connect to live WebSocket if available
  const connect = useCallback(() => {
    // If no WS_URL or if we are hosted on remote without backend URL, go straight to simulated mode
    if (!WS_URL) {
      setConnectionMode('SIMULATED');
      return;
    }

    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch {}
    }

    try {
      const ws = new WebSocket(WS_URL);
      socketRef.current = ws;

      ws.onopen = () => {
        setConnectionMode('LIVE_NODE');
        retryCountRef.current = 0;
      };

      ws.onmessage = (event) => {
        setLastMessageTime(Date.now());
        try {
          const msg = JSON.parse(event.data);
          const type = msg.type;
          const data = msg.data;

          switch (type) {
            case 'SNAPSHOT':
              if (data && data.characters) {
                setSnapshot((prev) => ({ ...prev, ...data }));
              }
              break;

            case 'CHARACTER_STATUS_UPDATE':
              if (data && typeof data.tokenId === 'number') {
                setSnapshot((prev) => ({
                  ...prev,
                  characters: prev.characters.map((c) => (c.tokenId === data.tokenId ? { ...c, ...data } : c)),
                  systemStats: {
                    ...prev.systemStats,
                    totalStaked: prev.characters.filter((c) => (c.tokenId === data.tokenId ? data.staking?.isStaked : c.staking.isStaked)).length,
                  },
                }));
              }
              break;

            case 'AGENT_THOUGHT':
              if (data) {
                setSnapshot((prev) => ({
                  ...prev,
                  recentThoughts: [data, ...prev.recentThoughts.slice(0, 49)],
                }));
              }
              break;

            case 'CHAIN_EVENT':
              if (data) {
                setSnapshot((prev) => ({
                  ...prev,
                  recentChainEvents: [data, ...prev.recentChainEvents.slice(0, 49)],
                }));
              }
              break;

            case 'TRADE_UPDATE':
              if (data) {
                setSnapshot((prev) => {
                  const existingIndex = prev.activeTrades.findIndex((t) => t.trade_id === data.trade_id);
                  let updatedTrades: TradeSummary[];
                  if (data.status === 'SETTLED' || data.status === 'CANCELLED') {
                    updatedTrades = prev.activeTrades.filter((t) => t.trade_id !== data.trade_id);
                  } else if (existingIndex >= 0) {
                    updatedTrades = prev.activeTrades.map((t, idx) => (idx === existingIndex ? data : t));
                  } else {
                    updatedTrades = [data, ...prev.activeTrades];
                  }
                  return {
                    ...prev,
                    activeTrades: updatedTrades,
                    systemStats: { ...prev.systemStats, totalTrades: prev.systemStats.totalTrades + 1 },
                  };
                });
              }
              break;

            case 'SESSION_KEY_EVENT':
              if (data) {
                setSnapshot((prev) => ({
                  ...prev,
                  characters: prev.characters.map((c) => {
                    if (c.tokenId === data.tokenId) {
                      return {
                        ...c,
                        sessionKey: {
                          ...c.sessionKey,
                          walletAddress: data.walletAddress,
                          expiresAt: data.expiresAt,
                          isActive: data.eventType === 'REGISTERED',
                        },
                      };
                    }
                    return c;
                  }),
                }));
              }
              break;

            case 'SIMULATOR_EVENT':
              if (data) {
                setLatestSimEvent(data);
              }
              break;
          }
        } catch (err) {
          console.warn('Error parsing WS message:', err);
        }
      };

      ws.onclose = () => {
        retryCountRef.current++;
        if (retryCountRef.current > 2) {
          // Switch cleanly to Simulated Demo mode after 2 quick failed attempts
          setConnectionMode('SIMULATED');
        } else {
          setConnectionMode('CONNECTING');
          const delay = Math.min(1000 * Math.pow(1.5, retryCountRef.current), 5000);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      ws.onerror = () => {
        if (retryCountRef.current >= 2) {
          setConnectionMode('SIMULATED');
        }
      };
    } catch {
      setConnectionMode('SIMULATED');
    }
  }, []);

  // Trigger simulated event client-side
  const injectSimulatedEvent = useCallback((preset: { type: string; name: string; description: string; defaultPayload: any }, targetTokenId: number) => {
    setSnapshot((prev) => {
      const char = prev.characters.find((c) => c.tokenId === targetTokenId) || prev.characters[0];
      const txHash = `0x${Math.random().toString(16).slice(2, 12)}...${Math.random().toString(16).slice(2, 6)}`;
      
      let actionTaken = 'hold';
      let sentiment: Sentiment = 'NEUTRAL';
      let reasoning = '';

      if (preset.type === 'BATTLE_WON') {
        sentiment = 'POSITIVE';
        actionTaken = 'stake';
        reasoning = `Combat Victory against ${preset.defaultPayload.opponent}! Gained ${preset.defaultPayload.xpGained} XP & ${preset.defaultPayload.rewardAmount} REWA. High aggression triggers immediate staking of battle spoils.`;
      } else if (preset.type === 'BATTLE_LOST') {
        sentiment = 'NEGATIVE';
        actionTaken = 'hold';
        reasoning = `Combat Defeat by ${preset.defaultPayload.opponent}. Took ${preset.defaultPayload.damageTaken} damage. Defensive preservation heuristic activated.`;
      } else if (preset.type === 'RARE_ITEM_DISCOVERED') {
        sentiment = 'POSITIVE';
        actionTaken = 'proposetrade';
        reasoning = `Discovered ${preset.defaultPayload.itemName} (${preset.defaultPayload.itemRarity}). Estimated Value: ${preset.defaultPayload.estimatedValue} REWA. Initiating peer exchange.`;
      } else if (preset.type === 'REWARD_POOL_SPIKE') {
        sentiment = 'POSITIVE';
        actionTaken = 'stake';
        reasoning = `Reward Pool surge detected (${preset.defaultPayload.multiplier}x APY). Agent evaluating vault contract for yield capture.`;
      } else {
        sentiment = 'NEUTRAL';
        actionTaken = 'hold';
        reasoning = `Observed environmental shift: ${preset.description}. Calibrating strategy weights.`;
      }

      const newThought: AgentThought = {
        tokenId: char.tokenId,
        characterName: char.name,
        archetype: char.archetype,
        observationSummary: `Event Trigger: ${preset.name} injected into LangGraph state graph.`,
        reasoningSummary: reasoning,
        actionTaken,
        transactionHash: txHash,
        sentiment,
        isSimulated: true,
        timestamp: Math.floor(Date.now() / 1000),
      };

      const newEvent: ChainEvent = {
        eventType: preset.type === 'BATTLE_WON' || preset.type === 'REWARD_POOL_SPIKE' ? 'Staked' : 'SimulatedTrigger',
        tokenIds: [char.tokenId],
        details: `Event '${preset.name}' processed for Agent #${char.tokenId} (${char.name})`,
        blockNumber: (prev.recentChainEvents[0]?.blockNumber || 4920150) + 1,
        transactionHash: txHash,
        timestamp: Math.floor(Date.now() / 1000),
      };

      const updatedChars = prev.characters.map((c) => {
        if (c.tokenId === char.tokenId && actionTaken === 'stake') {
          return {
            ...c,
            staking: {
              ...c.staking,
              isStaked: true,
              stakedAt: Math.floor(Date.now() / 1000),
            },
          };
        }
        return c;
      });

      return {
        ...prev,
        characters: updatedChars,
        recentThoughts: [newThought, ...prev.recentThoughts.slice(0, 49)],
        recentChainEvents: [newEvent, ...prev.recentChainEvents.slice(0, 49)],
        systemStats: {
          ...prev.systemStats,
          totalStaked: updatedChars.filter((c) => c.staking.isStaked).length,
        },
      };
    });
  }, []);

  // Client-side stake toggle fallback
  const toggleSimulatedStake = useCallback((tokenId: number) => {
    setSnapshot((prev) => {
      const char = prev.characters.find((c) => c.tokenId === tokenId);
      if (!char) return prev;
      const willBeStaked = !char.staking.isStaked;
      const txHash = `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`;

      const newThought: AgentThought = {
        tokenId,
        characterName: char.name,
        archetype: char.archetype,
        observationSummary: willBeStaked ? 'Manual / session-delegated staking executed.' : 'Manual / session-delegated unstaking executed.',
        reasoningSummary: willBeStaked
          ? `Token #${tokenId} deposited into StakingVault.sol contract for yield accrual.`
          : `Token #${tokenId} withdrawn from StakingVault.sol. Accumulated rewards settled.`,
        actionTaken: willBeStaked ? 'stake' : 'unstake',
        transactionHash: txHash,
        sentiment: willBeStaked ? 'POSITIVE' : 'NEUTRAL',
        isSimulated: true,
        timestamp: Math.floor(Date.now() / 1000),
      };

      const newEvent: ChainEvent = {
        eventType: willBeStaked ? 'Staked' : 'Unstaked',
        tokenIds: [tokenId],
        details: willBeStaked ? `Token #${tokenId} staked into StakingVault.sol` : `Token #${tokenId} unstaked from StakingVault.sol`,
        blockNumber: (prev.recentChainEvents[0]?.blockNumber || 4920150) + 1,
        transactionHash: txHash,
        timestamp: Math.floor(Date.now() / 1000),
      };

      const updatedChars = prev.characters.map((c) => {
        if (c.tokenId === tokenId) {
          return {
            ...c,
            staking: {
              ...c.staking,
              isStaked: willBeStaked,
              stakedAt: willBeStaked ? Math.floor(Date.now() / 1000) : null,
              estimatedPendingRewardsFormatted: willBeStaked ? '0.0000' : c.staking.estimatedPendingRewardsFormatted,
            },
          };
        }
        return c;
      });

      return {
        ...prev,
        characters: updatedChars,
        recentThoughts: [newThought, ...prev.recentThoughts.slice(0, 49)],
        recentChainEvents: [newEvent, ...prev.recentChainEvents.slice(0, 49)],
        systemStats: {
          ...prev.systemStats,
          totalStaked: updatedChars.filter((c) => c.staking.isStaked).length,
        },
      };
    });
  }, []);

  // Client-side revoke session key fallback
  const revokeSimulatedKey = useCallback((tokenId: number) => {
    setSnapshot((prev) => {
      const char = prev.characters.find((c) => c.tokenId === tokenId);
      if (!char) return prev;
      const txHash = `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`;

      const newEvent: ChainEvent = {
        eventType: 'AgentRevoked',
        tokenIds: [tokenId],
        details: `Master Kill Switch activated: Session Key for Token #${tokenId} revoked on AgentRegistry.sol`,
        blockNumber: (prev.recentChainEvents[0]?.blockNumber || 4920150) + 1,
        transactionHash: txHash,
        timestamp: Math.floor(Date.now() / 1000),
      };

      const newThought: AgentThought = {
        tokenId,
        characterName: char.name,
        archetype: char.archetype,
        observationSummary: 'Session key revoked by root owner authority on-chain.',
        reasoningSummary: 'Execution frozen. Agent will not sign further autonomous state transactions until re-authorized by owner.',
        actionTaken: 'hold',
        transactionHash: txHash,
        sentiment: 'NEGATIVE',
        isSimulated: true,
        timestamp: Math.floor(Date.now() / 1000),
      };

      const updatedChars = prev.characters.map((c) => {
        if (c.tokenId === tokenId) {
          return {
            ...c,
            sessionKey: {
              ...c.sessionKey,
              isActive: false,
              expiresAt: Math.floor(Date.now() / 1000),
            },
          };
        }
        return c;
      });

      return {
        ...prev,
        characters: updatedChars,
        recentThoughts: [newThought, ...prev.recentThoughts.slice(0, 49)],
        recentChainEvents: [newEvent, ...prev.recentChainEvents.slice(0, 49)],
        systemStats: {
          ...prev.systemStats,
          activeSessionKeys: updatedChars.filter((c) => c.sessionKey.isActive).length,
        },
      };
    });
  }, []);

  // Toggle scheduler
  const toggleSimulatedScheduler = useCallback((enabled: boolean) => {
    setSnapshot((prev) => ({
      ...prev,
      systemStats: {
        ...prev.systemStats,
        simulatorRunning: enabled,
      },
    }));
  }, []);

  useEffect(() => {
    fetchSnapshot();
    connect();

    // Heartbeat simulation loop (runs every 9 seconds when simulatorRunning is true)
    simulationIntervalRef.current = setInterval(() => {
      runAutonomousCycle();
    }, 9000);

    return () => {
      if (simulationIntervalRef.current) clearInterval(simulationIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch {}
      }
    };
  }, [fetchSnapshot, connect, runAutonomousCycle]);

  return {
    snapshot,
    connectionMode,
    isConnected: connectionMode === 'LIVE_NODE',
    isReconnecting: connectionMode === 'CONNECTING',
    isSimulated: connectionMode === 'SIMULATED',
    lastMessageTime,
    latestSimEvent,
    refreshSnapshot: fetchSnapshot,
    injectSimulatedEvent,
    toggleSimulatedStake,
    revokeSimulatedKey,
    toggleSimulatedScheduler,
  };
}
