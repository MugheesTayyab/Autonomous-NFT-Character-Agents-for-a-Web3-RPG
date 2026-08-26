# Phase 2 — Detailed Implementation Plan
## Backend Service Layer: The Connective Tissue Between Chain and Agents

> **Who this document is for**: A software engineer beginning Phase 2 after Phase 1 is fully complete and verified. This document tells you exactly what to build, in what order, what decisions to make and why, how each component connects to the others, what to test and how, and what every completion criterion means in concrete terms. No code — only the thinking a skilled engineer needs to write the right code themselves.

---

## Part 1: The Right Mental Model Before Building Anything

Before writing a single route handler or database schema, you must internalize three things about this phase that will determine whether your architecture is correct or just functional.

**1. The backend is not a helper — it is the only path to the blockchain.**
Every single interaction with on-chain contracts flows through this service, and only through this service. Agents in Phase 3 will never call a contract directly. They will call the Action API, which will call the policy engine, which will decide whether to sign and broadcast a transaction. This is not a nice-to-have design choice — it is the fundamental safety guarantee of the entire system. If any component bypasses the Action API, the policy engine never runs, and you have no agent safety at all. Preserve this constraint fanatically.

**2. The event listener is not logging — it is the state synchronization mechanism.**
When an on-chain event arrives, the listener's job is to update the local state cache so that the rest of the system sees the new reality without ever hitting the blockchain directly. The event is not a log entry. It is a signal that the source of truth (the blockchain) has changed, and the cache must change to match. Every downstream component — the Action API, the agents in Phase 3, the dashboard in Phase 4 — reads from the cache, not the chain. If the listener fails or misses an event, the cache becomes stale and downstream components make decisions based on wrong data. The listener must be robust.

**3. The policy engine demonstrates engineering judgment that most blockchain + AI projects skip entirely.**
The easiest thing to do is give each agent the same private key that signed the deployment and let it do anything. That is not an autonomous agent system — it is a script. What separates this project from scripts is that agents operate within a defined, enforced, auditable permission boundary. The policy engine is what creates that boundary. When you explain this to a recruiter, the conversation about "session keys" and "policy enforcement" is the conversation they have not had with other candidates. Protect the complexity and clarity of this component.

---

## Part 2: Development Environment and Prerequisites

### 2.1 Workspace Structure Decision

The backend service lives in a `backend/` directory at the root of the monorepo, adjacent to the `contracts/` directory created in Phase 1. The two directories are siblings, not nested. This is important because the backend needs to import TypeChain-generated type definitions from the compiled contracts, and doing this cleanly requires a predictable relative path between the two directories.

The internal directory structure of `backend/` should separate concerns clearly from the start, before writing any feature code. Reorganizing after you have built functionality is painful — establish the structure early:

```
backend/
├── src/
│   ├── config/          ← All environment variable loading and validation
│   ├── blockchain/      ← All ethers.js interaction (listener + transaction sender)
│   ├── db/              ← Database connection, schema, query helpers
│   ├── api/             ← Fastify/Express routes, request validation
│   ├── policyEngine/    ← Middleware for permission enforcement
│   ├── services/        ← Thin orchestration layer tying components together
│   └── types/           ← Shared TypeScript types used across modules
├── test/
│   ├── unit/            ← Policy engine, state cache, API response tests
│   └── integration/     ← Tests against local Hardhat node
├── .env
├── .env.example
├── package.json
└── tsconfig.json
```

Separating `blockchain/`, `policyEngine/`, `api/`, and `db/` into distinct directories is not overengineering — it makes the system auditable. When a recruiter or reviewer reads the code, the folder names alone tell them that you understood the separation of concerns: the API layer does not know about key management, the policy engine does not know about HTTP, and the blockchain layer does not know about the database schema.

### 2.2 Technology Stack and Dependency Decisions

**Runtime**: Node.js with TypeScript. Enable strict mode in `tsconfig.json`. The project brief explicitly calls out TypeScript, and strict mode catches type errors on function arguments that are directly translated into transaction parameters — a category of error that can cause silent transaction failures or incorrect on-chain behavior.

**Blockchain interaction**: ethers.js v6. This is the version the Phase 1 contracts were compiled against via TypeChain. Use the same version to ensure the generated TypeScript contract bindings are compatible.

**API framework**: Fastify is the stronger choice over Express for this project for three reasons. First, Fastify has schema-based request validation built in using JSON Schema — you define the shape of valid request bodies and Fastify rejects malformed requests before your handler code even runs. Second, Fastify has better TypeScript integration out of the box. Third, it runs faster. If you are more comfortable with Express and the project timeline is tight, Express is acceptable — but note that you'll need to add a separate validation library (such as `zod`) to achieve the same request safety guarantees. Never trust raw unvalidated request bodies from agents, even in an internal API.

**Database**: SQLite for solo development and demo, using the `better-sqlite3` library which provides a synchronous, file-based embedded database. This is the correct choice because: the demo does not need concurrent write performance, there is no separate database server process to manage, the entire database is a single file that can be committed to the repository or reset instantly during development, and it removes a deployment dependency. If you have a strong preference for PostgreSQL, it is equally valid — the schema and query patterns are the same. Make the choice once and document it clearly in the README.

**Testing**: Jest with `ts-jest` for TypeScript test execution. Jest is the most widely used Node.js test runner, has excellent TypeScript support, and handles both unit and integration tests in the same framework.

**Environment config**: `dotenv` for loading secrets. Apply the same two-file pattern from Phase 1: a `.env` file (never committed) and a `.env.example` file (committed, showing all required variable names with no values).

**TypeChain bindings**: Import the contract type definitions generated during Phase 1's `npm run compile` step. These bindings give you type-safe contract interaction — calling a contract function with wrong argument types fails at compile time, not at runtime during a live demo. The import path will be a relative path from `backend/src/blockchain/` to `contracts/typechain-types/`.

### 2.3 Contract Address Configuration

After Phase 1 deployment, you have five contract addresses. These must be accessible to the backend. Store them in the `.env` file as named variables (`REWARD_TOKEN_ADDRESS`, `CHARACTER_NFT_ADDRESS`, `AGENT_REGISTRY_ADDRESS`, `STAKING_VAULT_ADDRESS`, `TRADE_ESCROW_ADDRESS`). Load them at startup in the configuration module and validate that all five are present and are valid Ethereum addresses (42-character strings starting with `0x`). If any is missing or malformed, the application should fail to start with a descriptive error message — not silently continue and fail at the first contract call.

### 2.4 Session Key Wallet Setup

Before building any code, create the five session-key wallets outside the running application. These are the wallets that will sign transactions on behalf of each character agent. The approach:

Generate five brand-new wallets using an ephemeral script (not committed) or the ethers.js wallet generation method, and record each wallet's address and private key securely in a local notes file. Do not reuse the deployer wallet for any agent. Do not use MetaMask-managed wallets — the backend needs direct private key access.

Fund each wallet with a small amount of test POL (0.1 POL is sufficient for dozens of transactions). Track funding from the same deployer wallet used in Phase 1. Keep the amounts minimal — unused test funds are not a concern, but establishing the principle of "minimum necessary balance" is important practice.

Register each session key in the `AgentRegistry` contract on-chain using the deployer wallet. Call `registerAgent(tokenId, sessionKeyAddress, policyHash, duration)` for each of the five characters. The `policyHash` is the keccak256 hash of a policy document string (define a consistent format, e.g., a JSON string encoding allowed actions and spend limits). The `duration` should be long enough to cover the full demo period — several days at minimum.

Store each session key's private key in the `.env` file under named variables (`AGENT_SESSION_KEY_0` through `AGENT_SESSION_KEY_4`). These private keys must never appear in log output. Log only the public wallet address.

---

## Part 3: Component 1 — Event Listener Service

### 3.1 Architecture and Connection Management

The event listener is a long-running, always-on process that subscribes to blockchain events using WebSocket. It is not a polling loop. It does not send HTTP requests to the blockchain on a timer. A WebSocket subscription means the blockchain node sends event data to the listener the moment a matching event is emitted and confirmed — the listener does not ask, it is told.

Create a dedicated `BlockchainListener` class in `backend/src/blockchain/`. This class is responsible for:
- Establishing and maintaining the WebSocket connection to the Alchemy (or Infura) endpoint.
- Attaching event listeners to each of the five deployed contracts.
- Handling WebSocket disconnection gracefully and reconnecting with exponential backoff.
- Routing incoming events to handler functions in the service layer.

The reconnection logic is important and often skipped in demo projects. WebSocket connections to blockchain nodes do drop — after a period of inactivity, after provider restarts, after network interruptions. If the listener does not reconnect automatically, it will silently stop receiving events and the cache will drift from the actual on-chain state. Implement a reconnect strategy: on disconnect, wait 2 seconds, try to reconnect, then 4 seconds, then 8, up to a max of 30 seconds per attempt. Log every disconnect and reconnect clearly.

### 3.2 Contract Instantiation for Listening

The listener needs contract instances with a WebSocket provider (not an HTTP provider). HTTP providers can call read functions and send transactions, but they cannot subscribe to events. Create a separate `wsProvider` using the WebSocket URL from your Alchemy account. Attach event listeners through contract instances created with this `wsProvider`.

Create a separate `httpProvider` and `httpSigner` for sending transactions (the Action API uses these). The two providers serve different roles and must not be swapped. Using an HTTP provider for event subscriptions will silently fail — the subscriptions appear to register but events never arrive.

### 3.3 Events to Subscribe to and What Each Handler Must Do

For each event, define the expected parameters, the database update operation, and what notification (if any) should be queued for the relevant agent.

**`CharacterMinted` from CharacterNFT**:
Parameters: tokenId, name, archetype, owner address.
Database operation: Upsert a row in the `characters` table with the token ID, name, archetype, owner address, and default values for stake status (unstaked), current agent wallet (null until registration), and reward balance (zero).
Agent notification: None — this event is handled at setup time, not during runtime agent operation.

**`AgentRegistered` from AgentRegistry**:
Parameters: tokenId, agentWallet, policyHash, expiresAt.
Database operation: Update the characters table row for this tokenId to record the current session key wallet address and expiry. Upsert a row in the `session_keys` table with all registration details.
Agent notification: None — this is an administrative event.

**`AgentRevoked` from AgentRegistry**:
Parameters: tokenId, agentWallet.
Database operation: Mark the session key as revoked in the `session_keys` table. Update the characters table to clear the current agent wallet address.
Agent notification: Log a revocation notice in the agent's memory log. This should surface visibly in Phase 4's dashboard.

**`CharacterStaked` from StakingVault**:
Parameters: tokenId, agentWallet, originalOwner, timestamp.
Database operation: Update the characters table row for this tokenId to set `isStaked = true`, record `stakedAt` timestamp, and record `originalOwner`.
Agent notification: Enqueue a "staked successfully" event for the relevant agent. The agent in Phase 3 will react to this to update its internal state.

**`CharacterUnstaked` from StakingVault**:
Parameters: tokenId, agentWallet, rewardsPaid, timestamp.
Database operation: Update the characters table to set `isStaked = false`, clear `stakedAt`, and add `rewardsPaid` to the running `totalRewardsClaimed` figure.
Agent notification: Enqueue an "unstaked" event for the relevant agent with the rewards amount.

**`TradeProposed` from TradeEscrow**:
Parameters: tradeId, proposerWallet, targetWallet, offeredTokenId, requestedTokenId, timestamp.
Database operation: Insert a new row in the `trades` table with status `PROPOSED` and all trade details. Resolve the target wallet's tokenId by querying the local `session_keys` table — do not call the chain for this.
Agent notification: Enqueue a "trade received" event for the agent associated with the target wallet. This event will be the trigger that causes the target agent in Phase 3 to evaluate and decide whether to accept or reject.

**`TradeSettled` from TradeEscrow**:
Parameters: tradeId, proposerOwner, receivedTokenId, targetOwner, deliveredTokenId, timestamp.
Database operation: Update the trades table row to status `SETTLED` and record the settlement timestamp.
Agent notification: Enqueue a "trade settled" event for both involved agents. The agent memory log entry for each should record whether they were the proposer or target, what was gained and lost, and tag the sentiment as `POSITIVE` (trades that complete are positive outcomes for both parties by definition).

**`TradeCancelled` from TradeEscrow**:
Parameters: tradeId, cancelledBy, timestamp.
Database operation: Update the trades table row to status `CANCELLED`.
Agent notification: Enqueue a "trade cancelled" event for both involved agents. Sentiment tag: `NEUTRAL` if the agent itself cancelled, `NEGATIVE` if the counterparty cancelled.

### 3.4 Startup Behavior — Sync Before Listening

When the listener starts, it faces a gap problem: if the application was not running when some events occurred (e.g., during a restart or outage), those events are lost. On startup, perform a one-time historical catch-up before activating real-time subscriptions:

Query the current on-chain state using view function calls (not event history) to confirm the database accurately reflects the current state of each character. Specifically: for each tokenId (0 through 4), call `characterNFT.getCharacter(tokenId)`, `stakingVault.getStakeInfo(tokenId)`, and `agentRegistry.getAgentRecord(tokenId)`. Compare the returned values to what the database says. If there is a discrepancy, the on-chain value wins — update the database. Log every discrepancy found during startup sync as a warning.

Only after the startup sync completes successfully should real-time event subscriptions be activated. This ensures the cache is accurate before agents start relying on it.

---

## Part 4: Component 2 — Database Schema Design

### 4.1 Schema Philosophy

The schema has exactly four tables. Resist the urge to add tables or columns speculatively — every column should have a named component that reads it. Each table maps directly to one of the four concepts the system tracks.

### 4.2 The `characters` Table

This is the primary lookup table. Every component that needs to know the current state of a character reads from here.

Columns and their purpose:
- `token_id` (INTEGER, PRIMARY KEY): The NFT token ID. Immutable identifier.
- `name` (TEXT): Character name (e.g., "Kael the Unbroken"). For display.
- `archetype` (TEXT): BERSERKER, STRATEGIST, SCAVENGER, DIPLOMAT, or HOARDER. For agent decision-making.
- `risk_tolerance`, `trust_baseline`, `aggression`, `patience` (INTEGER): On-chain personality traits, 0–100. These are read from the contract at startup sync and cached here. They do not change after minting.
- `owner_address` (TEXT): The human player's wallet address. Immutable after minting.
- `current_agent_wallet` (TEXT, nullable): The session key wallet currently registered for this token. Updated by `AgentRegistered` and `AgentRevoked` events.
- `is_staked` (INTEGER/BOOLEAN): Whether the character is currently staked. Updated by `CharacterStaked` and `CharacterUnstaked`.
- `staked_at` (INTEGER, nullable): Unix timestamp when staking began. Set on stake, cleared on unstake.
- `total_rewards_claimed` (INTEGER): Running total of MLRD reward tokens claimed. Incremented on each unstake event.

### 4.3 The `session_keys` Table

Tracks the lifecycle of each session key registration, including revocations.

Columns:
- `id` (INTEGER, PRIMARY KEY, AUTOINCREMENT)
- `token_id` (INTEGER): FK to characters table.
- `wallet_address` (TEXT): The session key's public address (never the private key).
- `policy_hash` (TEXT): The keccak256 hash registered on-chain, for verification.
- `policy_document` (TEXT): The raw JSON policy document whose hash is stored on-chain. Stored locally so the backend can parse allowed actions and spend limits without re-deriving from the hash.
- `registered_at` (INTEGER): Unix timestamp.
- `expires_at` (INTEGER): Unix timestamp when session key validity expires.
- `is_active` (INTEGER/BOOLEAN): True until revoked.
- `revoked_at` (INTEGER, nullable): Set when `AgentRevoked` event arrives.

The `policy_document` column is a critical design detail. The on-chain `policyHash` is the hash of this JSON string. The policy engine reads from this column to know what actions are allowed and what spend limits apply. Storing it locally avoids re-fetching it from the contract (which only stores the hash, not the document).

### 4.4 The `trades` Table

One row per trade, tracking all state transitions.

Columns:
- `trade_id` (TEXT, PRIMARY KEY): The `bytes32` trade ID emitted by the contract (stored as a hex string).
- `proposer_token_id` (INTEGER)
- `target_token_id` (INTEGER)
- `proposer_wallet` (TEXT): Session key wallet of the proposer.
- `target_wallet` (TEXT): Session key wallet of the target.
- `proposer_owner` (TEXT): Human player address of the proposer (for audit).
- `status` (TEXT): One of `PROPOSED`, `SETTLED`, `CANCELLED`.
- `proposed_at` (INTEGER): Unix timestamp.
- `settled_at` (INTEGER, nullable): Set when SETTLED or CANCELLED.
- `sentiment_proposer` (TEXT, nullable): `POSITIVE`, `NEUTRAL`, or `NEGATIVE`. Set on settlement.
- `sentiment_target` (TEXT, nullable): Set on settlement.

### 4.5 The `agent_memory` Table

One row per significant agent decision or event. This is the memory store that agents in Phase 3 query to bias their future decisions. It is also the primary evidence of autonomous behavior visible in Phase 4's dashboard.

Columns:
- `id` (INTEGER, PRIMARY KEY, AUTOINCREMENT)
- `token_id` (INTEGER): Which character this memory belongs to.
- `event_type` (TEXT): One of a defined enum: `STAKED`, `UNSTAKED`, `TRADE_PROPOSED`, `TRADE_RECEIVED`, `TRADE_ACCEPTED`, `TRADE_REJECTED`, `TRADE_SETTLED`, `TRADE_CANCELLED`, `POLICY_REJECTED`, `SESSION_EXPIRED`, `SESSION_REVOKED`.
- `description` (TEXT): A human-readable sentence describing what happened. This is what appears in the Phase 4 dashboard's live log feed.
- `related_trade_id` (TEXT, nullable): FK to trades table, if applicable.
- `decision_metadata` (TEXT): JSON blob with decision-specific data (e.g., for a trade acceptance, the trait scores considered; for a policy rejection, the reason string).
- `outcome` (TEXT): What actually happened as a result.
- `sentiment` (TEXT): `POSITIVE`, `NEUTRAL`, or `NEGATIVE`.
- `timestamp` (INTEGER): Unix timestamp.

The `description` and `decision_metadata` columns will be written by Phase 3 agent logic, but the table and columns must be designed now so that the backend is ready to receive them.

---

## Part 5: Component 3 — Policy Engine

### 5.1 Policy Document Structure

Every session key has an associated policy document stored in the `session_keys` table. Define a consistent JSON structure for this document. A good minimal structure:

The document has three top-level keys: `allowedActions` (an array of strings naming the action types the agent may take — e.g., `["stake", "unstake", "proposeTrade", "respondTrade"]`), `spendLimits` (an object mapping limit types to numeric thresholds — e.g., a max number of active trade proposals at one time, or a max number of stake/unstake cycles per session), and `version` (a string identifying the policy schema version, used to handle future policy format evolution).

Characters with restrictive archetypes should have restrictive policies. Nyx the Hoarder, for example, might have a policy that excludes `proposeTrade` from `allowedActions` — Nyx never proposes a trade. Kael the Berserker might have a high `maxTradeProposals` spend limit. These policy differences are what make the characters behaviorally distinct at the infrastructure level, before the agent's AI reasoning even adds another layer of differentiation.

### 5.2 The Three Checks — Detailed Logic

**Check 1 — Action Allowed**:
Extract the action type string from the incoming API request. Query the `session_keys` table to get the active policy document for the requesting character's token ID. Parse the JSON. Check whether the action type string appears in the `allowedActions` array. If it does not appear, return a rejection object with reason `"ACTION_NOT_PERMITTED"` and the specific action type that was blocked.

This check is intentionally simple — it is a list lookup, not a complex rule evaluation. The complexity of agent behavior comes from the AI reasoning layer above, not from the policy engine below. The policy engine enforces hard limits; the agent decides within those limits.

**Check 2 — Spend Limit**:
Each action type that involves resource consumption has an associated spend limit check. For `stake` actions, query the `agent_memory` table to count how many stake events this character has had in the current session (since the session key's `registered_at` timestamp). Compare to the policy's `maxStakeCycles` limit. For `proposeTrade`, count open (PROPOSED status) trades in the `trades` table for this character. Compare to `maxActiveTrades`. For `respondTrade`, no spend limit applies — responding to a trade is never consumption-capped (you can always accept or reject what others propose).

Return a rejection with reason `"SPEND_LIMIT_EXCEEDED"` and include the current count, the limit, and which limit was triggered.

**Check 3 — Session Expiry**:
Read the `expires_at` value from the `session_keys` table for this character. Compare to `Date.now() / 1000` (current Unix timestamp in seconds). If the session has expired, return a rejection with reason `"SESSION_EXPIRED"`. Also cross-reference this against the on-chain `isAuthorizedAgent()` return value for belt-and-suspenders verification — if on-chain says expired but local DB says active (or vice versa), log a warning about cache inconsistency and trust the on-chain value.

### 5.3 The Policy Engine as Middleware

In the Fastify application, implement the policy engine as a pre-handler hook attached to all action routes (not read-only routes like `/status` or `/memory`). The hook receives the decoded request, extracts the `tokenId` from the route parameters, runs all three checks in order, and either calls `reply.send()` with a rejection response (stopping the request chain) or calls `done()` to allow the request to proceed to the route handler.

This middleware pattern means policy enforcement is structurally guaranteed for every action route — you cannot write a new action route and accidentally forget to add policy checks, because the hook is attached to all action routes by route prefix, not individually.

### 5.4 Logging Rejections

Every policy rejection must be written to the `agent_memory` table with `event_type = "POLICY_REJECTED"`, the `decision_metadata` JSON containing the reason and the specific values that failed the check, and `sentiment = "NEUTRAL"` (rejections are expected system behavior, not failures). This logging is both a debugging tool during development and a Phase 4 dashboard feature — the live log should show when and why an agent was blocked.

---

## Part 6: Component 4 — Action API Routes

### 6.1 Route Design Principles

All action routes return a consistent JSON response structure with at minimum: `success` (boolean), `tokenId` (number), `action` (string naming the action type), `transactionHash` (string, present on success), and `reason` (string, present on rejection). This consistency makes it easy to write Phase 3 agent code that handles API responses uniformly regardless of the action type.

All routes should validate their inputs before reaching the policy engine. For a `proposeTrade` request, validate that `targetTokenId` is a number, that it is not the same as `tokenId` (a character cannot trade with itself), and that both tokens exist in the characters table. Do not let malformed requests reach the policy engine or the blockchain layer.

### 6.2 `POST /agents/:tokenId/stake`

Handler logic after policy engine approval:
Load the session key's private key from environment variables (by token ID). Create an ethers.js `Wallet` instance using the private key and the HTTP provider. Get the current gas price estimate. Build and send a transaction calling `stakingVault.stake(tokenId)`. Wait for the transaction receipt. On success, return the transaction hash in the response body. On transaction revert, parse the revert reason from the error (ethers.js exposes this) and return a 500 response with the revert reason.

Note a critical prerequisite: the NFT owner must have approved the StakingVault to transfer their token before this call can succeed. During Phase 2, this approval is handled as a one-time setup step by the operator (run a setup script as the NFT owner that calls `characterNFT.approve(stakingVaultAddress, tokenId)` for all five characters). In a production system, this would be handled through the game frontend's wallet integration.

### 6.3 `POST /agents/:tokenId/unstake`

Symmetric to stake. After policy approval, load session key, build the `stakingVault.unstake(tokenId)` transaction, send it, return receipt. Log the resulting `CharacterUnstaked` event data (which the event listener will also catch and write to the database).

### 6.4 `POST /agents/:tokenId/proposeTrade`

Request body: `{ targetTokenId: number }`.
After policy approval: resolve the target character's current session key wallet address from the `session_keys` table (the contract needs the session key wallet address, not the token ID, as the `targetWallet` parameter). Call `tradeEscrow.proposeTrade(offeredTokenId, requestedTokenId, targetWallet)`. Return the trade ID from the transaction receipt's event log. The trade ID is extracted by parsing the `TradeProposed` event from the transaction receipt — it is not returned by the function's return value directly.

Prerequisite: the NFT owner must have approved the TradeEscrow to transfer their token. Handle this in the same operator setup script as the staking approval.

### 6.5 `POST /agents/:tokenId/respondTrade`

Request body: `{ tradeId: string, response: "accept" | "reject" }`.
After policy approval: if `response === "accept"`, call `tradeEscrow.acceptTrade(tradeId)`. If `response === "reject"`, call `tradeEscrow.cancelTrade(tradeId)`. Return the transaction hash. This endpoint will be called by agents in Phase 3 when they evaluate an incoming trade proposal and decide to respond.

The reject path (calling `cancelTrade`) requires that the calling wallet be either the proposer or target of the trade. Since this endpoint is only called by the target agent's session key (which is validated by the policy engine via the tokenId), and targets can cancel, this always works. Validate that the trade ID exists in the local `trades` table and is in `PROPOSED` status before sending anything on-chain.

### 6.6 `GET /agents/:tokenId/status`

Read-only. No policy check needed.
Return a JSON object combining data from the `characters` table row, the active `session_keys` row, any open trade proposals involving this token ID from the `trades` table, and the pending reward estimate. For the pending reward estimate: if `is_staked` is true, calculate the estimate using the formula `(currentTimestamp - stakedAt) * REWARD_RATE` where `REWARD_RATE` is the constant value from the StakingVault contract (115740740740740 wei per second). Do not call the contract for this — use the local cache and the known formula. This keeps the endpoint fast.

### 6.7 `GET /agents/:tokenId/memory`

Read-only. Returns the most recent N entries from the `agent_memory` table for this `token_id`, ordered by timestamp descending. Accept a `?limit=` query parameter (default 20, max 100). This endpoint is what Phase 4's dashboard will poll to populate the live decision log feed for each character.

---

## Part 7: Transaction Sending — Detailed Design

### 7.1 Nonce Management

When multiple transactions are sent for the same agent wallet in quick succession (which can happen during Phase 4 demo), nonce collisions cause transactions to fail. The nonce for an Ethereum address must increment by exactly 1 with each transaction, and if two transactions are sent with the same nonce, only one will be accepted.

Implement a per-wallet nonce tracker. On startup, fetch the current on-chain nonce for each session key wallet using `provider.getTransactionCount(walletAddress)`. Store this in memory. When preparing a transaction, use and increment the in-memory nonce. If a transaction fails due to a nonce error, re-fetch the nonce from the chain and reset the tracker.

For a demo with five agents acting somewhat independently, this in-memory tracker is sufficient. Do not implement a database-backed nonce queue unless you observe actual nonce collision failures during testing.

### 7.2 Gas Estimation and Fee Strategy

Use `provider.getFeeData()` to get current gas prices before each transaction. Apply a 20% buffer to the `maxFeePerGas` estimate — this prevents transactions from hanging indefinitely due to gas price spikes on Polygon Amoy. Set `gasLimit` using `contract.stake.estimateGas(tokenId)` (ethers.js's built-in estimation) plus a 15% buffer. Never hardcode gas values.

### 7.3 Transaction Receipt Waiting and Timeout

After sending a transaction, call `.wait(1)` on the returned transaction response to wait for one block confirmation. Apply a timeout of 60 seconds — if the transaction is not confirmed within 60 seconds on Amoy, log it as potentially lost and return a 504 (Gateway Timeout) response to the caller. Do not wait indefinitely. Do not assume all transactions confirm within seconds on a public testnet.

---

## Part 8: Testing Plan — Detailed

### 8.1 Unit Test: Policy Engine

These tests should run entirely in memory — no database connection, no network calls, no contract dependencies. Pass mock policy documents and mock request data directly to the policy engine functions.

Test case: valid action in allowedActions list → expect approved result.
Test case: action not in allowedActions list → expect rejected result with `reason = "ACTION_NOT_PERMITTED"`.
Test case: action at spend limit → expect rejected result with `reason = "SPEND_LIMIT_EXCEEDED"` and correct current/limit values in the error data.
Test case: action under spend limit → expect approved result.
Test case: session key expires_at in the future → expect approved result.
Test case: session key expires_at in the past → expect rejected result with `reason = "SESSION_EXPIRED"`.

Write one test per case, named descriptively. These tests are fast (< 1ms each) and should pass in under a second total. They are the first tests you run before any integration tests.

### 8.2 Unit Test: State Cache Event Handlers

Test each event handler function in isolation, passing a mock event object and a mock database interface. Verify that the correct database operation (update, insert, delete) is called with the correct values derived from the event data.

Test case: `CharacterStaked` event → characters table updated with `isStaked = true` and correct `stakedAt`.
Test case: `CharacterUnstaked` event → characters table updated with `isStaked = false` and `totalRewardsClaimed` incremented.
Test case: `TradeProposed` event → trades table row inserted with correct status and all fields.
Test case: `AgentRevoked` event → session_keys row marked inactive and characters row cleared.

### 8.3 Unit Test: API Response Codes

Using Fastify's `inject` method (which sends fake HTTP requests without starting a real server), test that each route returns the correct HTTP status code for each scenario:

- Valid action for authorized agent → 200 with `success: true` and transaction hash.
- Policy rejection (action not permitted) → 403 with `success: false` and reason.
- Unknown tokenId (character not in database) → 404 with descriptive message.
- Malformed request body (missing required field) → 400 with validation error message.

### 8.4 Integration Test: Full Stake Flow Against Local Hardhat Node

Start a local Hardhat node with the Phase 1 contracts deployed via Ignition. Run the backend service configured to point at this local node. Register a session key for token 0. Then call `POST /agents/0/stake` via a real HTTP request and verify:
- The response contains a transaction hash.
- The on-chain `stakingVault.stakes(0)` shows `stakedAt > 0` (the character is staked).
- The local database shows `is_staked = true` for token 0.
- The `agent_memory` table has a new `STAKED` event entry for token 0.

This integration test proves the end-to-end flow works without touching the Amoy testnet. Run it as part of `npm test` but clearly mark it as an integration test that requires a local node to be running.

### 8.5 Integration Test: Policy Rejection Flow

With the integration setup above, call `POST /agents/0/proposeTrade` with a `targetTokenId` for a character whose agent wallet address is registered. Repeat the call until the spend limit is exceeded. Verify the last call returns a 403 rejection. Verify the `agent_memory` table has a `POLICY_REJECTED` entry. Verify `tradeEscrow.getTrade()` on the local node shows no trade was created.

---

## Part 9: Operator Setup Script — One-Time Deployment Steps

The operator setup script is a one-time script run by the deployer/operator before Phase 3 begins. It is not a test and not a runtime service. It handles all the permissions and approvals that Phase 3 agents will need to already be in place when they start operating. The script should:

Step 1 — Approve StakingVault for all characters: For each of the five characters (token IDs 0–4), call `characterNFT.approve(stakingVaultAddress, tokenId)` signed by the NFT owner's wallet (the deployer wallet, since the deployer minted all characters to itself in Phase 1).

Step 2 — Approve TradeEscrow for all characters: For each character, call `characterNFT.approve(tradeEscrowAddress, tokenId)`.

Note: a single `characterNFT.setApprovalForAll(stakingVaultAddress, true)` call and a second `setApprovalForAll(tradeEscrowAddress, true)` call would grant approval for all tokens with two transactions instead of ten. This is a valid optimization for the operator setup script — understand the difference between `approve` (single token) and `setApprovalForAll` (all tokens by this owner to this operator).

Step 3 — Register session keys on-chain: For each character, call `agentRegistry.registerAgent(tokenId, sessionKeyWalletAddress, policyHash, durationInSeconds)` signed by the deployer.

Step 4 — Link agent wallets in CharacterNFT: For each character, call `characterNFT.linkAgentWallet(tokenId, sessionKeyWalletAddress)` signed by the deployer.

Step 5 — Verify setup: After all transactions are confirmed, query `agentRegistry.isAuthorizedAgent(sessionKeyAddress)` for each of the five session keys and confirm all return `true`.

---

## Part 10: Security and Operational Notes

### 10.1 Private Key Security

Session key private keys loaded from environment variables must be accessed exactly once during startup, used to create ethers.js `Wallet` instances, and then the raw private key string should be discarded from memory (set to an empty string or undefined). The `Wallet` instances are kept in memory as part of a private map inside the blockchain service class. Expose only the wallet's public address through any interface — never the key itself.

In a production system, private keys would be stored in a hardware security module (HSM) or a managed secret service (AWS Secrets Manager, HashiCorp Vault). For this demo, environment variables are acceptable with one explicit acknowledgment: the `.env` file is the attack surface. Keep it off cloud storage, off shared drives, and never paste its contents into Slack, GitHub issues, or documentation.

### 10.2 Logging Guidelines

Use structured logging (JSON log lines, not `console.log` strings) throughout the backend. Each log entry should include: timestamp, log level (INFO, WARN, ERROR), component name (LISTENER, API, POLICY, DB), event type (for listener logs), and the public wallet address (never the private key) for any agent-related log entry.

Log the following at INFO level: every event caught by the listener, every API request received, every transaction sent (with transaction hash), every policy check pass, every database write.
Log the following at WARN level: any reconnect attempt by the WebSocket listener, any cache inconsistency found during startup sync, any transaction that takes more than 30 seconds to confirm.
Log the following at ERROR level: any uncaught exception, any database write failure, any transaction that fails with a revert error.

### 10.3 API Design for Security

The Action API should be treated as an internal service even though it is accessed by agents running on the same machine. Do not expose it on a public network interface — bind to `localhost` (127.0.0.1), not `0.0.0.0`. Add a request source check: any request not originating from localhost is rejected immediately. This prevents a scenario where a vulnerability in the agent code allows external callers to call the API.

---

## Part 11: Phase 2 Completion Criteria — Detailed Checklist

### Event Listener
- [ ] WebSocket connection established to Alchemy (or Infura) Amoy endpoint on service startup
- [ ] All 8 event types subscribed and confirmed (log output shows subscription confirmations)
- [ ] Startup sync completes without cache inconsistency warnings for all 5 characters
- [ ] Reconnect logic tested: kill and restart the WebSocket connection manually, confirm the listener reconnects and resumes catching events
- [ ] `CharacterStaked` event caught and `characters.is_staked` updated in database — verified by querying the DB after a manual stake transaction
- [ ] `TradeProposed` event caught and `trades` row inserted — verified by querying the DB after a manual trade proposal
- [ ] All 8 event types produce corresponding `agent_memory` log entries

### Database
- [ ] Schema created with all 4 tables and all columns as specified
- [ ] Startup sync populates correct initial state for all 5 characters from on-chain data
- [ ] All event handler database writes confirmed correct via SELECT queries after triggering each event
- [ ] `policy_document` column populated for all 5 session keys with valid JSON matching the registered policy hash

### Action API
- [ ] All 6 routes registered and responding (test with curl or Postman against locally running service)
- [ ] Input validation rejecting malformed requests with 400 responses
- [ ] 404 response for unknown tokenId on all action routes
- [ ] Consistent JSON response structure on all routes

### Policy Engine
- [ ] All unit tests passing (action check, spend limit check, session expiry check — all pass and fail cases)
- [ ] Policy rejection logging confirmed: rejected action appears in `agent_memory` table
- [ ] Policy rejection API response: rejected action returns 403 with reason string
- [ ] No transaction sent on-chain for any rejected action — confirmed by checking `tradeEscrow.getTrade()` or `stakingVault.getStakeInfo()` before and after a rejected call

### Session Keys
- [ ] All 5 session key wallets generated and funded with test POL
- [ ] All 5 session keys registered on-chain in AgentRegistry (verified via `agentRegistry.isAuthorizedAgent()` returning true for each)
- [ ] All 5 session keys' `policy_document` stored in database and hashes matching on-chain `policyHash`
- [ ] Private keys accessible from `.env` and never appearing in log output

### End-to-End Manual Verification
- [ ] **Flow A**: Call `POST /agents/0/stake` → confirm 200 response with transaction hash → confirm on-chain `stakingVault.stakes(0).stakedAt > 0` → confirm `characters.is_staked = true` in database → confirm `agent_memory` has STAKED entry
- [ ] **Flow B**: Call `POST /agents/0/proposeTrade` with `targetTokenId: 1` → confirm 200 response → confirm on-chain `tradeEscrow.trades[tradeId].status = PROPOSED` → confirm trades row in database → call `POST /agents/1/respondTrade` with `response: "accept"` → confirm TradeSettled event in database → confirm NFT ownership swapped on-chain
- [ ] **Flow C**: Trigger spend limit rejection → confirm 403 response → confirm `agent_memory` has POLICY_REJECTED entry → confirm no on-chain transaction

### Integration Tests
- [ ] Full stake flow integration test passing against local Hardhat node
- [ ] Policy rejection integration test passing
- [ ] All unit tests passing

**Phase 2 is complete when every item above is checked. Phase 3 does not begin until then.**
