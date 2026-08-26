export type Archetype = 'SCAVENGER' | 'STRATEGIST' | 'BERSERKER' | 'DIPLOMAT' | 'HOARDER';
export type Sentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

export interface PersonalityTraits {
  riskTolerance: number;
  trustBaseline: number;
  aggression: number;
  patience: number;
}

export interface CharacterStatus {
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
  openTrades: TradeSummary[];
  blockedActionCount?: number;
}

export interface TradeSummary {
  trade_id: string;
  proposer_token_id: number;
  target_token_id: number;
  proposer_wallet: string;
  target_wallet: string;
  proposer_owner?: string;
  status: 'PROPOSED' | 'SETTLED' | 'CANCELLED';
  proposed_at: number;
  settled_at?: number | null;
  sentiment_proposer?: Sentiment | null;
  sentiment_target?: Sentiment | null;
}

export interface AgentThought {
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

export interface ChainEvent {
  eventType: string;
  tokenIds: number[];
  transactionHash?: string;
  blockNumber?: number;
  details: string;
  timestamp: number;
}

export interface SystemStats {
  totalCharacters: number;
  totalStaked: number;
  totalTrades: number;
  activeSessionKeys: number;
  simulatorRunning: boolean;
  network: string;
}

export interface DashboardSnapshot {
  characters: CharacterStatus[];
  activeTrades: TradeSummary[];
  recentThoughts: AgentThought[];
  recentChainEvents: ChainEvent[];
  policyBlocksSummary: Record<number, number>;
  systemStats: SystemStats;
}
