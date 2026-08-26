# Phase 2: Backend Service Layer
### Autonomous NFT Character Agents — Implementation Planning

---

## What This Phase Is

Phase 2 builds the connective tissue between the on-chain contracts (Phase 1) and the AI agents (Phase 3). The backend has one job: be the only path through which anything touches the blockchain. Agents never speak to the blockchain directly — they speak to the backend. The backend verifies, validates, and then acts.

By the end of this phase, you should be able to trigger every contract action (stake, unstake, propose trade, accept trade) **from the backend alone**, and see those actions land on-chain. Agents are not involved yet. This phase proves the infrastructure works before any AI reasoning is layered on top.

---

## What You're Building (4 Components)

### 1. Event Listener Service

This service runs continuously, watching the blockchain for events emitted by the Phase 1 contracts. Every time something happens on-chain — a character is staked, a trade is proposed, a trade is settled — this listener catches the event and routes it to the rest of the system.

**What it watches for**:
- `CharacterMinted` from CharacterNFT
- `CharacterStaked` and `CharacterUnstaked` from StakingVault
- `TradeProposed`, `TradeSettled`, and `TradeCancelled` from TradeEscrow
- `AgentRegistered` and `AgentRevoked` from AgentRegistry

**What it does when it catches an event**:
- Updates the local state cache (the database) to reflect the new on-chain reality
- Pushes a notification to the relevant agent(s) that something happened they may want to react to

**Technology**: Use **ethers.js** to subscribe to contract events via a WebSocket provider. A WebSocket connection is essential here — polling the blockchain on a timer would be wasteful and add unnecessary latency between events and agent reactions. With WebSocket subscriptions, events arrive in near real-time.

**Why this matters for the demo**: This is what makes the system feel reactive and alive. An agent doesn't have to ask "did anything happen?" — it gets told. This is the same pattern a production game backend (like MetaSpace's real server) would use.

### 2. Action API

An internal HTTP API (REST-style) that agents call when they decide to do something. This is the enforcement gate — no agent can affect the blockchain without going through this API, and this API enforces all the safety rules before signing anything.

**Endpoints to build**:
- `POST /agents/:tokenId/stake` — agent requests to stake its character
- `POST /agents/:tokenId/unstake` — agent requests to unstake
- `POST /agents/:tokenId/proposeTrade` — agent proposes a trade with another character
- `POST /agents/:tokenId/respondTrade` — agent accepts or rejects an incoming trade proposal
- `GET /agents/:tokenId/status` — returns the agent's current on-chain state (staked/unstaked, pending proposals, reward balance)
- `GET /agents/:tokenId/memory` — returns the agent's memory log (for transparency and debugging)

**Design principle**: The API should be the **only** path to the blockchain. If agents could bypass it and call contracts directly, the entire safety model collapses. Every single action request passes through this layer before anything is signed.

**Technology**: Node.js with TypeScript, using Express or Fastify. All routes should be typed end-to-end.

### 3. Session Key / Policy Engine

This is the most architecturally important component of the entire project — the one that shows real security judgment, not just the ability to call blockchain functions.

**The problem it solves**: Agents need to sign transactions, which means they need a private key. But giving an agent an unrestricted private key is dangerous — it could stake every character, transfer NFTs, drain wallets, or do anything else the key permits. The policy engine exists to make that impossible.

**How it works**:

For each character agent, the backend generates a dedicated **session key** — a separate keypair that is not the main deployer key, not the NFT owner's key, and has no funds or permissions beyond what's explicitly granted. The policy engine then enforces three constraints on every action request before using that session key to sign anything:

- **Allowed actions check**: Does this character's current policy permit this type of action? A character whose policy only allows `stake` and `unstake` cannot call `proposeTrade`, even if an agent asks for it.
- **Spend limit check**: Would this action exceed the character's cumulative spend limit? If a character is allowed to stake at most 50 tokens total and has already staked 45, a request to stake 10 more is blocked.
- **Expiry check**: Has this session key expired? All session keys have a hard expiry timestamp. An expired key cannot sign anything, even for an otherwise-allowed action.

If any check fails, the request is **rejected and logged** — the agent is informed why, and nothing is sent to the blockchain. If all checks pass, the policy engine uses the session key to sign the transaction and broadcast it.

**Why this matters**: This demonstrates security judgment that most "blockchain + AI" projects completely skip. Anyone can write a script that calls a contract. Far fewer can explain why an autonomous agent should never hold an unrestricted key, and demonstrate a working scoped alternative. This is a headline talking point.

**Session key management**:
- Keys are generated programmatically by the backend on character registration
- Each key is funded with a small amount of test POL (enough to pay gas fees for the session duration)
- Keys are stored securely (encrypted at rest, even in a dev environment)
- Keys are registered on-chain in the AgentRegistry contract (from Phase 1)
- The human operator can revoke a session key instantly, both in the backend state and on-chain

### 4. State Cache (Local Database)

A local database that mirrors relevant on-chain state. Instead of hitting the blockchain every time an agent or the dashboard asks "is character #2 currently staked?", the backend reads from this fast local cache.

**What it stores**:
- Character records (token ID, name, archetype, traits, current stake status, reward balance estimate)
- Open trade proposals (trade ID, proposer, target, offered/requested assets, status, timestamps)
- Session key records (which wallet is the current session key for each character, policy details, expiry)
- Agent memory logs (one entry per agent decision — what happened, when, what the outcome was, sentiment tag)

**Technology**: PostgreSQL or SQLite. PostgreSQL is consistent with the builder's existing experience. SQLite is simpler for a single-developer demo. Either is fine — the choice is an infrastructure trade-off, not an architectural one.

**Consistency strategy**: The state cache is populated and updated by the Event Listener. An event fires on-chain → the listener catches it → the cache is updated to match. This means the cache is eventually consistent with the blockchain — which is the correct model. The blockchain is always the source of truth; the cache is just a performance layer on top of it.

---

## Technology Stack

| Component | Technology | Why |
|---|---|---|
| Runtime | Node.js + TypeScript | Explicitly required in MetaSpace job posting |
| Blockchain interaction | ethers.js v6 | Explicitly required in job posting; WebSocket support for event subscriptions |
| API framework | Fastify or Express | Standard Node.js API layer |
| Database | PostgreSQL | Consistent with builder's existing skills |
| Environment config | dotenv | Standard for secrets management |

---

## Architecture Decisions to Make

### WebSocket vs. HTTP polling for blockchain events

Always use WebSocket subscriptions for event listening in this project. Polling introduces latency and wastes RPC quota. WebSocket means events arrive in milliseconds of being confirmed. The difference is visible in a live demo.

### Where does the policy engine live?

The policy engine is a **middleware layer inside the Action API** — not a separate microservice, not a smart contract. It runs before any transaction is signed. This keeps it simple and auditable: you can read the policy enforcement logic in one place.

### Should agents talk directly to the blockchain?

No. Explicitly no. Agents call the Action API. The Action API calls the policy engine. Only the policy engine touches the session key and signs transactions. This separation is the entire safety architecture of the system. If agents bypassed the API, there would be no policy enforcement.

### Database schema key decisions

Every agent memory entry needs: character ID, timestamp, event type, decision details, outcome, and a simple sentiment tag (positive / neutral / negative). The sentiment tag is used in Phase 3 by the agent's reasoning step to bias future decisions — e.g., "my last three trades with Voss had positive outcomes, so I trust Voss more now."

---

## Data Flows to Implement

### Flow A: Backend-triggered staking (Phase 2 manual test)

Manually call the Action API's stake endpoint for character #0 (Kael). The policy engine checks: is staking in Kael's allowed actions? Is the amount within the spend limit? Has the session key expired? If all pass, the backend signs a `stake()` transaction using Kael's session key and sends it to the StakingVault contract. The event listener catches the resulting `CharacterStaked` event, updates the state cache, and logs it.

This entire flow should be testable **before Phase 3** using a simple HTTP client (curl, Postman, or a test script) to call the API. No agents needed to verify Phase 2.

### Flow B: Policy rejection logging

Manually call the stake endpoint with an amount that exceeds the spend limit. Confirm the API returns a rejection response with a clear reason message. Confirm the rejection is logged in the database. Confirm no transaction was sent to the blockchain.

### Flow C: Event-driven state cache update

Trigger any on-chain event (even manually via Polygonscan). Confirm the event listener catches it within a few seconds. Confirm the state cache row is updated correctly. This verifies the listener is working before agents depend on it.

---

## Testing Strategy

Unlike Phase 1 (which used Hardhat's testing framework), Phase 2 is a Node.js service and should be tested using a standard TypeScript test runner (Jest or Vitest).

**Unit tests to write**:
- Policy engine: allowed action → approved; disallowed action → rejected with reason
- Policy engine: within spend limit → approved; over spend limit → rejected
- Policy engine: valid session → approved; expired session → rejected
- State cache: event handler correctly updates the right database row
- Action API: correct HTTP response codes for each scenario (200 approve, 403 policy rejection, 404 unknown character)

**Integration tests**:
- Run against a local Hardhat node with the Phase 1 contracts deployed locally
- Call the stake endpoint → confirm a real local transaction was signed and sent → confirm the local contract state changed
- This gives fast, free integration test runs without touching the Amoy testnet

---

## Security Notes

- Session key private keys must never appear in logs. Log only the public wallet address.
- The Action API should not be exposed to the public internet. For this demo it's internal, but design it as if it will eventually need authentication.
- Every rejected action should be logged with the reason — both for debugging and because "the system logs what it blocked and why" is a strong demo talking point.
- Session key wallets should be funded with only the minimum amount of test POL needed for the demo session. No excess funds.

---

## Phase 2 Completion Criteria

Do not start Phase 3 until all of the following are true:

- [ ] Event listener is running and catching all contract events from Phase 1 contracts on Amoy
- [ ] State cache database is being populated correctly from events
- [ ] Action API is running and all endpoints respond correctly
- [ ] Policy engine correctly approves valid actions and rejects invalid ones (tested manually and via unit tests)
- [ ] Session keys generated, registered on-chain (AgentRegistry), and funded
- [ ] Full stake flow triggered via API — confirmed on Polygonscan, state cache updated
- [ ] Policy rejection confirmed — over-limit request blocked, nothing sent on-chain
- [ ] All unit tests passing
- [ ] Rejection logs visible and readable
