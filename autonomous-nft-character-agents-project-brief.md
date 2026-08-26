# Autonomous NFT Character Agents for a Web3 RPG
## Full Project Brief for Implementation Planning

---

## 0. Purpose of This Document

This document is a complete conceptual and technical brief for a single project: **Autonomous NFT Character Agents**. It exists so that an implementation planner (human or AI) can turn it into a concrete, sequenced build plan without needing any outside context.

This file does not contain a day-by-day schedule. It contains everything the plan needs to be built from: the problem, the target company context, the architecture, every component, every data model, every flow, every risk, and every success criterion. The planner's job is to take these pieces and sequence them into phases, tasks, and milestones.

Read this top to bottom before planning. Sections build on each other.

---

## 1. Executive Summary

The builder (a Computer Science undergraduate specializing in AI engineering, with existing experience building multi-agent systems using LangGraph) is applying for a Blockchain Engineer role at MetaSpace, a company that builds a Web3 mobile RPG on the Polygon blockchain. The builder has no prior blockchain development experience.

To stand out in the application process, the builder will build a demonstration project called **Autonomous NFT Character Agents**: a small system in which NFT-based game characters are not static collectibles, but are each backed by an autonomous AI agent that can independently stake itself for rewards, react to simulated in-game events, and negotiate trades with other character-agents, all while touching a real blockchain (a free public test network) through real smart contracts.

The project is designed to prove, in one working demo, that the builder can do the exact job MetaSpace is hiring for: write and deploy smart contracts, integrate wallets, listen to and act on blockchain transactions, and connect all of that to a backend, while also demonstrating a skill MetaSpace does not currently have on staff: multi-agent AI orchestration.

---

## 2. Background: Who This Is For

### 2.1 The Company

MetaSpace is a real, currently operating company (offices in Dubai, UAE and Noida, India) that builds a mobile Web3 RPG called MetaSpace. Key facts the planner should treat as fixed context:

- The game is a space-adventure RPG. The player character, Todd, is a rebel soldier who crash-lands on a hostile planet and ends up leading a resistance.
- The game has Story Mode (single-player missions) and Arena Mode (PvP battles).
- The game world is divided into four "planets" or zones: Barr3n X-11, Cry O-Hail, KT 88, and Traders Belt.
- The game features a small cast of named commander characters, each with a distinct personality and backstory (a rebel leader, a fiery outsider, a mysterious wanderer, an elite soldier, a musician-rebel). These characters, along with weapons (launchers, assault rifles, LMGs, snipers, melee gear), are minted as NFTs.
- Every NFT (character or weapon) is fully owned by the player: it can be traded, sold, or staked in a decentralized marketplace for passive token rewards.
- The game runs two tokens: $LORD (earned through gameplay) and $MLD (a separate token, buyable).
- The game is built on the Polygon blockchain (a low-fee, Ethereum-compatible network popular specifically for game developers because of its speed and low transaction costs).
- Onboarding is deliberately frictionless: signing up with email, Google, or Facebook auto-creates a crypto wallet behind the scenes, so a player never has to manually set up MetaMask or manage a seed phrase to start playing.
- The company has a public roadmap mentioning a DAO (decentralized governance, where token holders vote on decisions) as a future direction.
- The company is actively hiring Blockchain Engineers with skills in: Solidity, EVM-compatible networks, Polygon/Ethereum specifically, Node.js/TypeScript, ethers.js/Web3.js, API design, databases, and backend architecture. They specifically called out that a candidate's prior use of blockchain/Web3 payments (MetaMask integration) was what caught their attention.

### 2.2 The Builder's Existing Background (context for the planner)

The planner should account for the following existing skills and not plan work that duplicates what the builder already knows:

- Strong in Python, JavaScript, Java, C++.
- Experienced with LangGraph and LangChain for building multi-agent systems, including a self-correcting proofreader agent (OutreachNode.ai), a self-healing multi-agent coding assistant with LLM-as-Judge evaluation (AgentEval, considered the builder's strongest prior project), and a multi-agent LangGraph research assistant (Aetheris).
- Comfortable with FastAPI, Next.js, PostgreSQL, and Docker for backend/web work.
- No prior experience with Solidity, smart contracts, wallets, or any blockchain-specific tooling. This is a genuinely new skill area and should be planned for accordingly (expect a real learning curve on Solidity syntax, gas mechanics, and contract security patterns, even though the overall system design is within the builder's existing capability).

### 2.3 Why This Specific Project Was Chosen

Three project ideas were evaluated against MetaSpace's hiring needs and current (2026) trends in the blockchain-AI space. This project was chosen because:

- It mirrors MetaSpace's actual product almost exactly. MetaSpace already has named NFT characters with personalities. This project takes that exact concept and makes it autonomous, so the demo is immediately legible to a MetaSpace reviewer without needing much explanation.
- It touches every skill listed in MetaSpace's job posting: Solidity, EVM/Polygon, Node.js/TypeScript, ethers.js/Web3.js, wallet integration, backend architecture.
- It showcases a skill MetaSpace's existing team likely does not have deep experience in: multi-agent AI orchestration. This is the builder's genuine strength and differentiates the application from other blockchain-only candidates.
- It aligns with the single biggest current trend at the intersection of AI and blockchain: autonomous agents that hold and operate their own wallets under strict, limited permissions (an area seeing major industry investment and standardization in 2026, including new agent-identity standards and safer permission models for letting AI touch real assets).
- It is scoped small enough to actually finish (a handful of working character-agents on a free test network) while still being a complete, end-to-end system rather than a toy script.

---

## 3. Problem Statement

Today, in games like MetaSpace, an NFT character is inert. It is a picture and a set of stats sitting in a wallet. All value comes from a human deciding to stake it, trade it, or use it in a battle. The character itself has no agency.

This project asks: **what if the character could act on its own, within limits set by its owner?**

Specifically, this project builds a small proof-of-concept world where:

1. Each character is represented on-chain as an NFT with on-chain identity (not just artwork/metadata, but a record that says "this token is an agent, and here is its wallet and its behavior profile").
2. Each character has an AI agent "brain" that can observe events (both real on-chain events and simulated in-game events) and decide what to do.
3. Each character can take real, limited financial actions on its own: stake itself into a rewards pool, or propose/accept a trade with another character, without a human clicking "confirm" on every single action.
4. None of this is possible without solving the actual hard problem in this space right now: how do you let an AI safely control a wallet without handing it a permanent private key that could be stolen, leaked, or misused? This project solves that with session keys (explained in detail in Section 8).

---

## 4. Goals

### 4.1 Primary Goals (must be true for the project to be considered successful)

- A character NFT can be minted on a public test network and viewed on a block explorer.
- A character NFT can independently decide, via its AI agent, to stake itself into a staking contract, and this decision and the resulting transaction are visible on-chain.
- Two character NFTs' agents can negotiate a trade with each other (propose, counter, accept/reject) and settle that trade through a smart contract escrow, without a human manually approving each transaction step.
- No agent ever holds a permanent, unrestricted private key. All agent actions go through a scoped, time-limited, spend-limited permission (a session key).
- There is a visible way (a simple dashboard, terminal log, or similar) to watch the agents thinking and acting in close to real time, so this can be demoed live.

### 4.2 Secondary Goals (valuable but not required for the project to be "done")

- Agents have a simple persistent memory (e.g., "I traded with Agent B last week and it went well, I trust Agent B more now") that influences future decisions.
- Agents react to simulated in-game events (e.g., a fake "battle won" event increases a character's confidence and staking appetite).
- A short written or recorded walkthrough exists that a MetaSpace reviewer could read/watch in under 5 minutes and understand exactly what was built and why it matters to them.

### 4.3 Explicit Non-Goals

To keep this project scoped and finishable, the following are intentionally out of scope:

- No real mainnet deployment or real money. Everything runs on a free public test network (Polygon Amoy) with fake test tokens.
- No actual game client, 3D graphics, or mobile app. This is backend/contracts/agents only, with at most a minimal web dashboard for visibility.
- No integration with MetaSpace's actual live contracts or systems. This is an original, self-contained demo inspired by their product, not a fork or clone of their code.
- No production-grade security audit. Security best practices should be followed, but this is a portfolio/demo project, not something handling real funds.
- No novel token economics design (inflation modeling, tokenomics whitepaper, etc.). The staking/reward mechanism should be simple and illustrative, not economically sophisticated.

---

## 5. High-Level System Architecture

The system has four layers. The planner should think of these as four largely independent workstreams that connect through well-defined interfaces.

```
┌─────────────────────────────────────────────────────────┐
│                     AGENT LAYER                          │
│   (LangGraph) One agent "brain" per character            │
│   Observes events → Reasons → Decides → Requests action  │
└───────────────────────┬───────────────────────────────────┘
                         │  (calls backend API to act)
┌───────────────────────▼───────────────────────────────────┐
│                  BACKEND SERVICE LAYER                    │
│   Node.js / TypeScript                                    │
│   - Event listener (watches the blockchain via ethers.js) │
│   - Action API (lets agents request on-chain actions)     │
│   - Session key / policy engine (approves or blocks)      │
│   - State cache (fast local read of on-chain state)       │
└───────────────────────┬───────────────────────────────────┘
                         │  (signs & sends transactions)
┌───────────────────────▼───────────────────────────────────┐
│                SMART CONTRACT LAYER                        │
│   Solidity, deployed on Polygon Amoy testnet               │
│   - CharacterNFT contract                                  │
│   - StakingVault contract                                  │
│   - TradeEscrow contract                                   │
│   - AgentRegistry contract                                 │
└───────────────────────┬───────────────────────────────────┘
                         │  (reads/writes)
┌───────────────────────▼───────────────────────────────────┐
│                POLYGON AMOY TESTNET                        │
│   Public, free, Ethereum-compatible test blockchain        │
└─────────────────────────────────────────────────────────────┘
```

Data and control flow in both directions: the blockchain emits events upward (a stake happened, a trade was proposed), and the agent layer sends decisions downward (stake this character, propose this trade), passing through the backend's policy engine, which is the safety layer that prevents an agent from doing anything outside its allowed boundaries.

---

## 6. Component 1: Smart Contract Layer

This is the on-chain foundation. All contracts are written in Solidity and deployed to Polygon Amoy (Polygon's official public test network, functionally identical to the real Polygon network but using free, worthless test tokens).

### 6.1 CharacterNFT Contract

- Standard: ERC-721 (the standard NFT format; each token is unique and non-interchangeable, unlike a currency token).
- Each minted token represents one character (the planner can choose 3 to 5 original character concepts inspired by, but distinct from, MetaSpace's own roster; for example, a scavenger, a strategist, a berserker, a diplomat, a hoarder, each with a different "personality" that will later influence agent behavior).
- Each token stores or references metadata: name, personality traits (a small set of numeric or categorical traits that the agent's reasoning will read, such as risk tolerance, trust level, aggression), and a pointer to that character's agent wallet (see Section 8).
- Standard NFT functions: mint, transfer, ownerOf, tokenURI (for metadata).

### 6.2 AgentRegistry Contract

- A lightweight contract that formally links a CharacterNFT token to an "agent identity": an on-chain record saying "token #4 is operated by agent wallet 0xABC..., with permission scope defined by policy hash 0x123...".
- This is what makes the system "on-chain-identified" rather than just an off-chain script pretending to be tied to an NFT. It is the equivalent of the agent having a verifiable on-chain badge saying "I am authorized to act for this character."
- Should support registering an agent, updating its permission scope, and revoking it (the human owner can always shut an agent off).

### 6.3 StakingVault Contract

- Allows a CharacterNFT to be staked (locked into the contract) in exchange for accruing a reward (a simple test token, minted for this project, standing in for something like MetaSpace's $LORD).
- Needs: stake function, unstake function, a reward calculation (can be simple, e.g., linear accrual per block or per unit time), and a way to check current stake status per token.
- This is the contract an agent calls when it decides "I should stake myself right now."

### 6.4 TradeEscrow Contract

- Allows two parties (in this case, two character-agents) to propose, accept, and settle a trade of NFTs or tokens without trusting each other directly. The contract holds both sides of the trade until both parties have confirmed, then releases atomically (either the whole trade happens, or none of it does, so nobody can be cheated mid-trade).
- Needs: proposeTrade, acceptTrade, cancelTrade, and an escrow holding mechanism.
- This is the contract that lets two agents "negotiate," even though the actual negotiation logic (deciding what's a fair trade) lives in the agent layer, not the contract. The contract just enforces that whatever was agreed gets executed safely.

### 6.5 Reward/Test Token Contract

- A simple ERC-20 (fungible/currency-style) token, minted freely for testing, used as the reward token paid out by the StakingVault. This stands in conceptually for MetaSpace's $LORD token.

### 6.6 Contract Design Principles to Follow

- Keep every contract as simple as possible. This is a demonstration of understanding, not a production financial system. Simpler, well-commented contracts are more valuable for this purpose than clever, dense ones.
- Every state-changing function should emit an event (e.g., `event CharacterStaked(uint256 tokenId, uint256 amount, uint256 timestamp)`). Events are what the backend's listener will watch for. This is not optional: the entire "agents react to on-chain events" goal depends on rich, well-structured events.
- Use OpenZeppelin's standard, audited contract libraries as the base for ERC-721 and ERC-20 rather than writing token logic from scratch. This is standard industry practice and signals contract-security awareness.
- Include basic access control (only the registered agent wallet or the NFT owner can trigger actions for a given character, not just anyone).

---

## 7. Component 2: Backend Service Layer

Built in Node.js and TypeScript, this is the connective tissue between the smart contracts and the AI agents. It has four responsibilities.

### 7.1 Event Listener Service

- Uses ethers.js to subscribe to events emitted by the smart contracts (new stakes, new trade proposals, trade settlements, new character mints).
- Whenever an event fires, this service should update the local state cache and notify the relevant agent(s) that something happened they may want to react to.
- This is what makes the system feel "alive": an agent doesn't have to constantly poll the blockchain, it gets notified.

### 7.2 Action API

- An internal API (can be a simple REST or RPC-style API) that the agent layer calls when it has decided to do something, e.g., `POST /agents/{tokenId}/stake` or `POST /agents/{tokenId}/proposeTrade`.
- This API is the only path through which an agent can affect the blockchain. The agent layer never talks to the blockchain directly; it always goes through this API, which is the enforcement point for the policy/safety rules in Section 8.
- The API should reject any request that falls outside the calling agent's permitted scope (e.g., trying to stake more than its allowed limit) and log the rejection.

### 7.3 Session Key / Policy Engine

- The component responsible for actually holding and using the limited-permission signing keys described in Section 8, and for checking each incoming action request against that character's allowed policy (spend limits, allowed action types, expiry time) before signing and sending any transaction.
- This is arguably the most important piece of the entire backend from a "this shows real engineering judgment" standpoint, because it is the safety mechanism that makes autonomous agents touching real assets defensible at all.

### 7.4 State Cache

- A lightweight local database (can be as simple as SQLite or a local Postgres instance, consistent with the builder's existing PostgreSQL familiarity) that mirrors relevant on-chain state (which characters exist, who's staked, open trade proposals) so that the agent layer and any dashboard can query fast, human-readable state without hitting the blockchain directly every time.

---

## 8. Component 3: Wallet & Security Design (Session Keys)

This section explains, in detail, the single most important design decision in the whole project: how an AI agent is allowed to touch a wallet without ever holding a real, unrestricted private key.

### 8.1 The Problem

A normal crypto wallet is controlled by one private key. Whoever has that key can do absolutely anything the wallet is allowed to do, with no limits, forever. Handing that key directly to an AI agent is dangerous for obvious reasons: the agent could make a mistake, be manipulated by a bad input, or (in worse cases seen elsewhere in the industry) accidentally leak the key entirely, resulting in total and permanent loss of anything in that wallet.

### 8.2 The Solution: Session Keys

Instead of giving an agent the master key, the system gives it a **session key**: a separate, secondary key that:

- Is only valid for a limited time (e.g., expires after 24 hours, or after this demo session ends).
- Can only be used for specific, pre-approved action types (e.g., "may call `stake()`" and "may call `proposeTrade()`," but nothing else, such as transferring the NFT outright or withdrawing to an arbitrary address).
- Has a hard spending/value limit (e.g., "may stake at most 50 test tokens total").
- Can be instantly revoked by the real owner (the human, or in this demo, the system operator) at any time.

This means that even in the worst case (the agent behaves unexpectedly, or the session key somehow leaks), the maximum possible damage is small and time-boxed, because the key simply cannot do anything outside its narrow, pre-approved scope.

### 8.3 How This Should Be Implemented

There are two reasonable implementation paths, and the planner should pick one based on what's feasible in the available time:

1. **Simplified/custom approach (recommended for a first build):** the backend itself generates a separate keypair per character-agent, funds it with a small, fixed amount of test currency, and enforces the scope/expiry/spend-limit rules entirely in the backend's policy engine (Section 7.3) before ever using that key to sign a transaction. This is straightforward to build, fully demonstrates the concept, and does not require deep protocol-level expertise.
2. **Standards-based approach (a stretch goal if time allows):** implement this using real account abstraction patterns from the Ethereum ecosystem (smart contract wallets with programmable permission modules), which is the industry-standard, production-grade way of doing this. This is more impressive if achieved, but meaningfully harder and should only be attempted after the simplified version works end-to-end.

The planner should treat option 1 as the baseline requirement and option 2 as an optional enhancement, not a blocker.

### 8.4 Why This Matters for the Application

This is the part of the project that proves security judgment, not just the ability to call blockchain functions. Any candidate can write a script that sends a transaction. Far fewer can explain and implement why an autonomous agent should never hold an unrestricted key, and demonstrate a working, scoped alternative. This should be a headline talking point in the eventual demo.

---

## 9. Component 4: Agent Layer

This is where the builder's existing strength applies most directly, using LangGraph exactly as in prior projects, now with blockchain-connected tools instead of purely digital ones.

### 9.1 Agent Structure

Each character has its own independent agent instance (not one shared agent playing multiple roles). Each agent's "brain" is a LangGraph graph with, at minimum:

- An **observation** step: reads current relevant state (its own status, e.g., staked/unstaked; any incoming trade proposals; any new event notifications from the backend).
- A **reasoning** step: given its personality traits (from Section 6.1) and current observations, decides what, if anything, to do.
- An **action** step: if it decides to act, calls the backend's Action API (Section 7.2) with the specific request.
- A **memory update** step: records what happened (what it decided, what the outcome was) for future reasoning.

### 9.2 Personality-Driven Behavior

Each character's numeric/categorical traits (risk tolerance, trust level, aggression, patience, etc., defined in the NFT metadata) should meaningfully change agent behavior, not just be flavor text. For example:

- A high-risk-tolerance character stakes aggressively and accepts trades quickly.
- A low-trust character requires a track record (via memory) with another agent before accepting a trade from them.
- A patient character waits for better trade offers rather than accepting the first one.

This is what makes the demo interesting to watch rather than just mechanically identical agents doing the same thing.

### 9.3 Agent Tools

The concrete tools/functions exposed to each agent (as LangGraph tool calls) should map directly to the backend's Action API, for example:

- `check_my_status()`
- `stake_myself(amount)`
- `unstake_myself()`
- `propose_trade(target_character_id, offer_details)`
- `respond_to_trade(trade_id, accept_or_reject_or_counter)`
- `recall_memory(topic)` (reads its own history)

### 9.4 Memory

A simple persistent memory per agent (can be as simple as a structured log stored in the state cache database) recording past actions and outcomes, referenced by the reasoning step. This does not need to be a sophisticated vector-embedding memory system for this project; a structured, readable history log is sufficient and easier to demo transparently (a reviewer can literally read an agent's memory log and see why it made a decision).

### 9.5 Event-Driven Triggering

Agents should not just run on a fixed timer. They should be triggered to "wake up and think" specifically when the backend's event listener notifies them of something relevant (their own staking status changed, a new trade proposal came in, a simulated game event occurred). This is what makes the system feel reactive rather than just looping.

### 9.6 Simulated Game Events (Optional but Recommended)

Since there is no real MetaSpace game client to connect to, the planner should include a small "event simulator" that can inject fake game events into the system (e.g., "Character #2 won a battle" or "A rare weapon dropped nearby"), which the relevant agent then reacts to (e.g., increased confidence, decision to stake winnings). This demonstrates the intended real-world integration point (a real game backend firing these same kinds of events) without needing to build an actual game.

---

## 10. Data Models (Reference for the Planner)

### 10.1 Character NFT Metadata (on-chain or IPFS-referenced)

- `tokenId`
- `name`
- `archetype` (e.g., Scavenger, Strategist, Berserker)
- `traits`: `{ riskTolerance: 0-100, trustBaseline: 0-100, aggression: 0-100, patience: 0-100 }`
- `agentWalletAddress` (the session-key wallet tied to this character)

### 10.2 Agent Memory Entry (off-chain, in state cache)

- `characterId`
- `timestamp`
- `eventType` (e.g., "stake_decision", "trade_completed", "trade_rejected")
- `details` (free text or structured summary of what happened)
- `outcomeSentiment` (simple positive/neutral/negative tag used to bias future decisions)

### 10.3 Trade Proposal

- `tradeId`
- `proposerCharacterId`
- `targetCharacterId`
- `offeredAsset` / `requestedAsset`
- `status` (proposed, countered, accepted, rejected, settled)
- `timestamps`

### 10.4 Session Key Policy

- `characterId`
- `sessionKeyAddress`
- `allowedActions` (list, e.g., `["stake", "proposeTrade", "acceptTrade"]`)
- `spendLimit`
- `expiresAt`
- `revoked` (boolean)

---

## 11. Core End-to-End Flows

These are the specific scenarios the planner should design the system around, and which should ultimately become the demo script.

### 11.1 Flow A: Minting and Registering a Character

1. Operator mints a new CharacterNFT with chosen name, archetype, and traits.
2. Backend generates a session-key wallet for this character and registers it in the AgentRegistry contract with an initial policy (allowed actions, spend limit, expiry).
3. Backend funds the session-key wallet with a small amount of test token.
4. A new LangGraph agent instance is initialized for this character, loaded with its traits and empty memory.

### 11.2 Flow B: Autonomous Staking Decision

1. Event listener notices the character's balance/status changed (e.g., just minted, or received rewards).
2. Agent is woken up, observes its current state and traits.
3. Given a high risk tolerance, the agent reasons "I should stake now" and calls `stake_myself(amount)`.
4. Backend's Action API validates this against the character's session key policy (is staking allowed? is the amount within the spend limit? has the key expired?).
5. If valid, backend signs and sends the `stake()` transaction to the StakingVault contract using the session key.
6. Contract emits a `CharacterStaked` event.
7. Event listener picks this up, updates the state cache, and logs it to the agent's memory as a completed action.

### 11.3 Flow C: Agent-to-Agent Trade Negotiation

1. Agent A decides (based on its traits/memory) that it wants an asset Agent B holds, and calls `propose_trade(B, offer_details)`.
2. Backend validates against Agent A's policy, then calls `proposeTrade()` on the TradeEscrow contract, which emits a `TradeProposed` event.
3. Event listener notifies Agent B's agent instance of the incoming proposal.
4. Agent B reasons about the offer, factoring in its trust level toward Agent A (checked against its memory: has it traded with A before, and how did that go?).
5. Agent B either accepts, rejects, or (stretch goal) proposes a counter-offer, calling the corresponding Action API endpoint.
6. If accepted, backend calls `acceptTrade()`, the contract settles the trade atomically, and emits a `TradeSettled` event.
7. Both agents' memories are updated with the outcome, which will influence future trust-based decisions between them.

### 11.4 Flow D: Reacting to a Simulated Game Event

1. Operator (or a scheduled simulator) triggers a fake event, e.g., "Character #3 won an arena battle."
2. This event is pushed into the same event pipeline the on-chain listener uses, so the agent layer treats it identically to a real on-chain event.
3. Character #3's agent reasons that a win increases its confidence, and (depending on traits) may decide to stake its winnings or become more willing to accept trades for a short time.
4. This demonstrates the intended integration point with a real game backend: MetaSpace's own server could fire this exact kind of event in production, and the same agent logic would apply unchanged.

---

## 12. Technology Stack Summary

| Layer | Technology | Notes |
|---|---|---|
| Smart contracts | Solidity | New skill area for the builder; use OpenZeppelin base contracts |
| Contract dev/test framework | Hardhat or Foundry | Hardhat is generally more approachable for a first Solidity project; Foundry is faster/more powerful once comfortable |
| Blockchain network | Polygon Amoy testnet | Free, public, Ethereum-compatible; obtain test tokens from a public faucet |
| Blockchain interaction library | ethers.js | Explicitly requested in the job posting |
| Backend runtime | Node.js + TypeScript | Explicitly requested in the job posting |
| Agent orchestration | LangGraph | Builder's existing core skill, reused here |
| State cache / database | PostgreSQL or SQLite | Consistent with builder's existing PostgreSQL familiarity |
| Dashboard (optional but recommended) | Simple Next.js page or even a plain HTML page with live-updating logs | Only needs to be good enough to demo clearly, not production-polished |
| Block explorer for verification | Polygonscan (Amoy testnet explorer) | Used to show contract deployments and transactions publicly during the demo |

---

## 13. Non-Functional Requirements

- **Observability**: every agent decision and every on-chain action must be logged in a human-readable way. A reviewer watching the demo should be able to see, in real time or in a log, exactly why an agent did what it did (e.g., "Agent Cyto: risk tolerance 80/100, balance sufficient, decided to stake 20 tokens").
- **Safety**: no code path should exist where an agent can act outside its session key's defined policy. This should be enforced at the backend layer, not merely assumed.
- **Reproducibility**: the entire system (contract deployment, backend startup, agent initialization) should be runnable from a clean environment with clear setup instructions, since this needs to be demoable to MetaSpace, potentially on a call or from a recording.
- **Gas awareness**: since this runs on a testnet, real cost isn't a concern, but the contracts and backend should still be written as if gas efficiency mattered (avoiding obviously wasteful patterns), since this reflects real production judgment.
- **Simplicity over cleverness**: given this is a demonstration project built by someone new to blockchain specifically, every component should favor clarity and correctness over advanced or obscure patterns. A well-explained simple system is more valuable here than an impressive-looking but poorly understood complex one.

---

## 14. Testing & Deployment Strategy

- All smart contracts should have unit tests (using Hardhat or Foundry's testing tools) covering the core paths: minting, staking, unstaking, trade proposal, trade acceptance, and rejection of unauthorized actions.
- Contracts should first be tested on a local development blockchain (e.g., Hardhat's built-in local network) before being deployed to the public Polygon Amoy testnet, to iterate quickly without waiting for real network confirmation times.
- Once stable locally, contracts are deployed to Polygon Amoy using a deployment script, and their addresses are recorded for the backend to connect to.
- Test tokens for the deployer/operator wallet (to pay for contract deployment and to fund agent session-key wallets) are obtained from a public Polygon Amoy faucet, free of charge.
- After deployment, a manual end-to-end pass should be run through all four flows in Section 11 before considering the project demo-ready.

---

## 15. Suggested Phased Roadmap (High-Level Only)

The planner should expand this into a detailed task-level plan, but the intended macro-sequence is:

1. **Phase 1: Contracts.** Design, write, and test all four contracts locally. Deploy to Polygon Amoy. Verify manually via Polygonscan and simple scripts that minting, staking, and trading work correctly when triggered directly (no agents yet).
2. **Phase 2: Backend.** Build the event listener, Action API, state cache, and session key/policy engine. Verify that the backend alone can trigger every contract action correctly and that it correctly blocks out-of-policy requests.
3. **Phase 3: Agents.** Build the LangGraph agent structure for one character first, wire it end-to-end through the backend to the contracts, and confirm one full autonomous staking flow works. Then extend to multiple characters and the trade negotiation flow.
4. **Phase 4: Polish & Demo Prep.** Add the simulated event system, build the minimal dashboard/log view, write the short walkthrough explanation, and rehearse the demo flows described in Section 11.

This order is deliberate: each phase should be fully working and testable before the next begins, since debugging a broken agent is far harder if the contracts or backend underneath it are also unverified.

---

## 16. Risks, Assumptions, and Open Questions

### 16.1 Risks

- **Solidity learning curve**: this is genuinely new territory. The planner should budget real learning time, not assume contract-writing speed comparable to the builder's existing languages.
- **Scope creep**: the temptation to add more contracts, more characters, or more sophisticated negotiation logic could easily expand this indefinitely. The Section 4.3 non-goals should be actively enforced during planning.
- **Testnet reliability**: public testnets occasionally have downtime or slow faucets. The plan should not assume instant access to test tokens.
- **Session key implementation complexity**: the standards-based approach (Section 8.3, option 2) could consume disproportionate time if attempted before the simplified version is solid. Treat it strictly as optional.

### 16.2 Assumptions

- The builder has access to a computer capable of running Node.js, a Solidity development environment, and standard blockchain tooling.
- A free Polygon Amoy faucet will be available and sufficient for all testing and demo needs.
- The demo will be shown either live or via a short recording, not require a persistently running public deployment.

### 16.3 Open Questions for the Planner to Resolve

- How many characters (agents) are actually needed for a convincing demo? (Recommendation: start with 2, expand to 3 to 5 once the core flows work.)
- Should the dashboard be a real web UI, or is a clean terminal/log output sufficient for the demo? (Either is acceptable; the web UI is more visually convincing but not required for the core goals in Section 4.1.)
- Should the counter-offer negotiation capability (Section 11.3, step 5) be included in the first version, or treated as a stretch goal? (Recommendation: treat as stretch; accept/reject alone is sufficient to prove the concept.)

---

## 17. What "Done" Looks Like (Demo Script Outline)

When the project is complete, the builder should be able to walk a MetaSpace reviewer through the following in under ten minutes:

1. Show the deployed contracts on Polygonscan (Amoy), proving they are real, live, and verifiable.
2. Show 2 to 5 minted character NFTs with distinct traits.
3. Trigger the system and show, live, an agent independently deciding to stake itself, with its reasoning visible in the logs, followed by the resulting on-chain transaction appearing on Polygonscan.
4. Trigger a simulated in-game event and show an agent reacting to it differently based on its personality traits.
5. Show two agents negotiating and completing a trade with each other, entirely autonomously.
6. Explicitly explain the session key mechanism: show that the agent's wallet has a limited, expiring, scoped permission, and explain why this matters for anyone deploying AI agents against real user assets.
7. Close by connecting it back to MetaSpace directly: "this is the same pattern your existing named NFT characters could use to become autonomous participants in your game's economy."

---

## 18. Glossary

- **NFT (Non-Fungible Token)**: a blockchain-based token representing a unique item (as opposed to a currency, where every unit is identical).
- **ERC-721**: the standard technical format for NFTs on Ethereum-compatible blockchains.
- **ERC-20**: the standard technical format for fungible (currency-style) tokens.
- **Smart contract**: a program deployed on a blockchain that runs exactly as written, automatically, without a central authority controlling it after deployment.
- **Polygon**: an Ethereum-compatible blockchain network known for low fees and fast transactions, popular for games.
- **Polygon Amoy**: Polygon's official free public test network, used for development and demos without real money.
- **ethers.js**: a JavaScript/TypeScript library used to interact with Ethereum-compatible blockchains from code (reading data, sending transactions).
- **Wallet**: an account on a blockchain, controlled by a private key, that can hold assets and sign transactions.
- **Private key**: the secret credential that gives full, unrestricted control over a wallet.
- **Session key**: a secondary, limited-permission key that can only perform specific, pre-approved actions, for a limited time, up to a limited value, without exposing the wallet's main private key.
- **Staking**: locking an asset into a contract in exchange for earning rewards over time.
- **Escrow**: a neutral holding mechanism (here, a smart contract) that holds both sides of a trade until the conditions are met, then releases them, preventing either party from being cheated.
- **Event (blockchain)**: a structured log entry that a smart contract emits when something happens, which off-chain services (like the backend's event listener) can watch for.
- **Faucet**: a free service that gives out small amounts of test-network tokens for development purposes.
- **Account abstraction**: a broader set of techniques in the Ethereum ecosystem for making wallets programmable (e.g., supporting spending limits, recovery, or delegated permissions) instead of being controlled by a single raw private key.
- **Multi-agent system**: a system composed of multiple independent AI agents, each with its own reasoning and goals, that can observe, decide, and act, sometimes interacting with one another (as in the trade negotiation flow in this project).

---

## 19. Summary for the Planner

Build, in this order: contracts, then backend, then agents, then polish. Keep every character-agent's power strictly limited through session keys. Make every decision an agent makes visible and explainable. Keep the scope to what Section 4.1 requires before touching anything in Section 4.2, and do not build anything listed in Section 4.3. The end state is a small, fully working, honestly demoable system that proves the builder can do exactly what MetaSpace's job posting asks for, while also showing a skill most blockchain-only candidates won't have.
