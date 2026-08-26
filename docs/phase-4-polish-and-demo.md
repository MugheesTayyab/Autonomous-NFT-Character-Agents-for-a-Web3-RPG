# Phase 4: Polish, Dashboard & Demo Preparation
### Autonomous NFT Character Agents — Implementation Planning

---

## What This Phase Is

Phase 4 is not about adding new core functionality — everything that matters technically should already exist after Phase 3. This phase is about making the system **demoable**, **visible**, and **explainable** to a MetaSpace reviewer in under ten minutes.

A system that works but can't be clearly shown to someone else is worthless for a portfolio application. Phase 4 closes that gap. It adds the simulated game event system, builds the live monitoring dashboard, and prepares the full demo walkthrough narrative.

The guiding principle of this phase: **every decision an agent makes must be visible and explainable**. A reviewer watching the demo should be able to see in real time exactly why an agent did what it did — not as a black box emitting transactions, but as a reasoning system with a traceable chain of thought.

---

## What You're Building

### 1. Simulated Game Event System

Since there is no real MetaSpace game client, this component simulates the kinds of in-game events a real game backend would fire — and injects them into the same event pipeline the blockchain listener uses. The agent layer treats these simulated events identically to real on-chain events.

**Purpose**: This demonstrates the intended integration point. During the demo, you can explain: "In production, MetaSpace's own game server would fire events exactly like this — character won a battle, rare item dropped nearby — and the same agent logic would apply unchanged. The integration point is already designed."

**What the simulator provides**:
- A simple API endpoint or CLI command that lets the operator inject a named event for a specific character
- A library of predefined event types: battle won, battle lost, rare item discovered, entering a new zone, another character made a hostile move
- A scheduling mechanism that can fire events automatically on a cadence (e.g., every 90 seconds, fire a random event for a random character) to keep the demo active during live presentation without the presenter manually triggering everything

**How agents react to simulated events**:
- "Battle won" → increases the character's confidence in the current session → biases it toward staking aggressively or accepting trades more readily (calibrated by aggression and risk tolerance traits)
- "Battle lost" → decreases confidence → biases toward holding assets, refusing risky trades
- "Rare item nearby" → triggers the character to evaluate whether a trade for that item makes sense given current relationships and resources
- "Hostile action detected" → high-aggression characters escalate (attempt counter-trade or stake to signal strength); low-aggression characters (like Voss) de-escalate by withdrawing proposals

The key is that **the same character trait system** that drives blockchain actions also drives reactions to game events. The traits are not two separate systems — they are one unified model of the character's personality that applies to everything.

---

### 2. Live Monitoring Dashboard

A minimal web UI that makes the demo visually compelling during a live presentation or screen recording. This does not need to be production-polished — it needs to be clear, readable, and update in near real-time.

**What to show on the dashboard**:

**Character Status Panel** (one card per character): Shows each character's name, archetype, current staking status (staked / unstaked), pending reward balance, and the session key wallet's expiry countdown. These cards should update in real time as events come in.

**Agent Thought Stream**: A live-scrolling log that shows the most recent reasoning output from each agent — exactly what the agent observed, what it decided, and what action it took. This is the most important UI element. It answers the question: "Is this actually thinking, or just randomly clicking buttons?" The answer should be immediately obvious.

**On-Chain Activity Feed**: A live list of recent transactions — stake events, unstake events, trade proposals, trade settlements — with links to the corresponding Polygonscan transaction. Every entry is clickable and takes the reviewer directly to the on-chain proof.

**Trade Negotiation Visualizer**: A simple diagram (could be as simple as a styled table or card pair) that shows currently pending trade proposals: who proposed to whom, what's being offered, what's being requested, current status. Updates when a trade is accepted or rejected.

**Session Key Health Panel**: For each character, shows whether its session key is active, how many seconds remain before expiry, and whether any actions have been blocked by the policy engine (with the reason). This is the safety demonstration panel — it shows that the guardrails are real and active.

**Technology approach**:

Use **Next.js** (consistent with the builder's existing experience). The real-time updates can be implemented via two approaches:
- **WebSocket connection from the frontend to the backend**: The backend pushes events to the dashboard as they occur. This is the more impressive approach and the one to aim for.
- **Server-Sent Events (SSE) as a simpler fallback**: Easier to implement than WebSockets, still real-time, suitable if time is tight.

The dashboard reads from the Phase 2 state cache database and the Phase 2 event stream — it does not touch the blockchain directly. All data goes through the backend.

---

### 3. Demo Script & Walkthrough Preparation

This is as important as any technical component. A MetaSpace reviewer is unlikely to clone the repository and run it locally. They will either watch a recording or see a live demo. The walkthrough must be clear, confident, and under ten minutes.

**Structure of the ten-minute walkthrough**:

**Minute 1-2: Orient the reviewer**
Open by explaining the problem being solved: "Today, MetaSpace characters are inert — they're pictures sitting in a wallet. All value comes from a human deciding to stake or trade. This project asks: what if the character could act on its own, within limits set by its owner?"

Then immediately show the deployed contracts on Polygonscan Amoy. This establishes in the first 60 seconds that this is real and on-chain, not a simulation running entirely off-chain.

**Minute 2-4: Show the characters**
Show the 5 minted characters on Polygonscan. Highlight the on-chain trait data. Explain what each trait means for agent behavior. Point to Kael (95 risk tolerance) vs. Lyra (30 risk tolerance) and explain that they will behave visibly differently.

**Minute 4-6: Live autonomous staking**
Trigger a simulated event (or let the scheduler fire one automatically) and show Kael's agent reasoning through its staking decision in the dashboard's thought stream. Point to the risk tolerance driving the decision. Show the resulting transaction appearing on Polygonscan. Explain the session key mechanism: "This agent does not hold Kael's actual wallet key. It has a scoped, time-limited permission — it can only stake, only up to a defined limit, and only until midnight tonight. The owner can revoke it in one call right now."

**Minute 6-8: Agent-to-agent trade negotiation**
Trigger a trade between Kael and Lyra. Show Kael's proposal appearing in the dashboard. Show Lyra's agent waking up, reading the proposal, checking its memory for prior interactions with Kael, and reasoning through whether to accept. Show the decision — and then show the on-chain trade settlement on Polygonscan.

**Minute 8-10: Close with the MetaSpace connection**
Close by connecting everything back directly: "MetaSpace already has named NFT characters with distinct personalities — a rebel leader, an elite soldier, a musician. This is exactly the pattern those characters could use to become autonomous participants in MetaSpace's economy. Stake themselves for rewards, negotiate player-to-player trades, react to game events — all without every individual player having to manually confirm each transaction."

**Written walkthrough**: In addition to the live demo, prepare a short written document (1-2 pages) or a `README.md` that covers the same narrative. This is for reviewers who look at the repository asynchronously.

---

### 4. Repository Polish

The repository itself is part of the application. A MetaSpace engineer looking at the GitHub repository should immediately get a sense of engineering maturity.

**README.md requirements**:
- One-paragraph project summary (what it is, why it matters to MetaSpace specifically)
- Architecture diagram (the four-layer system: agents → backend → contracts → blockchain) — even a simple ASCII diagram is fine
- Technology stack table with rationale for each choice
- Setup and run instructions that actually work from a clean environment
- Demo video link or Polygonscan links to the live deployed contracts
- A "key design decisions" section explaining: why session keys instead of full private keys, why each event must emit on-chain, why the Checks-Effects-Interactions pattern matters

**Code quality signals**:
- Commit history should be clean and descriptive — each commit should be a logical unit with a meaningful message
- No secrets in the repository — `.env` is in `.gitignore`, keys are loaded from environment variables only
- TypeScript strict mode enabled — no `any` types in the backend
- Contract code is well-commented — every function has a NatSpec comment explaining what it does, who can call it, and why

---

## Phase 4 Completion Criteria

- [ ] Simulated event system operational — events fire, agents react, reactions are visible in logs
- [ ] Dashboard running and updating in real time during a demo session
- [ ] Character status cards show correct staking status, reward balance, session expiry
- [ ] Agent thought stream shows legible, real-time reasoning from all active agents
- [ ] On-chain activity feed shows recent events with working Polygonscan links
- [ ] Trade negotiation flow visible in the dashboard from proposal through settlement
- [ ] Session key health panel shows active/expired status and blocked action count
- [ ] Ten-minute demo rehearsed at least twice — timing confirmed, transitions smooth
- [ ] Written walkthrough document complete
- [ ] README.md professional, accurate, and complete
- [ ] Repository has no secrets committed, no dead code, clean commit history
- [ ] Full end-to-end demo recorded as a video backup (in case live demo connection fails)
