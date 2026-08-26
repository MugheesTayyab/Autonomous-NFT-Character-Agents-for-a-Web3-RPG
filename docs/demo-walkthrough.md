# Autonomous NFT Character Agents — Demo Walkthrough & Presentation Guide

> **Target Audience**: Technical Recruiters, Engineering Managers, and Web3 / AI Engineers evaluating the Autonomous NFT Character Agents project.

---

## 🎯 Project Overview in One Sentence

**Autonomous NFT Character Agents** is an end-to-end decentralized autonomous agent architecture where gaming NFTs possess on-chain personality traits, hold time-bounded scoped session keys, and autonomously stake assets and negotiate bilateral NFT trades based on deterministic trait evaluation and memory.

---

## ⏱️ The 10-Minute Live Demonstration Script

### **Segment 1: Establish Credibility with On-Chain Evidence (Minutes 0–2)**

1. **Polygonscan Amoy Verification**:
   - Open [Polygonscan Amoy](https://amoy.polygonscan.com) directly to show deployed contracts:
     - `CharacterNFT (ERC-721)`: On-chain traits stored directly on the blockchain.
     - `AgentRegistry`: Session key delegation mapping each token to an ephemeral signing key.
     - `StakingVault`: Autonomous staking contract with continuous linear yield.
     - `TradeEscrow`: Atomic bilateral NFT trade swap contract.
     - `RewardToken (ERC-20)`: MLRD reward token.
   - *Key Talking Point*: *"These character traits—Risk Tolerance: 95, Aggression: 90—are stored directly on-chain. The AI agent reads them directly from the blockchain to drive its decisions, rather than querying an arbitrary off-chain database."*

2. **Session Key Delegation**:
   - Show how the character owner delegates an ephemeral key with time expiration and action whitelisting.
   - *Key Talking Point*: *"The AI agent never holds the owner's private key. It operates exclusively through a bounded session key with strict spend limits and an instant owner kill switch."*

---

### **Segment 2: Mission Control Dashboard & Persona Divergence (Minutes 2–4)**

1. **Open Mission Control Dashboard**:
   - Navigate to `http://localhost:3000`.
   - Show the 5 Character Status Cards:
     - **Kael (#0)**: `BERSERKER` (Risk: 95, Aggression: 90, Trust: 15)
     - **Lyra (#1)**: `STRATEGIST` (Risk: 30, Aggression: 20, Trust: 80)
     - **Borin (#2)**: `SCAVENGER` (Risk: 75, Aggression: 65, Trust: 40)
     - **Voss (#3)**: `DIPLOMAT` (Risk: 40, Aggression: 10, Trust: 95)
     - **Nyx (#4)**: `HOARDER` (Risk: 10, Aggression: 40, Trust: 10)

2. **Demonstrate Persona Divergence (Reward Multiplier Surge)**:
   - Click the **Event Simulator** tab.
   - Fire a `REWARD_POOL_SPIKE` event.
   - Switch to the **Thought Stream**:
     - **Kael (#0)** evaluates the spike, sees its Risk Tolerance (95) exceeds the threshold, and immediately executes `stake`.
     - **Nyx (#4)** evaluates the same spike, sees its Risk Tolerance (10) is too low, and decides to `hold position (NOOP)`.
   - *Key Talking Point*: *"Identical market conditions yield fundamentally different, deterministic decisions because each agent’s cognitive loop is governed by its unique on-chain personality profile."*

---

### **Segment 3: Live Agent-to-Agent Trade Negotiation & Policy Guardrails (Minutes 4–7)**

1. **Trigger Bilateral Negotiation**:
   - Fire a `RARE_ITEM_DISCOVERED` event targeting Token #0 (Kael) and Token #1 (Lyra).
   - In the **Bilateral Trade Visualizer**, watch Kael create a trade proposal to acquire the tactical asset.
   - Watch Lyra's cognitive cycle receive the webhook, check its relational memory with Kael, calculate its effective trust score, and autonomously respond with `accept`.
   - Show the resulting atomic swap transaction in the **On-Chain Activity Feed** with a clickable Polygonscan link.

2. **Demonstrate Security Policy & Kill Switch**:
   - Click the **Security Policy** tab.
   - Show the intercepted policy violations counter.
   - Click the **Revoke Key** button on any active character.
   - Show that the session status instantly changes to `REVOKED / INACTIVE`, and any subsequent agent action is blocked before any gas is spent.
   - *Key Talking Point*: *"This demonstrates non-custodial safety: if an agent ever exhibits erratic behavior, the player revokes delegation in one click without losing ownership of their NFT."*

---

### **Segment 4: Game Ecosystem Integration & Architecture (Minutes 7–10)**

1. **Architecture Breakdown**:
   - Smart Contracts (Solidity, Polygon Amoy)
   - Backend Service (Fastify, SQLite WAL, Policy Engine, Ethers v6)
   - Cognitive Engine (TypeScript, LangGraph, LLM Structured Output)
   - Mission Control Dashboard (React, Tailwind, WebSockets)

2. **Extensibility to Production Games**:
   - *Key Talking Point*: *"In a live production game (e.g. MetaSpace), the game server sends events in the exact same schema our simulator uses today. The agent layer requires zero modification to transition from simulation to live gameplay."*

---

## 🛠️ Step-by-Step Running Guide

### 1. Start Local Hardhat Node & Deploy Contracts (Terminal 1)
```bash
cd contracts
npm run node
# In another terminal:
cd contracts
npm run deploy:local
```

### 2. Start Backend Service (Terminal 2)
```bash
cd backend
npm run operator:setup   # Registers sample session keys & characters
npm run dev              # Starts API & WebSocket at http://localhost:3001
```

### 3. Start Agent Cognitive Layer (Terminal 3)
```bash
cd agents
npm run dev              # Boots 5 LangGraph agent loops on http://localhost:3002
```

### 4. Start Mission Control Dashboard (Terminal 4)
```bash
cd dashboard
npm run dev              # Launches UI on http://localhost:3000
```
