export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS characters (
  token_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  archetype TEXT NOT NULL,
  risk_tolerance INTEGER NOT NULL,
  trust_baseline INTEGER NOT NULL,
  aggression INTEGER NOT NULL,
  patience INTEGER NOT NULL,
  owner_address TEXT NOT NULL,
  current_agent_wallet TEXT,
  is_staked INTEGER DEFAULT 0,
  staked_at INTEGER,
  total_rewards_claimed TEXT DEFAULT '0',
  metadata_uri TEXT
);

CREATE TABLE IF NOT EXISTS session_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id INTEGER NOT NULL,
  wallet_address TEXT NOT NULL,
  policy_hash TEXT NOT NULL,
  policy_document TEXT NOT NULL,
  registered_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  is_active INTEGER DEFAULT 1,
  revoked_at INTEGER,
  FOREIGN KEY (token_id) REFERENCES characters (token_id)
);

CREATE TABLE IF NOT EXISTS trades (
  trade_id TEXT PRIMARY KEY,
  proposer_token_id INTEGER NOT NULL,
  target_token_id INTEGER NOT NULL,
  proposer_wallet TEXT NOT NULL,
  target_wallet TEXT NOT NULL,
  proposer_owner TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PROPOSED', 'SETTLED', 'CANCELLED')),
  proposed_at INTEGER NOT NULL,
  settled_at INTEGER,
  sentiment_proposer TEXT CHECK (sentiment_proposer IN ('POSITIVE', 'NEUTRAL', 'NEGATIVE', NULL)),
  sentiment_target TEXT CHECK (sentiment_target IN ('POSITIVE', 'NEUTRAL', 'NEGATIVE', NULL))
);

CREATE TABLE IF NOT EXISTS agent_memory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  description TEXT NOT NULL,
  related_trade_id TEXT,
  decision_metadata TEXT,
  outcome TEXT,
  sentiment TEXT NOT NULL CHECK (sentiment IN ('POSITIVE', 'NEUTRAL', 'NEGATIVE')),
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (token_id) REFERENCES characters (token_id)
);

CREATE TABLE IF NOT EXISTS policy_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id INTEGER NOT NULL,
  action_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (token_id) REFERENCES characters (token_id)
);

CREATE INDEX IF NOT EXISTS idx_characters_agent_wallet ON characters (current_agent_wallet);
CREATE INDEX IF NOT EXISTS idx_session_keys_token ON session_keys (token_id, is_active);
CREATE INDEX IF NOT EXISTS idx_session_keys_wallet ON session_keys (wallet_address);
CREATE INDEX IF NOT EXISTS idx_trades_proposer ON trades (proposer_token_id, status);
CREATE INDEX IF NOT EXISTS idx_trades_target ON trades (target_token_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_memory_token ON agent_memory (token_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_policy_blocks_token ON policy_blocks (token_id, timestamp DESC);
`;
