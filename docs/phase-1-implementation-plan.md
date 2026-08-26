# Phase 1 — Detailed Implementation Plan
## Smart Contract Layer: Autonomous NFT Character Agents

> **Who this document is for**: A software engineer beginning Phase 1 from scratch. This document tells you exactly what to do, in what order, what decisions to make and why, what to test and how, what problems to anticipate, and how to know when you're done. It does not include code — it includes everything a skilled engineer needs to write the right code themselves.

---

## Part 1: Mental Model Before You Write a Single Line

Before touching your editor, internalize three things about this phase:

**1. You are building the ground floor, and it must be load-bearing.**
Every layer above this — the backend event listener, the policy engine, the AI agents, the monitoring dashboard — connects to these contracts through events and function calls. If a contract emits a malformed event, the backend will misparse it. If a function has a subtle access control bug, an agent will be able to take unauthorized actions. The contracts must be correct before anything else is built. This is not a phase you can "come back and fix later" because every other phase will be built on top of whatever you ship here.

**2. Simplicity is not laziness — it is the correct engineering decision for this context.**
Every contract should have the minimum number of functions needed to satisfy the requirements. The most impressive-looking contracts for a portfolio reviewer are not the most complex ones — they are the cleanest, most readable, most obviously-correct ones. A smart contract auditor's highest compliment is "I can understand exactly what this does just by reading it." Aim for that.

**3. Events are load-bearing architecture, not logging.**
In a normal web application, log statements are optional — they help you debug, but the application functions without them. In this system, events emitted by smart contracts are the only mechanism through which the backend learns that anything happened on-chain. If a function changes state but does not emit an event, that change is invisible to everything above the contract layer. Treat every event as a required output of every state-changing function, as important as the return value.

---

## Part 2: Development Environment Setup

### 2.1 Account and API Key Prerequisites

Gather the following before writing any contract code. These are external dependencies that cannot be resolved mid-build without interrupting your flow:

**Wallet and test tokens**:
Set up a MetaMask wallet (or any Ethereum-compatible wallet) that you will use exclusively as the deployer account for this project. Do not reuse a personal wallet. After setup, add the Polygon Amoy testnet to this wallet manually (Chain ID: 80002, RPC: from Alchemy/Infura, currency symbol: POL). Then visit the official Polygon Amoy faucet at `faucet.polygon.technology` and request test POL tokens to this wallet. Note that faucets sometimes throttle — request early, keep the wallet funded, and do not drain it on unnecessary transactions. You will need POL to deploy five contracts plus run multiple test transactions.

**RPC provider**:
Register for a free account at Alchemy (`alchemy.com`). Create a new app, select "Polygon Amoy" as the network, and copy the HTTPS endpoint and the WebSocket endpoint. The HTTPS endpoint is used for deployment and sending transactions. The WebSocket endpoint will be needed in Phase 2 for the event listener. Store both. Infura is an equally valid alternative — the choice does not matter.

**Polygonscan API key**:
Register at `amoy.polygonscan.com`. Navigate to the API Keys section in your account settings and generate a new key. This key is used by Hardhat to programmatically verify contracts after deployment — you pass it as a configuration value and Hardhat handles the verification API call automatically.

**IPFS storage** (for character metadata):
Register for a free account at Pinata (`pinata.cloud`). You will upload JSON metadata files for each of the 5 characters and use the resulting IPFS CIDs as the token URIs when minting. This makes the metadata decentralized and permanent, which is standard NFT practice and a signal of technical maturity.

### 2.2 Repository Initialization

The project will be a monorepo — one repository containing all layers (contracts, backend, agents, frontend). Create the root repository directory first and initialize git. Then create a `contracts/` subdirectory. All work in Phase 1 happens inside `contracts/`.

Inside `contracts/`, initialize a new Node.js project. The `package.json` should specify the project as a Hardhat TypeScript project. Install all dependencies before writing any contracts — this avoids dependency resolution surprises mid-development.

Primary dependencies to install:
- **hardhat** (latest v3 — the 2026 professional standard)
- **@nomicfoundation/hardhat-toolbox** (bundles ethers.js, TypeChain, Chai, Mocha, coverage tooling, and gas reporter — a single install gives you the complete development toolkit)
- **@nomicfoundation/hardhat-ignition-ethers** (Hardhat Ignition for declarative deployments)
- **@openzeppelin/contracts** (v5 — the industry-standard contract library)
- **dotenv** (environment variable management)

TypeScript configuration: create a `tsconfig.json` that enables strict mode. This catches a class of type errors that are particularly dangerous in blockchain code where incorrect types on transaction parameters can cause silent failures or incorrect behavior.

### 2.3 Directory Structure Decision

The `contracts/` directory should follow the conventional Hardhat structure from the start, even if some directories are initially empty. This prevents reorganization later and signals familiarity with the standard project layout to anyone who looks at the repository:

```
contracts/
│
├── contracts/          ← All Solidity source files live here
├── test/               ← TypeScript test files, mirroring contracts/
│   └── integration/    ← Integration tests (multi-contract flows)
├── ignition/
│   └── modules/        ← Hardhat Ignition deployment modules
├── scripts/            ← Utility scripts (manual testing, minting, etc.)
├── .env                ← Never committed — all secrets live here
├── .env.example        ← Committed — shows required variable names, no values
├── .gitignore          ← .env + node_modules + artifacts + cache
├── hardhat.config.ts   ← Full Hardhat configuration
└── tsconfig.json
```

Add `.env` to `.gitignore` the moment you create the file. Add the `.env.example` file at the same time. This two-file pattern is the professional standard for secrets management in Node.js projects — `.env.example` tells future readers (or MetaSpace engineers cloning the repo) exactly what environment variables they need to configure, without exposing your own values.

### 2.4 Hardhat Configuration Design

The `hardhat.config.ts` file has five concerns to address:

**Solidity compiler settings**: Use Solidity 0.8.24. Enable the optimizer with 200 runs. The 200-run value is the conventional middle-ground between optimizing for deployment cost (lower runs = smaller bytecode) and optimizing for execution cost (higher runs = cheaper function calls). 200 runs is the standard for non-special-purpose contracts.

**Network definitions**: Define two networks — `hardhat` (the built-in local network, used for all testing) and `polygonAmoy` (the testnet, used only for final deployment and demo). The local network needs no configuration beyond its chainId. The Amoy network needs the RPC URL and the deployer private key, both loaded from environment variables.

**Etherscan/Polygonscan configuration**: Define the Polygonscan Amoy verification configuration under the `etherscan` key. Hardhat's verification plugin handles the API calls — you just provide the API key and the custom chain definition (API endpoint URL and browser URL for Amoy). Hardhat will use these when you run the verify command post-deployment.

**Gas reporter**: Enable gas reporting when the `REPORT_GAS` environment variable is set. This gives you a table of gas costs per function per test run — useful for confirming that no function is obviously more expensive than it needs to be. Not required to be on by default (it slows tests slightly), but should be easy to enable.

**Path configuration**: Hardhat defaults are fine. Do not customize artifact or cache paths unless you have a specific reason — non-standard paths are a common source of confusion when someone else (or the Ignition plugin) tries to find compiled artifacts.

---

## Part 3: Contract Design — Decisions and Rationale

Before writing each contract, make the design decisions explicit. The following sections describe the thinking for each contract, what choices are available, and which choice to make and why.

### 3.1 RewardToken — Design Decisions

**Standard choice**: ERC-20 via OpenZeppelin's base `ERC20.sol`. No extensions beyond what's needed. Do not add ERC-20Permit, ERC-20Votes, or ERC-20Snapshot — these are useful in production systems but add complexity and attack surface to a demo.

**Minting model**: The contract should have a minter role — a list of addresses permitted to call `mint()`. Initially, only the StakingVault has this role. The deployer wallet can add or remove minters. This is intentionally simpler than OpenZeppelin's full `AccessControl` pattern (which uses role hashes and a complex role hierarchy) — a simple minter mapping is easier to read and audit, and provides the same functional guarantee for this use case.

**Initial supply**: Mint a large initial supply (say, 1,000,000 tokens) to the deployer on construction. The deployer will manually transfer some of these to agent session-key wallets and the operator wallet during Phase 2 setup. Having this initial supply avoids the chicken-and-egg problem of an agent needing tokens to stake before the vault has minted any.

**Naming**: Use a name and ticker that are recognizable as "standing in for MetaSpace's reward token" — something like "MetaSpace Reward Token" / "MLRD". This makes the connection to the real product clear without being a copy of the actual `$LORD` token.

**What to NOT add**: No burn mechanism, no cap, no fee-on-transfer. These are all real-world token features that add complexity without adding anything to the demo's goals.

### 3.2 CharacterNFT — Design Decisions

**Standard choice**: ERC-721 with the URI storage extension (`ERC721URIStorage`). The URI storage extension lets you store a metadata URI per token, which is the standard way to link an NFT to its off-chain (IPFS) JSON metadata. Use the base ERC-721 from OpenZeppelin — do not write transfer logic, approval logic, or tokenURI resolution from scratch.

**Trait storage model**: Store traits on-chain as a struct with four `uint8` fields (riskTolerance, trustBaseline, aggression, patience). `uint8` allows values 0–255, and you are validating that all values are ≤ 100 in the mint function. Using `uint8` instead of `uint256` saves storage space — packing multiple `uint8` values into a single storage slot is more gas-efficient than one `uint256` per trait.

**Why on-chain traits and not just IPFS JSON?**: The agents in Phase 3 read traits via a contract view call. If traits lived only in IPFS JSON, the agent would need to fetch and parse IPFS content, which is slower, unreliable, and requires additional off-chain tooling. On-chain trait storage means the agent can read traits with a single, deterministic, fast RPC call. It also means traits are verifiable — anyone can confirm on-chain what a character's traits actually are.

**Archetype enum**: Define an enum for the five archetypes (SCAVENGER, STRATEGIST, BERSERKER, DIPLOMAT, HOARDER). Storing an enum value on-chain is cheaper than storing a string, and it forces type safety — you cannot accidentally set a character's archetype to an undefined value.

**Agent wallet field**: Add a field on the Character struct for the `agentWalletAddress`. This starts as the zero address on mint and is set later when the Phase 2 backend generates the session key and calls `linkAgentWallet()`. This field is the on-chain record connecting the NFT identity to the agent identity.

**Mint access control**: Restrict minting to the contract owner (the deployer wallet) for this demo. In production, this would be more complex (whitelist, public sale with price, etc.) — but for a demo project, owner-only minting keeps the surface area minimal and prevents anyone from minting arbitrary characters that would interfere with the demo.

**Token ID management**: Use a sequential counter starting at 0. The five demo characters will have token IDs 0 through 4. This predictability matters because Phase 2 and Phase 3 will reference characters by token ID in configuration and API calls.

**Character roster and trait values** — finalize these before minting:

| Token ID | Name | Archetype | riskTolerance | trustBaseline | aggression | patience |
|---|---|---|---|---|---|---|
| 0 | Kael | BERSERKER | 95 | 15 | 90 | 10 |
| 1 | Lyra | STRATEGIST | 30 | 80 | 20 | 85 |
| 2 | Rexx | SCAVENGER | 70 | 25 | 60 | 40 |
| 3 | Voss | DIPLOMAT | 20 | 95 | 5 | 90 |
| 4 | Nyx | HOARDER | 10 | 10 | 15 | 95 |

These values are not arbitrary — they are calibrated so that the behavioral differences between characters are clearly visible during the Phase 3 and Phase 4 demos. Kael and Nyx are near-opposite on almost every axis, which makes side-by-side comparison compelling.

### 3.3 AgentRegistry — Design Decisions

**No standard base needed**: This contract has no standard (ERC-20, ERC-721, etc.) to inherit from. It is a pure custom contract. Use `Ownable` from OpenZeppelin for access control — the owner is the deployer, and only the owner can register, update, or revoke agents.

**Policy hash model**: The `policyHash` field is a `bytes32` that stores the `keccak256` hash of the off-chain policy document (a JSON object describing allowed actions, spend limits, and expiry). The full policy lives in the Phase 2 backend database. The contract only stores the hash — this lets anyone verify that the backend is using the same policy that was registered on-chain, without storing the full policy (which would be expensive). This is the same pattern used in legal document notarization on-chain.

**Expiry model**: Store `expiresAt` as a Unix timestamp (`uint256`). The `isAuthorizedAgent()` function checks both that the record is marked `active` and that the current block timestamp is before `expiresAt`. Using block timestamp (`block.timestamp`) is appropriate here — the precision requirement is hours to days, not seconds, so the minor miner manipulation risk of block timestamps is irrelevant.

**Reverse lookup mapping**: Maintain a mapping from `agentWallet => tokenId` in addition to the primary `tokenId => AgentRecord` mapping. This lets the StakingVault and TradeEscrow contracts look up "which character does this calling wallet represent?" in a single storage read, without iterating. Efficiency and simplicity.

**Revocation model**: When an agent is revoked, set the `active` flag to `false` and delete the entry in the reverse lookup mapping. Setting `active = false` is sufficient for authorization checks to fail immediately — the `isAuthorizedAgent()` function returns false whenever `active` is false. Deleting the reverse lookup prevents a revoked wallet from being associated with a token even in a stale read.

**Why this contract is a talking point**: Most autonomous agent systems have no on-chain identity layer — the agent is just a wallet address that happens to hold a key. The AgentRegistry is what makes this system architecturally different: the agent's authorization is publicly recorded on-chain, and anyone can verify it, update it, or revoke it at any time. This is the first step toward the on-chain identity standards (like ERC-7579) that the industry is converging on in 2026.

### 3.4 StakingVault — Design Decisions

**Dependencies**: This contract takes three constructor parameters — the CharacterNFT contract address, the RewardToken contract address, and the AgentRegistry contract address. All three are stored as `immutable` state variables. `immutable` means they are set once in the constructor and can never be changed — this eliminates the attack vector where a compromised admin wallet updates the contract addresses to point to malicious contracts.

**Who can stake**: Only the session-key wallet registered in the AgentRegistry for a specific token ID can call `stake()` or `unstake()` for that token. The contract verifies this by calling `agentRegistry.isAuthorizedAgent(msg.sender)` and then `agentRegistry.getTokenForWallet(msg.sender)` to confirm the calling wallet is the agent for the specific tokenId being staked. This means an agent cannot stake a different character's NFT — it can only ever stake its own.

**NFT approval requirement**: Before the vault can transfer an NFT into escrow, the NFT owner must have approved the StakingVault contract to move their token. The approval is an on-chain transaction that must be completed by the NFT owner (the human player) before their agent can stake. This is standard ERC-721 mechanics — the NFT contract's `transferFrom` function checks that the caller is approved. In Phase 2, the backend setup script will handle this approval transaction.

**Original owner tracking**: When an NFT is staked, store the original owner's address in the `StakeInfo` struct. This is necessary because the NFT is held by the vault contract during staking — calling `ownerOf()` on the NFT contract while staked returns the vault address, not the player. The vault needs to know where to return the NFT when unstaking.

**Reward calculation model**: Linear accrual per second. Choose a simple, transparent formula: a fixed number of tokens per day per staked NFT, calculated as `(block.timestamp - stakedAt) * REWARD_RATE`. The `REWARD_RATE` constant is defined in the contract as tokens per second. Keeping this formula simple means anyone can verify their expected rewards without a complex model. For the demo, approximately 10 tokens per day is a reasonable rate — it means a character staked during a demo session will accumulate a visible, non-trivial reward balance within minutes (when you artificially fast-forward time on the local network during testing).

**The CEI pattern in detail**: Every function in StakingVault that touches assets must follow Checks-Effects-Interactions in strict order:
- First, validate every condition that could cause the transaction to fail (the character is not already staked, the calling wallet is authorized, the amounts are valid).
- Second, update all state variables (record the stake, update the stored staking timestamp, clear the stake record if unstaking).
- Third, and only after state is fully updated, call external contracts (transfer the NFT, mint reward tokens).

The reason for this ordering: if an external call (step 3) somehow reenters the function before state updates (step 2) complete, the reentrancy attacker finds state that still says "not staked" and can stake again, and again, and again — draining the vault. By updating state before any external call, a reentrant call finds state that already says "staked" and fails its precondition check. `ReentrancyGuard` is a belt-and-suspenders addition on top of CEI — it is correct to use both.

**Reward token minting**: The StakingVault calls `rewardToken.mint()` when unstaking to pay out accrued rewards. This only works because the StakingVault has been granted minter role on the RewardToken contract (done in the post-deployment setup step). If `setupMinterRole()` is forgotten during deployment, unstaking will succeed at moving the NFT but fail when trying to mint rewards — a subtle bug to be aware of.

### 3.5 TradeEscrow — Design Decisions

**Trade ID generation**: Each trade needs a unique identifier. Generate the trade ID as the `keccak256` hash of the proposer wallet, the target wallet, both token IDs, and the block timestamp. This combination is practically guaranteed unique for any reasonable demo usage. Using a hash means trade IDs are deterministic and can be predicted/tracked off-chain by the backend before the transaction confirms.

**Storage model**: A mapping from `bytes32` (trade ID) to a `Trade` struct. The `Trade` struct stores all the information needed to settle or cancel the trade: both parties' wallet addresses, both token IDs, the original human owner of the proposer's NFT (stored at proposal time), the current status, and the timestamps.

**Why store the proposer's original owner at proposal time?**: When Agent A's NFT enters escrow at `proposeTrade()`, the NFT's `ownerOf()` value changes from the human owner to the escrow contract. If `acceptTrade()` tries to look up the original owner by calling `ownerOf()`, it gets the escrow contract address — not the human. By storing the original human owner at proposal time in the Trade struct, the settle logic always knows where to send the NFT.

**Atomic settlement**: The `acceptTrade()` function performs the following in a single transaction: take Agent B's NFT into escrow, release Agent A's escrowed NFT to Agent B's human owner, release Agent B's escrowed NFT to Agent A's human owner. Either all three transfers succeed and the transaction is committed, or the transaction reverts and everything returns to its pre-call state. This is what "atomic" means — no intermediate state where one party has transferred their NFT but the other has not yet.

**Status state machine**: The Trade struct has a `status` field that follows a strict state machine: `PROPOSED → SETTLED` or `PROPOSED → CANCELLED`. Only a trade in `PROPOSED` status can be accepted or cancelled. A `SETTLED` or `CANCELLED` trade is final and cannot be interacted with. Every function that operates on a trade must check that the trade is in the correct status before proceeding.

**Who can cancel**: Either the proposer's agent wallet or the target's agent wallet can cancel a `PROPOSED` trade. The contract owner cannot cancel (this keeps the escrow trustless — the deployer/operator has no special power over individual trades). If a trade is cancelled, the proposer's NFT is returned to the proposer's original human owner.

---

## Part 4: Character Metadata — IPFS Upload Workflow

Before minting the five characters, prepare and upload their metadata to IPFS. This is a prerequisite for `mintCharacter()` because the function takes a `metadataURI` parameter that will be stored as the token's URI.

**Metadata JSON structure per character**:
Each JSON file should contain: the character's name, archetype string, description (one or two sentences describing the character's personality and role), all four numeric trait values, the intended agent wallet address (leave as a placeholder — will be updated or stored separately), and optionally an image field pointing to an IPFS-hosted character illustration.

**IPFS upload process**:
Upload each JSON file to Pinata individually. After each upload, copy the CID (Content Identifier) that Pinata returns. The `tokenURI` for each character will be `ipfs://<CID>`. Keep a mapping of token ID to CID in a local notes file — you will need these during the minting script.

**Optional: character illustrations**:
If time permits, generate a simple visual for each character (AI-generated art tools are fine for a portfolio demo). Upload each image to Pinata first, record its CID, then include the image CID in the metadata JSON's `image` field before uploading the JSON. Standard NFT metadata format uses `image: "ipfs://<image-cid>"`.

---

## Part 5: Testing Plan — Detailed

### 5.1 Test File Organization

Create one test file per contract, plus one integration test file. The naming convention should mirror the contract name exactly — `CharacterNFT.test.ts` tests only `CharacterNFT`, `StakingVault.test.ts` tests only `StakingVault`, and `integration/FullFlow.test.ts` tests multi-contract interactions.

Every test file should have a `describe` block per contract and nested `describe` blocks per function or feature area. The naming convention `describe("functionName() — scenario")` makes test output readable and self-documenting.

### 5.2 Test Setup Pattern

Each test file's `beforeEach` hook should:
1. Get test signers from `ethers.getSigners()` — at minimum: deployer, user1 (simulating a human NFT owner), user2 (simulating a second human NFT owner), and agentWallet1 and agentWallet2 (simulating session-key wallets)
2. Deploy the relevant contract(s) fresh for each test — this prevents state from one test leaking into another
3. For tests that require multi-contract setup (like StakingVault tests), deploy and wire all dependencies in the setup

Fresh deployment per test is slower than reusing a deployment, but it guarantees complete isolation. Given the small number of contracts and the local Hardhat network's speed, this is the correct choice.

### 5.3 RewardToken Test Cases

**Constructor behavior**: Confirm that the deployer receives the initial supply on deployment. Confirm the token name and symbol are correct. Confirm the deployer is not automatically a minter (they are the owner, but the minter list is initially empty).

**addMinter / removeMinter**: Confirm only the owner can call these functions. Confirm a non-owner call reverts with the correct custom error. Confirm that after `addMinter`, the added address can call `mint()`. Confirm that after `removeMinter`, the previously added address cannot call `mint()`.

**mint()**: Confirm that an authorized minter can mint tokens to any address. Confirm the recipient's balance increases by the minted amount. Confirm the total supply increases correctly. Confirm that a non-minter calling `mint()` reverts.

**Edge cases**: Mint 0 tokens (should succeed or revert gracefully — check OpenZeppelin's behavior). Mint to the zero address (OpenZeppelin's ERC-20 will revert this).

### 5.4 CharacterNFT Test Cases

**mintCharacter()**: Confirm the function returns the correct sequential token ID (0, then 1, then 2). Confirm the character struct is stored with all the correct field values. Confirm the token URI is stored correctly. Confirm the `CharacterMinted` event is emitted with the correct parameters (token ID, name, archetype, owner address). Confirm a second mint increments the ID.

**Trait validation**: Confirm minting with each trait at exactly 100 succeeds. Confirm minting with any trait at 101 reverts with the correct error message. Confirm minting with all traits at 0 succeeds.

**Access control on mintCharacter**: Confirm a non-owner address reverts with `OwnableUnauthorizedAccount`. The signer used should be a fresh address with no special permissions.

**linkAgentWallet()**: Confirm only the owner can call it. Confirm calling it for a non-existent token ID reverts. Confirm after a successful call, `characters[tokenId].agentWalletAddress` equals the provided address and `agentRegistered` is `true`. Confirm the `AgentWalletLinked` event is emitted.

**getTraits()**: Confirm it returns the correct trait values for an existing token. Confirm it reverts for a non-existent token ID.

**Transfer behavior**: Confirm that after minting, the owner of the token is the `to` address provided. Confirm that the NFT can be transferred to another address using the standard ERC-721 `transferFrom()`.

### 5.5 AgentRegistry Test Cases

**registerAgent()**: Confirm only the owner can register. Confirm that after registration, `agentRecords[tokenId].agentWallet` equals the provided wallet. Confirm `walletToToken[agentWallet]` equals the token ID. Confirm `isAuthorizedAgent(agentWallet)` returns true immediately after registration. Confirm the `AgentRegistered` event is emitted with all correct parameters.

**Authorization checks in isAuthorizedAgent()**: Register an agent with a 1-hour duration. Confirm `isAuthorizedAgent()` returns true immediately. Then use Hardhat's `time.increase()` utility to fast-forward the block timestamp by 3601 seconds (past the 1-hour mark). Confirm `isAuthorizedAgent()` now returns false. This time-manipulation test is critical — it proves the expiry logic works correctly.

**updateAgent()**: Confirm the policy hash and expiry are updated correctly. Confirm that after an extension, a previously-expired agent becomes authorized again (if time is fast-forwarded to mid-extension).

**revokeAgent()**: Confirm only the owner can revoke. Confirm that after revocation, `isAuthorizedAgent()` returns false immediately. Confirm that the reverse lookup mapping (`walletToToken`) is cleared — calling `getTokenForWallet()` for the revoked wallet should return 0 or the default value. Confirm the `AgentRevoked` event is emitted.

**Edge cases**: Register an agent with the zero address (should revert). Register with zero duration (should revert). Revoke an already-revoked agent (should revert with an appropriate message).

### 5.6 StakingVault Test Cases

**Setup requirements**: Deploy all four prerequisite contracts (RewardToken, CharacterNFT, AgentRegistry, StakingVault). Mint a character NFT. Register an agent for that character. Approve the StakingVault to transfer the NFT from the character owner. This full setup must be in `beforeEach` for every StakingVault test.

**stake()**: Confirm the NFT moves from the owner's wallet to the vault contract (`ownerOf(tokenId)` should return the vault address). Confirm the `StakeInfo` is stored with the correct original owner and timestamp. Confirm the `CharacterStaked` event is emitted. Confirm an unauthorized wallet calling `stake()` (not the registered agent) reverts with the correct message.

**Attempting to stake when already staked**: Confirm a second `stake()` call on the same token ID reverts.

**Reward accrual**: After staking, fast-forward the Hardhat block timestamp by a known number of seconds. Call `pendingRewards(tokenId)` and confirm the returned value matches the expected formula output for that elapsed time. This verifies the reward math is correct without needing to unstake.

**unstake()**: Confirm the NFT returns to the original human owner. Confirm reward tokens are minted to the original human owner in the correct amount. Confirm the `CharacterUnstaked` and `RewardsClaimed` events are both emitted. Confirm the `StakeInfo` mapping entry is deleted (calling `stakes[tokenId].stakedAt` should return 0 after unstaking).

**Unstaking when not staked**: Confirm `unstake()` reverts when called for a token that is not currently staked.

**Session key expiry interaction**: Register an agent, stake, then fast-forward time past the session key expiry. Confirm that `unstake()` fails because the session key is expired. This is an important test — it shows that expiring session keys actually stop agents from acting, even for their own character.

### 5.7 TradeEscrow Test Cases

**Setup requirements**: Deploy CharacterNFT, AgentRegistry, and TradeEscrow. Mint two characters (token 0 and token 1). Register two agents (agent1Wallet for token 0, agent2Wallet for token 1). The human owners of each character must approve the TradeEscrow to transfer their NFTs.

**proposeTrade()**: Confirm the trade ID is returned. Confirm the Trade struct is stored correctly with the right status (PROPOSED), both wallet addresses, both token IDs, and the proposer's original owner. Confirm the proposer's NFT moves into escrow (vault owns it). Confirm the `TradeProposed` event is emitted with all correct parameters. Confirm an agent can only propose a trade for their own character's token ID — attempting to offer a different character's token should revert.

**acceptTrade()**: Only the target agent can call this. Confirm the trade status changes to SETTLED. Confirm the proposer's escrowed NFT goes to the target's human owner. Confirm the target's NFT goes to the proposer's human owner. Confirm the `TradeSettled` event is emitted. Confirm the `acceptTrade()` call fails if the trade is already SETTLED or CANCELLED.

**cancelTrade()**: Both the proposer's agent and the target's agent can cancel. Confirm the proposer's NFT is returned to the proposer's human owner after cancellation. Confirm status changes to CANCELLED. Confirm a SETTLED or CANCELLED trade cannot be cancelled again.

**Access control edge cases**: A random wallet (not a trade participant) calling `cancelTrade()` should revert. An unauthorized wallet calling `acceptTrade()` (not the target's agent) should revert. An expired session key calling `acceptTrade()` after time-forwarding should fail the authorization check.

### 5.8 Integration Test: Full Flow

This test deploys all five contracts, mints two characters, registers two agents, and runs through two complete end-to-end flows without stopping:

**Flow 1 — Staking lifecycle**: Approve vault → stake token 0 via agent0 → fast-forward time 24 hours → call `pendingRewards()` and record the value → unstake via agent0 → confirm token returned to owner → confirm reward tokens minted to owner → confirm balance matches the earlier `pendingRewards()` reading.

**Flow 2 — Trade lifecycle**: Approve escrow for both tokens → agent0 proposes trade of token 0 for token 1 → confirm token 0 in escrow → agent1 accepts → confirm token 0 now owned by user2 (owner of token 1) → confirm token 1 now owned by user1 (owner of token 0) → confirm neither token is in escrow.

The integration test should be run last and can be slower than unit tests — it validates the entire contract system as a whole.

---

## Part 6: Deployment Execution Plan

### 6.1 Local Deployment Validation

Before touching Polygon Amoy, run the full Ignition deployment against the local Hardhat network. This confirms:
- All constructor arguments are correct and in the right order
- The post-deployment `setupMinterRole()` call succeeds
- No deployment-time errors or reverts
- The Ignition module correctly captures and exposes all deployed contract addresses

After local deployment succeeds, run a quick manual test using the deployed addresses: mint one character, register one agent, stake it, unstake it. This is not part of the automated test suite — it is a manual sanity check on the deployed system state.

### 6.2 Polygon Amoy Deployment

Switch the Ignition deployment target to `polygonAmoy`. Before running, confirm:
- The deployer wallet has sufficient POL balance for five contract deployments plus several test transactions (at least 0.5 POL is a safe minimum — if the balance is low, get more from the faucet before starting)
- The `AMOY_RPC_URL` in `.env` is a working Alchemy or Infura endpoint (test it by running a simple balance check script first)
- The `DEPLOYER_PRIVATE_KEY` in `.env` is correct and corresponds to the funded wallet

Run the deployment. It will take longer than local — testnet transactions need to be confirmed by validators. Hardhat Ignition shows progress. After each contract deploys, it logs the address. When the full module completes, copy all five contract addresses and their names into a structured notes file.

### 6.3 Contract Verification on Polygonscan

Run verification for each contract immediately after deployment — do not wait, and do not deploy all five and then verify, because verification requires the deployed bytecode to match the source code exactly, and if anything in your environment changes between deploy and verify, verification can fail.

Verification requires: the contract address, the contract name, and all constructor arguments in the same order as the constructor signature. Hardhat's verify command handles the API interaction with Polygonscan — you just provide the inputs.

After verification completes, visit `amoy.polygonscan.com`, search each contract address, and confirm: a green checkmark appears, the "Contract" tab shows the verified source code, and the "Read Contract" and "Write Contract" tabs are populated with the function interfaces. Take a screenshot or save the Polygonscan URL for each contract — these are your primary demo evidence links.

### 6.4 Post-Deployment Minting

After deployment and verification, run the minting script to create all five characters. The minting script should:
1. Mint each character in order (token ID 0 through 4) using the trait values defined in the character roster
2. Log each transaction hash as it completes
3. After all five mints, verify by calling `characters(0)` through `characters(4)` via Polygonscan's read interface and confirming the correct data

Minting all five before starting Phase 2 means Phase 2 can immediately read them without additional setup steps.

---

## Part 7: Manual End-to-End Verification Plan

After minting, run the following manual verification flows using Polygonscan's Write Contract interface (or a simple utility script). This is the final gate before Phase 2.

**Verification 1 — Staking and unstaking**:
Using the deployer wallet: call `AgentRegistry.registerAgent()` to register the deployer wallet as a temporary agent for token 0. Approve the StakingVault to transfer token 0 (call `CharacterNFT.approve(stakingVaultAddress, 0)`). Call `StakingVault.stake(0)`. On Polygonscan, find the transaction and open the event logs — confirm a `CharacterStaked` event is present with the correct token ID, agent wallet, and timestamp. Wait a few minutes, then call `StakingVault.unstake(0)`. Confirm the `CharacterUnstaked` and `RewardsClaimed` events in the transaction logs. Check the deployer wallet's RewardToken balance — confirm it increased by the expected amount.

**Verification 2 — Trade proposal and settlement**:
Register the deployer as agent for token 0 and a second wallet as agent for token 1. Approve the TradeEscrow for both tokens. Call `TradeEscrow.proposeTrade(0, 1, agent2Wallet)`. Note the returned trade ID from the event log. Confirm token 0 is now owned by the TradeEscrow contract. From agent2Wallet, call `TradeEscrow.acceptTrade(tradeId)`. Confirm token 0 is now owned by the owner of token 1. Confirm token 1 is now owned by the owner of token 0.

**Verification 3 — Agent revocation**:
While an agent is registered for token 0, call `AgentRegistry.revokeAgent(0)`. Immediately call `AgentRegistry.isAuthorizedAgent(agentWalletAddress)` via the Read Contract tab. Confirm it returns `false`. Attempt to call `StakingVault.stake(0)` from the revoked agent wallet — confirm the transaction reverts.

All three verifications must pass before declaring Phase 1 complete.

---

## Part 8: Documentation to Produce During Phase 1

**Contract address registry**: A text file or section in the README listing all five contract addresses, the network (Polygon Amoy), the deployment date, and the Polygonscan verification link for each. This file is referenced by Phase 2's environment configuration.

**Character roster reference**: A table in the README (or a separate `characters.md` file) listing all five minted characters with their token IDs, trait values, IPFS metadata CIDs, and Polygonscan NFT links. Phase 3 uses this as its character configuration reference.

**Gas usage report**: After running the tests with `REPORT_GAS=true`, save the gas reporter output. Add a section to the README noting the gas cost of the most expensive functions (staking and trade proposal are likely the most expensive). This demonstrates production awareness even on a testnet project.

**Architecture diagram**: Add a simple ASCII or Mermaid diagram to the README showing the five contracts and their relationships (which contracts call which, what data flows between them). This makes the contract layer immediately understandable to anyone reading the repository.

---

## Part 9: Common Pitfalls and How to Avoid Them

**Pitfall 1 — Forgetting `setupMinterRole()` after deployment**:
The StakingVault calls `rewardToken.mint()` during `unstake()`. If the StakingVault has not been added to the RewardToken's minter list, `unstake()` will revert at the mint call — but only after the NFT has already been transferred back to the owner. This creates a difficult-to-debug state where the NFT is back in the owner's wallet but no reward tokens were minted. Avoid this by making `setupMinterRole()` the very first post-deployment call in the Ignition module, not an afterthought.

**Pitfall 2 — NFT approval not set before staking**:
`StakingVault.stake()` calls `characterNFT.transferFrom(nftOwner, address(this), tokenId)`. This only works if the NFT owner has previously called `characterNFT.approve(stakingVaultAddress, tokenId)`. If the approval is missing, `transferFrom` reverts with a "not approved" error. In the test setup, approval is handled in `beforeEach`. In production (Phases 2 and 4), the backend setup script must handle this approval transaction before any agent can stake.

**Pitfall 3 — Incorrect CEI ordering causing test confusion**:
If you accidentally write a function that emits an event at the wrong point in the CEI order (say, emitting `CharacterStaked` before the NFT transfer), the event might still be visible in a passing test, but the ordering is semantically wrong. Pay attention to where events are emitted — they should come after state updates and after external calls, so they reflect the final committed state.

**Pitfall 4 — Testing with the deployer wallet as the agent**:
During local testing, it is tempting to use `owner` (the deployer) as both the NFT owner and the agent wallet for simplicity. This can mask access control bugs — since the deployer has owner privileges, some permission checks might pass for the wrong reason. Always use distinct signers for the NFT owner, the deployer, and the agent wallet in tests.

**Pitfall 5 — Block timestamp vs. real time in tests**:
The `block.timestamp` in Hardhat's local network starts at a recent Unix timestamp but does not advance in real time — it only advances when you mine new blocks or use `time.increase()`. If your reward calculation relies on `block.timestamp - stakedAt`, tests that do not explicitly advance time will show zero reward accrual even after a stake. Always use `time.increase(seconds)` followed by `mine()` in any test that verifies time-based reward logic.

**Pitfall 6 — Testnet faucet delays**:
The Polygon Amoy faucet has rate limits and occasionally has downtime. If you need test POL urgently during deployment and the faucet is unavailable, you are blocked. Mitigate this by requesting tokens well before you plan to deploy — ideally while setting up the environment in Part 2.

---

## Part 10: Phase 1 Completion Criteria — Detailed Checklist

### Compilation
- [ ] All 5 contracts compile with Solidity 0.8.24 and zero warnings
- [ ] TypeChain generates type-safe bindings for all contracts (confirms ABI is parseable)
- [ ] Gas reporter output shows no function with obviously unreasonable gas costs (no function should exceed 500,000 gas for a demo system)

### Testing
- [ ] All unit tests pass: 0 failures, 0 pending
- [ ] Line coverage ≥ 90% for all five contracts
- [ ] Branch coverage ≥ 80% (all if/else paths covered)
- [ ] All event emission tests pass (every event, every parameter verified)
- [ ] All access control revert tests pass
- [ ] All CEI pattern and reentrancy tests pass
- [ ] Time-based expiry tests pass (using `time.increase()`)
- [ ] Integration test — full staking lifecycle passes
- [ ] Integration test — full trade lifecycle passes

### Deployment and Verification
- [ ] Full deployment succeeds against local Hardhat network
- [ ] All 5 contracts deployed to Polygon Amoy (all 5 transaction hashes recorded)
- [ ] All 5 contracts verified on Polygonscan (green checkmark on each, Read/Write tabs functional)
- [ ] `setupMinterRole()` confirmed — StakingVault can mint RewardToken (verify by checking `rewardToken.minters(stakingVaultAddress)` returns `true` via Polygonscan read)

### Character Minting
- [ ] All 5 characters minted on Polygon Amoy (token IDs 0–4)
- [ ] Trait values confirmed correct via Polygonscan read (call `characters(0)` through `characters(4)`)
- [ ] IPFS metadata uploaded and accessible for all 5 characters (test each IPFS CID via a gateway)

### Manual End-to-End Verification
- [ ] Staking flow confirmed on Amoy: stake, CharacterStaked event visible in Polygonscan logs, unstake, CharacterUnstaked and RewardsClaimed events visible, reward tokens balance confirmed
- [ ] Trade flow confirmed on Amoy: proposeTrade, TradeProposed event visible, acceptTrade, TradeSettled event visible, ownership swap confirmed on Polygonscan
- [ ] Revocation flow confirmed: agent registered, `isAuthorizedAgent` returns true, revoke called, `isAuthorizedAgent` returns false, stake attempt reverts

### Documentation
- [ ] Contract address registry created with all addresses, network, and Polygonscan links
- [ ] Character roster reference created with all token IDs, trait values, and IPFS links
- [ ] Gas report saved and added to documentation
- [ ] Architecture diagram added to README
- [ ] `.env.example` committed with all required variable names
- [ ] `.env` confirmed absent from git history (`git log -- .env` returns nothing)

**Phase 1 is complete when every item above is checked. Phase 2 does not begin until then.**
