import { expect } from "chai";
import { ethers } from "hardhat";
import { AgentRegistry } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("AgentRegistry", () => {
  let registry: AgentRegistry;
  let owner: HardhatEthersSigner;
  let agentWallet1: HardhatEthersSigner;
  let agentWallet2: HardhatEthersSigner;
  let user: HardhatEthersSigner;

  const samplePolicyHash = ethers.keccak256(ethers.toUtf8Bytes("POLICY_STAKE_AND_TRADE_V1"));
  const oneDay = 86400; // 24 hours

  beforeEach(async () => {
    [owner, agentWallet1, agentWallet2, user] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("AgentRegistry");
    registry = (await Factory.deploy(owner.address)) as AgentRegistry;
    await registry.waitForDeployment();
  });

  describe("Agent Registration", () => {
    it("registers agent wallet with policy hash and duration", async () => {
      const tx = await registry.registerAgent(0, agentWallet1.address, samplePolicyHash, oneDay);
      const latestBlock = await ethers.provider.getBlock("latest");
      const expectedExpiry = latestBlock!.timestamp + oneDay;

      await expect(tx)
        .to.emit(registry, "AgentRegistered")
        .withArgs(0, agentWallet1.address, samplePolicyHash, expectedExpiry);

      expect(await registry.isAuthorizedAgent(agentWallet1.address)).to.be.true;
      expect(await registry.getTokenForWallet(agentWallet1.address)).to.equal(0);

      const record = await registry.getAgentRecord(0);
      expect(record.agentWallet).to.equal(agentWallet1.address);
      expect(record.policyHash).to.equal(samplePolicyHash);
      expect(record.active).to.be.true;
    });

    it("clears previous wallet mapping if re-registering a token", async () => {
      await registry.registerAgent(0, agentWallet1.address, samplePolicyHash, oneDay);
      expect(await registry.isAuthorizedAgent(agentWallet1.address)).to.be.true;

      await registry.registerAgent(0, agentWallet2.address, samplePolicyHash, oneDay);
      expect(await registry.isAuthorizedAgent(agentWallet1.address)).to.be.false;
      expect(await registry.isAuthorizedAgent(agentWallet2.address)).to.be.true;
      expect(await registry.getTokenForWallet(agentWallet2.address)).to.equal(0);
    });

    it("reverts registration with zero address or zero duration", async () => {
      await expect(
        registry.registerAgent(0, ethers.ZeroAddress, samplePolicyHash, oneDay)
      ).to.be.revertedWithCustomError(registry, "InvalidAgentWallet");

      await expect(
        registry.registerAgent(0, agentWallet1.address, samplePolicyHash, 0)
      ).to.be.revertedWithCustomError(registry, "InvalidDuration");
    });

    it("reverts if non-owner attempts to register", async () => {
      await expect(
        registry.connect(user).registerAgent(0, agentWallet1.address, samplePolicyHash, oneDay)
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });
  });

  describe("Session Key Expiry & Time Manipulation", () => {
    beforeEach(async () => {
      await registry.registerAgent(0, agentWallet1.address, samplePolicyHash, oneDay);
    });

    it("returns true while within session window", async () => {
      expect(await registry.isAuthorizedAgent(agentWallet1.address)).to.be.true;
    });

    it("returns false immediately once session duration expires", async () => {
      expect(await registry.isAuthorizedAgent(agentWallet1.address)).to.be.true;

      // Fast-forward time past 24 hours
      await time.increase(oneDay + 1);

      expect(await registry.isAuthorizedAgent(agentWallet1.address)).to.be.false;
    });

    it("allows extending active session duration via updateAgent", async () => {
      const extraTime = 43200; // 12 hours
      const newPolicyHash = ethers.keccak256(ethers.toUtf8Bytes("POLICY_V2"));

      await expect(registry.updateAgent(0, newPolicyHash, extraTime))
        .to.emit(registry, "AgentUpdated");

      const record = await registry.getAgentRecord(0);
      expect(record.policyHash).to.equal(newPolicyHash);

      // Fast forward past initial 24h, verify still authorized due to extra 12h
      await time.increase(oneDay);
      expect(await registry.isAuthorizedAgent(agentWallet1.address)).to.be.true;

      // Fast forward past extra 12h, verify now expired
      await time.increase(extraTime + 1);
      expect(await registry.isAuthorizedAgent(agentWallet1.address)).to.be.false;
    });
  });

  describe("Instant Revocation (Kill Switch)", () => {
    beforeEach(async () => {
      await registry.registerAgent(0, agentWallet1.address, samplePolicyHash, oneDay);
    });

    it("allows owner to instantly revoke an agent", async () => {
      expect(await registry.isAuthorizedAgent(agentWallet1.address)).to.be.true;

      await expect(registry.revokeAgent(0))
        .to.emit(registry, "AgentRevoked")
        .withArgs(0, agentWallet1.address);

      expect(await registry.isAuthorizedAgent(agentWallet1.address)).to.be.false;

      const record = await registry.getAgentRecord(0);
      expect(record.active).to.be.false;

      await expect(
        registry.getTokenForWallet(agentWallet1.address)
      ).to.be.revertedWithCustomError(registry, "WalletNotMapped");
    });

    it("reverts if attempting to revoke an already-revoked agent", async () => {
      await registry.revokeAgent(0);
      await expect(
        registry.revokeAgent(0)
      ).to.be.revertedWithCustomError(registry, "AgentAlreadyRevoked")
        .withArgs(0);
    });

    it("reverts if non-owner attempts revocation", async () => {
      await expect(
        registry.connect(user).revokeAgent(0)
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });
  });
});
