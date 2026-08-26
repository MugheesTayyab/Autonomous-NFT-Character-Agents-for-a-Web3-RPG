import { AgentState, Sentiment } from '../../types';
import config from '../../config';

export function createRememberNode() {
  return async function rememberNode(state: AgentState): Promise<Partial<AgentState>> {
    const tokenId = state.tokenId;
    const name = state.name || `Token #${tokenId}`;
    const reasoning = state.reasoningOutput;
    const actionResult = state.actionResult || {
      success: true,
      action: reasoning?.action || 'noop',
    };

    let narrative = '';
    let sentiment: Sentiment = reasoning?.intendedSentiment || 'NEUTRAL';

    if (!reasoning || reasoning.action === 'noop') {
      narrative = `${name} observed environment and decided to hold position. Justification: ${reasoning?.justification || 'No action needed.'}`;
      sentiment = 'NEUTRAL';
    } else if (actionResult && !actionResult.success) {
      narrative = `${name} attempted '${reasoning.action}' but was blocked: ${actionResult.reason || 'Execution rejected'}.`;
      sentiment = 'NEUTRAL'; // Policy rejections are normal bounded behavior
    } else if (actionResult && actionResult.success) {
      if (reasoning.action === 'stake') {
        narrative = `${name} autonomously staked into StakingVault (Tx: ${actionResult.transactionHash || 'confirmed'}). ${reasoning.justification}`;
        sentiment = 'POSITIVE';
      } else if (reasoning.action === 'proposeTrade') {
        narrative = `${name} proposed trade targeting Token #${reasoning.targetTokenId} (Trade ID: ${actionResult.tradeId || 'created'}). ${reasoning.justification}`;
        sentiment = 'NEUTRAL';
      } else if (reasoning.action === 'respondTrade') {
        narrative = `${name} responded '${reasoning.tradeResponse}' to Trade ${reasoning.tradeId}. ${reasoning.justification}`;
        sentiment = reasoning.tradeResponse === 'accept' ? 'POSITIVE' : 'NEUTRAL';
      } else {
        narrative = `${name} executed '${reasoning.action}' successfully.`;
      }
    }

    console.log(`[CognitiveCycle:Memory] [Token #${tokenId} ${name}] Sentiment: ${sentiment}`);
    console.log(` > ${narrative}`);

    // Forward thought to Backend Action API & WebSocket stream
    if (process.env.NODE_ENV !== 'test') {
      try {
        const observationText = state.observations
          ? `Staked: ${state.observations.isStaked ? 'YES' : 'NO'}, Pending: ${state.observations.estimatedPendingRewardsFormatted || '0'} REWA`
          : 'Environment scanned';

        fetch(`${config.backendApiUrl}/api/agent/thought`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tokenId,
            characterName: name,
            archetype: state.archetype || 'STRATEGIST',
            observationSummary: state.triggerEvent?.payload?.details?.description || observationText,
            reasoningSummary: reasoning?.justification || narrative,
            actionTaken: reasoning?.action || 'noop',
            transactionHash: actionResult.transactionHash,
            sentiment,
            isSimulated: Boolean(
              state.triggerEvent?.payload?.source === 'MANUAL_API' ||
              state.triggerEvent?.payload?.source === 'AUTO_SCHEDULER'
            ),
          }),
        }).catch(() => {
          // Non-blocking in dev
        });
      } catch {
        // ignore fetch error in offline mode
      }
    }

    return {
      actionResult,
      memoryHistory: [
        {
          token_id: tokenId,
          event_type: reasoning?.action ? reasoning.action.toUpperCase() : 'NOOP',
          description: narrative,
          outcome: actionResult?.success ? 'SUCCESS' : 'REJECTED',
          sentiment,
          timestamp: Math.floor(Date.now() / 1000),
        },
        ...(state.memoryHistory || []),
      ],
    };
  };
}
