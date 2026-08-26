import { AgentRunner } from '../../src/orchestrator/agentRunner';
import { EventBridge } from '../../src/orchestrator/eventBridge';

describe('Multi-Agent Autonomous Trade Negotiation Integration', () => {
  it('executes full bilateral negotiation cycle from proposal to acceptance', async () => {
    let mockOpenTrades: any[] = [];

    const mockFetch = jest.fn().mockImplementation(async (url: string, init?: any) => {
      // Status endpoint
      if (url.includes('/status')) {
        const tokenId = parseInt(url.split('/agents/')[1].split('/status')[0], 10);
        return {
          ok: true,
          json: async () => ({
            tokenId,
            // Character is already staked, prompting proactive trade evaluation
            staking: { isStaked: true, estimatedPendingRewardsFormatted: '12.0' },
            openTrades: mockOpenTrades,
          }),
        };
      }

      // Memory endpoint
      if (url.includes('/memory')) {
        return { ok: true, json: async () => ({ memories: [] }) };
      }

      // Propose trade endpoint
      if (url.includes('/proposeTrade')) {
        const body = JSON.parse(init.body);
        const tradeId = `0xTrade_${0}_To_${body.targetTokenId}`;
        mockOpenTrades.push({
          trade_id: tradeId,
          proposer_token_id: 0,
          target_token_id: body.targetTokenId,
          status: 'PROPOSED',
          proposed_at: Math.floor(Date.now() / 1000),
        });
        return {
          ok: true,
          json: async () => ({
            success: true,
            tokenId: 0,
            action: 'proposeTrade',
            tradeId,
            transactionHash: '0xProposeTxHash',
          }),
        };
      }

      // Respond trade endpoint
      if (url.includes('/respondTrade')) {
        const body = JSON.parse(init.body);
        const trade = mockOpenTrades.find((t) => t.trade_id === body.tradeId);
        if (trade) {
          trade.status = body.response === 'accept' ? 'SETTLED' : 'CANCELLED';
        }
        return {
          ok: true,
          json: async () => ({
            success: true,
            tokenId: trade ? trade.target_token_id : 1,
            action: 'respondTrade',
            tradeId: body.tradeId,
            transactionHash: '0xAcceptTxHash',
          }),
        };
      }

      return { ok: true, json: async () => ({ success: true }) };
    });

    const runner = new AgentRunner({
      observeOptions: { customFetch: mockFetch as any },
      reasonOptions: { forceDeterministic: true },
      actOptions: { customFetch: mockFetch as any },
    });

    const bridge = new EventBridge(runner);

    // ── Step 1: Agent #0 (Kael - Berserker, staked) wakes and decides to propose trade ──
    const kaelState = await runner.runAgent(0, { eventType: 'HEARTBEAT' });
    expect(kaelState.reasoningOutput?.action).toBe('proposeTrade');
    expect(kaelState.actionResult?.success).toBe(true);
    expect(mockOpenTrades.length).toBe(1);

    const proposedTrade = mockOpenTrades[0];
    const targetTokenId = proposedTrade.target_token_id;

    // ── Step 2: Event Listener dispatches TradeProposed event to the designated target agent ──
    await bridge.onEventReceived({
      eventType: 'TradeProposed',
      affectedTokenIds: [targetTokenId],
      payload: { tradeId: proposedTrade.trade_id },
    });

    // ── Step 3: Verify target agent accepted and trade is settled ──
    const settledTrade = mockOpenTrades.find((t) => t.trade_id === proposedTrade.trade_id);
    expect(settledTrade?.status).toBe('SETTLED');
  });
});
