import { createReasonNode } from '../../src/graphs/nodes/reason';
import { calculateEffectiveTrust } from '../../src/personas/prompts';
import { AgentState, MemoryEntry } from '../../src/types';

describe('ReasonNode Unit Tests', () => {
  const reasonNode = createReasonNode({ forceDeterministic: true });

  describe('Dynamic Trust Calculation', () => {
    it('increases trust baseline with positive trade outcomes', () => {
      const memories: MemoryEntry[] = [
        { token_id: 0, event_type: 'TRADE_SETTLED', description: 'Good trade', sentiment: 'POSITIVE', timestamp: 1 },
        { token_id: 0, event_type: 'TRADE_SETTLED', description: 'Good trade', sentiment: 'POSITIVE', timestamp: 2 },
      ];
      const trust = calculateEffectiveTrust(30, 1, memories);
      // 30 + (2 * 15) = 60
      expect(trust).toBe(60);
    });

    it('decreases trust baseline with negative trade outcomes', () => {
      const memories: MemoryEntry[] = [
        { token_id: 0, event_type: 'TRADE_CANCELLED', description: 'Bad trade', sentiment: 'NEGATIVE', timestamp: 1 },
      ];
      const trust = calculateEffectiveTrust(50, 1, memories);
      // 50 - (1 * 25) = 25
      expect(trust).toBe(25);
    });
  });

  describe('Autonomous Trait-Driven Decisions', () => {
    it('Kael (Berserker) stakes aggressively when unstaked', async () => {
      const state: AgentState = {
        tokenId: 0,
        name: 'Kael the Unbroken',
        archetype: 'BERSERKER',
        traits: { riskTolerance: 95, trustBaseline: 15, aggression: 90, patience: 10 },
        observations: {
          isStaked: false,
          stakedAt: null,
          estimatedPendingRewardsWei: '0',
          estimatedPendingRewardsFormatted: '0.0',
          totalRewardsClaimedWei: '0',
          openTrades: [],
          hasPendingIncomingTrades: false,
          incomingTrades: [],
          outgoingTrades: [],
          timestamp: 1700000000,
        },
      };

      const result = await reasonNode(state);
      expect(result.reasoningOutput).toBeDefined();
      expect(result.reasoningOutput?.action).toBe('stake');
      expect(result.reasoningOutput?.justification).toContain('Risk Tolerance');
    });

    it('Nyx (Hoarder) chooses NOOP and never initiates trade proposals', async () => {
      const state: AgentState = {
        tokenId: 4,
        name: 'Nyx the Shadow',
        archetype: 'HOARDER',
        traits: { riskTolerance: 10, trustBaseline: 10, aggression: 15, patience: 95 },
        observations: {
          isStaked: false,
          stakedAt: null,
          estimatedPendingRewardsWei: '0',
          estimatedPendingRewardsFormatted: '0.0',
          totalRewardsClaimedWei: '0',
          openTrades: [],
          hasPendingIncomingTrades: false,
          incomingTrades: [],
          outgoingTrades: [],
          timestamp: 1700000000,
        },
      };

      const result = await reasonNode(state);
      expect(result.reasoningOutput?.action).toBe('noop');
      expect(result.reasoningOutput?.justification).toContain('HOARDER');
    });

    it('Voss (Diplomat) accepts incoming trade offer due to high trust baseline', async () => {
      const state: AgentState = {
        tokenId: 3,
        name: 'Voss the Peacemaker',
        archetype: 'DIPLOMAT',
        traits: { riskTolerance: 20, trustBaseline: 95, aggression: 5, patience: 90 },
        observations: {
          isStaked: false,
          stakedAt: null,
          estimatedPendingRewardsWei: '0',
          estimatedPendingRewardsFormatted: '0.0',
          totalRewardsClaimedWei: '0',
          openTrades: [{ trade_id: '0xTradeVoss', proposer_token_id: 0, target_token_id: 3, proposer_wallet: '0xKael', target_wallet: '0xVoss', status: 'PROPOSED', proposed_at: 1700000000 }],
          hasPendingIncomingTrades: true,
          incomingTrades: [{ trade_id: '0xTradeVoss', proposer_token_id: 0, target_token_id: 3, proposer_wallet: '0xKael', target_wallet: '0xVoss', status: 'PROPOSED', proposed_at: 1700000000 }],
          outgoingTrades: [],
          timestamp: 1700000000,
        },
      };

      const result = await reasonNode(state);
      expect(result.reasoningOutput?.action).toBe('respondTrade');
      expect(result.reasoningOutput?.tradeResponse).toBe('accept');
      expect(result.reasoningOutput?.tradeId).toBe('0xTradeVoss');
    });
  });
});
