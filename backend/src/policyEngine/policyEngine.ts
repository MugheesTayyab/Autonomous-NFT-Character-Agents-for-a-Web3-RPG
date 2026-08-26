import {
  CharacterRepository,
  SessionKeyRepository,
  TradeRepository,
  AgentMemoryRepository,
  PolicyBlockRepository,
} from '../db/repositories';
import {
  PolicyDocument,
  PolicyValidationResult,
  SessionKeyRecord,
} from '../types';

export class PolicyEngine {
  constructor(
    private charRepo: CharacterRepository,
    private sessionRepo: SessionKeyRepository,
    private tradeRepo: TradeRepository,
    private memoryRepo: AgentMemoryRepository,
    private policyBlockRepo?: PolicyBlockRepository
  ) {}

  /**
   * Evaluates an agent action against its active scoped session key policy.
   *
   * 3 Security Guarantees:
   * 1. Allowed Actions: The action type must be explicitly listed in the policy.
   * 2. Spend / Frequency Limits: Staking cycles, active trades must not exceed thresholds.
   * 3. Session Expiry: Session key must not be expired.
   */
  public evaluate(
    tokenId: number,
    action: 'stake' | 'unstake' | 'proposeTrade' | 'respondTrade',
    actionDetails?: Record<string, any>
  ): PolicyValidationResult {
    const char = this.charRepo.getCharacterByTokenId(tokenId);
    if (!char) {
      return {
        allowed: false,
        reason: 'CHARACTER_NOT_FOUND',
        details: { tokenId },
      };
    }

    const session = this.sessionRepo.getActiveSessionKey(tokenId);
    if (!session || session.is_active !== 1) {
      this.logRejection(tokenId, action, 'SESSION_NOT_FOUND', { tokenId, message: 'No active session key' });
      return {
        allowed: false,
        reason: 'SESSION_NOT_FOUND',
        details: { tokenId, message: 'No active session key registered for character' },
      };
    }

    // ── Check 1: Session Expiry ──
    const now = Math.floor(Date.now() / 1000);
    if (now >= session.expires_at) {
      this.logRejection(tokenId, action, 'SESSION_EXPIRED', {
        now,
        expiresAt: session.expires_at,
        expiredSecondsAgo: now - session.expires_at,
      });
      return {
        allowed: false,
        reason: 'SESSION_EXPIRED',
        details: { now, expiresAt: session.expires_at },
      };
    }

    // ── Parse Policy Document ──
    let policy: PolicyDocument;
    try {
      policy = JSON.parse(session.policy_document);
    } catch {
      policy = {
        version: '1.0',
        allowedActions: ['stake', 'unstake', 'proposeTrade', 'respondTrade'],
        spendLimits: {},
      };
    }

    // ── Check 2: Action Allowed ──
    if (!policy.allowedActions.includes(action)) {
      this.logRejection(tokenId, action, 'ACTION_NOT_PERMITTED', {
        action,
        allowedActions: policy.allowedActions,
      });
      return {
        allowed: false,
        reason: 'ACTION_NOT_PERMITTED',
        details: { action, allowedActions: policy.allowedActions },
      };
    }

    // ── Check 3: Spend / Resource Limits ──
    if (action === 'stake' && policy.spendLimits.maxStakeCycles !== undefined) {
      const stakeCount = this.memoryRepo.countMemoriesSince(tokenId, 'STAKED', session.registered_at);
      if (stakeCount >= policy.spendLimits.maxStakeCycles) {
        this.logRejection(tokenId, action, 'SPEND_LIMIT_EXCEEDED', {
          currentStakeCount: stakeCount,
          maxStakeCycles: policy.spendLimits.maxStakeCycles,
          violation: `Max stake limit reached (${stakeCount}/${policy.spendLimits.maxStakeCycles})`,
        });
        return {
          allowed: false,
          reason: 'SPEND_LIMIT_EXCEEDED',
          details: {
            currentStakeCount: stakeCount,
            maxStakeCycles: policy.spendLimits.maxStakeCycles,
          },
        };
      }
    }

    if (action === 'proposeTrade' && policy.spendLimits.maxActiveTrades !== undefined) {
      const activeTrades = this.tradeRepo.countActiveTradesByProposer(tokenId);
      if (activeTrades >= policy.spendLimits.maxActiveTrades) {
        this.logRejection(tokenId, action, 'SPEND_LIMIT_EXCEEDED', {
          currentActiveTrades: activeTrades,
          maxActiveTrades: policy.spendLimits.maxActiveTrades,
          violation: `Max active trades reached (${activeTrades}/${policy.spendLimits.maxActiveTrades})`,
        });
        return {
          allowed: false,
          reason: 'SPEND_LIMIT_EXCEEDED',
          details: {
            currentActiveTrades: activeTrades,
            maxActiveTrades: policy.spendLimits.maxActiveTrades,
          },
        };
      }
    }

    return { allowed: true };
  }

  private logRejection(
    tokenId: number,
    action: string,
    reason: string,
    details: Record<string, any>
  ): void {
    const timestamp = Math.floor(Date.now() / 1000);
    this.memoryRepo.insertMemory({
      token_id: tokenId,
      event_type: 'POLICY_REJECTED',
      description: `Policy engine blocked '${action}': ${reason}`,
      decision_metadata: JSON.stringify({ action, reason, details }),
      outcome: 'Action rejected by policy engine; zero on-chain gas spent',
      sentiment: 'NEUTRAL',
      timestamp,
    });

    if (this.policyBlockRepo) {
      this.policyBlockRepo.insertBlock({
        token_id: tokenId,
        action_type: action,
        reason,
        details: JSON.stringify(details),
        timestamp,
      });
    }
  }
}
