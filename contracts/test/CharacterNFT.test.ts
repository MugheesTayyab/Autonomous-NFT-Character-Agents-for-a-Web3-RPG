import { expect } from "chai";
import { ethers } from "hardhat";
import { CharacterNFT } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("CharacterNFT (ERC-721)", () => {
  let nft: CharacterNFT;
  let owner: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let agentWallet: HardhatEthersSigner;

  const validTraits = {
    riskTolerance: 95,
    trustBaseline: 15,
    aggression: 90,
    patience: 10,
  };

  beforeEach(async () => {
    [owner, user, agentWallet] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("CharacterNFT");
    nft = (await Factory.deploy(owner.address)) as CharacterNFT;
    await nft.waitForDeployment();
  });

  describe("Initialization", () => {
    it("has correct name and symbol", async () => {
      expect(await nft.name()).to.equal("MetaSpace Character");
      expect(await nft.symbol()).to.equal("MSCHAR");
      expect(await nft.owner()).to.equal(owner.address);
      expect(await nft.totalMinted()).to.equal(0);
    });
  });

  describe("Minting Characters", () => {
    it("mints character with on-chain traits and metadata URI", async () => {
      const tx = await nft.mintCharacter(
        user.address,
        "Kael",
        2, // Archetype: BERSERKER
        validTraits,
        "ipfs://QmKaelMetadataCID"
      );

      await expect(tx)
        .to.emit(nft, "CharacterMinted")
        .withArgs(0, "Kael", 2, user.address);

      expect(await nft.ownerOf(0)).to.equal(user.address);
      expect(await nft.tokenURI(0)).to.equal("ipfs://QmKaelMetadataCID");
      expect(await nft.totalMinted()).to.equal(1);

      const char = await nft.getCharacter(0);
      expect(char.name).to.equal("Kael");
      expect(char.archetype).to.equal(2);
      expect(char.traits.riskTolerance).to.equal(95);
      expect(char.traits.trustBaseline).to.equal(15);
      expect(char.traits.aggression).to.equal(90);
      expect(char.traits.patience).to.equal(10);
      expect(char.agentWalletAddress).to.equal(ethers.ZeroAddress);
      expect(char.agentRegistered).to.be.false;
    });

    it("increments token IDs sequentially", async () => {
      await nft.mintCharacter(user.address, "Kael", 2, validTraits, "ipfs://1");
      await nft.mintCharacter(user.address, "Lyra", 1, { riskTolerance: 30, trustBaseline: 80, aggression: 20, patience: 85 }, "ipfs://2");

      expect(await nft.ownerOf(0)).to.equal(user.address);
      expect(await nft.ownerOf(1)).to.equal(user.address);
      expect(await nft.totalMinted()).to.equal(2);
    });

    it("reverts if non-owner attempts to mint", async () => {
      await expect(
        nft.connect(user).mintCharacter(user.address, "Kael", 2, validTraits, "ipfs://1")
      ).to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");
    });

    it("reverts if any trait value is greater than 100", async () => {
      const badTraits = { ...validTraits, riskTolerance: 101 };
      await expect(
        nft.mintCharacter(user.address, "BadChar", 0, badTraits, "ipfs://bad")
      ).to.be.revertedWithCustomError(nft, "TraitOutOfRange")
        .withArgs("riskTolerance", 101);
    });
  });

  describe("Linking Agent Wallet", () => {
    beforeEach(async () => {
      await nft.mintCharacter(user.address, "Kael", 2, validTraits, "ipfs://1");
    });

    it("allows owner to link agent session-key wallet", async () => {
      await expect(nft.linkAgentWallet(0, agentWallet.address))
        .to.emit(nft, "AgentWalletLinked")
        .withArgs(0, agentWallet.address);

      const char = await nft.getCharacter(0);
      expect(char.agentWalletAddress).to.equal(agentWallet.address);
      expect(char.agentRegistered).to.be.true;
    });

    it("reverts if linking zero address as agent wallet", async () => {
      await expect(
        nft.linkAgentWallet(0, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(nft, "InvalidAgentWallet");
    });

    it("reverts if non-owner attempts to link agent wallet", async () => {
      await expect(
        nft.connect(user).linkAgentWallet(0, agentWallet.address)
      ).to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");
    });

    it("reverts if linking agent for non-existent token", async () => {
      await expect(
        nft.linkAgentWallet(999, agentWallet.address)
      ).to.be.revertedWithCustomError(nft, "TokenDoesNotExist")
        .withArgs(999);
    });
  });

  describe("Trait & Character Queries", () => {
    beforeEach(async () => {
      await nft.mintCharacter(user.address, "Kael", 2, validTraits, "ipfs://1");
    });

    it("returns correct traits via getTraits", async () => {
      const traits = await nft.getTraits(0);
      expect(traits.riskTolerance).to.equal(95);
      expect(traits.trustBaseline).to.equal(15);
      expect(traits.aggression).to.equal(90);
      expect(traits.patience).to.equal(10);
    });

    it("reverts getTraits for non-existent token", async () => {
      await expect(nft.getTraits(99)).to.be.revertedWithCustomError(nft, "TokenDoesNotExist");
    });
  });
});
