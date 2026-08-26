# Phase 1: Smart Contract Layer
### Autonomous NFT Character Agents — Implementation Planning

---

## What This Phase Is

This is the on-chain foundation. Every other phase — the backend, the agents, the dashboard — depends on these contracts being deployed, tested, and verified first. Do not move to Phase 2 until every contract is live on Polygon Amoy and manually confirmed to work via Polygonscan.

The single most important principle of this phase: **keep every contract as simple as possible**. This is a demonstration of understanding, not a production financial system. A clean, well-commented, simple contract is far more valuable here than a clever, dense one.

---

## What You're Building (5 Contracts)

### 1. RewardToken (ERC-20)

A freely mintable test token that acts as the reward currency for staking. This stands in for MetaSpace's `$LORD` token. It needs to be mintable by the StakingVault contract (and only the StakingVault — no one else). Start with a large initial supply minted to the deployer wallet so agent wallets can be funded easily during setup.

Use **OpenZeppelin's ERC-20** as the base. Do not write token logic from scratch — using OZ signals that you know not to reinvent audited security primitives, which is exactly what a MetaSpace reviewer wants to see.

### 2. CharacterNFT (ERC-721)

Each minted token is one game character. The key difference from a standard NFT: each token stores **personality traits on-chain** — numeric values (0–100 scale) for risk tolerance, trust level, aggression, and patience. These traits are not flavor text; they are the data the AI agents in Phase 3 will read and use to make decisions.

Five archetypes to mint for the demo:

| Name | Archetype | Personality Summary |
|---|---|---|
| Kael | Berserker | Max risk, near-zero patience, highly aggressive |
| Lyra | Strategist | Low risk, high trust, very patient |
| Rexx | Scavenger | Moderate risk, low trust, opportunistic |
| Voss | Diplomat | Minimal aggression, maximum trust and patience |
| Nyx | Hoarder | Extremely risk-averse, isolated, refuses early trades |

Each character should also store a field for its **agent wallet address** — the session-key wallet that will be linked to it in Phase 2.

Use **OpenZeppelin's ERC-721** with URI storage extension. Metadata (name, traits, artwork URI) should be IPFS-referenced or stored directly on the token for demo simplicity.

### 3. AgentRegistry

This is the contract that makes the system **on-chain verifiable** rather than just an off-chain script pretending to act for an NFT. It formally records: "Token #2 is authorized to be operated by session-key wallet 0xABC, with this policy hash, valid until this expiry timestamp."

Key functions it needs:
- Register a new agent (link a session key to a token)
- Update an agent's policy or extend its session
- Revoke an agent immediately (the human owner's instant kill switch — a headline talking point for the demo)
- Check whether a given wallet address is currently an active, non-expired authorized agent

The **instant revocation** capability is critical to demo. It proves that even though agents act autonomously, humans retain full, immediate control at all times.

### 4. StakingVault

This is the contract an agent calls when it autonomously decides to stake its character. A staked NFT is transferred into the vault and begins accruing reward tokens at a fixed rate per unit of time. When unstaked, the NFT returns to the original human owner along with all accrued rewards.

Key design requirements:
- Only the **authorized agent session-key wallet** (verified through AgentRegistry) can stake or unstake a given character — no random wallet can trigger this on behalf of someone else's character
- Use the **Checks-Effects-Interactions** pattern for every function that moves assets — this prevents the reentrancy exploit class that has caused hundreds of millions of dollars in real-world losses
- Use **ReentrancyGuard** (from OpenZeppelin) on all asset-moving functions
- Reward calculation should be simple: a fixed number of tokens per day per staked NFT is sufficient for a demo

Every action must emit a structured **event** — `CharacterStaked`, `CharacterUnstaked`, `RewardsClaimed` — because the backend's event listener in Phase 2 depends entirely on these events to know what happened.

### 5. TradeEscrow

This is the atomic settlement layer. When two agents agree to trade, neither party should have to trust the other to follow through. The contract holds both NFTs in escrow and only releases them after both sides have confirmed — if either side cancels, both NFTs are returned. Either the whole trade happens, or nothing does.

Key functions:
- `proposeTrade`: Agent A locks its NFT into escrow and declares what it wants from Agent B
- `acceptTrade`: Agent B confirms, locks its own NFT, and the contract atomically swaps both and releases them to the correct owners
- `cancelTrade`: Either party can cancel a pending proposal; the proposer's escrowed NFT is returned

Again, every function must emit an event — `TradeProposed`, `TradeSettled`, `TradeCancelled` — for the backend listener.

---

## Technology Decisions

**Framework**: Hardhat 3 with Hardhat Ignition for deployment. Hardhat is the right choice here because of its rich TypeScript tooling and plugin ecosystem. Ignition gives you declarative, reproducible deployments — the ability to redeploy the entire system from one command is important for a demo.

**Library**: OpenZeppelin Contracts v5. Industry standard. Always use audited libraries for token primitives and access control. Never write ERC-20 or ERC-721 logic from scratch.

**Language**: Solidity 0.8.24 with the optimizer enabled (200 runs is the standard setting for deployed contracts).

**Network**: Polygon Amoy testnet (Chain ID: 80002). Free, public, Ethereum-compatible. Get test POL tokens from the official Polygon faucet.

**Verification**: All contracts should be verified on Polygonscan Amoy after deployment — this means anyone can read the source code directly from the block explorer, which is a key demo element (showing verified contracts proves they are real, public, and transparent).

**RPC Provider**: Alchemy or Infura free tier. Both support Polygon Amoy. You'll need the RPC URL for deployment and for the backend in Phase 2.

---

## Security Principles to Follow Throughout

These are not optional — each one is a talking point during the demo:

- **Checks-Effects-Interactions**: In every function that moves tokens or NFTs, validate all conditions first (Checks), update all state variables second (Effects), then call external contracts last (Interactions). This ordering prevents reentrancy attacks.
- **ReentrancyGuard**: Applied to every function that moves assets. Direct reference to the DAO hack and all similar exploits since.
- **Minimal privilege**: Only the registered agent session-key wallet can act for its specific character. Not any other wallet, not the deployer, not anyone else. Access is scoped to the specific character.
- **Immutable contract addresses**: Key dependencies (the NFT contract address, the registry address) should be set in the constructor and stored as `immutable` — they cannot change after deployment, which eliminates a class of upgrade-related attack vectors.
- **Event completeness**: Every single state change must emit an event. This is both an architecture requirement (the backend depends on it) and a security audit best practice (nothing happens silently on-chain).

---

## Testing Strategy

The testing target is ≥90% line coverage. Tests run on the local Hardhat network — no waiting for testnet confirmations, instant feedback.

Test categories to cover for each contract:

**Happy path tests**: Every core function works correctly under normal conditions. Minting returns the right token ID. Staking moves the NFT. Trade acceptance swaps ownership.

**Access control tests**: Every function that has a permission check must be tested to confirm it reverts when called by an unauthorized address.

**Boundary tests**: Edge cases — trait value at exactly 100 (should pass), at 101 (should revert), at 0 (should pass). Empty stake, double-stake, unstaking when nothing is staked.

**Event emission tests**: Confirm every state-changing function emits the correct event with the correct parameters. This is not just good practice — in Phase 3, agent behavior depends on these events being correctly structured.

**Integration tests**: A full end-to-end flow: mint → register agent → approve NFT → stake → wait → unstake → confirm rewards. Then separately: mint two characters → propose trade → accept trade → confirm ownership swap.

Run gas reporting during tests to identify any obviously wasteful functions. This demonstrates production-minded thinking even on a testnet project.

---

## Deployment Sequence

The contracts must be deployed in dependency order:

1. Deploy **RewardToken** (no dependencies)
2. Deploy **CharacterNFT** (no dependencies)
3. Deploy **AgentRegistry** (no dependencies)
4. Deploy **StakingVault** (needs RewardToken + CharacterNFT + AgentRegistry addresses)
5. Deploy **TradeEscrow** (needs CharacterNFT + AgentRegistry addresses)
6. Post-deploy setup: grant StakingVault minting rights on RewardToken

Use a single Hardhat Ignition module that handles the entire sequence. This means the full system can be redeployed with one command — essential for demos and for proving reproducibility.

After each deployment to Amoy, verify the contract source on Polygonscan. Verified contracts have a green checkmark and show source code, read functions, and write functions directly in the browser — this is what you'll show during the demo.

---

## Manual Verification Before Moving to Phase 2

After deployment, manually run through every flow using Polygonscan's write tab and simple scripts — no agents, no backend, just direct contract calls:

- Mint all 5 characters → confirm they appear on Polygonscan
- Call `stake()` for one character → confirm the `CharacterStaked` event appears in the transaction logs
- Call `unstake()` → confirm the NFT returned and rewards were minted
- Propose a trade between two characters → confirm `TradeProposed` event
- Accept the trade → confirm `TradeSettled` and verify the NFT ownership swap on-chain
- Register an agent, then immediately revoke it → confirm subsequent staking attempt reverts

Record every deployed contract address in a `.env` file for Phase 2.

---

## Recruiter Impact Summary

This phase demonstrates, in a way any blockchain engineer can immediately evaluate:

- You can write and deploy Solidity contracts from scratch, using industry-standard libraries and security patterns
- You understand why every contract event matters (it's not just logging — it's what makes the entire reactive system possible)
- You understand and can explain the reentrancy attack class, and you prevented it correctly
- You used Hardhat Ignition — the 2026 professional standard for reproducible deployments
- Every contract is **publicly verified on Polygonscan** — not a local script, not a toy, but a real on-chain system anyone can inspect

---

## Phase 1 Completion Criteria

Do not start Phase 2 until all of the following are true:

- [ ] All 5 contracts compile with no errors or warnings
- [ ] Test suite passes with ≥ 90% coverage
- [ ] All 5 contracts deployed to Polygon Amoy and verified on Polygonscan
- [ ] All 5 character NFTs minted on testnet
- [ ] Manual end-to-end flows tested and confirmed working
- [ ] All contract addresses documented and ready for Phase 2
