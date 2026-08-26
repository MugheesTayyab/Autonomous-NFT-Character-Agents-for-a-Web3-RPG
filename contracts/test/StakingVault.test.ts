import { expect } from "chai";
import { ethers } from "hardhat";
import { StakingVault, CharacterNFT, RewardToken, AgentRegistry } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("StakingVault", () => {
  let vault: StakingVault;
  let nft: CharacterNFT;
  let rewardToken: RewardToken;
  let registry: AgentRegistry;

  let owner: HardhatEthersSigner;
  let humanPlayer: HardhatEthersSigner;
  let agentWallet: HardhatEthersSigner;
  let unauthorizedUser: HardhatEthersSigner;

  const validTraits = {
    riskTolerance: 95,
    trustBaseline: 15,
    aggression: 90,
    patience: 10,
  };
  const policyHash = ethers.keccak256(ethers.toUtf8Bytes("STAKE_POLICY"));
  const oneWeek = 7 * 86400;

  beforeEach(async () => {
    [owner, humanPlayer, agentWallet, unauthorizedUser] = await ethers.getSigners();

    // 1. Deploy RewardToken
    const TokenFactory = await ethers.getContractFactory("RewardToken");
    rewardToken = (await TokenFactory.deploy(owner.address)) as RewardToken;
    await rewardToken.waitForDeployment();

    // 2. Deploy CharacterNFT
    const NFTFactory = await ethers.getContractFactory("CharacterNFT");
    nft = (await NFTFactory.deploy(owner.address)) as CharacterNFT;
    await nft.waitForDeployment();

    // 3. Deploy AgentRegistry
    const RegistryFactory = await ethers.getContractFactory("AgentRegistry");
    registry = (await RegistryFactory.deploy(owner.address)) as AgentRegistry;
    await registry.waitForDeployment();

    // 4. Deploy StakingVault
    const VaultFactory = await ethers.getContractFactory("StakingVault");
    vault = (await VaultFactory.deploy(
      await nft.getAddress(),
      await rewardToken.getAddress(),
      await registry.getAddress(),
      owner.address
    )) as StakingVault;
    await vault.waitForDeployment();

    // 5. Authorize Vault as minter on RewardToken (Owner calls RewardToken directly)
    await rewardToken.addMinter(await vault.getAddress());

    // 6. Mint token 0 to humanPlayer
    await nft.mintCharacter(humanPlayer.address, "Kael", 2, validTraits, "ipfs://kael");

    // 7. Register agentWallet for token 0
    await registry.registerAgent(0, agentWallet.address, policyHash, oneWeek);

    // 8. Human player approves StakingVault to transfer token 0
    await nft.connect(humanPlayer).approve(await vault.getAddress(), 0);
  });

  describe("Staking Lifecycle", () => {
    it("allows authorized agent to stake its character", async () => {
      const tx = await vault.connect(agentWallet).stake(0);
      const latestBlock = await ethers.provider.getBlock("latest");

      await expect(tx)
        .to.emit(vault, "CharacterStaked")
        .withArgs(0, agentWallet.address, humanPlayer.address, latestBlock!.timestamp);

      // NFT is now escrowed in StakingVault
      expect(await nft.ownerOf(0)).to.equal(await vault.getAddress());

      const stakeInfo = await vault.getStakeInfo(0);
      expect(stakeInfo.originalOwner).to.equal(humanPlayer.address);
      expect(stakeInfo.stakedAt).to.equal(latestBlock!.timestamp);
    });

    it("reverts if unauthorized address attempts to stake", async () => {
      await expect(
        vault.connect(unauthorizedUser).stake(0)
      ).to.be.revertedWithCustomError(vault, "UnauthorizedAgent")
        .withArgs(unauthorizedUser.address);
    });

    it("reverts if agent attempts to stake a different character's token", async () => {
      // Mint token 1 to humanPlayer
      await nft.mintCharacter(humanPlayer.address, "Lyra", 1, validTraits, "ipfs://lyra");
      await nft.connect(humanPlayer).approve(await vault.getAddress(), 1);

      await expect(
        vault.connect(agentWallet).stake(1)
      ).to.be.revertedWithCustomError(vault, "AgentTokenMismatch")
        .withArgs(0, 1);
    });

    it("reverts double staking on same token", async () => {
      await vault.connect(agentWallet).stake(0);
      await expect(
        vault.connect(agentWallet).stake(0)
      ).to.be.revertedWithCustomError(vault, "AlreadyStaked")
        .withArgs(0);
    });
  });

  describe("Reward Accrual & Unstaking", () => {
    beforeEach(async () => {
      await vault.connect(agentWallet).stake(0);
    });

    it("accrues rewards linearly over time", async () => {
      const oneDay = 86400;
      await time.increase(oneDay);

      // 10 MLRD per day = 10 * 1e18
      const pending = await vault.pendingRewards(0);
      const expected = ethers.parseEther("10");

      // Allow small precision difference due to block timestamp
      const diff = pending > expected ? pending - expected : expected - pending;
      expect(diff).to.be.lte(ethers.parseEther("0.01"));
    });

    it("unstakes character, returns NFT to player, and mints accrued rewards", async () => {
      const twoDays = 2 * 86400;
      await time.increase(twoDays);

      const expectedRewards = ethers.parseEther("20");

      const tx = await vault.connect(agentWallet).unstake(0);

      await expect(tx)
        .to.emit(vault, "CharacterUnstaked");

      // NFT returned to original human player
      expect(await nft.ownerOf(0)).to.equal(humanPlayer.address);

      // Rewards minted to human player
      const playerBalance = await rewardToken.balanceOf(humanPlayer.address);
      const diff = playerBalance > expectedRewards ? playerBalance - expectedRewards : expectedRewards - playerBalance;
      expect(diff).to.be.lte(ethers.parseEther("0.01"));

      // Stake record cleared
      const stakeInfo = await vault.getStakeInfo(0);
      expect(stakeInfo.stakedAt).to.equal(0);
    });

    it("reverts unstaking if session key expires", async () => {
      // Fast forward past oneWeek
      await time.increase(oneWeek + 1);

      await expect(
        vault.connect(agentWallet).unstake(0)
      ).to.be.revertedWithCustomError(vault, "UnauthorizedAgent");
    });
  });
});
