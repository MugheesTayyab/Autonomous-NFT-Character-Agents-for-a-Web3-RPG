import { createActNode } from '../../src/graphs/nodes/act';
import { AgentState } from '../../src/types';

describe('ActNode Unit Tests', () => {
  it('calls Action API stake endpoint on stake action', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        tokenId: 0,
        action: 'stake',
        transactionHash: '0xStakeTx123',
      }),
    });

    const actNode = createActNode({ customFetch: mockFetch as any });

    const state: AgentState = {
      tokenId: 0,
      name: 'Kael',
      archetype: 'BERSERKER',
      traits: { riskTolerance: 95, trustBaseline: 15, aggression: 90, patience: 10 },
      reasoningOutput: {
        action: 'stake',
        justification: 'High risk tolerance',
        intendedSentiment: 'POSITIVE',
      },
    };

    const result = await actNode(state);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/agents/0/stake'),
      expect.objectContaining({ method: 'POST' })
    );
    expect(result.actionResult?.success).toBe(true);
    expect(result.actionResult?.transactionHash).toBe('0xStakeTx123');
  });

  it('handles Policy Engine 403 rejection gracefully without throwing', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        success: false,
        tokenId: 0,
        action: 'stake',
        reason: 'SPEND_LIMIT_EXCEEDED',
        details: { maxStakeCycles: 3 },
      }),
    });

    const actNode = createActNode({ customFetch: mockFetch as any });

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
    };

    const result = await actNode(state);
    expect(result.actionResult?.success).toBe(false);
    expect(result.actionResult?.reason).toBe('SPEND_LIMIT_EXCEEDED');
  });

  it('bypasses HTTP call when action is NOOP', async () => {
    const mockFetch = jest.fn();
    const actNode = createActNode({ customFetch: mockFetch as any });

    const state: AgentState = {
      tokenId: 4,
      name: 'Nyx',
      archetype: 'HOARDER',
      traits: { riskTolerance: 10, trustBaseline: 10, aggression: 15, patience: 95 },
      reasoningOutput: {
        action: 'noop',
        justification: 'Holding',
        intendedSentiment: 'NEUTRAL',
      },
    };

    const result = await actNode(state);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.actionResult?.action).toBe('noop');
  });
});
