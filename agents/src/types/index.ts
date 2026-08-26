import { z } from 'zod';

export type Archetype = 'SCAVENGER' | 'STRATEGIST' | 'BERSERKER' | 'DIPLOMAT' | 'HOARDER';
export type Sentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
export type ActionType = 'stake' | 'unstake' | 'proposeTrade' | 'respondTrade' | 'noop';

export interface PersonalityTraits {
  riskTolerance: number; // 0-100
  trustBaseline: number; // 0-100
  aggression: number;    // 0-100
  patience: number;      // 0-100
}

export interface TradeSummary {
  trade_id: string;
  proposer_token_id: number;
  target_token_id: number;
  proposer_wallet: string;
  target_wallet: string;
  status: 'PROPOSED' | 'SETTLED' | 'CANCELLED';
  proposed_at: number;
}

export interface ObservationData {
  isStaked: boolean;
  stakedAt: number | null;
  estimatedPendingRewardsWei: string;
  estimatedPendingRewardsFormatted: string;
  totalRewardsClaimedWei: string;
  openTrades: TradeSummary[];
  hasPendingIncomingTrades: boolean;
  incomingTrades: TradeSummary[];
  outgoingTrades: TradeSummary[];
  timestamp: number;
}

export interface MemoryEntry {
  id?: number;
  token_id: number;
  event_type: string;
  description: string;
  related_trade_id?: string | null;
  decision_metadata?: string;
  outcome?: string;
  sentiment: Sentiment;
  timestamp: number;
}

// Zod Schema for Structured Decision Output from LLM
export const ReasoningOutputSchema = z.object({
  action: z.enum(['stake', 'unstake', 'proposeTrade', 'respondTrade', 'noop']),
  targetTokenId: z.number().int().nonnegative().optional(),
  tradeId: z.string().optional(),
  tradeResponse: z.enum(['accept', 'reject']).optional(),
  justification: z.string().min(5),
  intendedSentiment: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']),
  effectiveTrustScore: z.number().optional(),
});

export type ReasoningOutput = z.infer<typeof ReasoningOutputSchema>;

export interface ActionResult {
  success: boolean;
  action: string;
  transactionHash?: string;
  tradeId?: string;
  reason?: string;
  details?: Record<string, any>;
}

export interface AgentState {
  tokenId: number;
  name: string;
  archetype: Archetype;
  traits: PersonalityTraits;
  triggerEvent?: {
    eventType: string;
    payload?: Record<string, any>;
  };
  observations?: ObservationData;
  memoryHistory?: MemoryEntry[];
  reasoningOutput?: ReasoningOutput;
  actionResult?: ActionResult;
  error?: string;
}

export interface CharacterPersona {
  tokenId: number;
  name: string;
  archetype: Archetype;
  traits: PersonalityTraits;
  bio: string;
  coreDirectives: string[];
}
