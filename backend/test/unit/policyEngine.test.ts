import { getDatabase, closeDatabase } from '../../src/db/database';
import {
  CharacterRepository,
  SessionKeyRepository,
  TradeRepository,
  AgentMemoryRepository,
} from '../../src/db/repositories';
import { PolicyEngine } from '../../src/policyEngine/policyEngine';

describe('PolicyEngine Unit Tests', () => {
  let db: any;
  let charRepo: CharacterRepository;
  let sessionRepo: SessionKeyRepository;
  let tradeRepo: TradeRepository;
  let memoryRepo: AgentMemoryRepository;
  let policyEngine: PolicyEngine;

  const sampleWallet = '0x1111111111111111111111111111111111111111';

  beforeEach(() => {
    db = getDatabase(':memory:');
    charRepo = new CharacterRepository(db);
    sessionRepo = new SessionKeyRepository(db);
    tradeRepo = new TradeRepository(db);
    memoryRepo = new AgentMemoryRepository(db);
    policyEngine = new PolicyEngine(charRepo, sessionRepo, tradeRepo, memoryRepo);

    // Setup Token 0 (Kael - standard policy)
    charRepo.upsertCharacter({
      token_id: 0,
      name: 'Kael',
      archetype: 'BERSERKER',
      owner_address: '0xOwner',
    });

    const now = Math.floor(Date.now() / 1000);
    sessionRepo.insertSessionKey({
      token_id: 0,
      wallet_address: sampleWallet,
      policy_hash: '0xHash',
      policy_document: JSON.stringify({
        version: '1.0',
        allowedActions: ['stake', 'unstake', 'proposeTrade', 'respondTrade'],
        spendLimits: { maxStakeCycles: 3, maxActiveTrades: 2 },
      }),
      registered_at: now,
      expires_at: now + 3600, // 1 hour validity
      is_active: 1,
    });
  });

  afterEach(() => {
    closeDatabase();
  });

  describe('Check 1: Allowed Actions', () => {
    it('approves an action that is listed in allowedActions', () => {
      const result = policyEngine.evaluate(0, 'stake');
      expect(result.allowed).toBe(true);
    });

    it('rejects an action that is not in allowedActions (e.g. Hoarder policy without proposeTrade)', () => {
      // Setup Token 4 (Nyx - Hoarder with restricted actions)
      charRepo.upsertCharacter({
        token_id: 4,
        name: 'Nyx',
        archetype: 'HOARDER',
        owner_address: '0xOwner',
      });

      const now = Math.floor(Date.now() / 1000);
      sessionRepo.insertSessionKey({
        token_id: 4,
        wallet_address: '0xHoarderWallet',
        policy_hash: '0xHoarderHash',
        policy_document: JSON.stringify({
          version: '1.0',
          allowedActions: ['stake', 'unstake', 'respondTrade'], // proposeTrade excluded!
          spendLimits: {},
        }),
        registered_at: now,
        expires_at: now + 3600,
        is_active: 1,
      });

      const result = policyEngine.evaluate(4, 'proposeTrade');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('ACTION_NOT_PERMITTED');

      // Verify rejection was logged in agent_memory
      const memories = memoryRepo.getMemoriesByTokenId(4);
      expect(memories.length).toBe(1);
      expect(memories[0].event_type).toBe('POLICY_REJECTED');
    });
  });

  describe('Check 2: Spend & Frequency Limits', () => {
    it('approves stake action when within maxStakeCycles limit', () => {
      const result = policyEngine.evaluate(0, 'stake');
      expect(result.allowed).toBe(true);
    });

    it('rejects stake action when maxStakeCycles limit is exceeded', () => {
      const now = Math.floor(Date.now() / 1000);
      // Simulate 3 past stake events
      for (let i = 0; i < 3; i++) {
        memoryRepo.insertMemory({
          token_id: 0,
          event_type: 'STAKED',
          description: `Stake #${i}`,
          sentiment: 'POSITIVE',
          timestamp: now,
        });
      }

      const result = policyEngine.evaluate(0, 'stake');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('SPEND_LIMIT_EXCEEDED');
      expect(result.details?.currentStakeCount).toBe(3);
      expect(result.details?.maxStakeCycles).toBe(3);
    });

    it('rejects proposeTrade when maxActiveTrades limit is exceeded', () => {
      const now = Math.floor(Date.now() / 1000);
      // Simulate 2 currently active proposed trades
      tradeRepo.insertTrade({
        trade_id: '0xTrade1',
        proposer_token_id: 0,
        target_token_id: 1,
        proposer_wallet: sampleWallet,
        target_wallet: '0xTarget',
        proposer_owner: '0xOwner',
        status: 'PROPOSED',
        proposed_at: now,
        settled_at: null,
        sentiment_proposer: null,
        sentiment_target: null,
      });

      tradeRepo.insertTrade({
        trade_id: '0xTrade2',
        proposer_token_id: 0,
        target_token_id: 2,
        proposer_wallet: sampleWallet,
        target_wallet: '0xTarget2',
        proposer_owner: '0xOwner',
        status: 'PROPOSED',
        proposed_at: now,
        settled_at: null,
        sentiment_proposer: null,
        sentiment_target: null,
      });

      const result = policyEngine.evaluate(0, 'proposeTrade');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('SPEND_LIMIT_EXCEEDED');
      expect(result.details?.currentActiveTrades).toBe(2);
    });
  });

  describe('Check 3: Session Expiry & De-authorization', () => {
    it('rejects action if session key is expired', () => {
      const past = Math.floor(Date.now() / 1000) - 100;
      sessionRepo.insertSessionKey({
        token_id: 0,
        wallet_address: sampleWallet,
        policy_hash: '0xHash',
        policy_document: JSON.stringify({
          version: '1.0',
          allowedActions: ['stake'],
          spendLimits: {},
        }),
        registered_at: past - 3600,
        expires_at: past, // Expired in the past
        is_active: 1,
      });

      const result = policyEngine.evaluate(0, 'stake');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('SESSION_EXPIRED');
    });

    it('rejects action if session key was revoked', () => {
      sessionRepo.revokeSessionKey(0);

      const result = policyEngine.evaluate(0, 'stake');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('SESSION_NOT_FOUND');
    });
  });
});
