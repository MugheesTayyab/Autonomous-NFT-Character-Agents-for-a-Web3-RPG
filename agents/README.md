# Autonomous NFT Character Agents — Cognitive Layer (Phase 3)

The Cognitive Layer runs **autonomous LangGraph state machines** for each character NFT. Agents observe on-chain market conditions, reason using calibrated personality traits and memory feedback, and execute actions via the Phase 2 Action API.

---

## 🧠 LangGraph Cognitive Architecture

Each character agent operates an independent 4-node `StateGraph`:

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

### The 4 Nodes:
1. **`observeNode`**: Queries `GET /agents/:tokenId/status` and `GET /agents/:tokenId/memory` to collect current stake status, reward balances, and open trade proposals.
2. **`reasonNode`**: Evaluates observations against numerical traits (`riskTolerance`, `trustBaseline`, `aggression`, `patience`). Supports OpenAI LLM with structured output + calibrated deterministic reasoning.
3. **`actNode`**: Dispatches validated HTTP actions (`stake`, `unstake`, `proposeTrade`, `respondTrade`) to the Action API.
4. **`rememberNode`**: Synthesizes the cognitive cycle into human-readable narratives, logs sentiment (`POSITIVE`, `NEUTRAL`, `NEGATIVE`), and stores feedback.

---

## 🎭 Character Personas & Trait System

| Token | Character Name | Archetype | Risk | Trust | Aggression | Patience | Strategy |
|---|---|---|---|---|---|---|---|
| **0** | **Kael the Unbroken** | `BERSERKER` | **95** | **15** | **90** | **10** | Aggressive staking and trade proposals. Rejects offers from strangers immediately. |
| **1** | **Lyra the Tactical** | `STRATEGIST` | **30** | **80** | **20** | **85** | High patience, evaluates history. Accepts win-win proposals. |
| **2** | **Rexx the Scavenger** | `SCAVENGER` | **70** | **25** | **60** | **40** | Opportunistic arbitrage between staking yields and trade opportunities. |
| **3** | **Voss the Peacemaker** | `DIPLOMAT` | **20** | **95** | **5** | **90** | Builds alliances; accepts incoming proposals to maximize rapport. |
| **4** | **Nyx the Shadow** | `HOARDER` | **10** | **10** | **15** | **95** | Extreme capital preservation; strictly forbidden from proposing trades. |

### 📈 Dynamic Trust Calculation
$$\text{Effective Trust} = \text{baseTrust} + (\text{positivePastTrades} \times 15) - (\text{negativePastTrades} \times 25)$$

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

### 3. Run Test Suite
```bash
npm test
```
*Current test suite: **14 passing tests** across 6 test files covering observe, reason, act, remember, persona divergence, and multi-agent negotiation.*

### 4. Run Autonomous Agent Runner
```bash
npm run dev
```
