# Autonomous NFT Character Agents — Backend Service & Policy Engine (Phase 2)

The backend service acts as the **connective tissue** and **security gateway** between on-chain smart contracts (Polygon Amoy) and autonomous AI agents (Phase 3 LangGraph layer).

---

## 🏛️ System Architecture

```
                    ┌────────────────────────┐
                    │   Phase 3: AI Agents   │
                    │   (LangGraph Reasoner) │
                    └───────────┬────────────┘
                                │ HTTP API calls (actions)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND SERVICE LAYER                        │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                      Action API                         │   │
│   │   (Fastify + Zod Request Validation + CORS)             │   │
│   └───────────────────────────┬─────────────────────────────┘   │
│                               │                                 │
│                               ▼                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                    Policy Engine                        │   │
│   │   1. Allowed Actions Check (e.g., Hoarder restrictions) │   │
│   │   2. Spend / Frequency Limits (max stakes, max trades)  │   │
│   │   3. Session Expiry & Revocation Check                  │   │
│   └─────────────┬─────────────────────────────┬─────────────┘   │
│                 │                             │                 │
│                 ▼ (If Approved)               ▼ (Rejection)     │
│   ┌──────────────────────────┐  ┌───────────────────────────┐   │
│   │    Transaction Signer    │  │    Local State Cache      │   │
│   │   (Scoped Session Key)   │  │   (SQLite WAL Database)   │   │
│   │   Nonce / Gas Buffers    │  │  Characters / Memory Logs │   │
│   └─────────────┬────────────┘  └─────────────▲─────────────┘   │
│                 │                             │                 │
└─────────────────┼─────────────────────────────┼─────────────────┘
                  │ Broadcast Tx                │ Sync On-Chain State
                  ▼                             │ WebSocket Events
┌───────────────────────────────────────────────┴─────────────────┐
│            POLYGON BLOCKCHAIN / SMART CONTRACTS                 │
│   CharacterNFT │ StakingVault │ TradeEscrow │ AgentRegistry     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛡️ Core Features

### 1. Scoped Session Key Architecture
- Each character agent (token ID 0–4) is assigned a dedicated session-key wallet.
- The session key is funded with minimal test POL and registered on-chain in `AgentRegistry`.
- Private keys never leak to AI agents or API clients.

### 2. Policy Engine (3-Tier Security Gate)
Every action request passes through `PolicyEngine.evaluate()` before anything is signed:
1. **Allowed Actions Check**: Verifies if the requested action is permitted in the character's active JSON policy document.
2. **Spend & Resource Limits**: Enforces `maxStakeCycles` and `maxActiveTrades`.
3. **Session Expiry & Kill Switch**: Verifies session key timestamp and on-chain active status.
- Rejections are written to `agent_memory` with `event_type = 'POLICY_REJECTED'` and return `403 Forbidden` with zero gas wasted.

### 3. Real-Time Blockchain Event Listener
- Subscribes to 8 contract events over WebSocket with exponential backoff auto-reconnect:
  - `CharacterMinted`
  - `AgentRegistered`
  - `AgentRevoked`
  - `CharacterStaked`
  - `CharacterUnstaked`
  - `TradeProposed`
  - `TradeSettled`
  - `TradeCancelled`
- Runs startup on-chain reconciliation before opening event subscriptions.

### 4. Local SQLite State Cache
- Embedded SQLite with Write-Ahead Logging (WAL) and foreign key integrity.
- Stores:
  - `characters` (tokens, on-chain traits, staking state, claimed rewards)
  - `session_keys` (scoped policies, expiration, active status)
  - `trades` (trade proposals, escrow status, sentiments)
  - `agent_memory` (decision logs, outcomes, sentiment tags)

---

## 📡 Action API Endpoints

| Method | Route | Description |
|---|---|---|
| `POST` | `/agents/:tokenId/stake` | Agent requests to stake its character in StakingVault |
| `POST` | `/agents/:tokenId/unstake` | Agent requests to unstake and claim MLRD rewards |
| `POST` | `/agents/:tokenId/proposeTrade` | Agent proposes NFT trade with target character (`{ targetTokenId }`) |
| `POST` | `/agents/:tokenId/respondTrade` | Agent accepts or rejects trade (`{ tradeId, response: "accept"\|"reject" }`) |
| `GET` | `/agents/:tokenId/status` | Returns character details, traits, active session key, staking rewards, open trades |
| `GET` | `/agents/:tokenId/memory` | Returns memory history & decision log (`?limit=20`) |
| `GET` | `/health` | Service health status check |

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` and configure your contract addresses and RPC URLs:
```bash
cp .env.example .env
```

### 3. Run Test Suite
```bash
npm test
```
*Current test suite: **24 passing tests** covering policy engine, repositories, event listener, and API routes.*

### 4. Run Operator Setup (On-Chain Approvals & Session Key Registration)
```bash
npm run operator:setup
```

### 5. Start Development Server
```bash
npm run dev
```
The server will start on `http://127.0.0.1:3001` and connect to the blockchain event stream.
