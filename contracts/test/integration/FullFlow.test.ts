import { expect } from "chai";
import { ethers } from "hardhat";
import {
  RewardToken,
  CharacterNFT,
  AgentRegistry,
  StakingVault,
  TradeEscrow
} from "../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Integration: Full End-to-End System Flows", () => {
  let rewardToken: RewardToken;
  let nft: CharacterNFT;
  let registry: AgentRegistry;
  let stakingVault: StakingVault;
  let tradeEscrow: TradeEscrow;

  let owner: HardhatEthersSigner;
  let player1: HardhatEthersSigner;
  let player2: HardhatEthersSigner;
  let agent1: HardhatEthersSigner;
  let agent2: HardhatEthersSigner;

  const policyHash = ethers.keccak256(ethers.toUtf8Bytes("MASTER_SESSION_POLICY"));
  const sessionDuration = 7 * 86400; // 7 days

  beforeEach(async () => {
    [owner, player1, player2, agent1, agent2] = await ethers.getSigners();

    // 1. Deploy contracts
    const TokenFactory = await ethers.getContractFactory("RewardToken");
    rewardToken = (await TokenFactory.deploy(owner.address)) as RewardToken;
    await rewardToken.waitForDeployment();

    const NFTFactory = await ethers.getContractFactory("CharacterNFT");
    nft = (await NFTFactory.deploy(owner.address)) as CharacterNFT;
    await nft.waitForDeployment();

    const RegistryFactory = await ethers.getContractFactory("AgentRegistry");
    registry = (await RegistryFactory.deploy(owner.address)) as AgentRegistry;
    await registry.waitForDeployment();

    const VaultFactory = await ethers.getContractFactory("StakingVault");
    stakingVault = (await VaultFactory.deploy(
      await nft.getAddress(),
      await rewardToken.getAddress(),
      await registry.getAddress(),
      owner.address
    )) as StakingVault;
    await stakingVault.waitForDeployment();

    const EscrowFactory = await ethers.getContractFactory("TradeEscrow");
    tradeEscrow = (await EscrowFactory.deploy(
      await nft.getAddress(),
      await registry.getAddress(),
      owner.address
    )) as TradeEscrow;
    await tradeEscrow.waitForDeployment();

    // 2. Authorize StakingVault on RewardToken (Owner grants minter authority directly)
    await rewardToken.addMinter(await stakingVault.getAddress());

    // 3. Mint Character 0 (Kael - Berserker) to player1
    await nft.mintCharacter(
      player1.address,
      "Kael",
      2, // BERSERKER
      { riskTolerance: 95, trustBaseline: 15, aggression: 90, patience: 10 },
      "ipfs://kael-metadata"
    );

    // 4. Mint Character 1 (Lyra - Strategist) to player2
    await nft.mintCharacter(
      player2.address,
      "Lyra",
      1, // STRATEGIST
      { riskTolerance: 30, trustBaseline: 80, aggression: 20, patience: 85 },
      "ipfs://lyra-metadata"
    );

    // 5. Register session key agents on-chain
    await registry.registerAgent(0, agent1.address, policyHash, sessionDuration);
    await registry.registerAgent(1, agent2.address, policyHash, sessionDuration);

    // 6. Link agent wallets on NFT contract
    await nft.linkAgentWallet(0, agent1.address);
    await nft.linkAgentWallet(1, agent2.address);
  });

  describe("Flow 1: Autonomous Staking & Reward Lifecycle", () => {
    it("completes full approve -> stake -> accrue rewards -> unstake -> payout cycle", async () => {
      // 1. Human player approves StakingVault
      await nft.connect(player1).approve(await stakingVault.getAddress(), 0);

      // 2. Agent 1 initiates autonomous stake
      await stakingVault.connect(agent1).stake(0);
      expect(await nft.ownerOf(0)).to.equal(await stakingVault.getAddress());

      // 3. Fast-forward time by 3 days
      const threeDays = 3 * 86400;
      await time.increase(threeDays);

      const pending = await stakingVault.pendingRewards(0);
      const expected3Days = ethers.parseEther("30"); // 10 MLRD/day * 3 days
      const diff = pending > expected3Days ? pending - expected3Days : expected3Days - pending;
      expect(diff).to.be.lte(ethers.parseEther("0.01"));

      // 4. Agent 1 initiates autonomous unstake
      await stakingVault.connect(agent1).unstake(0);

      // 5. Verify NFT returned to player1 and rewards minted to player1
      expect(await nft.ownerOf(0)).to.equal(player1.address);
      const playerBalance = await rewardToken.balanceOf(player1.address);
      const payoutDiff = playerBalance > expected3Days ? playerBalance - expected3Days : expected3Days - playerBalance;
      expect(payoutDiff).to.be.lte(ethers.parseEther("0.01"));
    });
  });

  describe("Flow 2: Autonomous Agent-to-Agent Trade Negotiation & Settlement", () => {
    it("completes propose -> escrow lock -> evaluate & accept -> atomic swap cycle", async () => {
      // 1. Both human players approve TradeEscrow
      await nft.connect(player1).approve(await tradeEscrow.getAddress(), 0);
      await nft.connect(player2).approve(await tradeEscrow.getAddress(), 1);

      // 2. Agent 1 proposes trading Token 0 (Kael) for Token 1 (Lyra)
      const tx = await tradeEscrow.connect(agent1).proposeTrade(0, 1, agent2.address);
      const receipt = await tx.wait();

      const event = receipt?.logs.find((log: any) => {
        try {
          return tradeEscrow.interface.parseLog(log)?.name === "TradeProposed";
        } catch {
          return false;
        }
      });
      const parsed = tradeEscrow.interface.parseLog(event!);
      const tradeId = parsed!.args[0];

      // Token 0 is in escrow; Token 1 is with Player 2
      expect(await nft.ownerOf(0)).to.equal(await tradeEscrow.getAddress());
      expect(await nft.ownerOf(1)).to.equal(player2.address);

      // 3. Agent 2 evaluates and accepts trade proposal
      await tradeEscrow.connect(agent2).acceptTrade(tradeId);

      // 4. Verify atomic swap:
      // Player 1 (offered Token 0) now owns Token 1 (Lyra)
      expect(await nft.ownerOf(1)).to.equal(player1.address);
      // Player 2 (offered Token 1) now owns Token 0 (Kael)
      expect(await nft.ownerOf(0)).to.equal(player2.address);
    });
  });

  describe("Flow 3: Safety Guardrails & Instant Kill Switch", () => {
    it("owner revocation immediately blocks further agent execution", async () => {
      await nft.connect(player1).approve(await stakingVault.getAddress(), 0);

      // Verify agent is currently authorized
      expect(await registry.isAuthorizedAgent(agent1.address)).to.be.true;

      // Operator/Owner triggers kill switch on Token 0's agent
      await registry.revokeAgent(0);

      // Agent is immediately de-authorized
      expect(await registry.isAuthorizedAgent(agent1.address)).to.be.false;

      // Agent attempt to stake now reverts
      await expect(
        stakingVault.connect(agent1).stake(0)
      ).to.be.revertedWithCustomError(stakingVault, "UnauthorizedAgent");
    });
  });
});
