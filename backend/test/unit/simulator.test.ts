import { getDatabase, closeDatabase } from '../../src/db/database';
import {
  CharacterRepository,
  SessionKeyRepository,
  TradeRepository,
  AgentMemoryRepository,
  PolicyBlockRepository,
} from '../../src/db/repositories';
import { PolicyEngine } from '../../src/policyEngine/policyEngine';
import { TransactionSigner } from '../../src/blockchain/TransactionSigner';
import { AgentService } from '../../src/services/AgentService';
import { EventInjector } from '../../src/simulator/injector';
import { SimulatorScheduler } from '../../src/simulator/scheduler';
import { DashboardWebSocketHub } from '../../src/ws/dashboardWs';
import { buildServer } from '../../src/api/server';
import { EventEmitter } from 'events';
import { FastifyInstance } from 'fastify';

describe('Simulator & Dashboard API Unit Tests', () => {
  let db: any;
  let server: FastifyInstance;
  let charRepo: CharacterRepository;
  let sessionRepo: SessionKeyRepository;
  let tradeRepo: TradeRepository;
  let memoryRepo: AgentMemoryRepository;
  let policyBlockRepo: PolicyBlockRepository;
  let agentService: AgentService;
  let injector: EventInjector;
  let scheduler: SimulatorScheduler;
  let wsHub: DashboardWebSocketHub;

  beforeEach(async () => {
    db = getDatabase(':memory:');
    charRepo = new CharacterRepository(db);
    sessionRepo = new SessionKeyRepository(db);
    tradeRepo = new TradeRepository(db);
    memoryRepo = new AgentMemoryRepository(db);
    policyBlockRepo = new PolicyBlockRepository(db);

    const policyEngine = new PolicyEngine(charRepo, sessionRepo, tradeRepo, memoryRepo, policyBlockRepo);
    const mockTxSigner = {
      executeStake: jest.fn().mockResolvedValue({ txHash: '0xStakeHash' }),
      executeUnstake: jest.fn().mockResolvedValue({ txHash: '0xUnstakeHash' }),
      executeProposeTrade: jest.fn().mockResolvedValue({ txHash: '0xProposeHash', tradeId: '0xTrade123' }),
      executeAcceptTrade: jest.fn().mockResolvedValue({ txHash: '0xAcceptHash' }),
      executeCancelTrade: jest.fn().mockResolvedValue({ txHash: '0xCancelHash' }),
    } as unknown as TransactionSigner;

    agentService = new AgentService(charRepo, sessionRepo, tradeRepo, memoryRepo, policyEngine, mockTxSigner);
    wsHub = new DashboardWebSocketHub();
    const eventBus = new EventEmitter();
    injector = new EventInjector(memoryRepo, wsHub, eventBus);
    scheduler = new SimulatorScheduler(injector, { enabled: false });

    server = buildServer({
      agentService,
      injector,
      scheduler,
      charRepo,
      sessionRepo,
      tradeRepo,
      memoryRepo,
      policyBlockRepo,
      wsHub,
    });
    await server.ready();

    // Setup character
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
  });

  afterEach(async () => {
    scheduler.stop();
    await server.close();
    closeDatabase();
  });

  describe('GET /api/dashboard/snapshot', () => {
    it('returns full dashboard state snapshot', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/dashboard/snapshot',
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.characters).toHaveLength(5);
      expect(data.characters[0].name).toBe('Kael');
      expect(data.systemStats).toBeDefined();
      expect(data.systemStats.totalCharacters).toBe(5);
    });
  });

  describe('POST /api/simulate/event', () => {
    it('injects BATTLE_WON event and stores memory', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/simulate/event',
        payload: {
          eventType: 'BATTLE_WON',
          targetTokenId: 0,
        },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(true);
      expect(data.event.eventType).toBe('BATTLE_WON');
      expect(data.event.targetTokenId).toBe(0);

      // Verify memory record
      const memories = memoryRepo.getMemoriesByTokenId(0);
      expect(memories.length).toBeGreaterThanOrEqual(1);
      expect(memories[0].event_type).toBe('SIM_BATTLE_WON');
    });

    it('rejects invalid event type', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/simulate/event',
        payload: {
          eventType: 'INVALID_EVENT',
          targetTokenId: 0,
        },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/agent/thought', () => {
    it('records agent thought and broadcasts to clients', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/agent/thought',
        payload: {
          tokenId: 0,
          characterName: 'Kael',
          archetype: 'BERSERKER',
          observationSummary: 'Observed reward spike',
          reasoningSummary: 'High risk tolerance allows staking',
          actionTaken: 'stake',
          sentiment: 'POSITIVE',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).success).toBe(true);

      const memories = memoryRepo.getMemoriesByTokenId(0);
      expect(memories.some((m) => m.event_type === 'THOUGHT')).toBe(true);
    });
  });

  describe('GET /api/simulate/events', () => {
    it('lists 6 predefined simulation events', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/api/simulate/events',
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.availableEvents).toHaveLength(6);
    });
  });

  describe('POST /api/session-keys/:tokenId/revoke (Kill Switch)', () => {
    it('revokes active session key immediately', async () => {
      const now = Math.floor(Date.now() / 1000);
      sessionRepo.insertSessionKey({
        token_id: 0,
        wallet_address: '0xActiveWallet',
        policy_hash: '0xHash',
        policy_document: '{}',
        registered_at: now,
        expires_at: now + 3600,
        is_active: 1,
      });

      const res = await server.inject({
        method: 'POST',
        url: '/api/session-keys/0/revoke',
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).success).toBe(true);

      const active = sessionRepo.getActiveSessionKey(0);
      expect(active).toBeNull();
    });
  });
});
