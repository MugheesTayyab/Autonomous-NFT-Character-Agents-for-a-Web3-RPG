# Autonomous NFT Character Agents — Smart Contract Layer (Phase 1)

This package contains the core Solidity smart contracts, comprehensive unit/integration test suites, and Hardhat Ignition deployment modules for **Autonomous NFT Character Agents** on Polygon Amoy.

---

## 🏛️ Smart Contract Architecture

```
                               ┌───────────────────────────┐
                               │     RewardToken (ERC20)   │
                               │        Ticker: MLRD       │
                               └─────────────▲─────────────┘
                                             │ (mints rewards)
┌──────────────────────────┐   ┌─────────────┴─────────────┐   ┌──────────────────────────┐
│   CharacterNFT (ERC721)  │◄──┤       StakingVault        │   │       TradeEscrow        │
│      On-Chain Traits     │   │     (NonReentrant/CEI)    │   │  (Atomic 2-Way Escrow)   │
└────────────▲─────────────┘   └─────────────▲─────────────┘   └─────────────▲────────────┘
             │                               │                               │
             │                 ┌─────────────┴─────────────┐                 │
             └─────────────────┤       AgentRegistry       ├─────────────────┘
                               │  (On-Chain Session Keys)  │
                               └───────────────────────────┘
```

### 1. `RewardToken.sol` (ERC-20)
- Stand-in utility and reward currency for MetaSpace's `$LORD` token.
- Uses OpenZeppelin v5 `ERC20` and `Ownable`.
- Implements a designated `minters` mapping — only approved protocols (such as `StakingVault`) can mint rewards.

### 2. `CharacterNFT.sol` (ERC-721)
- Represents autonomous RPG commander characters with on-chain personality traits:
  - `riskTolerance` (0–100): Determines autonomous staking appetite.
  - `trustBaseline` (0–100): Minimum trust required to accept trade proposals.
  - `aggression` (0–100): Propensity to propose trades and escalate.
  - `patience` (0–100): Tolerance for trade delays and negotiation rounds.
- Five distinct archetypes: `SCAVENGER`, `STRATEGIST`, `BERSERKER`, `DIPLOMAT`, `HOARDER`.
- Directly links to decentralized metadata (IPFS JSON).

### 3. `AgentRegistry.sol`
- Provides verifiable on-chain identity for autonomous session keys.
- Maps `tokenId <=> agentWallet` with `policyHash` (keccak256 hash of off-chain permissions) and `expiresAt` timestamps.
- Features an instant **Owner Kill Switch** (`revokeAgent`) to immediately terminate agent permissions on-chain.

### 4. `StakingVault.sol`
- Manages NFT staking and linear reward emission (10 MLRD/day in wei/sec).
- Only authorized agent session-key wallets verified through `AgentRegistry` can stake or unstake.
- Strictly adheres to **Checks-Effects-Interactions (CEI)** pattern and OpenZeppelin `ReentrancyGuard`.

### 5. `TradeEscrow.sol`
- Enables trustless atomic two-way NFT trades between agent session-key wallets.
- Locks the proposer's NFT in escrow during proposal, and atomically executes the two-way swap upon target acceptance.
- Supports cancellation and asset return by either trade participant before settlement.

---

## 🚀 Quick Start & Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Compile Contracts
```bash
npm run compile
```

### 3. Run Test Suite
```bash
npm test
```
*Current test suite: **50 passing tests** across all unit and integration scenarios.*

### 4. Run Code Coverage
```bash
npm run coverage
```
*Coverage Metrics:*
- Statements: **97.98%**
- Functions: **96.77%**
- Lines: **93.75%**

### 5. Local Ignition Deployment
```bash
npm run deploy:local
```

### 6. Polygon Amoy Deployment
1. Copy `.env.example` to `.env` and fill in your keys:
   ```env
   AMOY_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY
   DEPLOYER_PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY
   POLYGONSCAN_API_KEY=YOUR_POLYGONSCAN_KEY
   ```
2. Fund deployer wallet with test POL from [Polygon Faucet](https://faucet.polygon.technology/).
3. Deploy all contracts:
   ```bash
   npm run deploy:amoy
   ```
4. Mint the initial 5 calibrated character NFTs:
   ```bash
   npm run mint:amoy
   ```

---

## 🔒 Security & Best Practices
1. **Checks-Effects-Interactions (CEI)**: Enforced across all asset-handling functions.
2. **Reentrancy Protection**: OpenZeppelin v5 `ReentrancyGuard` applied on all state-mutating external calls.
3. **Immutability**: Core contract relationships (`characterNFT`, `rewardToken`, `agentRegistry`) are `immutable` state variables set during construction.
4. **Scoped Authority**: Session-key wallets can only operate on their linked token ID and are subject to time-bounded expiration.
