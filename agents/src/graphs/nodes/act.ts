import config from '../../config';
import { AgentState, ActionResult } from '../../types';

export interface ActNodeOptions {
  customFetch?: typeof fetch;
}

export function createActNode(options: ActNodeOptions = {}) {
  const fetchFn = options.customFetch || globalThis.fetch;

  return async function actNode(state: AgentState): Promise<Partial<AgentState>> {
    const tokenId = state.tokenId;
    const reasoning = state.reasoningOutput;
    const backendUrl = config.backendApiUrl;

    if (!reasoning || reasoning.action === 'noop') {
      return {
        actionResult: {
          success: true,
          action: 'noop',
        },
      };
    }

    try {
      let endpoint = '';
      let method = 'POST';
      let payload: Record<string, any> | undefined = undefined;

      switch (reasoning.action) {
        case 'stake':
          endpoint = `${backendUrl}/agents/${tokenId}/stake`;
          break;
        case 'unstake':
          endpoint = `${backendUrl}/agents/${tokenId}/unstake`;
          break;
        case 'proposeTrade':
          endpoint = `${backendUrl}/agents/${tokenId}/proposeTrade`;
          payload = { targetTokenId: reasoning.targetTokenId };
          break;
        case 'respondTrade':
          endpoint = `${backendUrl}/agents/${tokenId}/respondTrade`;
          payload = {
            tradeId: reasoning.tradeId,
            response: reasoning.tradeResponse,
          };
          break;
        default:
          return {
            actionResult: {
              success: true,
              action: reasoning.action,
            },
          };
      }

      const response = await fetchFn(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: payload ? JSON.stringify(payload) : undefined,
      });

      const data = (await response.json()) as any;

      if (!response.ok) {
        // Handle Policy Rejection (HTTP 403) or Not Found (404) gracefully
        return {
          actionResult: {
            success: false,
            action: reasoning.action,
            reason: data.reason || response.statusText,
            details: data.details,
          },
        };
      }

      return {
        actionResult: {
          success: true,
          action: reasoning.action,
          transactionHash: data.transactionHash,
          tradeId: data.tradeId,
        },
      };
    } catch (err: any) {
      return {
        actionResult: {
          success: false,
          action: reasoning.action,
          reason: err.message || 'ACTION_API_NETWORK_ERROR',
        },
      };
    }
  };
}
