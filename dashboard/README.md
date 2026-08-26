# Autonomous NFT Character Agents — Live Mission Control Dashboard

A modern, high-performance real-time monitoring interface for **Autonomous NFT Character Agents** on Polygon Amoy.

---

## 🌟 Key Features

1. **Autonomous Character Agents Status Cards**:
   - Live visual status (Staked vs. Unstaked) with pulsing animated indicators.
   - Real-time REWA token rewards counter.
   - Live countdown timer for scoped session key expiry.
   - Interactive **Master Kill Switch** to revoke delegated agent permissions on-chain.
   - Visual on-chain trait gauges (Risk Tolerance, Aggression, Trust Baseline, Patience).

2. **Agent Cognitive Thought Stream**:
   - Real-time stream of agent reasoning cycles powered by LangGraph.
   - Displays observation, weighted trait justifications, chosen actions, and clickable on-chain Polygonscan transaction links.
   - Identifies simulated game events with a `SIM EVENT` badge.
   - Filter by individual agent and toggle auto-scroll.

3. **Bilateral Trade Negotiation Visualizer**:
   - Visual representation of atomic trade proposals between characters.
   - Shows offered vs. requested NFTs in escrow with real-time settlement status.

4. **On-Chain Activity Feed**:
   - Real-time log of verified smart contract events from Polygon Amoy (Staking, Unstaking, Trade Proposed, Trade Settled, Agent Registered, Session Revoked).
   - Clickable links directly to Polygonscan Amoy block explorer.

5. **Simulated Game Event Engine**:
   - Interactive control panel to inject 6 in-game events on demand (`Combat Victory`, `Combat Defeat`, `Rare Item Drop`, `Zone Transition`, `Hostile Move`, `Reward Multiplier Surge`).
   - Auto-fire scheduler with configurable 90-second cadence.

6. **Session Key Guardrails & Security Policy**:
   - Displays the 3 cryptographic guarantees: Action Whitelisting, Spend Limits, and Instant Owner Revocation.

---

## 🛠️ Tech Stack

- **Framework**: React 18 + Vite + TypeScript
- **Styling**: Tailwind CSS + Custom Dark Cyberpunk Glassmorphism
- **Icons**: Lucide React
- **Transport**: Real-time WebSocket (`ws://localhost:3001/ws/dashboard`) with exponential backoff auto-reconnection and REST snapshot fallback.

---

## 🚀 Running the Dashboard

```bash
cd dashboard
npm install
npm run dev
```

Open your browser at `http://localhost:3000`.
