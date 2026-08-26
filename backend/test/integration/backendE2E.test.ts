import { getDatabase, closeDatabase } from '../../src/db/database';
import {
  CharacterRepository,
  SessionKeyRepository,
  TradeRepository,
  AgentMemoryRepository,
} from '../../src/db/repositories';
import { PolicyEngine } from '../../src/policyEngine/policyEngine';
import { TransactionSigner } from '../../src/blockchain/TransactionSigner';
import { BlockchainListener } from '../../src/blockchain/BlockchainListener';
import { AgentService } from '../../src/services/AgentService';
import { buildServer } from '../../src/api/server';
import { FastifyInstance } from 'fastify';

describe('Backend Service E2E Flow Integration', () => {
  let db: any;
  let server: FastifyInstance;
  let charRepo: CharacterRepository;
  let sessionRepo: SessionKeyRepository;
  let tradeRepo: TradeRepository;
  let memoryRepo: AgentMemoryRepository;
  let listener: BlockchainListener;
  let agentService: AgentService;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    charRepo = new CharacterRepository(db);
    sessionRepo = new SessionKeyRepository(db);
    tradeRepo = new TradeRepository(db);
    memoryRepo = new AgentMemoryRepository(db);
    listener = new BlockchainListener(charRepo, sessionRepo, tradeRepo, memoryRepo);

    const policyEngine = new PolicyEngine(charRepo, sessionRepo, tradeRepo, memoryRepo);
    const mockTxSigner = {
      executeStake: jest.fn().mockImplementation(async (tokenId: number) => {
        const txHash = `0xStakeTx_${tokenId}_${Date.now()}`;
        // Simulate event arriving via listener
        listener.handleCharacterStaked(tokenId, '0xAgentWallet0', '0xPlayerA', Math.floor(Date.now() / 1000));
        return { txHash };
      }),
      executeUnstake: jest.fn().mockImplementation(async (tokenId: number) => {
        const txHash = `0xUnstakeTx_${tokenId}_${Date.now()}`;
        listener.handleCharacterUnstaked(tokenId, '0xAgentWallet0', '10000000000000000000', Math.floor(Date.now() / 1000));
        return { txHash };
      }),
      executeProposeTrade: jest.fn().mockImplementation(async (offered: number, requested: number, targetWallet: string) => {
        const txHash = `0xProposeTx_${offered}_${requested}`;
        const tradeId = `0xTrade_${offered}_${requested}`;
        listener.handleTradeProposed(tradeId, '0xAgentWallet0', targetWallet, offered, requested, Math.floor(Date.now() / 1000));
        return { txHash, tradeId };
      }),
      executeAcceptTrade: jest.fn().mockImplementation(async (targetToken: number, tradeId: string) => {
        const txHash = `0xAcceptTx_${tradeId}`;
        listener.handleTradeSettled(tradeId, '0xPlayerA', 1, '0xPlayerB', 0, Math.floor(Date.now() / 1000));
        return { txHash };
      }),
      executeCancelTrade: jest.fn().mockImplementation(async (callerToken: number, tradeId: string) => {
        const txHash = `0xCancelTx_${tradeId}`;
        listener.handleTradeCancelled(tradeId, '0xAgentWallet0', Math.floor(Date.now() / 1000));
        return { txHash };
      }),
    } as unknown as TransactionSigner;

    agentService = new AgentService(charRepo, sessionRepo, tradeRepo, memoryRepo, policyEngine, mockTxSigner);
    server = buildServer(agentService);
    await server.ready();

    // Initialize 2 characters via listener
    listener.handleCharacterMinted(0, 'Kael', 2, '0xPlayerA');
    listener.handleCharacterMinted(1, 'Lyra', 1, '0xPlayerB');

    const now = Math.floor(Date.now() / 1000);
    listener.handleAgentRegistered(0, '0xAgentWallet0', '0xHash0', now + 86400);
    listener.handleAgentRegistered(1, '0xAgentWallet1', '0xHash1', now + 86400);
  });

  afterEach(async () => {
    await server.close();
    closeDatabase();
  });

  it('executes full Flow A: Stake -> Sync Event -> Query Status -> Unstake', async () => {
    // 1. Trigger Stake via API
    const stakeRes = await server.inject({
      method: 'POST',
      url: '/agents/0/stake',
    });
    expect(stakeRes.statusCode).toBe(200);
    expect(JSON.parse(stakeRes.body).success).toBe(true);

    // 2. Verify state cache updated
    const char = charRepo.getCharacterByTokenId(0);
    expect(char?.is_staked).toBe(1);

    // 3. Query Status API
    const statusRes = await server.inject({
      method: 'GET',
      url: '/agents/0/status',
    });
    expect(statusRes.statusCode).toBe(200);
    const status = JSON.parse(statusRes.body);
    expect(status.staking.isStaked).toBe(true);

    // 4. Trigger Unstake via API
    const unstakeRes = await server.inject({
      method: 'POST',
      url: '/agents/0/unstake',
    });
    expect(unstakeRes.statusCode).toBe(200);

    // 5. Verify character unstaked and rewards recorded
    const updatedChar = charRepo.getCharacterByTokenId(0);
    expect(updatedChar?.is_staked).toBe(0);
    expect(updatedChar?.total_rewards_claimed).toBe('10000000000000000000');
  });

  it('executes full Flow B: Propose Trade -> Accept Trade -> Atomic Swap Record', async () => {
    // 1. Propose trade Token 0 for Token 1
    const proposeRes = await server.inject({
      method: 'POST',
      url: '/agents/0/proposeTrade',
      payload: { targetTokenId: 1 },
    });
    expect(proposeRes.statusCode).toBe(200);
    const { tradeId } = JSON.parse(proposeRes.body);
    expect(tradeId).toBe('0xTrade_0_1');

    // 2. Verify trade is in open trades
    const openTrades = tradeRepo.getOpenTradesForToken(0);
    expect(openTrades.length).toBe(1);
    expect(openTrades[0].status).toBe('PROPOSED');

    // 3. Target accepts trade
    const respondRes = await server.inject({
      method: 'POST',
      url: '/agents/1/respondTrade',
      payload: { tradeId, response: 'accept' },
    });
    expect(respondRes.statusCode).toBe(200);

    // 4. Verify settled
    const settledTrade = tradeRepo.getTradeById(tradeId);
    expect(settledTrade?.status).toBe('SETTLED');
  });
});
