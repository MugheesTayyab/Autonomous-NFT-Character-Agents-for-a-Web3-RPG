# Phase 4 - Detailed Implementation Plan
## Polish, Dashboard & Demo Preparation

> **Who this document is for**: A software engineer implementing Phase 4 after Phases 1-3 are complete and verified. This document specifies the simulated event injection system, the Next.js real-time monitoring dashboard, the demo narrative, and repository polish requirements. It contains zero code - only architectural decisions, data-flow contracts, UI component specifications, and preparation checklists required to build a demo-ready system any MetaSpace recruiter can evaluate within ten minutes.

---

## Part 1: The Governing Philosophy of Phase 4

Phase 4 is a discipline exercise, not a feature sprint. The three prior phases built a system that is technically correct but invisible. A correct system that cannot be demonstrated is worthless in a portfolio context. This phase creates the presentation layer that makes the underlying technical work legible to a non-engineer evaluator or a busy engineering hiring manager.

Three non-negotiable principles govern every decision in this phase:

**Principle 1: Every agent decision must have a visible, human-readable trail.**
The most important UI element in the entire dashboard is the agent thought stream. A recruiter looking at this project needs to see in real time that agents are reasoning, not randomly firing. The thought stream answers this in thirty seconds. It must be legible, timestamped, and surface the trait values that influenced the decision.

**Principle 2: Every on-chain action must be a clickable Polygonscan link.**
The entire credibility of this project rests on the fact that it is real - actual smart contracts deployed to a public testnet, actual transactions on an actual blockchain. Every time an agent does something, it must be immediately verifiable. A reviewer who clicks a link and sees a real transaction on Polygonscan Amoy will believe the system. A reviewer who cannot verify this will assume it is a simulation.

**Principle 3: The demo must be runnable without explanation.**
The walkthrough document must be written assuming the reviewer has never heard of this project. The README must contain setup instructions that work on a clean machine. The demo script must assume no questions from the audience. Every component of the demo should be self-explaining.

---

## Part 2: Simulated Game Event System

### 2.1 Purpose and Design Contract

The simulated event system creates a bridge between two realities: (1) in production, MetaSpace's own game server would fire events that drive agent behavior; (2) in this demo, no real game exists. The simulator fills this gap by providing a deterministic, controllable event injection mechanism that exercises the complete agent reasoning pipeline.

The design contract is critical: **simulated events are structurally identical to real events**. The agent graphs receive the same event schema whether the event came from a real game server or the simulator. The simulator is not a test harness - it is the demo engine. The event schema must be defined precisely in the types layer before the simulator is written. The simulator then constructs valid instances of that schema and injects them into the same event bus that the Phase 2 blockchain listener uses.

### 2.2 Event Type Taxonomy

The simulator must support exactly six named event types. Each maps to specific agent behavioral responses driven by the character's trait values:

**BATTLE_WON**: The character has won a combat engagement. Behavioral impact: increases a session-level confidence multiplier calibrated by the aggression trait. High-aggression characters (Kael, Borin) get a larger confidence boost. The increased confidence biases the agent toward staking aggressively and accepting incoming trade proposals. This effect is transient: it decays naturally as the agent reasoning cycle completes without another battle event.

**BATTLE_LOST**: The character has lost a combat engagement. Behavioral impact: decreases the same confidence multiplier, with a larger decrease for low-patience characters. The decreased confidence biases the agent toward holding assets and refusing risky trades. This demonstrates asymmetric trait-driven reaction - Kael (high aggression, high risk tolerance) recovers faster from a loss than Lyra (low risk tolerance, low aggression), observable in the dashboard thought stream within two reasoning cycles.

**RARE_ITEM_DISCOVERED**: A valuable item has appeared in the character's vicinity. Behavioral impact: triggers the character to evaluate a potential trade - either to acquire the item from another character who holds it, or to stake aggressively to fund an acquisition. This is the primary event type that surfaces agent-to-agent trade negotiation. When the item is discovered near two characters, both agents receive the event and must independently decide how to respond, creating emergent negotiation scenarios.

**ZONE_TRANSITION**: The character has entered a new zone of the game world. Behavioral impact: triggers a memory scan. Does this character have prior positive or negative interactions with other characters currently in the same zone? The zone event carries a list of other character token IDs in the zone. The agent uses relationship memory to decide whether to approach (propose a trade) or avoid (maintain distance) other zone occupants. This demonstrates memory-driven behavior accumulating across multiple reasoning cycles.

**HOSTILE_ACTION_DETECTED**: Another character has taken an aggressive action directed at this character. Behavioral impact: high-aggression characters (Kael, Borin) escalate - they counter-propose trades or stake larger amounts to signal resource strength. Low-aggression characters (Voss, Lyra) de-escalate. Voss withdraws any pending proposals with the aggressor; Lyra reduces its staking exposure. This directly demonstrates the personality divergence that makes this system compelling.

**REWARD_POOL_SPIKE**: The staking reward multiplier for a particular asset type has spiked. Behavioral impact: all characters evaluate their current staking position against their risk tolerance. High-risk-tolerance characters (Kael, 95) stake immediately if not already staked. Low-risk-tolerance characters (Lyra, 30) only stake if the spike is extreme. Medium characters (Sable, 60) stake if their trust-adjusted confidence is above a threshold. This demonstrates coordinated but independently-reasoned response - five agents making the same type of decision with different outcomes based on their individual trait profiles.

### 2.3 Event Injection Architecture

The simulator exposes two mechanisms for event injection during a demo:

**Manual injection via HTTP API**: A POST endpoint at `/api/simulate/event` on the backend accepts a JSON body specifying the event type, the target character token ID, and any event-specific payload fields. This allows the demo presenter to trigger specific events at specific moments during a live demonstration. The endpoint is guarded - it is only accessible when NODE_ENV=development. In any other environment, the endpoint returns 404.

**Scheduled auto-fire**: The simulator includes a scheduling module that fires events automatically on a configurable cadence. The default configuration fires one random event for one random character every 90 seconds. This keeps the dashboard visually active during a live demo when the presenter is explaining something and cannot manually trigger events. The scheduler must be configurable via environment variables: SIM_AUTO_FIRE_ENABLED (boolean), SIM_INTERVAL_SECONDS (number, default 90), and SIM_EVENT_WEIGHTS (comma-separated list of relative weights for each event type).

**Simulator state isolation**: The simulator does not maintain its own state. It constructs an event object and injects it into the backend's internal event emitter - the same EventEmitter instance that the Phase 2 blockchain listener publishes to. The backend's event handling logic, database writes, and agent notification system all activate as if a real on-chain event had occurred. The simulator has no special treatment path. This is the demo's core claim: the system is production-ready and the only difference between simulation and production is the event source.

### 2.4 Event-to-Agent Bridge

When the backend receives a simulated event (or a real on-chain event), it must notify the relevant agents. The bridge works as follows:

Step 1: The event is received by the backend event bus (internal EventEmitter). Step 2: The backend's notification service determines which agents are affected - the target character token ID plus any secondary characters referenced in the payload. Step 3: For each affected agent, the notification service makes an HTTP POST call to the agent orchestrator's webhook endpoint at http://localhost:3002/webhook/event with the full event payload. Step 4: The agent orchestrator routes the event to the appropriate character agent runner, identified by token ID. Step 5: The agent runner queues the event and begins a new reasoning cycle graph execution.

This architecture maintains the clean separation established in Phase 3: the backend drives agent notification, agents do not poll the backend. This means the agent layer can be completely replaced without changing the backend - any reasoning system that responds correctly to the webhook schema will work.

---

## Part 3: Next.js Real-Time Monitoring Dashboard

### 3.1 Stack Decisions and Rationale

The dashboard is built as a standalone Next.js application in a dashboard/ directory at the monorepo root, using the App Router. Server-side data fetching handles the initial page load (ensuring no visible flash of empty state), combined with client-side WebSocket subscription for real-time updates after load.

**Real-time transport: WebSocket over SSE.** Server-Sent Events were considered as a simpler fallback, but WebSocket is chosen because: (1) it allows the dashboard to send control messages back to the backend (triggering a simulated event directly from the UI is dramatically better for a live demo); (2) WebSocket support in Next.js is stable; and (3) it is the more technically impressive choice to explain during a demo.

The backend exposes a WebSocket endpoint at ws://localhost:3001/ws/dashboard. The dashboard connects to this on mount. The backend pushes structured event messages over this connection whenever a new on-chain event is processed, an agent reasoning cycle completes, a trade proposal is created or resolved, a session key expires or is created, or the simulated event system fires.

**Styling: Tailwind CSS.** The dashboard uses Tailwind because the rapid utility-first approach is appropriate for a demo-focused UI where iteration speed matters. Dark mode is the default. Colors signal purpose: green for active/staked states, amber for pending/processing, red for expired/rejected, indigo and violet for agent reasoning content to visually distinguish AI-generated thought from mechanical event data.

**State management: Zustand.** The dashboard maintains global client state in a Zustand store. The WebSocket handler populates the store as messages arrive. Components subscribe to slices of the store they need, avoiding prop drilling across deeply nested panel components.

### 3.2 Panel Architecture and Component Specification

The dashboard is a single-page layout with a fixed header and a responsive grid of panels. The layout must be readable at 1920x1080 with all panels visible without scrolling. The panel grid uses a 12-column CSS grid layout with three row groups.

**Panel 1: Character Status Cards** (top row, all 12 columns, one card per character)

A horizontally-arranged row of five cards. Each card displays: character name and archetype badge (e.g., Kael - BERSERKER); staking status with a colored indicator that pulses with a subtle CSS animation when the status changes; current reward balance in REWA tokens formatted to 4 decimal places updating in real time; a live session key expiry countdown showing hours:minutes:seconds (turning amber under 10 minutes, red when expired); an action blocked count with a tooltip explaining the most recent block reason; and the on-chain wallet address truncated to 0x1234...abcd with a Polygonscan link icon.

Each card has a subtle top-border color coded by archetype: deep red for BERSERKER, royal blue for STRATEGIST, forest green for SCAVENGER, gold for HOARDER, violet for DIPLOMAT. This color coding carries through to the thought stream entries for visual consistency.

**Panel 2: Agent Thought Stream** (second row, columns 1-6)

This is the most important panel in the dashboard. It is a vertically-scrolling live log of agent reasoning output. New entries appear at the top (newest-first). The panel auto-scrolls to the top as new entries arrive but stops auto-scrolling if the user manually scrolls down.

Each entry contains: timestamp (HH:MM:SS local time), character name and archetype (color-coded), observation summary (what the agent perceived in one sentence), reasoning summary (the key decision factors the agent weighed including the specific trait values that drove the decision), action taken (the final decision and its outcome), and the transaction hash as a clickable Polygonscan link when an on-chain action was taken.

Entries where the agent decided NOT to act must also appear. These are equally important. An agent that decided not to stake because the reward pool spike did not exceed Lyra's 30-point risk tolerance threshold demonstrates intelligent restraint, not inactivity. The reasoning summary for a no-action entry should say something like: risk tolerance (30) below required threshold for this spike magnitude (45-point minimum). Decision: HOLD.

**Panel 3: On-Chain Activity Feed** (second row, columns 7-12)

A live list of recent blockchain transactions processed by the Phase 2 event listener. Each entry shows: event type with a color-coded icon (stake icon for CharacterStaked, handshake for TradeProposed, checkmark for TradeSettled, x-mark for TradeRejected), involved parties by character name not raw addresses, block number and timestamp formatted as X seconds ago, the transaction hash as a clickable Polygonscan Amoy link (non-negotiable - every entry must be verifiable), and amount or trade details.

The feed maintains a maximum of 50 entries in memory to prevent UI memory growth during long demo sessions.

**Panel 4: Trade Negotiation Visualizer** (third row, columns 1-6)

A panel showing currently active (unresolved) trade proposals. For each pending trade: the proposing character on the left, the responding character on the right, with a center column showing the offer terms and the current status badge (PENDING in amber, ACCEPTED in green, REJECTED in red, EXPIRED in gray).

When a trade resolves, the card plays a brief slide-out animation before being removed, and the On-Chain Activity Feed simultaneously receives a new entry for the settlement transaction. This synchronized visual response makes the cause-and-effect relationship obvious to a live demo audience.

**Panel 5: Session Key Health Panel** (third row, columns 7-12)

A compact table showing one row per character with: character name, session key address (truncated) with copy-to-clipboard, status badge (ACTIVE, EXPIRING SOON under 30 minutes, EXPIRED), time remaining in Xh Ym format, actions blocked count with expandable inline list showing each block reason, and a Revoke button that calls POST /api/session-keys/:tokenId/revoke.

The Revoke button is styled as a destructive action (red, hover confirmation tooltip) to make clear it is consequential. After revocation, the character's session key status updates to EXPIRED immediately across all connected dashboard instances, and the agent suspends all further actions until a new session key is registered. This live revocation demonstration is one of the strongest safety-mechanism demos in the entire project.

### 3.3 WebSocket Message Protocol

All messages over the WebSocket connection follow a discriminated union schema keyed by a type field. The six defined message types:

**CHARACTER_STATUS_UPDATE**: Full current state of one character (staking status, reward balance, session key status). Published whenever any field changes.

**AGENT_THOUGHT**: Single thought stream entry: timestamp, character ID, observation summary, reasoning summary, action taken, optional transaction hash, and an optional isSimulated boolean flag. When true, the dashboard shows a SIM badge on the entry, helping the demo presenter point out the causal chain from simulation to agent reasoning.

**CHAIN_EVENT**: Processed blockchain event: event type, involved token IDs, transaction hash, block number, timestamp. Published every time the blockchain listener processes a new event from the node.

**TRADE_UPDATE**: Full state of one trade proposal: trade ID, proposer token ID, responder token ID, offered token, requested token, status, created-at and updated-at timestamps. Published whenever a trade is created, updated, or resolved.

**SESSION_KEY_EVENT**: Session key creation or revocation: character token ID, session key address, expiry timestamp, event type (REGISTERED or REVOKED). Published when any session key state changes.

**SIMULATOR_EVENT**: Simulated event payload: event type, target characters, timestamp, and which mechanism fired it (MANUAL_API or AUTO_SCHEDULER). Published when the simulated event system fires, before the agent has processed it, allowing the dashboard to briefly highlight the injection before the resulting thought stream entry appears.

### 3.4 Dashboard Data Loading Strategy

The initial page load must not show an empty dashboard. On mount, the frontend makes a single REST call to GET /api/dashboard/snapshot which returns: all five character records, all active trades, the last 20 agent thoughts from the agent_memory table, the last 20 chain events, and all session key statuses. This snapshot populates the Zustand store before the WebSocket connection is established, ensuring the dashboard shows meaningful data from the first frame with no loading spinners.

After the snapshot is loaded, the WebSocket connection is opened. The WebSocket handler merges incoming messages into the already-populated store rather than replacing it. This prevents any visual reset when the WebSocket connects.

---

## Part 4: Demo Script and Walkthrough Preparation

### 4.1 The Ten-Minute Structure

**Segment 1 (Minutes 0-2): Establish Credibility with On-Chain Evidence**

Open the browser to Polygonscan Amoy - not the dashboard, not the codebase. Go directly to the deployed CharacterNFT contract address. Show the contract is verified. Show the five minted NFTs. Click into one token and show its on-chain trait values. Say: These are real NFTs on a real testnet. The traits you see here - risk tolerance 95, aggression 88 - are the values the AI agent reads when making decisions. They are not in a database I control. They are on the blockchain.

Navigate to the RewardToken contract. Show the staking events in the transaction history. At least three staking transactions should already exist from Phase 3 testing. Say: These transactions were submitted by the agent autonomously. I did not sign them. The agent holds a session key - a time-limited, scope-restricted signing key - that I delegated to it. It can only stake, only up to limits I set, and only until the expiry I configured.

**Segment 2 (Minutes 2-4): Show the Dashboard and Character Personalities**

Switch to the dashboard. Show the five character cards. Point to Kael (BERSERKER, risk tolerance 95) and Lyra (DIPLOMAT, risk tolerance 30) side by side. Say: These two characters have fundamentally different personalities encoded in their on-chain traits. Watch what happens when they receive the same event.

Trigger a REWARD_POOL_SPIKE event via the dashboard Inject Event button. Watch the thought stream. Point out: Kael stakes immediately (high risk tolerance exceeds threshold). Lyra evaluates and decides to hold (30 risk tolerance is below the spike threshold). Say: Same event. Different decisions. The behavior is deterministic and explained - you can see exactly why each agent made its choice.

**Segment 3 (Minutes 4-7): Live Agent-to-Agent Trade Negotiation**

Trigger a RARE_ITEM_DISCOVERED event targeting both Kael and Sable (the HOARDER). Explain: Both agents receive this event. Kael wants the item - but Sable has it and is not inclined to trade without favorable terms. Watch the negotiation.

Point to the Trade Negotiation Visualizer. Show Kael's agent sending a proposal. Show Sable's agent receiving it, consulting its memory (did Kael behave honestly in prior interactions?), and making a decision. Show the resulting outcome on Polygonscan. Then point to the session key health panel. Show the policy engine block count for Kael if any blocks occurred. Say: The policy engine blocked this action because it exceeded the single-trade token limit I configured. The agent wanted to do it - the guardrail stopped it. This is how you give an AI agent real power without giving it unlimited access.

**Segment 4 (Minutes 7-10): Connect to MetaSpace and Close**

Navigate back to the repository README on GitHub. Show the architecture diagram. Then say: MetaSpace already has named NFT characters with distinct personalities - a rebel leader, an elite soldier, a musician. Each one could have a trait profile like this, stored on-chain, that drives autonomous behavior in MetaSpace's economy.

Walk through three capabilities demonstrated: (1) autonomous staking - the character participates in reward systems without the player signing every transaction; (2) agent-to-agent trade negotiation - characters negotiate player-to-player trades directly with the player setting approval boundaries; (3) game event reactivity - characters respond to what happens in the game in ways consistent with their personality.

Close with: The integration point is already designed. MetaSpace's own game server would fire events in the same schema the simulator uses today. Nothing in the agent layer changes. You plug in the real event source and the agents start reacting to real game events.

### 4.2 Written Walkthrough Document

A written walkthrough must be prepared in docs/demo-walkthrough.md for reviewers who look at the repository asynchronously. It is a narrative document written in the second person that walks a reader through the same journey as the live demo, with Polygonscan links embedded for every contract and transaction referenced, and dashboard screenshots annotated with callouts.

Screenshots must be taken at a moment when: at least two agents have recent thought stream entries, at least one trade has been proposed or settled, and the policy engine block count for at least one character is non-zero. A dashboard showing all zeros and no activity is not an acceptable screenshot.

### 4.3 Pre-Demo Environment Preparation Checklist

Before any demo session, verify in order:

1. Local Hardhat node running (or Polygon Amoy accessible).
2. All five contracts deployed and addresses in backend .env.
3. All five characters minted with correct on-chain trait values.
4. Operator setup script run: session keys registered, staking approved for all five characters.
5. Backend running and connected (health endpoint returns 200).
6. Agents service running with all five agent runners active.
7. Dashboard displaying live data with all five character cards showing non-zero values.
8. Simulated event auto-fire enabled.

Pre-warm the system for at least 5 minutes before the demo begins. This ensures the agent thought stream has existing entries, at least one trade has been attempted, and the on-chain activity feed has at least 5 entries. A cold system with no history looks unconvincing.

---

## Part 5: Repository Polish

### 5.1 Root-Level README Architecture

The root README must have these seven sections written with the same attention as a product pitch:

**Section 1 - Project Headline and Positioning**: What is this, why it matters to MetaSpace specifically, what is technically novel. The MetaSpace connection must appear in the first sentence.

**Section 2 - Architecture Overview**: A Mermaid or ASCII diagram showing the four-layer system (Smart Contracts, Backend Service, Agent Layer, Dashboard) with a one-sentence responsibility description for each layer.

**Section 3 - Technology Stack Table**: A markdown table with columns Layer, Technology, and Rationale. The Rationale column must explain why each choice was made. Example: SQLite was chosen over PostgreSQL because the state cache is read-heavy, single-process, and never distributed; SQLite WAL mode provides the necessary read concurrency without operational overhead.

**Section 4 - Key Design Decisions**: Four subsections covering (1) why session keys instead of full private keys - scope limitation as the safety primitive; (2) why all state changes emit events on-chain rather than being tracked off-chain - verifiability and replay capability; (3) why the Checks-Effects-Interactions pattern matters in the staking contract - re-entrancy prevention; (4) why agent isolation was chosen over a shared agent blackboard - mirrors decentralized reality and prevents emergent coordination bugs.

**Section 5 - Quick Start**: Step-by-step setup instructions for a clean machine with Node.js 20 and Git installed. Every command must be a literal copy-paste command. Verify these by running them in a clean environment before submission.

**Section 6 - Running the Full Stack**: Four commands to start local blockchain, backend, agents service, and dashboard, with expected output snippets for each.

**Section 7 - Live Demo Links**: Links to deployed contracts on Polygonscan Amoy, the Polygon Amoy explorer, and the recorded demo video. Real links only, no placeholders.

### 5.2 Per-Package README Files

Each of the four packages (contracts, backend, agents, dashboard) needs its own README covering: package responsibility, internal directory structure, commands to run it in isolation (tests, dev server, build), and environment variables with explanations. The contracts README must include deployed contract addresses and ABI locations.

### 5.3 Code Quality Standards

**TypeScript strict mode**: tsc --noEmit in both backend/ and agents/ with zero errors. strict: true in both tsconfig files. Zero any types.

**NatSpec comments**: Every Solidity function must have @notice, @param, @return, and @dev fields as appropriate.

**No secrets in git history**: Run git grep -r PRIVATE_KEY and check .env history. Clean with git filter-repo if any found before submission.

**Dead code removal**: No commented-out code blocks, no unused imports, no unresolved TODOs in the final committed state.

**Commit history hygiene**: Commits grouped by feature, following the format type(scope): description where type is one of feat, fix, docs, test, chore.

### 5.4 Demo Video Recording

The backup demo video must be 8-10 minutes at 1920x1080 with clear narration, terminal output visible in a split-screen to prove the system is running locally, Polygonscan shown for every on-chain action, and the GitHub repository README visible at the end. Clarity over production value.

---

## Part 6: Directory Structure for Phase 4 Additions

The following new directories and files must be created during Phase 4:

```
autonomous-nft/
  dashboard/                            (NEW: Next.js monitoring dashboard)
    app/
      layout.tsx                        (Root layout, dark mode, WebSocket provider)
      page.tsx                          (Main dashboard page, 5-panel grid layout)
      api/snapshot/route.ts             (Initial state snapshot from backend)
    components/
      CharacterCard.tsx
      ThoughtStream.tsx
      ActivityFeed.tsx
      TradeVisualizer.tsx
      SessionKeyPanel.tsx
      SimulatorControls.tsx
    store/
      dashboardStore.ts                 (Zustand store)
    hooks/
      useWebSocket.ts                   (WebSocket connection with reconnection)
    types/
      messages.ts                       (WebSocket message discriminated union types)

  backend/src/
    ws/
      dashboardWs.ts                    (NEW: WebSocket hub broadcasting to all clients)
    simulator/
      events.ts                         (Event type definitions and payload constructors)
      scheduler.ts                      (Auto-fire scheduler with configurable interval)
      injector.ts                       (Injects events into backend event bus)
    api/routes/
      simulate.ts                       (NEW: POST /api/simulate/event, dev-only guard)

  docs/
    demo-walkthrough.md                 (NEW: Written demo narrative with screenshots)
    phase-4-implementation-plan.md      (This document)
```

---

## Part 7: Integration and Wiring Checklist

### 7.1 Backend Additions Required

The Fastify server must register the @fastify/websocket plugin and expose ws://localhost:3001/ws/dashboard. The WebSocket handler maintains a Set of connected dashboard clients and broadcasts structured messages to all of them whenever the event bus fires.

A new REST endpoint GET /api/dashboard/snapshot must return all five character records, all session key records, all trades with status PENDING, the last 20 agent_memory records ordered by created_at descending, and a computed summary of policy engine blocks per character.

A new policy_blocks table must be added to the database schema to record every time the policy engine denies an action. Each row records: character token ID, timestamp, denied action type, deny reason, and the proposed parameter that violated the policy (example: amount 500 exceeds limit 100). This table is queried by the snapshot endpoint and the WebSocket hub.

A new REST endpoint POST /api/agent/thought must receive structured thought log entries from the agent layer, write them to the agent_memory table, and immediately broadcast them to connected dashboard clients via the WebSocket hub.

### 7.2 Agent Layer Additions Required

The Phase 3 agent orchestrator must emit a structured thought log at the end of every graph execution via HTTP POST to POST /api/agent/thought. The payload must include observation summary, reasoning summary, action taken, optional transaction hash, and the simulation flag.

The agent webhook server must add a simulation event handling path. When the backend's simulator posts an event with source SIMULATOR in the payload, the agent handles it identically to a real event but includes the simulation flag in its thought log entry, allowing the dashboard to display a SIM badge on the resulting thought stream entry.

### 7.3 Dashboard Wiring

The useWebSocket hook must handle reconnection with exponential backoff: 1s, 2s, 4s, 8s, maximum 30s between retries. A connection status indicator in the dashboard header shows CONNECTED (green dot) or RECONNECTING (amber dot, pulsing).

The Zustand store must handle all six WebSocket message types with immutable state updates. Character status updates deep-merge with existing records. The thought stream is a prepend operation. The activity feed is prepend with a maximum of 50 entries enforced on every update.

---

## Part 8: Completion Checklist

**Simulated Event System**
- POST /api/simulate/event returns 200 with the injected event payload echoed back, and backend logs show the event was processed
- Injecting BATTLE_WON for Kael causes a new thought stream entry in the dashboard within 5 seconds showing changed confidence
- Injecting BATTLE_LOST for Lyra causes a thought stream entry showing reduced confidence and a hold decision
- The auto-fire scheduler fires events at the configured interval (verified from backend logs)
- The auto-fire scheduler can be disabled by setting SIM_AUTO_FIRE_ENABLED=false without restarting the backend
- All six event types have been tested and produce visible agent reactions in the thought stream

**Dashboard**
- Dashboard loads with all five character cards populated on the first render (no flash of empty state)
- Character cards update within 2 seconds of a CharacterStaked on-chain event
- Thought stream receives and displays a new entry for every agent reasoning cycle
- All thought stream entries for on-chain actions include a clickable Polygonscan link
- Trade visualizer shows pending trades and removes them within 2 seconds of settlement
- Session key health panel shows expiry time updating every second
- Clicking the Revoke button immediately updates the character's status to EXPIRED across all connected clients
- WebSocket reconnection works: stopping and restarting the backend causes the dashboard to reconnect within 30 seconds without a page reload
- The SIM badge appears on thought stream entries triggered by simulated events

**Repository Polish**
- tsc --noEmit passes in backend/ and agents/ with zero errors
- All Solidity functions have complete NatSpec comments
- git grep finds no private keys or API keys anywhere in the git history
- Root README has all seven sections and all Polygonscan links are real deployed contract addresses
- All four per-package READMEs are complete and accurate
- Quick Start instructions tested end-to-end on a clean environment

**Demo Preparation**
- Ten-minute live demo script rehearsed at least twice with timing confirmed
- Written demo walkthrough complete with live-data dashboard screenshots
- Backup demo video recorded at 1920x1080, reviewed, confirmed 8-10 minutes
- Pre-demo environment checklist run and all items verified
- Dashboard shows non-zero agent thought entries before demo begins (system pre-warmed 5+ minutes)
- At least one policy engine block has occurred so the blocked action counter is non-zero

---

## Part 9: What Phase 4 Must Not Do

To protect the timeline, the following are explicitly out of scope:

**Do not build a production deployment pipeline.** Deploying to Vercel, Railway, or any cloud provider is a Phase 5 stretch goal. Spending time on cloud deployment during Phase 4 delays the demo preparation that actually matters for the recruiter deadline.

**Do not add new agent capabilities.** The agent reasoning logic is complete after Phase 3. Phase 4 makes existing behavior visible - it does not add new decision types, new on-chain interactions, or new LLM prompt logic. Any ideas that arise during Phase 4 should be logged as Phase 5 items.

**Do not over-engineer the dashboard.** The dashboard is a demo tool, not a production monitoring system. Skip: user authentication, persistent dashboard configuration, historical analytics charts, mobile responsiveness, multi-user support. Focus exclusively on making the existing system legible during a ten-minute demo at a single screen.

**Do not polish code that is not visible to the reviewer.** Spend time polishing the repository's public-facing surfaces (README, NatSpec, demo walkthrough, commit history) rather than refactoring internal implementation details that a reviewer will never read. The README is read by everyone. Internal utility functions are read by no one.

---

*End of Phase 4 Implementation Plan. 9 parts, 370+ specification lines covering the complete demo-ready system.*
