# Phase 3 — Detailed Implementation Plan
## Agent Layer: Autonomous Multi-Agent LangGraph Cognitive Engine

> **Who this document is for**: A software engineer implementing Phase 3 from scratch. This document specifies the multi-agent cognitive architecture, LangGraph state machine structure, personality-driven decision algorithms, memory feedback loops, and event-driven orchestration connecting AI agents to the Phase 2 backend. It contains zero code — only the architectural specifications, prompt contracts, and system designs required to write production-grade agent code.

---

## Part 1: Architectural Mental Model

Before constructing the agent graphs, internalize four foundational principles of this autonomous agent system:

**1. The Agent Layer is a pure reasoning engine with no blockchain privileges.**
Agents never import private keys, never instantiate ethers.js wallets, and never communicate directly with smart contracts. All agency is expressed via structured HTTP calls to the Phase 2 Action API. The agent decides *what* it wants to achieve; the backend determines *if* the action is legally permissible under active security policy and handles on-chain transaction execution.

**2. Personality traits are deterministic mathematical constraints, not decorative prompts.**
On-chain numerical traits (`riskTolerance`, `trustBaseline`, `aggression`, `patience` on a 0–100 scale) directly dictate agent decision thresholds. In this system, prompt engineering is treated as a deterministic mathematical policy: two agents presented with identical market observations must produce demonstrably distinct decisions due to their trait equations.

**3. Complete Agent Isolation.**
There is no shared memory, global state blackboard, or direct inter-agent inter-process communication (IPC). When Agent A wishes to interact with Agent B, it proposes a trade on-chain via the backend. Agent B discovers the proposal through the event listener. This strictly mirrors decentralized asynchronous interactions on a public blockchain.

**4. Memory is a closed feedback loop.**
Every action taken by an agent and every event received from external agents generates a structured memory record in the database tagged with a sentiment score (`POSITIVE`, `NEUTRAL`, `NEGATIVE`). During future reasoning cycles, recent memory entries dynamically bias the agent's baseline trust and risk appetites, creating emergent behavioral evolution over time.

---

## Part 2: Technology Stack & Package Architecture

### 2.1 Workspace Structure

The agent layer is structured as a dedicated package `agents/` within the monorepo, communicating over local HTTP with the `backend/` service:

```
agents/
├── src/
│   ├── config/              ← Environment variables, LLM API keys, backend URLs
│   ├── types/               ← Graph state, observation, reasoning schema definitions
│   ├── graphs/
│   │   ├── state.ts         ← LangGraph state annotation schema
│   │   ├── nodes/
│   │   │   ├── observe.ts   ← Node 1: State & memory retrieval from Action API
│   │   │   ├── reason.ts    ← Node 2: LLM cognitive reasoning & trait weighting
│   │   │   ├── act.ts       ← Node 3: Action API execution gate
│   │   │   └── remember.ts  ← Node 4: Memory logging & sentiment assignment
│   │   └── agentGraph.ts    ← Compiled StateGraph with conditional edge routing
│   ├── personas/
│   │   ├── basePrompt.ts    ← Shared system prompt scaffolding
│   │   └── archetypes.ts    ← Calibrated persona system prompts for all 5 characters
│   ├── orchestrator/
│   │   ├── agentRunner.ts   ← Lifecycle manager for all 5 concurrent agent instances
│   │   └── eventBridge.ts   ← Event listener hook / webhook receiver triggering graph execution
│   └── index.ts             ← Package bootstrap & CLI execution loop
├── test/
│   ├── unit/                ← Node-level mock tests & persona reasoning tests
│   └── integration/         ← End-to-end multi-agent negotiation loop tests
├── package.json
├── tsconfig.json
├── jest.config.js
└── .env.example
```

### 2.2 Technology Selections

- **Runtime**: Node.js with TypeScript in strict mode.
- **Orchestration Framework**: `@langchain/langgraph` (v0.2+) with `@langchain/core`. LangGraph provides a stateful, cyclical computation graph with conditional branch routing, checkpointing, and deterministic state transitions.
- **LLM Integration**: `@langchain/openai` (GPT-4o or GPT-4o-mini) or `@langchain/anthropic` (Claude 3.5 Sonnet). Low temperature (`0.2`) is mandatory across all reasoning invocations to prevent arbitrary hallucinations and ensure high trait adherence.
- **Structured Output Validation**: `zod` and LangChain's `.withStructuredOutput()` ensuring 100% schema-compliant JSON decisions.
- **HTTP Client**: Native `fetch` or `axios` for fast HTTP communication with `http://127.0.0.1:3001`.

---

## Part 3: The 4-Node LangGraph Cognitive Architecture

Each character agent operates its own dedicated `StateGraph`. The graph executes four sequential nodes with conditional routing edges:

```
  ┌─────────────────────────────────────────────────────────────┐
  │                     AGENT STATE GRAPH                       │
  │                                                             │
  │     ┌──────────────┐         ┌──────────────┐               │
  │  ─► │ 1. OBSERVE   ├───────► │  2. REASON   │               │
  │     └──────────────┘         └───────┬──────┘               │
  │                                      │                      │
  │                                      ▼ (Conditional Edge)   │
  │                                [Action Type?]               │
  │                                ┌─────┴─────┐                │
  │                       Is Action│           │Is NOOP         │
  │                                ▼           │                │
  │                     ┌──────────────┐       │                │
  │                     │    3. ACT    │       │                │
  │                     └──────┬───────┘       │                │
  │                            │               │                │
  │                            ▼               ▼                │
  │                     ┌────────────────────────┐              │
  │                     │      4. REMEMBER       │ ──► END      │
  │                     └────────────────────────┘              │
  └─────────────────────────────────────────────────────────────┘
```

### 3.1 Graph State Definition (`AgentState`)

The state object flows through every node in the graph and contains:
- `tokenId` (number): Unique NFT token ID (0 through 4).
- `name` (string): Character name.
- `archetype` (string): `BERSERKER`, `STRATEGIST`, `SCAVENGER`, `DIPLOMAT`, or `HOARDER`.
- `traits` (object): Numeric trait scores: `riskTolerance`, `trustBaseline`, `aggression`, `patience`.
- `triggerEvent` (object, optional): The external event that woke the agent (e.g., `TRADE_PROPOSED`, `HEARTBEAT`, `STAKE_MILESTONE`).
- `observations` (object): Fresh state fetched from backend (staking status, pending reward balance, open trade proposals, current block timestamp).
- `memoryHistory` (array): The last 10 structured memory entries fetched from `GET /agents/:tokenId/memory`.
- `reasoningOutput` (object, optional): Structured decision produced by the LLM (action name, parameters, justification, target token, intended sentiment).
- `actionResult` (object, optional): The HTTP response payload returned by the Action API (success boolean, transaction hash, or rejection reason).
- `error` (string, optional): Internal execution or networking error if any occurred.

---

### 3.2 Node 1: Observation Node (`observeNode`)

**Objective**: Gather comprehensive internal and external environmental state without making any decisions.

**Step-by-step Execution**:
1. Concurrently execute two HTTP requests to the backend:
   - `GET /agents/:tokenId/status` (fetches on-chain stake status, reward balances, active session key, and incoming open trade proposals).
   - `GET /agents/:tokenId/memory?limit=10` (fetches recent decision history, outcomes, and sentiment tags).
2. If `triggerEvent` is present in graph input (e.g., trade notification from event listener), attach it directly to the observation payload.
3. Compute derived observation metrics:
   - `hasPendingIncomingTrades`: Boolean indicating if any trade in `openTrades` has `target_token_id == tokenId`.
   - `hasActiveOutgoingTrades`: Boolean indicating if any trade has `proposer_token_id == tokenId`.
   - `unclaimedRewardEstimate`: Parsed human-readable token balance.
4. Return updated graph state with populated `observations` and `memoryHistory`.

---

### 3.3 Node 2: Reasoning Node (`reasonNode`)

**Objective**: Apply the character's persona and numeric trait equations to observations and memory, producing a structured, schema-validated decision.

**Input Construction for LLM Prompt**:
1. **Character Profile**: Name, Archetype, Core Directives, and Raw Trait Scores.
2. **Current On-Chain Reality**: Staked status, reward balance, incoming proposals (with proposer token ID and offered assets).
3. **Recent Memory Stream**: Summary of last 5–10 events, emphasizing counterparty behavior and sentiment outcomes.
4. **Calculated Relational Modifiers**:
   - Dynamic Trust toward counterparty: 
     $$\text{Effective Trust} = \text{baseTrust} + (\text{positivePastTrades} \times 15) - (\text{negativePastTrades} \times 25)$$
5. **Decision Schema Contract**: Mandates a strict JSON output matching the following Zod schema:
   - `action`: One of `stake`, `unstake`, `proposeTrade`, `respondTrade`, or `noop`.
   - `targetTokenId` (number, optional): Target token ID if proposing trade.
   - `tradeId` (string, optional): Target trade ID if responding to trade.
   - `tradeResponse` (string, optional): `accept` or `reject` if responding.
   - `justification` (string): 1–2 sentence explanation of reasoning explicitly citing numeric traits and memory context.
   - `intendedSentiment` (string): `POSITIVE`, `NEUTRAL`, or `NEGATIVE`.

**System Prompt Structure**:
- System prompt instructs the LLM to roleplay as the commander while strictly adhering to mathematical risk/trust bounds.
- Explicit reasoning heuristics are codified:
  - If `riskTolerance > 70` and `isStaked == false`: Strong imperative to execute `stake`.
  - If `patience < 30` and incoming trade exists: Must respond immediately rather than waiting.
  - If `trustBaseline < 30` and counterparty has 0 past positive trades: Must `reject` trade proposal.
  - If `archetype == HOARDER`: Strictly forbidden from calling `proposeTrade`; always prefers holding assets.

---

### 3.4 Node 3: Action Node (`actNode`)

**Objective**: Translate the LLM's structured decision into a validated HTTP request to the Action API and capture the execution result.

**Execution Flow**:
1. Inspect `state.reasoningOutput.action`. If the action is `noop`, this node is skipped via graph conditional routing.
2. Match action type to corresponding backend endpoint:
   - If `stake`: Call `POST /agents/:tokenId/stake`.
   - If `unstake`: Call `POST /agents/:tokenId/unstake`.
   - If `proposeTrade`: Call `POST /agents/:tokenId/proposeTrade` with `{ targetTokenId: state.reasoningOutput.targetTokenId }`.
   - If `respondTrade`: Call `POST /agents/:tokenId/respondTrade` with `{ tradeId: state.reasoningOutput.tradeId, response: state.reasoningOutput.tradeResponse }`.
3. Handle Action API HTTP responses:
   - **HTTP 200 (Success)**: Record transaction hash, trade ID, and success status in `actionResult`.
   - **HTTP 403 (Policy Rejection)**: Capture rejection reason (e.g., `SPEND_LIMIT_EXCEEDED` or `ACTION_NOT_PERMITTED`). Do not crash or throw; record policy rejection into `actionResult` so the memory node can log the outcome.
   - **HTTP 400 / 404 / 500 (Errors)**: Record error details in `actionResult`.
4. Return updated graph state.

---

### 3.5 Node 4: Memory Node (`rememberNode`)

**Objective**: Synthesize the full cognitive cycle and write a human-readable, structured audit record to the backend memory store.

**Execution Flow**:
1. Formulate a structured narrative description:
   - Example: *"Observed incoming trade proposal from Token #3 (Voss). High trust baseline (80) and 2 prior positive trades biased decision to ACCEPT. Transaction broadcast with hash 0xabc..."*
   - Example on policy block: *"Attempted to propose trade, but was blocked by Policy Engine due to active trade limit (2/2). Defers action until next cycle."*
2. Determine final sentiment tag based on action outcome:
   - Successful stake or accepted trade: `POSITIVE`.
   - Rejection of malicious/unfair trade or neutral observation: `NEUTRAL`.
   - Policy violation or transaction failure: `NEGATIVE`.
3. Dispatch memory payload to backend state cache via backend repositories or logging helpers.
4. Output final state for telemetry and console streaming.

---

## Part 4: Character Archetypes & Trait Calibration

The 5 autonomous agents must exhibit distinct, recognizable decision patterns. The following matrix defines their behavioral rules:

| Token ID | Character Name | Archetype | Risk (0-100) | Trust (0-100) | Aggression (0-100) | Patience (0-100) | Core Autonomous Strategy |
|---|---|---|---|---|---|---|---|
| **0** | **Kael the Unbroken** | `BERSERKER` | **95** | **15** | **90** | **10** | **Ultra-Aggressive Expansion**: Stakes instantly upon acquiring assets. Proposes trades aggressively to any character holding assets. Rejects incoming trade offers from strangers instantly due to low patience and trust. |
| **1** | **Lyra the Tactical** | `STRATEGIST` | **30** | **80** | **20** | **85** | **Calculated Negotiation**: Evaluates counterparties systematically. High patience allows holding proposals for long durations. Prioritizes win-win alliances and requires positive historical sentiment before trading. |
| **2** | **Rexx the Scavenger** | `SCAVENGER` | **70** | **25** | **60** | **40** | **Opportunistic Arbitrage**: Rapidly shifts between staking and trading depending on yield opportunities. Low trust baseline requires favorable trade terms to accept. |
| **3** | **Voss the Peacemaker** | `DIPLOMAT` | **20** | **95** | **5** | **90** | **Collaborative Stability**: Highest trust baseline. Welcomes proposals from all agents. Seeks long-term mutual yield and will accept trades to build rapport even with modest immediate upside. |
| **4** | **Nyx the Shadow** | `HOARDER` | **10** | **10** | **15** | **95** | **Defensive Capital Preservation**: Extreme risk aversion. Will never initiate trade proposals. Refuses almost all incoming offers. Only stakes under zero-risk conditions and hoards all accrued tokens. |

---

## Part 5: Multi-Agent Trade Negotiation Protocol

The primary live demo showcase is an autonomous two-party negotiation resulting in atomic on-chain settlement:

```
  [KAEL: Agent #0]                                                  [VOSS: Agent #3]
  (Aggressive Berserker)                                            (Diplomatic Negotiator)
         │                                                                   │
 1. Wakes on Heartbeat                                                       │
 2. Reasons: Wants Voss's Asset                                              │
 3. Calls POST /proposeTrade ────► [BACKEND ACTION API]                     │
                                         │                                   │
                                   Validates Policy                          │
                                   Calls TradeEscrow.proposeTrade()          │
                                   Emits TradeProposed                       │
                                         │                                   │
                                   [EVENT LISTENER]                          │
                                         │ (Pushes Event Notification)       │
                                         └──────────────────────────────────►│ 4. Wakes on Trade Notification
                                                                             │ 5. Reads Proposal & Memory
                                                                             │ 6. Reasons: Voss has 95 Trust
                                                                             │ 7. Calls POST /respondTrade (Accept)
                                                                             │         │
                                                                   [BACKEND ACTION API]
                                                                             │
                                                                   Calls TradeEscrow.acceptTrade()
                                                                   Atomic NFT Swap Settled On-Chain
                                                                   Emits TradeSettled
                                                                             │
                                   [EVENT LISTENER]                          │
                                         │                                   │
                                 Notifies Both Agents                        │
                                         ▼                                   ▼
                            8. Kael Logs POSITIVE Memory        9. Voss Logs POSITIVE Memory
```

### Detailed State Transitions:
1. **Proposal Initiation**: Agent 0 triggers `proposeTrade(0, 3)`. Proposer's NFT is locked in `TradeEscrow`. Status: `PROPOSED`.
2. **Event Dispatch**: Event listener receives `TradeProposed`, persists to SQLite `trades` table, and dispatches notification to Agent 3's runner queue.
3. **Counterparty Evaluation**: Agent 3 executes its graph:
   - `observeNode`: Reads trade details (Offered Token 0, Requested Token 3).
   - `reasonNode`: Computes Effective Trust score. Agent 3 evaluates whether trading Token 3 for Token 0 aligns with its diplomatic objective.
   - `actNode`: Calls `POST /agents/3/respondTrade` with `{ tradeId, response: "accept" }`.
4. **On-Chain Settlement**: Backend signs `acceptTrade(tradeId)` with Agent 3's session key.
5. **Memory Synchronization**: Both agents write `TRADE_SETTLED` memory records, reinforcing future trust scores between Token 0 and Token 3.

---

## Part 6: Event-Driven Orchestrator & Runner Loop

Agents are triggered by two distinct mechanisms to balance responsiveness and autonomy:

### 6.1 Real-Time Event Bridge (`eventBridge.ts`)
- Subscribes to internal backend event emitter or polls event stream.
- When an on-chain event arrives:
  - `CharacterStaked` / `CharacterUnstaked` → Triggers graph execution for the affected character.
  - `TradeProposed` → Triggers graph execution for `target_token_id`.
  - `TradeSettled` / `TradeCancelled` → Triggers graph execution for both proposer and target.
- Execution is debounced (minimum 3-second cooldown per agent) to prevent execution loops.

### 6.2 Autonomous Heartbeat Loop (`agentRunner.ts`)
- A configurable interval timer (e.g., every 30 seconds during demo mode).
- Selects agents in randomized or round-robin sequence and runs one complete cognitive loop.
- Enables proactive behaviors: staking accrued balances, evaluating market opportunities, or cancelling stale outgoing proposals.

---

## Part 7: Testing Strategy

### 7.1 Unit Tests (Node Level)
- **Observation Node**: Mock HTTP responses from `/status` and `/memory`; verify state is parsed without errors.
- **Reasoning Node (Deterministic Mocking)**: Mock LLM responses; verify schema validation and trait-prompt interpolation.
- **Action Node**: Mock Action API endpoints; verify correct HTTP verbs and payload structures are transmitted.
- **Memory Node**: Verify formatting and sentiment tagging logic.

### 7.2 Persona Adherence Tests (Prompt Evaluation)
- Feed identical scenarios to Kael (Berserker) and Nyx (Hoarder).
- Assert that Kael's reasoning output chooses `stake` or `proposeTrade` with high confidence.
- Assert that Nyx's reasoning output chooses `noop` or rejects trade proposals with high confidence.

### 7.3 Integration Test: End-to-End Autonomous Staking & Trade Loops
- Run against local backend service connected to Hardhat node.
- **Test Flow 1**: Agent 0 wakes on heartbeat -> evaluates high risk tolerance -> calls stake endpoint -> verifies local DB and on-chain state updated.
- **Test Flow 2**: Agent 0 proposes trade to Agent 3 -> Agent 3 receives event trigger -> Agent 3 accepts -> verifies atomic swap completed on-chain.

---

## Part 8: Common Pitfalls & How to Avoid Them

**1. Hallucinating Invalid Token IDs or Actions**:
- *Pitfall*: LLM generates a trade proposal targeting a non-existent token ID (e.g., Token #99) or invalid action name.
- *Mitigation*: Strictly enforce Zod schema validation using LangChain's structured output. If validation fails, fallback automatically to `noop`.

**2. Infinite Negotiation Ping-Pong**:
- *Pitfall*: Two agents continuously propose and cancel trades back and forth, consuming excessive LLM calls and gas.
- *Mitigation*: Enforce a cooldown in `eventBridge.ts` and verify spend limits (`maxActiveTrades`) in the policy engine.

**3. Unhandled Policy Rejections (HTTP 403)**:
- *Pitfall*: When the policy engine blocks an over-limit stake or trade, the agent throws an uncaught error and crashes.
- *Mitigation*: The `actNode` must treat HTTP 403 as a standard, expected response. The rejection reason is recorded in `actionResult`, enabling the `rememberNode` to log `POLICY_REJECTED` and adapt future decisions.

**4. LLM API Rate Limits and Latency**:
- *Pitfall*: 5 agents making concurrent complex LLM reasoning calls exhaust rate limits.
- *Mitigation*: Use lightweight models (e.g., GPT-4o-mini or Claude 3.5 Haiku) for routine heartbeat checks, reserving flagship models for trade negotiations.

---

## Part 9: Phase 3 Completion Criteria Checklist

### LangGraph Agent Architecture
- [ ] Base `AgentState` schema defined with full TypeScript typings
- [ ] All 4 nodes implemented: `observeNode`, `reasonNode`, `actNode`, `rememberNode`
- [ ] Conditional routing edges correctly bypassing `actNode` on `noop`
- [ ] Structured output enforced via Zod schema (guaranteed valid JSON)

### Persona & Trait System
- [ ] Prompts calibrated for all 5 archetypes (Kael, Lyra, Rexx, Voss, Nyx)
- [ ] Numerical traits directly influencing reasoning justifications
- [ ] Dynamic trust modifier calculation integrating past positive/negative trade counts
- [ ] Verified side-by-side persona divergence (Kael vs. Lyra/Nyx)

### Backend Action API Integration
- [ ] Agents execute `stake` via `POST /agents/:tokenId/stake`
- [ ] Agents execute `unstake` via `POST /agents/:tokenId/unstake`
- [ ] Agents execute `proposeTrade` via `POST /agents/:tokenId/proposeTrade`
- [ ] Agents execute `respondTrade` via `POST /agents/:tokenId/respondTrade`
- [ ] Policy engine rejections (HTTP 403) handled gracefully and logged in memory

### Multi-Agent Orchestration & Trade Negotiation
- [ ] Orchestrator runs all 5 agent graphs concurrently
- [ ] Event bridge triggers target agent upon receiving `TradeProposed` event
- [ ] Full autonomous bilateral trade negotiation cycle executes from proposal to on-chain settlement without human intervention
- [ ] Both agents log `TRADE_SETTLED` memory records with positive sentiment

### Testing & Verification
- [ ] Unit tests passing for all 4 graph nodes
- [ ] Persona adherence unit tests passing
- [ ] End-to-end integration tests passing against local backend and Hardhat node

**Phase 3 is complete when all items above are checked. Phase 4 (Polish, Dashboard & Live Demo) does not begin until then.**
