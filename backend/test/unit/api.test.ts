import { getDatabase, closeDatabase } from '../../src/db/database';
import {
  CharacterRepository,
  SessionKeyRepository,
  TradeRepository,
  AgentMemoryRepository,
} from '../../src/db/repositories';
import { PolicyEngine } from '../../src/policyEngine/policyEngine';
import { TransactionSigner } from '../../src/blockchain/TransactionSigner';
import { AgentService } from '../../src/services/AgentService';
import { buildServer } from '../../src/api/server';
import { FastifyInstance } from 'fastify';

describe('Action API Route Tests', () => {
  let db: any;
  let server: FastifyInstance;
  let charRepo: CharacterRepository;
  let sessionRepo: SessionKeyRepository;
  let tradeRepo: TradeRepository;
  let memoryRepo: AgentMemoryRepository;
  let agentService: AgentService;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    charRepo = new CharacterRepository(db);
    sessionRepo = new SessionKeyRepository(db);
    tradeRepo = new TradeRepository(db);
    memoryRepo = new AgentMemoryRepository(db);

    const policyEngine = new PolicyEngine(charRepo, sessionRepo, tradeRepo, memoryRepo);
    const mockTxSigner = {
      executeStake: jest.fn().mockResolvedValue({ txHash: '0xStakeTxHash' }),
      executeUnstake: jest.fn().mockResolvedValue({ txHash: '0xUnstakeTxHash' }),
      executeProposeTrade: jest.fn().mockResolvedValue({ txHash: '0xProposeTxHash', tradeId: '0xNewTradeId' }),
      executeAcceptTrade: jest.fn().mockResolvedValue({ txHash: '0xAcceptTxHash' }),
      executeCancelTrade: jest.fn().mockResolvedValue({ txHash: '0xCancelTxHash' }),
    } as unknown as TransactionSigner;

    agentService = new AgentService(charRepo, sessionRepo, tradeRepo, memoryRepo, policyEngine, mockTxSigner);
    server = buildServer(agentService);
    await server.ready();

    // Setup Token 0 (Kael)
    charRepo.upsertCharacter({
      token_id: 0,
      name: 'Kael',
      archetype: 'BERSERKER',
      risk_tolerance: 95,
      trust_baseline: 15,
      aggression: 90,
      patience: 10,
      owner_address: '0xOwnerA',
    });

    // Setup Token 1 (Lyra)
    charRepo.upsertCharacter({
      token_id: 1,
      name: 'Lyra',
      archetype: 'STRATEGIST',
      risk_tolerance: 30,
      trust_baseline: 80,
      aggression: 20,
      patience: 85,
      owner_address: '0xOwnerB',
    });

    const now = Math.floor(Date.now() / 1000);
    sessionRepo.insertSessionKey({
      token_id: 0,
      wallet_address: '0xAgent0',
      policy_hash: '0xHash0',
      policy_document: JSON.stringify({
        version: '1.0',
        allowedActions: ['stake', 'unstake', 'proposeTrade', 'respondTrade'],
        spendLimits: { maxStakeCycles: 5, maxActiveTrades: 2 },
      }),
      registered_at: now,
      expires_at: now + 3600,
      is_active: 1,
    });

    sessionRepo.insertSessionKey({
      token_id: 1,
      wallet_address: '0xAgent1',
      policy_hash: '0xHash1',
      policy_document: JSON.stringify({
        version: '1.0',
        allowedActions: ['stake', 'unstake', 'proposeTrade', 'respondTrade'],
        spendLimits: {},
      }),
      registered_at: now,
      expires_at: now + 3600,
      is_active: 1,
    });
  });

  afterEach(async () => {
    await server.close();
    closeDatabase();
  });

  describe('GET /health', () => {
    it('returns 200 OK', async () => {
      const res = await server.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).status).toBe('ok');
    });
  });

  describe('POST /agents/:tokenId/stake', () => {
    it('returns 200 with txHash when policy passes', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/agents/0/stake',
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(true);
      expect(data.transactionHash).toBe('0xStakeTxHash');
    });

    it('returns 404 for unknown character', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/agents/999/stake',
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /agents/:tokenId/proposeTrade', () => {
    it('returns 200 with tradeId when proposing trade to Token 1', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/agents/0/proposeTrade',
        payload: { targetTokenId: 1 },
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(true);
      expect(data.tradeId).toBe('0xNewTradeId');
    });

    it('returns 400 when payload is invalid', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/agents/0/proposeTrade',
        payload: { wrongField: 'invalid' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 403 when trying to trade with oneself', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/agents/0/proposeTrade',
        payload: { targetTokenId: 0 },
      });
      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body).reason).toBe('CANNOT_TRADE_WITH_SELF');
    });
  });

  describe('GET /agents/:tokenId/status', () => {
    it('returns comprehensive character and staking status', async () => {
      charRepo.updateStakeStatus(0, true, Math.floor(Date.now() / 1000) - 100);

      const res = await server.inject({
        method: 'GET',
        url: '/agents/0/status',
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.tokenId).toBe(0);
      expect(data.name).toBe('Kael');
      expect(data.archetype).toBe('BERSERKER');
      expect(data.traits.riskTolerance).toBe(95);
      expect(data.staking.isStaked).toBe(true);
      expect(Number(data.staking.estimatedPendingRewardsWei)).toBeGreaterThan(0);
    });
  });

  describe('GET /agents/:tokenId/memory', () => {
    it('returns memory history for agent', async () => {
      memoryRepo.insertMemory({
        token_id: 0,
        event_type: 'STAKED',
        description: 'Manual stake test',
        sentiment: 'POSITIVE',
        timestamp: Math.floor(Date.now() / 1000),
      });

      const res = await server.inject({
        method: 'GET',
        url: '/agents/0/memory?limit=10',
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.count).toBe(1);
      expect(data.memories[0].event_type).toBe('STAKED');
    });
  });
});
