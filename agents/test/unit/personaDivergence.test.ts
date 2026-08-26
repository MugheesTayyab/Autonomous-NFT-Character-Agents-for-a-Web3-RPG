import { buildAgentGraph } from '../../src/graphs/agentGraph';
import { CHARACTER_PERSONAS } from '../../src/personas/archetypes';

describe('Persona Divergence Verification (Side-by-Side Tests)', () => {
  it('Divergence 1: Kael (Berserker) Stakes vs. Nyx (Hoarder) Holds on identical unstaked market', async () => {
    // Mock Action API returning identical unstaked status for both
    const mockFetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.includes('/status')) {
        return {
          ok: true,
          json: async () => ({
            staking: { isStaked: false, estimatedPendingRewardsFormatted: '0.0' },
            openTrades: [],
          }),
        };
      }
      if (url.includes('/memory')) {
        return { ok: true, json: async () => ({ memories: [] }) };
      }
      if (url.includes('/stake')) {
        return { ok: true, json: async () => ({ success: true, transactionHash: '0xStakeTx' }) };
      }
      return { ok: true, json: async () => ({}) };
    });

    const kaelGraph = buildAgentGraph({
      observeOptions: { customFetch: mockFetch as any },
      reasonOptions: { forceDeterministic: true },
      actOptions: { customFetch: mockFetch as any },
    });

    const nyxGraph = buildAgentGraph({
      observeOptions: { customFetch: mockFetch as any },
      reasonOptions: { forceDeterministic: true },
      actOptions: { customFetch: mockFetch as any },
    });

    const kaelState = await kaelGraph.invoke({
      tokenId: 0,
      name: CHARACTER_PERSONAS[0].name,
      archetype: CHARACTER_PERSONAS[0].archetype,
      traits: CHARACTER_PERSONAS[0].traits,
    });

    const nyxState = await nyxGraph.invoke({
      tokenId: 4,
      name: CHARACTER_PERSONAS[4].name,
      archetype: CHARACTER_PERSONAS[4].archetype,
      traits: CHARACTER_PERSONAS[4].traits,
    });

    // Verify contrasting decisions under identical conditions
    expect(kaelState.reasoningOutput?.action).toBe('stake');
    expect(kaelState.actionResult?.success).toBe(true);

    expect(nyxState.reasoningOutput?.action).toBe('noop');
    expect(nyxState.actionResult?.action).toBe('noop');
  });

  it('Divergence 2: Kael (Low Trust) Rejects vs. Voss (Diplomat) Accepts on incoming trade offer', async () => {
    const mockFetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.includes('/status')) {
        const tokenId = parseInt(url.split('/agents/')[1].split('/status')[0], 10);
        return {
          ok: true,
          json: async () => ({
            staking: { isStaked: false, estimatedPendingRewardsFormatted: '0.0' },
            openTrades: [
              {
                trade_id: `0xTradeFor_${tokenId}`,
                proposer_token_id: 2, // Rexx offering trade
                target_token_id: tokenId, // Targeted at current agent
                status: 'PROPOSED',
                proposed_at: 1700000000,
              },
            ],
          }),
        };
      }
      if (url.includes('/memory')) {
        return { ok: true, json: async () => ({ memories: [] }) };
      }
      if (url.includes('/respondTrade')) {
        return { ok: true, json: async () => ({ success: true, tradeId: '0xTradeFor_3' }) };
      }
      return { ok: true, json: async () => ({}) };
    });

    const kaelGraph = buildAgentGraph({
      observeOptions: { customFetch: mockFetch as any },
      reasonOptions: { forceDeterministic: true },
      actOptions: { customFetch: mockFetch as any },
    });

    const vossGraph = buildAgentGraph({
      observeOptions: { customFetch: mockFetch as any },
      reasonOptions: { forceDeterministic: true },
      actOptions: { customFetch: mockFetch as any },
    });

    const kaelState = await kaelGraph.invoke({
      tokenId: 0,
      name: CHARACTER_PERSONAS[0].name,
      archetype: CHARACTER_PERSONAS[0].archetype,
      traits: CHARACTER_PERSONAS[0].traits,
    });

    const vossState = await vossGraph.invoke({
      tokenId: 3,
      name: CHARACTER_PERSONAS[3].name,
      archetype: CHARACTER_PERSONAS[3].archetype,
      traits: CHARACTER_PERSONAS[3].traits,
    });

    // Kael (Trust 15) rejects incoming offer from stranger
    expect(kaelState.reasoningOutput?.action).toBe('respondTrade');
    expect(kaelState.reasoningOutput?.tradeResponse).toBe('reject');

    // Voss (Trust 95) accepts incoming offer to build diplomatic alliance
    expect(vossState.reasoningOutput?.action).toBe('respondTrade');
    expect(vossState.reasoningOutput?.tradeResponse).toBe('accept');
  });
});
