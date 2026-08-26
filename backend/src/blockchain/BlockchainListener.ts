import {
  Contract,
  WebSocketProvider,
  JsonRpcProvider,
} from 'ethers';
import config from '../config';
import {
  CharacterRepository,
  SessionKeyRepository,
  TradeRepository,
  AgentMemoryRepository,
} from '../db/repositories';
import {
  CHARACTER_NFT_ABI,
  AGENT_REGISTRY_ABI,
  STAKING_VAULT_ABI,
  TRADE_ESCROW_ABI,
} from './contracts';
import { Archetype } from '../types';
import { DashboardWebSocketHub } from '../ws/dashboardWs';

export class BlockchainListener {
  private wsProvider: WebSocketProvider | null = null;
  private httpProvider: JsonRpcProvider;
  private isRunning = false;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000;

  constructor(
    private charRepo: CharacterRepository,
    private sessionRepo: SessionKeyRepository,
    private tradeRepo: TradeRepository,
    private memoryRepo: AgentMemoryRepository,
    httpProvider?: JsonRpcProvider
  ) {
    this.httpProvider = httpProvider || new JsonRpcProvider(config.httpRpcUrl);
  }

  public async syncOnChainState(): Promise<void> {
    console.log('[BlockchainListener] Running startup on-chain state sync...');

    const nftContract = new Contract(config.contracts.characterNft, CHARACTER_NFT_ABI, this.httpProvider);
    const vaultContract = new Contract(config.contracts.stakingVault, STAKING_VAULT_ABI, this.httpProvider);
    const registryContract = new Contract(config.contracts.agentRegistry, AGENT_REGISTRY_ABI, this.httpProvider);

    try {
      const totalMintedBig = await nftContract.totalMinted();
      const totalMinted = Number(totalMintedBig);
      console.log(`[BlockchainListener] Total on-chain characters: ${totalMinted}`);

      const ARCHETYPE_MAP: Record<number, Archetype> = {
        0: 'SCAVENGER',
        1: 'STRATEGIST',
        2: 'BERSERKER',
        3: 'DIPLOMAT',
        4: 'HOARDER',
      };

      for (let tokenId = 0; tokenId < totalMinted; tokenId++) {
        try {
          const charData = await nftContract.getCharacter(tokenId);
          const ownerAddress = await nftContract.ownerOf(tokenId);
          const metadataUri = await nftContract.tokenURI(tokenId);
          const stakeInfo = await vaultContract.getStakeInfo(tokenId);
          const agentRecord = await registryContract.getAgentRecord(tokenId);

          const isStaked = stakeInfo.stakedAt > 0n;
          const stakedAtNum = isStaked ? Number(stakeInfo.stakedAt) : null;
          const rewardsClaimedStr = stakeInfo.rewardsClaimed.toString();

          this.charRepo.upsertCharacter({
            token_id: tokenId,
            name: charData.name,
            archetype: ARCHETYPE_MAP[Number(charData.archetype)] || 'STRATEGIST',
            risk_tolerance: Number(charData.traits.riskTolerance),
            trust_baseline: Number(charData.traits.trustBaseline),
            aggression: Number(charData.traits.aggression),
            patience: Number(charData.traits.patience),
            owner_address: ownerAddress,
            current_agent_wallet: agentRecord.agentWallet !== '0x0000000000000000000000000000000000000000' ? agentRecord.agentWallet : null,
            is_staked: isStaked ? 1 : 0,
            staked_at: stakedAtNum,
            total_rewards_claimed: rewardsClaimedStr,
            metadata_uri: metadataUri,
          });

          if (agentRecord.agentWallet !== '0x0000000000000000000000000000000000000000') {
            this.sessionRepo.insertSessionKey({
              token_id: tokenId,
              wallet_address: agentRecord.agentWallet,
              policy_hash: agentRecord.policyHash,
              policy_document: JSON.stringify({
                version: '1.0',
                allowedActions: ['stake', 'unstake', 'proposeTrade', 'respondTrade'],
                spendLimits: { maxStakeCycles: 10, maxActiveTrades: 3 },
              }),
              registered_at: Number(agentRecord.registeredAt),
              expires_at: Number(agentRecord.expiresAt),
              is_active: agentRecord.revoked ? 0 : 1,
            });
          }
        } catch (err: any) {
          console.warn(`[BlockchainListener] Warning syncing Token #${tokenId}:`, err.message);
        }
      }

      console.log('✅ [BlockchainListener] Startup sync complete.');
    } catch (err: any) {
      console.warn('[BlockchainListener] Note: Could not sync from chain (node offline or zero contracts). Using cache:', err.message);
    }
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    await this.syncOnChainState();

    if (!config.wsRpcUrl || config.nodeEnv === 'test') {
      console.log('[BlockchainListener] Running in polling / mock mode.');
      return;
    }

    this.connectWebSocket();
  }

  private connectWebSocket(): void {
    try {
      console.log(`[BlockchainListener] Connecting WebSocket provider to ${config.wsRpcUrl}...`);
      this.wsProvider = new WebSocketProvider(config.wsRpcUrl);

      if (this.wsProvider.websocket && typeof (this.wsProvider.websocket as any).on === 'function') {
        (this.wsProvider.websocket as any).on('close', () => {
          console.warn('[BlockchainListener] WebSocket disconnected. Scheduling reconnect...');
          this.reconnect();
        });

        (this.wsProvider.websocket as any).on('error', (err: any) => {
          console.error('[BlockchainListener] WebSocket error:', err.message);
        });
      }

      this.subscribeToContractEvents(this.wsProvider);
      this.reconnectAttempts = 0;
      console.log('📡 [BlockchainListener] WebSocket event subscriptions active.');
    } catch (err: any) {
      console.error('[BlockchainListener] Failed to connect WebSocket:', err.message);
      this.reconnect();
    }
  }

  private reconnect(): void {
    if (!this.isRunning) return;

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
    console.log(`[BlockchainListener] Reconnecting in ${delay / 1000}s (Attempt #${this.reconnectAttempts})...`);

    setTimeout(() => {
      if (this.isRunning) {
        this.connectWebSocket();
      }
    }, delay);
  }

  private subscribeToContractEvents(provider: WebSocketProvider): void {
    const nft = new Contract(config.contracts.characterNft, CHARACTER_NFT_ABI, provider);
    const registry = new Contract(config.contracts.agentRegistry, AGENT_REGISTRY_ABI, provider);
    const vault = new Contract(config.contracts.stakingVault, STAKING_VAULT_ABI, provider);
    const escrow = new Contract(config.contracts.tradeEscrow, TRADE_ESCROW_ABI, provider);

    // 1. CharacterNFT Events
    nft.on('CharacterMinted', (tokenId, owner, name, archetype, traits, event) => {
      this.handleCharacterMinted(Number(tokenId), owner, name, Number(archetype));
    });

    nft.on('AgentWalletLinked', (tokenId, agentWallet, event) => {
      this.charRepo.updateAgentWallet(Number(tokenId), agentWallet);
      console.log(`[Event:AgentWalletLinked] Token #${tokenId} -> ${agentWallet}`);
    });

    // 2. AgentRegistry Events
    registry.on('AgentRegistered', (tokenId, agentWallet, policyHash, expiresAt, event) => {
      this.handleAgentRegistered(Number(tokenId), agentWallet, policyHash, Number(expiresAt));
    });

    registry.on('AgentRevoked', (tokenId, agentWallet, event) => {
      this.handleAgentRevoked(Number(tokenId), agentWallet);
    });

    // 3. StakingVault Events
    vault.on('CharacterStaked', (tokenId, agentWallet, originalOwner, timestamp, event) => {
      this.handleCharacterStaked(Number(tokenId), agentWallet, originalOwner, Number(timestamp));
    });

    vault.on('CharacterUnstaked', (tokenId, agentWallet, rewardsPaid, timestamp, event) => {
      this.handleCharacterUnstaked(Number(tokenId), agentWallet, rewardsPaid.toString(), Number(timestamp));
    });

    // 4. TradeEscrow Events
    escrow.on('TradeProposed', (tradeId, proposerWallet, targetWallet, offeredTokenId, requestedTokenId, timestamp, event) => {
      this.handleTradeProposed(
        tradeId,
        proposerWallet,
        targetWallet,
        Number(offeredTokenId),
        Number(requestedTokenId),
        Number(timestamp)
      );
    });

    escrow.on('TradeSettled', (tradeId, proposerOwner, receivedTokenId, targetOwner, deliveredTokenId, timestamp, event) => {
      this.handleTradeSettled(
        tradeId,
        proposerOwner,
        Number(receivedTokenId),
        targetOwner,
        Number(deliveredTokenId),
        Number(timestamp)
      );
    });

    escrow.on('TradeCancelled', (tradeId, cancelledBy, timestamp, event) => {
      this.handleTradeCancelled(tradeId, cancelledBy, Number(timestamp));
    });
  }

  // ── Public Event Handlers ──

  public handleCharacterMinted(
    tokenId: number,
    param2: string,
    param3: string | number,
    param4?: string | number
  ): void {
    let name = '';
    let owner = '';
    let archetypeNum = 0;

    if (typeof param3 === 'number') {
      // Called as (tokenId, name, archetypeNum, owner)
      name = param2;
      archetypeNum = param3;
      owner = (param4 as string) || '0x0000000000000000000000000000000000000000';
    } else {
      // Called as (tokenId, owner, name, archetypeNum)
      owner = param2;
      name = param3;
      archetypeNum = (param4 as number) || 0;
    }

    const ARCHETYPE_MAP: Record<number, Archetype> = {
      0: 'SCAVENGER',
      1: 'STRATEGIST',
      2: 'BERSERKER',
      3: 'DIPLOMAT',
      4: 'HOARDER',
    };
    const archetype = ARCHETYPE_MAP[archetypeNum] || 'STRATEGIST';

    this.charRepo.upsertCharacter({
      token_id: tokenId,
      name,
      archetype,
      owner_address: owner,
      is_staked: 0,
    });
    console.log(`[Event:CharacterMinted] Token #${tokenId} (${name}) owned by ${owner}`);

    DashboardWebSocketHub.getInstance().broadcastChainEvent({
      eventType: 'CharacterMinted',
      tokenIds: [tokenId],
      details: `Minted ${name} (${archetype}) to ${owner}`,
      timestamp: Math.floor(Date.now() / 1000),
    });
  }

  public handleAgentRegistered(tokenId: number, agentWallet: string, policyHash: string, expiresAt: number): void {
    this.charRepo.updateAgentWallet(tokenId, agentWallet);
    this.sessionRepo.insertSessionKey({
      token_id: tokenId,
      wallet_address: agentWallet,
      policy_hash: policyHash,
      policy_document: JSON.stringify({
        version: '1.0',
        allowedActions: ['stake', 'unstake', 'proposeTrade', 'respondTrade'],
        spendLimits: { maxStakeCycles: 10, maxActiveTrades: 3 },
      }),
      registered_at: Math.floor(Date.now() / 1000),
      expires_at: expiresAt,
      is_active: 1,
    });
    console.log(`[Event:AgentRegistered] Token #${tokenId} delegated to ${agentWallet}`);

    DashboardWebSocketHub.getInstance().broadcastSessionKeyEvent({
      tokenId,
      walletAddress: agentWallet,
      expiresAt,
      eventType: 'REGISTERED',
    });

    DashboardWebSocketHub.getInstance().broadcastChainEvent({
      eventType: 'AgentRegistered',
      tokenIds: [tokenId],
      details: `Session key registered for Token #${tokenId} (Address: ${agentWallet.slice(0, 8)}...)`,
      timestamp: Math.floor(Date.now() / 1000),
    });
  }

  public handleAgentRevoked(tokenId: number, agentWallet: string): void {
    this.charRepo.updateAgentWallet(tokenId, null);
    this.sessionRepo.revokeSessionKey(tokenId);
    this.memoryRepo.insertMemory({
      token_id: tokenId,
      event_type: 'SESSION_REVOKED',
      description: `Operator kill switch revoked session key ${agentWallet}`,
      outcome: 'Agent session terminated on-chain',
      sentiment: 'NEUTRAL',
      timestamp: Math.floor(Date.now() / 1000),
    });
    console.log(`[Event:AgentRevoked] Token #${tokenId} session key revoked`);

    DashboardWebSocketHub.getInstance().broadcastSessionKeyEvent({
      tokenId,
      walletAddress: agentWallet,
      expiresAt: 0,
      eventType: 'REVOKED',
    });

    DashboardWebSocketHub.getInstance().broadcastChainEvent({
      eventType: 'AgentRevoked',
      tokenIds: [tokenId],
      details: `Session key revoked on-chain for Token #${tokenId}`,
      timestamp: Math.floor(Date.now() / 1000),
    });
  }

  public handleCharacterStaked(tokenId: number, agentWallet: string, originalOwner: string, timestamp: number): void {
    this.charRepo.updateStakeStatus(tokenId, true, timestamp);
    this.memoryRepo.insertMemory({
      token_id: tokenId,
      event_type: 'STAKED',
      description: `Agent ${agentWallet} staked character into StakingVault`,
      outcome: 'NFT locked in vault, accruing MLRD rewards',
      sentiment: 'POSITIVE',
      timestamp,
    });
    console.log(`[Event:CharacterStaked] Token #${tokenId} staked at timestamp ${timestamp}`);

    DashboardWebSocketHub.getInstance().broadcastChainEvent({
      eventType: 'CharacterStaked',
      tokenIds: [tokenId],
      details: `Token #${tokenId} entered StakingVault (accruing MLRD rewards)`,
      timestamp,
    });
  }

  public handleCharacterUnstaked(tokenId: number, agentWallet: string, rewardsPaidWei: string, timestamp: number): void {
    this.charRepo.updateStakeStatus(tokenId, false, null);
    this.charRepo.addRewardsClaimed(tokenId, rewardsPaidWei);
    this.memoryRepo.insertMemory({
      token_id: tokenId,
      event_type: 'UNSTAKED',
      description: `Agent ${agentWallet} unstaked character and claimed rewards`,
      outcome: `NFT returned to owner with rewards payout`,
      decision_metadata: JSON.stringify({ rewardsPaidWei }),
      sentiment: 'POSITIVE',
      timestamp,
    });
    console.log(`[Event:CharacterUnstaked] Token #${tokenId} unstaked. Rewards paid: ${rewardsPaidWei}`);

    DashboardWebSocketHub.getInstance().broadcastChainEvent({
      eventType: 'CharacterUnstaked',
      tokenIds: [tokenId],
      details: `Token #${tokenId} unstaked. Rewards claimed: ${(Number(rewardsPaidWei) / 1e18).toFixed(2)} REWA`,
      timestamp,
    });
  }

  public handleTradeProposed(
    tradeId: string,
    proposerWallet: string,
    targetWallet: string,
    offeredTokenId: number,
    requestedTokenId: number,
    timestamp: number
  ): void {
    const char = this.charRepo.getCharacterByTokenId(offeredTokenId);
    const tradeRecord = {
      trade_id: tradeId,
      proposer_token_id: offeredTokenId,
      target_token_id: requestedTokenId,
      proposer_wallet: proposerWallet,
      target_wallet: targetWallet,
      proposer_owner: char?.owner_address || '',
      status: 'PROPOSED' as const,
      proposed_at: timestamp,
      settled_at: null,
      sentiment_proposer: null,
      sentiment_target: null,
    };
    this.tradeRepo.insertTrade(tradeRecord);

    this.memoryRepo.insertMemory({
      token_id: offeredTokenId,
      event_type: 'TRADE_PROPOSED',
      description: `Proposed trade of Token #${offeredTokenId} for Token #${requestedTokenId}`,
      related_trade_id: tradeId,
      sentiment: 'NEUTRAL',
      timestamp,
    });

    this.memoryRepo.insertMemory({
      token_id: requestedTokenId,
      event_type: 'TRADE_RECEIVED',
      description: `Received trade proposal offering Token #${offeredTokenId} for Token #${requestedTokenId}`,
      related_trade_id: tradeId,
      sentiment: 'NEUTRAL',
      timestamp,
    });

    console.log(`[Event:TradeProposed] Trade ${tradeId}: #${offeredTokenId} -> #${requestedTokenId}`);

    DashboardWebSocketHub.getInstance().broadcastTradeUpdate(tradeRecord);
    DashboardWebSocketHub.getInstance().broadcastChainEvent({
      eventType: 'TradeProposed',
      tokenIds: [offeredTokenId, requestedTokenId],
      details: `Trade proposed: Token #${offeredTokenId} -> Token #${requestedTokenId}`,
      timestamp,
    });
  }

  public handleTradeSettled(
    tradeId: string,
    proposerOwner: string,
    receivedTokenId: number,
    targetOwner: string,
    deliveredTokenId: number,
    timestamp: number
  ): void {
    this.tradeRepo.updateTradeStatus(tradeId, 'SETTLED', timestamp, 'POSITIVE', 'POSITIVE');

    // Update ownership in cache
    this.charRepo.upsertCharacter({
      token_id: deliveredTokenId,
      name: '',
      archetype: 'STRATEGIST',
      owner_address: targetOwner,
    });
    this.charRepo.upsertCharacter({
      token_id: receivedTokenId,
      name: '',
      archetype: 'STRATEGIST',
      owner_address: proposerOwner,
    });

    this.memoryRepo.insertMemory({
      token_id: deliveredTokenId,
      event_type: 'TRADE_SETTLED',
      description: `Trade ${tradeId} settled. Swapped Token #${deliveredTokenId} for Token #${receivedTokenId}`,
      related_trade_id: tradeId,
      outcome: 'Atomic NFT ownership swap completed on-chain',
      sentiment: 'POSITIVE',
      timestamp,
    });

    this.memoryRepo.insertMemory({
      token_id: receivedTokenId,
      event_type: 'TRADE_SETTLED',
      description: `Trade ${tradeId} settled. Received Token #${deliveredTokenId} for Token #${receivedTokenId}`,
      related_trade_id: tradeId,
      outcome: 'Atomic NFT ownership swap completed on-chain',
      sentiment: 'POSITIVE',
      timestamp,
    });

    console.log(`[Event:TradeSettled] Trade ${tradeId} settled.`);

    const settledTrade = this.tradeRepo.getTradeById(tradeId);
    if (settledTrade) {
      DashboardWebSocketHub.getInstance().broadcastTradeUpdate(settledTrade);
    }
    DashboardWebSocketHub.getInstance().broadcastChainEvent({
      eventType: 'TradeSettled',
      tokenIds: [deliveredTokenId, receivedTokenId],
      details: `Atomic swap settled: Token #${deliveredTokenId} <-> Token #${receivedTokenId}`,
      timestamp,
    });
  }

  public handleTradeCancelled(tradeId: string, cancelledBy: string, timestamp: number): void {
    const trade = this.tradeRepo.getTradeById(tradeId);
    this.tradeRepo.updateTradeStatus(tradeId, 'CANCELLED', timestamp, 'NEUTRAL', 'NEGATIVE');

    if (trade) {
      this.memoryRepo.insertMemory({
        token_id: trade.proposer_token_id,
        event_type: 'TRADE_CANCELLED',
        description: `Trade ${tradeId} was cancelled by ${cancelledBy}`,
        related_trade_id: tradeId,
        outcome: 'Escrowed NFT returned to owner',
        sentiment: 'NEUTRAL',
        timestamp,
      });

      this.memoryRepo.insertMemory({
        token_id: trade.target_token_id,
        event_type: 'TRADE_CANCELLED',
        description: `Trade ${tradeId} was cancelled by ${cancelledBy}`,
        related_trade_id: tradeId,
        sentiment: 'NEGATIVE',
        timestamp,
      });

      const cancelledTrade = this.tradeRepo.getTradeById(tradeId);
      if (cancelledTrade) {
        DashboardWebSocketHub.getInstance().broadcastTradeUpdate(cancelledTrade);
      }
    }

    console.log(`[Event:TradeCancelled] Trade ${tradeId} cancelled.`);

    DashboardWebSocketHub.getInstance().broadcastChainEvent({
      eventType: 'TradeCancelled',
      tokenIds: trade ? [trade.proposer_token_id, trade.target_token_id] : [],
      details: `Trade ${tradeId.slice(0, 10)}... was cancelled`,
      timestamp,
    });
  }

  public stop(): void {
    this.isRunning = false;
    if (this.wsProvider) {
      try {
        this.wsProvider.destroy();
      } catch {}
      this.wsProvider = null;
    }
  }
}
