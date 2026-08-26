import { Database } from 'better-sqlite3';
import {
  CharacterRecord,
  SessionKeyRecord,
  TradeRecord,
  AgentMemoryRecord,
  PolicyBlockRecord,
  TradeStatus,
  Sentiment,
} from '../types';

export class CharacterRepository {
  constructor(private db: Database) {}

  upsertCharacter(char: Partial<CharacterRecord> & { token_id: number; name: string; archetype: string; owner_address: string }): void {
    const stmt = this.db.prepare(`
      INSERT INTO characters (
        token_id, name, archetype, risk_tolerance, trust_baseline, aggression, patience,
        owner_address, current_agent_wallet, is_staked, staked_at, total_rewards_claimed, metadata_uri
      ) VALUES (
        @token_id, @name, @archetype, @risk_tolerance, @trust_baseline, @aggression, @patience,
        @owner_address, @current_agent_wallet, @is_staked, @staked_at, @total_rewards_claimed, @metadata_uri
      )
      ON CONFLICT(token_id) DO UPDATE SET
        name = excluded.name,
        archetype = excluded.archetype,
        risk_tolerance = excluded.risk_tolerance,
        trust_baseline = excluded.trust_baseline,
        aggression = excluded.aggression,
        patience = excluded.patience,
        owner_address = excluded.owner_address,
        current_agent_wallet = COALESCE(excluded.current_agent_wallet, characters.current_agent_wallet),
        is_staked = COALESCE(excluded.is_staked, characters.is_staked),
        staked_at = COALESCE(excluded.staked_at, characters.staked_at),
        total_rewards_claimed = COALESCE(excluded.total_rewards_claimed, characters.total_rewards_claimed),
        metadata_uri = COALESCE(excluded.metadata_uri, characters.metadata_uri)
    `);

    stmt.run({
      token_id: char.token_id,
      name: char.name,
      archetype: char.archetype,
      risk_tolerance: char.risk_tolerance ?? 50,
      trust_baseline: char.trust_baseline ?? 50,
      aggression: char.aggression ?? 50,
      patience: char.patience ?? 50,
      owner_address: char.owner_address,
      current_agent_wallet: char.current_agent_wallet ?? null,
      is_staked: char.is_staked ?? 0,
      staked_at: char.staked_at ?? null,
      total_rewards_claimed: char.total_rewards_claimed ?? '0',
      metadata_uri: char.metadata_uri ?? null,
    });
  }

  getCharacterByTokenId(tokenId: number): CharacterRecord | null {
    const stmt = this.db.prepare('SELECT * FROM characters WHERE token_id = ?');
    return (stmt.get(tokenId) as CharacterRecord) || null;
  }

  getAllCharacters(): CharacterRecord[] {
    const stmt = this.db.prepare('SELECT * FROM characters ORDER BY token_id ASC');
    return stmt.all() as CharacterRecord[];
  }

  updateStakeStatus(tokenId: number, isStaked: boolean, stakedAt: number | null): void {
    const stmt = this.db.prepare(`
      UPDATE characters
      SET is_staked = ?, staked_at = ?
      WHERE token_id = ?
    `);
    stmt.run(isStaked ? 1 : 0, stakedAt, tokenId);
  }

  addRewardsClaimed(tokenId: number, rewardsWei: string): void {
    const char = this.getCharacterByTokenId(tokenId);
    if (!char) return;

    const currentBig = BigInt(char.total_rewards_claimed || '0');
    const addBig = BigInt(rewardsWei || '0');
    const newTotal = (currentBig + addBig).toString();

    const stmt = this.db.prepare('UPDATE characters SET total_rewards_claimed = ? WHERE token_id = ?');
    stmt.run(newTotal, tokenId);
  }

  updateAgentWallet(tokenId: number, agentWallet: string | null): void {
    const stmt = this.db.prepare('UPDATE characters SET current_agent_wallet = ? WHERE token_id = ?');
    stmt.run(agentWallet, tokenId);
  }
}

export class SessionKeyRepository {
  constructor(private db: Database) {}

  insertSessionKey(key: Omit<SessionKeyRecord, 'id'>): void {
    const deactivateStmt = this.db.prepare(`
      UPDATE session_keys
      SET is_active = 0, revoked_at = ?
      WHERE token_id = ? AND is_active = 1
    `);
    deactivateStmt.run(Math.floor(Date.now() / 1000), key.token_id);

    const insertStmt = this.db.prepare(`
      INSERT INTO session_keys (
        token_id, wallet_address, policy_hash, policy_document, registered_at, expires_at, is_active
      ) VALUES (
        @token_id, @wallet_address, @policy_hash, @policy_document, @registered_at, @expires_at, 1
      )
    `);
    insertStmt.run(key);
  }

  getActiveSessionKey(tokenId: number): SessionKeyRecord | null {
    const stmt = this.db.prepare(`
      SELECT * FROM session_keys
      WHERE token_id = ? AND is_active = 1
      ORDER BY registered_at DESC
      LIMIT 1
    `);
    return (stmt.get(tokenId) as SessionKeyRecord) || null;
  }

  getSessionKeyByWallet(walletAddress: string): SessionKeyRecord | null {
    const stmt = this.db.prepare(`
      SELECT * FROM session_keys
      WHERE LOWER(wallet_address) = LOWER(?) AND is_active = 1
      LIMIT 1
    `);
    return (stmt.get(walletAddress) as SessionKeyRecord) || null;
  }

  revokeSessionKey(tokenId: number): void {
    const stmt = this.db.prepare(`
      UPDATE session_keys
      SET is_active = 0, revoked_at = ?
      WHERE token_id = ? AND is_active = 1
    `);
    stmt.run(Math.floor(Date.now() / 1000), tokenId);
  }

  getAllActiveSessionKeys(): SessionKeyRecord[] {
    const stmt = this.db.prepare('SELECT * FROM session_keys WHERE is_active = 1 ORDER BY token_id ASC');
    return stmt.all() as SessionKeyRecord[];
  }
}

export class TradeRepository {
  constructor(private db: Database) {}

  insertTrade(trade: TradeRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO trades (
        trade_id, proposer_token_id, target_token_id, proposer_wallet, target_wallet,
        proposer_owner, status, proposed_at, settled_at, sentiment_proposer, sentiment_target
      ) VALUES (
        @trade_id, @proposer_token_id, @target_token_id, @proposer_wallet, @target_wallet,
        @proposer_owner, @status, @proposed_at, @settled_at, @sentiment_proposer, @sentiment_target
      )
      ON CONFLICT(trade_id) DO UPDATE SET
        status = excluded.status,
        settled_at = excluded.settled_at,
        sentiment_proposer = excluded.sentiment_proposer,
        sentiment_target = excluded.sentiment_target
    `);
    stmt.run(trade);
  }

  getTradeById(tradeId: string): TradeRecord | null {
    const stmt = this.db.prepare('SELECT * FROM trades WHERE trade_id = ?');
    return (stmt.get(tradeId) as TradeRecord) || null;
  }

  updateTradeStatus(
    tradeId: string,
    status: TradeStatus,
    settledAt: number,
    sentimentProposer?: Sentiment,
    sentimentTarget?: Sentiment
  ): void {
    const stmt = this.db.prepare(`
      UPDATE trades
      SET status = ?, settled_at = ?, sentiment_proposer = COALESCE(?, sentiment_proposer), sentiment_target = COALESCE(?, sentiment_target)
      WHERE trade_id = ?
    `);
    stmt.run(status, settledAt, sentimentProposer || null, sentimentTarget || null, tradeId);
  }

  getOpenTradesForToken(tokenId: number): TradeRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM trades
      WHERE (proposer_token_id = ? OR target_token_id = ?) AND status = 'PROPOSED'
      ORDER BY proposed_at DESC
    `);
    return stmt.all(tokenId, tokenId) as TradeRecord[];
  }

  getAllOpenTrades(): TradeRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM trades
      WHERE status = 'PROPOSED'
      ORDER BY proposed_at DESC
    `);
    return stmt.all() as TradeRecord[];
  }

  getAllTrades(limit = 50): TradeRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM trades
      ORDER BY proposed_at DESC
      LIMIT ?
    `);
    return stmt.all(limit) as TradeRecord[];
  }

  countActiveTradesByProposer(tokenId: number): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM trades
      WHERE proposer_token_id = ? AND status = 'PROPOSED'
    `);
    const res = stmt.get(tokenId) as { count: number };
    return res?.count || 0;
  }
}

export class AgentMemoryRepository {
  constructor(private db: Database) {}

  insertMemory(memory: Omit<AgentMemoryRecord, 'id'>): void {
    const stmt = this.db.prepare(`
      INSERT INTO agent_memory (
        token_id, event_type, description, related_trade_id, decision_metadata, outcome, sentiment, timestamp
      ) VALUES (
        @token_id, @event_type, @description, @related_trade_id, @decision_metadata, @outcome, @sentiment, @timestamp
      )
    `);
    stmt.run({
      ...memory,
      related_trade_id: memory.related_trade_id ?? null,
      decision_metadata: memory.decision_metadata ?? null,
      outcome: memory.outcome ?? null,
    });
  }

  getMemoriesByTokenId(tokenId: number, limit = 20): AgentMemoryRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM agent_memory
      WHERE token_id = ?
      ORDER BY timestamp DESC, id DESC
      LIMIT ?
    `);
    return stmt.all(tokenId, limit) as AgentMemoryRecord[];
  }

  getAllRecentMemories(limit = 50): AgentMemoryRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM agent_memory
      ORDER BY timestamp DESC, id DESC
      LIMIT ?
    `);
    return stmt.all(limit) as AgentMemoryRecord[];
  }

  countMemoriesSince(tokenId: number, eventType: string, sinceTimestamp: number): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM agent_memory
      WHERE token_id = ? AND event_type = ? AND timestamp >= ?
    `);
    const res = stmt.get(tokenId, eventType, sinceTimestamp) as { count: number };
    return res?.count || 0;
  }
}

export class PolicyBlockRepository {
  constructor(private db: Database) {}

  insertBlock(block: Omit<PolicyBlockRecord, 'id'>): void {
    const stmt = this.db.prepare(`
      INSERT INTO policy_blocks (
        token_id, action_type, reason, details, timestamp
      ) VALUES (
        @token_id, @action_type, @reason, @details, @timestamp
      )
    `);
    stmt.run({
      ...block,
      details: block.details ?? null,
    });
  }

  countBlocksForToken(tokenId: number): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM policy_blocks
      WHERE token_id = ?
    `);
    const res = stmt.get(tokenId) as { count: number };
    return res?.count || 0;
  }

  getBlocksSummary(): Record<number, number> {
    const stmt = this.db.prepare(`
      SELECT token_id, COUNT(*) as count
      FROM policy_blocks
      GROUP BY token_id
    `);
    const rows = stmt.all() as { token_id: number; count: number }[];
    const summary: Record<number, number> = {};
    for (const row of rows) {
      summary[row.token_id] = row.count;
    }
    return summary;
  }

  getRecentBlocks(limit = 20): PolicyBlockRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM policy_blocks
      ORDER BY timestamp DESC, id DESC
      LIMIT ?
    `);
    return stmt.all(limit) as PolicyBlockRecord[];
  }
}
