import { createRememberNode } from '../../src/graphs/nodes/remember';
import { AgentState } from '../../src/types';

describe('RememberNode Unit Tests', () => {
  const rememberNode = createRememberNode();

  it('records narrative and POSITIVE sentiment on successful staking', async () => {
    const state: AgentState = {
      tokenId: 0,
      name: 'Kael',
      archetype: 'BERSERKER',
      traits: { riskTolerance: 95, trustBaseline: 15, aggression: 90, patience: 10 },
      reasoningOutput: {
        action: 'stake',
        justification: 'High risk tolerance allows aggressive yield capture.',
        intendedSentiment: 'POSITIVE',
      },
      actionResult: {
        success: true,
        action: 'stake',
        transactionHash: '0xStakeConfirmedHash',
      },
    };

    const result = await rememberNode(state);
    expect(result.memoryHistory).toBeDefined();
    expect(result.memoryHistory?.length).toBe(1);
    expect(result.memoryHistory?.[0].sentiment).toBe('POSITIVE');
    expect(result.memoryHistory?.[0].description).toContain('0xStakeConfirmedHash');
    expect(result.memoryHistory?.[0].outcome).toBe('SUCCESS');
  });

  it('records NEUTRAL sentiment when action is blocked by policy engine', async () => {
    const state: AgentState = {
      tokenId: 0,
      name: 'Kael',
      archetype: 'BERSERKER',
      traits: { riskTolerance: 95, trustBaseline: 15, aggression: 90, patience: 10 },
      reasoningOutput: {
        action: 'stake',
        justification: 'High risk',
        intendedSentiment: 'POSITIVE',
      },
      actionResult: {
        success: false,
        action: 'stake',
        reason: 'SPEND_LIMIT_EXCEEDED',
      },
    };

    const result = await rememberNode(state);
    expect(result.memoryHistory?.[0].sentiment).toBe('NEUTRAL');
    expect(result.memoryHistory?.[0].outcome).toBe('REJECTED');
    expect(result.memoryHistory?.[0].description).toContain('blocked');
  });
});
