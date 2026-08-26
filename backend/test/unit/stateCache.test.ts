import { getDatabase, closeDatabase } from '../../src/db/database';
import {
  CharacterRepository,
  SessionKeyRepository,
  TradeRepository,
  AgentMemoryRepository,
} from '../../src/db/repositories';
import { BlockchainListener } from '../../src/blockchain/BlockchainListener';

describe('State Cache & Event Listener Unit Tests', () => {
  let db: any;
  let charRepo: CharacterRepository;
  let sessionRepo: SessionKeyRepository;
  let tradeRepo: TradeRepository;
  let memoryRepo: AgentMemoryRepository;
  let listener: BlockchainListener;

  beforeEach(() => {
    db = getDatabase(':memory:');
    charRepo = new CharacterRepository(db);
    sessionRepo = new SessionKeyRepository(db);
    tradeRepo = new TradeRepository(db);
    memoryRepo = new AgentMemoryRepository(db);
    listener = new BlockchainListener(charRepo, sessionRepo, tradeRepo, memoryRepo);
  });

  afterEach(() => {
    closeDatabase();
  });

  describe('CharacterRepository', () => {
    it('upserts and retrieves character record correctly', () => {
      charRepo.upsertCharacter({
        token_id: 0,
        name: 'Kael',
        archetype: 'BERSERKER',
        risk_tolerance: 95,
        trust_baseline: 15,
        aggression: 90,
        patience: 10,
        owner_address: '0x123',
      });

      const char = charRepo.getCharacterByTokenId(0);
      expect(char).not.toBeNull();
      expect(char?.name).toBe('Kael');
      expect(char?.archetype).toBe('BERSERKER');
      expect(char?.risk_tolerance).toBe(95);
      expect(char?.is_staked).toBe(0);
    });

    it('updates staking status and rewards claimed', () => {
      charRepo.upsertCharacter({
        token_id: 0,
        name: 'Kael',
        archetype: 'BERSERKER',
        owner_address: '0x123',
      });

      charRepo.updateStakeStatus(0, true, 1700000000);
      let char = charRepo.getCharacterByTokenId(0);
      expect(char?.is_staked).toBe(1);
      expect(char?.staked_at).toBe(1700000000);

      charRepo.addRewardsClaimed(0, '5000000000000000000'); // 5 ether in wei
      char = charRepo.getCharacterByTokenId(0);
      expect(char?.total_rewards_claimed).toBe('5000000000000000000');
    });
  });

  describe('BlockchainListener Event Handlers', () => {
    it('handles CharacterMinted event', () => {
      listener.handleCharacterMinted(1, 'Lyra', 1, '0xPlayerAddress');

      const char = charRepo.getCharacterByTokenId(1);
      expect(char).not.toBeNull();
      expect(char?.name).toBe('Lyra');
      expect(char?.archetype).toBe('STRATEGIST');
      expect(char?.owner_address).toBe('0xPlayerAddress');
    });

    it('handles AgentRegistered event', () => {
      listener.handleCharacterMinted(0, 'Kael', 2, '0xOwner');
      listener.handleAgentRegistered(0, '0xAgentWallet', '0xPolicyHash', 1800000000);

      const char = charRepo.getCharacterByTokenId(0);
      expect(char?.current_agent_wallet).toBe('0xAgentWallet');

      const session = sessionRepo.getActiveSessionKey(0);
      expect(session).not.toBeNull();
      expect(session?.wallet_address).toBe('0xAgentWallet');
      expect(session?.expires_at).toBe(1800000000);
    });

    it('handles CharacterStaked and CharacterUnstaked events', () => {
      listener.handleCharacterMinted(0, 'Kael', 2, '0xOwner');

      listener.handleCharacterStaked(0, '0xAgentWallet', '0xOwner', 1700000000);
      let char = charRepo.getCharacterByTokenId(0);
      expect(char?.is_staked).toBe(1);
      expect(char?.staked_at).toBe(1700000000);

      listener.handleCharacterUnstaked(0, '0xAgentWallet', '10000000000000000000', 1700086400);
      char = charRepo.getCharacterByTokenId(0);
      expect(char?.is_staked).toBe(0);
      expect(char?.total_rewards_claimed).toBe('10000000000000000000');

      const memories = memoryRepo.getMemoriesByTokenId(0);
      expect(memories.length).toBe(2);
      expect(memories[0].event_type).toBe('UNSTAKED');
      expect(memories[1].event_type).toBe('STAKED');
    });

    it('handles Trade lifecycle: Proposed -> Settled', () => {
      listener.handleCharacterMinted(0, 'Kael', 2, '0xOwnerA');
      listener.handleCharacterMinted(1, 'Lyra', 1, '0xOwnerB');

      const tradeId = '0xTradeHash123';
      listener.handleTradeProposed(tradeId, '0xAgentA', '0xAgentB', 0, 1, 1700000000);

      let trade = tradeRepo.getTradeById(tradeId);
      expect(trade?.status).toBe('PROPOSED');
      expect(trade?.proposer_token_id).toBe(0);
      expect(trade?.target_token_id).toBe(1);

      listener.handleTradeSettled(tradeId, '0xOwnerA', 1, '0xOwnerB', 0, 1700001000);
      trade = tradeRepo.getTradeById(tradeId);
      expect(trade?.status).toBe('SETTLED');
    });

    it('handles AgentRevoked kill switch event', () => {
      listener.handleCharacterMinted(0, 'Kael', 2, '0xOwner');
      listener.handleAgentRegistered(0, '0xAgentWallet', '0xPolicyHash', 1800000000);

      listener.handleAgentRevoked(0, '0xAgentWallet');

      const char = charRepo.getCharacterByTokenId(0);
      expect(char?.current_agent_wallet).toBeNull();

      const session = sessionRepo.getActiveSessionKey(0);
      expect(session).toBeNull();

      const memories = memoryRepo.getMemoriesByTokenId(0);
      expect(memories[0].event_type).toBe('SESSION_REVOKED');
    });
  });
});
