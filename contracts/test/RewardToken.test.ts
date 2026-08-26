import { expect } from "chai";
import { ethers } from "hardhat";
import { RewardToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("RewardToken (ERC-20)", () => {
  let rewardToken: RewardToken;
  let owner: HardhatEthersSigner;
  let minter: HardhatEthersSigner;
  let user: HardhatEthersSigner;

  beforeEach(async () => {
    [owner, minter, user] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("RewardToken");
    rewardToken = (await Factory.deploy(owner.address)) as RewardToken;
    await rewardToken.waitForDeployment();
  });

  describe("Initialization & Metadata", () => {
    it("has correct name and symbol", async () => {
      expect(await rewardToken.name()).to.equal("MetaSpace Reward Token");
      expect(await rewardToken.symbol()).to.equal("MLRD");
      expect(await rewardToken.decimals()).to.equal(18);
    });

    it("mints initial supply to owner", async () => {
      const expectedSupply = ethers.parseEther("1000000");
      expect(await rewardToken.totalSupply()).to.equal(expectedSupply);
      expect(await rewardToken.balanceOf(owner.address)).to.equal(expectedSupply);
    });

    it("sets correct owner", async () => {
      expect(await rewardToken.owner()).to.equal(owner.address);
    });
  });

  describe("Minter Role Management", () => {
    it("allows owner to add a minter", async () => {
      await expect(rewardToken.addMinter(minter.address))
        .to.emit(rewardToken, "MinterAdded")
        .withArgs(minter.address);

      expect(await rewardToken.minters(minter.address)).to.be.true;
    });

    it("allows owner to remove a minter", async () => {
      await rewardToken.addMinter(minter.address);
      expect(await rewardToken.minters(minter.address)).to.be.true;

      await expect(rewardToken.removeMinter(minter.address))
        .to.emit(rewardToken, "MinterRemoved")
        .withArgs(minter.address);

      expect(await rewardToken.minters(minter.address)).to.be.false;
    });

    it("reverts if non-owner tries to add or remove minter", async () => {
      await expect(
        rewardToken.connect(user).addMinter(user.address)
      ).to.be.revertedWithCustomError(rewardToken, "OwnableUnauthorizedAccount");

      await expect(
        rewardToken.connect(user).removeMinter(owner.address)
      ).to.be.revertedWithCustomError(rewardToken, "OwnableUnauthorizedAccount");
    });

    it("reverts if zero address is added as minter", async () => {
      await expect(
        rewardToken.addMinter(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(rewardToken, "InvalidMinterAddress");
    });
  });

  describe("Minting", () => {
    beforeEach(async () => {
      await rewardToken.addMinter(minter.address);
    });

    it("allows authorized minter to mint tokens", async () => {
      const mintAmount = ethers.parseEther("500");
      await rewardToken.connect(minter).mint(user.address, mintAmount);

      expect(await rewardToken.balanceOf(user.address)).to.equal(mintAmount);
    });

    it("reverts if unauthorized address attempts to mint", async () => {
      const mintAmount = ethers.parseEther("100");
      await expect(
        rewardToken.connect(user).mint(user.address, mintAmount)
      ).to.be.revertedWithCustomError(rewardToken, "NotAuthorizedMinter")
        .withArgs(user.address);
    });
  });
});
