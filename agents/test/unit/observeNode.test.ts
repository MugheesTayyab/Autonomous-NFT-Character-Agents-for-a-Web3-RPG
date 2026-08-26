import { createObserveNode } from '../../src/graphs/nodes/observe';
import { AgentState } from '../../src/types';

describe('ObserveNode Unit Tests', () => {
  it('correctly fetches status and parses incoming vs. outgoing trades', async () => {
    const mockFetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.includes('/status')) {
        return {
          ok: true,
          json: async () => ({
            tokenId: 0,
            staking: {
              isStaked: true,
              stakedAt: 1700000000,
              estimatedPendingRewardsWei: '5000000000000000000',
              estimatedPendingRewardsFormatted: '5.0',
              totalRewardsClaimedWei: '10000000000000000000',
            },
            openTrades: [
              {
                trade_id: '0xTrade1',
                proposer_token_id: 1,
                target_token_id: 0,
                status: 'PROPOSED',
              },
              {
                trade_id: '0xTrade2',
                proposer_token_id: 0,
                target_token_id: 2,
                status: 'PROPOSED',
              },
            ],
          }),
        };
      }
      if (url.includes('/memory')) {
        return {
          ok: true,
          json: async () => ({
            memories: [
              {
                token_id: 0,
                event_type: 'STAKED',
                description: 'Past stake event',
                sentiment: 'POSITIVE',
                timestamp: 1700000000,
              },
            ],
          }),
        };
      }
      return { ok: false, statusText: 'Not Found' };
    });

    const observeNode = createObserveNode({ customFetch: mockFetch as any });

    const state: AgentState = {
      tokenId: 0,
      name: 'Kael',
      archetype: 'BERSERKER',
      traits: { riskTolerance: 95, trustBaseline: 15, aggression: 90, patience: 10 },
    };

    const result = await observeNode(state);

    expect(result.observations).toBeDefined();
    expect(result.observations?.isStaked).toBe(true);
    expect(result.observations?.hasPendingIncomingTrades).toBe(true);
    expect(result.observations?.incomingTrades.length).toBe(1);
    expect(result.observations?.incomingTrades[0].trade_id).toBe('0xTrade1');
    expect(result.observations?.outgoingTrades.length).toBe(1);
    expect(result.observations?.outgoingTrades[0].trade_id).toBe('0xTrade2');
    expect(result.memoryHistory?.length).toBe(1);
  });
});
