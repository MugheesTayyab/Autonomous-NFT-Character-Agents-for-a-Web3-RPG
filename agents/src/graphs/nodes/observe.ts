import config from '../../config';
import { AgentState, ObservationData, MemoryEntry } from '../../types';

export interface ObserveNodeOptions {
  customFetch?: typeof fetch;
}

export function createObserveNode(options: ObserveNodeOptions = {}) {
  const fetchFn = options.customFetch || globalThis.fetch;

  return async function observeNode(state: AgentState): Promise<Partial<AgentState>> {
    const tokenId = state.tokenId;
    const backendUrl = config.backendApiUrl;

    try {
      // 1. Fetch character and staking status
      const statusRes = await fetchFn(`${backendUrl}/agents/${tokenId}/status`);
      if (!statusRes.ok) {
        throw new Error(`Failed to fetch status for token ${tokenId}: ${statusRes.statusText}`);
      }
      const statusData = (await statusRes.json()) as any;

      // 2. Fetch memory log history
      const memoryRes = await fetchFn(`${backendUrl}/agents/${tokenId}/memory?limit=10`);
      let memoryHistory: MemoryEntry[] = [];
      if (memoryRes.ok) {
        const memoryData = (await memoryRes.json()) as any;
        memoryHistory = memoryData.memories || [];
      }

      // 3. Classify open trades into incoming vs outgoing
      const allOpenTrades = statusData.openTrades || [];
      const incomingTrades = allOpenTrades.filter((t: any) => t.target_token_id === tokenId);
      const outgoingTrades = allOpenTrades.filter((t: any) => t.proposer_token_id === tokenId);

      const observations: ObservationData = {
        isStaked: statusData.staking?.isStaked || false,
        stakedAt: statusData.staking?.stakedAt || null,
        estimatedPendingRewardsWei: statusData.staking?.estimatedPendingRewardsWei || '0',
        estimatedPendingRewardsFormatted: statusData.staking?.estimatedPendingRewardsFormatted || '0.0',
        totalRewardsClaimedWei: statusData.staking?.totalRewardsClaimedWei || '0',
        openTrades: allOpenTrades,
        hasPendingIncomingTrades: incomingTrades.length > 0,
        incomingTrades,
        outgoingTrades,
        timestamp: Math.floor(Date.now() / 1000),
      };

      return {
        observations,
        memoryHistory,
      };
    } catch (err: any) {
      console.warn(`[ObserveNode] Warning: using fallback observation for Token #${tokenId}: ${err.message}`);
      return {
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
          timestamp: Math.floor(Date.now() / 1000),
        },
        memoryHistory: [],
      };
    }
  };
}
