/**
 * Shared TypeScript definitions for Autonomous NFT Character Agents Backend
 */

export type Archetype = 'SCAVENGER' | 'STRATEGIST' | 'BERSERKER' | 'DIPLOMAT' | 'HOARDER';

export interface PersonalityTraits {
  riskTolerance: number; // 0-100
  trustBaseline: number; // 0-100
  aggression: number;    // 0-100
  patience: number;      // 0-100
}

export interface CharacterRecord {
  token_id: number;
  name: string;
  archetype: Archetype;
  risk_tolerance: number;
  trust_baseline: number;
  aggression: number;
  patience: number;
  owner_address: string;
  current_agent_wallet: string | null;
  is_staked: number; // 0 or 1
  staked_at: number | null;
  total_rewards_claimed: string; // BigInt serialized as string (in wei)
  metadata_uri?: string;
}

export interface SpendLimits {
  maxStakeCycles?: number;
  maxActiveTrades?: number;
  maxDailyTransactions?: number;
}

export interface PolicyDocument {
  version: string;
  allowedActions: ('stake' | 'unstake' | 'proposeTrade' | 'respondTrade')[];
  spendLimits: SpendLimits;
}

export interface SessionKeyRecord {
  id?: number;
  token_id: number;
  wallet_address: string;
  policy_hash: string;
  policy_document: string; // JSON serialized PolicyDocument
  registered_at: number;
  expires_at: number;
  is_active: number; // 0 or 1
  revoked_at?: number | null;
}

export type TradeStatus = 'PROPOSED' | 'SETTLED' | 'CANCELLED';
export type Sentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

export interface TradeRecord {
  trade_id: string;
  proposer_token_id: number;
  target_token_id: number;
  proposer_wallet: string;
  target_wallet: string;
  proposer_owner: string;
  status: TradeStatus;
  proposed_at: number;
  settled_at: number | null;
  sentiment_proposer: Sentiment | null;
  sentiment_target: Sentiment | null;
}

export type MemoryEventType =
  | 'STAKED'
  | 'UNSTAKED'
  | 'TRADE_PROPOSED'
  | 'TRADE_RECEIVED'
  | 'TRADE_ACCEPTED'
  | 'TRADE_REJECTED'
  | 'TRADE_SETTLED'
  | 'TRADE_CANCELLED'
  | 'POLICY_REJECTED'
  | 'SESSION_EXPIRED'
  | 'SESSION_REVOKED'
  | 'SIMULATOR_EVENT'
  | 'THOUGHT'
  | 'OBSERVE';

export interface AgentMemoryRecord {
  id?: number;
  token_id: number;
  event_type: MemoryEventType | string;
  description: string;
  related_trade_id?: string | null;
  decision_metadata?: string; // JSON serialized
  outcome?: string;
  sentiment: Sentiment;
  timestamp: number;
}

export interface PolicyBlockRecord {
  id?: number;
  token_id: number;
  action_type: string;
  reason: string;
  details?: string; // JSON serialized
  timestamp: number;
}

export interface PolicyValidationResult {
  allowed: boolean;
  reason?: 'ACTION_NOT_PERMITTED' | 'SPEND_LIMIT_EXCEEDED' | 'SESSION_EXPIRED' | 'CHARACTER_NOT_FOUND' | 'SESSION_NOT_FOUND';
  details?: Record<string, any>;
}

export interface ActionResponse {
  success: boolean;
  tokenId: number;
  action: string;
  transactionHash?: string;
  tradeId?: string;
  reason?: string;
  details?: Record<string, any>;
}

export interface AgentStatusResponse {
  tokenId: number;
  name: string;
  archetype: Archetype;
  traits: PersonalityTraits;
  ownerAddress: string;
  sessionKey: {
    walletAddress: string | null;
    expiresAt: number | null;
    isActive: boolean;
    policyHash: string | null;
  };
  staking: {
    isStaked: boolean;
    stakedAt: number | null;
    estimatedPendingRewardsWei: string;
    estimatedPendingRewardsFormatted: string;
    totalRewardsClaimedWei: string;
  };
  openTrades: TradeRecord[];
  blockedActionCount?: number;
}

// ──────────────── Phase 4: Simulator & Real-Time Types ────────────────

export type SimulatorEventType =
  | 'BATTLE_WON'
  | 'BATTLE_LOST'
  | 'RARE_ITEM_DISCOVERED'
  | 'ZONE_TRANSITION'
  | 'HOSTILE_ACTION_DETECTED'
  | 'REWARD_POOL_SPIKE';

export interface SimulatorEventPayload {
  eventId: string;
  eventType: SimulatorEventType;
  targetTokenId: number;
  timestamp: number;
  source: 'MANUAL_API' | 'AUTO_SCHEDULER';
  details: {
    title: string;
    description: string;
    zoneName?: string;
    opponentTokenId?: number;
    multiplier?: number;
    itemName?: string;
    nearbyTokenIds?: number[];
    [key: string]: any;
  };
}

export interface AgentThoughtPayload {
  tokenId: number;
  characterName: string;
  archetype: Archetype;
  observationSummary: string;
  reasoningSummary: string;
  actionTaken: string;
  transactionHash?: string;
  sentiment: Sentiment;
  isSimulated?: boolean;
  timestamp: number;
}

export interface ChainEventPayload {
  eventType: string;
  tokenIds: number[];
  transactionHash?: string;
  blockNumber?: number;
  details: string;
  timestamp: number;
}

export interface DashboardSnapshot {
  characters: AgentStatusResponse[];
  activeTrades: TradeRecord[];
  recentThoughts: AgentThoughtPayload[];
  recentChainEvents: ChainEventPayload[];
  policyBlocksSummary: Record<number, number>; // tokenId -> count
  systemStats: {
    totalCharacters: number;
    totalStaked: number;
    totalTrades: number;
    activeSessionKeys: number;
    simulatorRunning: boolean;
    network: string;
  };
}

export type WsMessageType =
  | 'CHARACTER_STATUS_UPDATE'
  | 'AGENT_THOUGHT'
  | 'CHAIN_EVENT'
  | 'TRADE_UPDATE'
  | 'SESSION_KEY_EVENT'
  | 'SIMULATOR_EVENT'
  | 'SNAPSHOT';

export interface WsMessage<T = any> {
  type: WsMessageType;
  data: T;
  timestamp: number;
}
