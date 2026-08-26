import {
  CharacterRepository,
  SessionKeyRepository,
  TradeRepository,
  AgentMemoryRepository,
} from '../db/repositories';
import { PolicyEngine } from '../policyEngine/policyEngine';
import { TransactionSigner } from '../blockchain/TransactionSigner';
import {
  ActionResponse,
  AgentStatusResponse,
  AgentMemoryRecord,
  PersonalityTraits,
  Archetype,
} from '../types';
import { formatEther } from 'ethers';

export class AgentService {
  // Staking reward emission rate constant: 10 MLRD per day in wei per second
  private static readonly REWARD_RATE_WEI_PER_SEC = 115740740740740n;

  constructor(
    private charRepo: CharacterRepository,
    private sessionRepo: SessionKeyRepository,
    private tradeRepo: TradeRepository,
    private memoryRepo: AgentMemoryRepository,
    private policyEngine: PolicyEngine,
    private txSigner: TransactionSigner
  ) {}

  public async stake(tokenId: number): Promise<ActionResponse> {
    // 1. Policy Engine Evaluation
    const validation = this.policyEngine.evaluate(tokenId, 'stake');
    if (!validation.allowed) {
      return {
        success: false,
        tokenId,
        action: 'stake',
        reason: validation.reason,
        details: validation.details,
      };
    }

    // 2. Execute Transaction via Session Key
    try {
      const { txHash } = await this.txSigner.executeStake(tokenId);
      return {
        success: true,
        tokenId,
        action: 'stake',
        transactionHash: txHash,
      };
    } catch (err: any) {
      return {
        success: false,
        tokenId,
        action: 'stake',
        reason: err.message || 'TRANSACTION_FAILED',
      };
    }
  }

  public async unstake(tokenId: number): Promise<ActionResponse> {
    const validation = this.policyEngine.evaluate(tokenId, 'unstake');
    if (!validation.allowed) {
      return {
        success: false,
        tokenId,
        action: 'unstake',
        reason: validation.reason,
        details: validation.details,
      };
    }

    try {
      const { txHash } = await this.txSigner.executeUnstake(tokenId);
      return {
        success: true,
        tokenId,
        action: 'unstake',
        transactionHash: txHash,
      };
    } catch (err: any) {
      return {
        success: false,
        tokenId,
        action: 'unstake',
        reason: err.message || 'TRANSACTION_FAILED',
      };
    }
  }

  public async proposeTrade(
    offeredTokenId: number,
    requestedTokenId: number
  ): Promise<ActionResponse> {
    if (offeredTokenId === requestedTokenId) {
      return {
        success: false,
        tokenId: offeredTokenId,
        action: 'proposeTrade',
        reason: 'CANNOT_TRADE_WITH_SELF',
      };
    }

    const validation = this.policyEngine.evaluate(offeredTokenId, 'proposeTrade', {
      requestedTokenId,
    });
    if (!validation.allowed) {
      return {
        success: false,
        tokenId: offeredTokenId,
        action: 'proposeTrade',
        reason: validation.reason,
        details: validation.details,
      };
    }

    // Resolve target agent session key wallet
    const targetSession = this.sessionRepo.getActiveSessionKey(requestedTokenId);
    if (!targetSession || targetSession.is_active !== 1) {
      return {
        success: false,
        tokenId: offeredTokenId,
        action: 'proposeTrade',
        reason: 'TARGET_AGENT_NOT_REGISTERED',
      };
    }

    try {
      const { txHash, tradeId } = await this.txSigner.executeProposeTrade(
        offeredTokenId,
        requestedTokenId,
        targetSession.wallet_address
      );

      return {
        success: true,
        tokenId: offeredTokenId,
        action: 'proposeTrade',
        transactionHash: txHash,
        tradeId,
      };
    } catch (err: any) {
      return {
        success: false,
        tokenId: offeredTokenId,
        action: 'proposeTrade',
        reason: err.message || 'TRANSACTION_FAILED',
      };
    }
  }

  public async respondTrade(
    tokenId: number,
    tradeId: string,
    response: 'accept' | 'reject'
  ): Promise<ActionResponse> {
    const validation = this.policyEngine.evaluate(tokenId, 'respondTrade', {
      tradeId,
      response,
    });
    if (!validation.allowed) {
      return {
        success: false,
        tokenId,
        action: 'respondTrade',
        reason: validation.reason,
        details: validation.details,
      };
    }

    const trade = this.tradeRepo.getTradeById(tradeId);
    if (!trade || trade.status !== 'PROPOSED') {
      return {
        success: false,
        tokenId,
        action: 'respondTrade',
        reason: 'TRADE_NOT_FOUND_OR_NOT_OPEN',
      };
    }

    try {
      if (response === 'accept') {
        const { txHash } = await this.txSigner.executeAcceptTrade(tokenId, tradeId);
        return {
          success: true,
          tokenId,
          action: 'respondTrade',
          transactionHash: txHash,
          tradeId,
        };
      } else {
        const { txHash } = await this.txSigner.executeCancelTrade(tokenId, tradeId);
        return {
          success: true,
          tokenId,
          action: 'respondTrade',
          transactionHash: txHash,
          tradeId,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        tokenId,
        action: 'respondTrade',
        reason: err.message || 'TRANSACTION_FAILED',
      };
    }
  }

  public getStatus(tokenId: number): AgentStatusResponse | null {
    const char = this.charRepo.getCharacterByTokenId(tokenId);
    if (!char) return null;

    const session = this.sessionRepo.getActiveSessionKey(tokenId);
    const openTrades = this.tradeRepo.getOpenTradesForToken(tokenId);

    // Calculate pending rewards estimate
    let pendingRewardsWei = 0n;
    if (char.is_staked === 1 && char.staked_at) {
      const now = Math.floor(Date.now() / 1000);
      const elapsed = BigInt(Math.max(0, now - char.staked_at));
      pendingRewardsWei = elapsed * AgentService.REWARD_RATE_WEI_PER_SEC;
    }

    const traits: PersonalityTraits = {
      riskTolerance: char.risk_tolerance,
      trustBaseline: char.trust_baseline,
      aggression: char.aggression,
      patience: char.patience,
    };

    return {
      tokenId: char.token_id,
      name: char.name,
      archetype: char.archetype as Archetype,
      traits,
      ownerAddress: char.owner_address,
      sessionKey: {
        walletAddress: session ? session.wallet_address : null,
        expiresAt: session ? session.expires_at : null,
        isActive: session ? session.is_active === 1 : false,
        policyHash: session ? session.policy_hash : null,
      },
      staking: {
        isStaked: char.is_staked === 1,
        stakedAt: char.staked_at,
        estimatedPendingRewardsWei: pendingRewardsWei.toString(),
        estimatedPendingRewardsFormatted: formatEther(pendingRewardsWei),
        totalRewardsClaimedWei: char.total_rewards_claimed || '0',
      },
      openTrades,
    };
  }

  public getMemory(tokenId: number, limit = 20): AgentMemoryRecord[] {
    return this.memoryRepo.getMemoriesByTokenId(tokenId, limit);
  }
}
