import { expect } from "chai";
import { ethers } from "hardhat";
import { TradeEscrow, CharacterNFT, AgentRegistry } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("TradeEscrow", () => {
  let escrow: TradeEscrow;
  let nft: CharacterNFT;
  let registry: AgentRegistry;

  let owner: HardhatEthersSigner;
  let playerA: HardhatEthersSigner;
  let playerB: HardhatEthersSigner;
  let agentA: HardhatEthersSigner;
  let agentB: HardhatEthersSigner;
  let outsider: HardhatEthersSigner;

  const traitsA = { riskTolerance: 95, trustBaseline: 15, aggression: 90, patience: 10 };
  const traitsB = { riskTolerance: 30, trustBaseline: 80, aggression: 20, patience: 85 };
  const policyHash = ethers.keccak256(ethers.toUtf8Bytes("TRADE_POLICY"));
  const oneWeek = 7 * 86400;

  beforeEach(async () => {
    [owner, playerA, playerB, agentA, agentB, outsider] = await ethers.getSigners();

    // 1. Deploy CharacterNFT
    const NFTFactory = await ethers.getContractFactory("CharacterNFT");
    nft = (await NFTFactory.deploy(owner.address)) as CharacterNFT;
    await nft.waitForDeployment();

    // 2. Deploy AgentRegistry
    const RegistryFactory = await ethers.getContractFactory("AgentRegistry");
    registry = (await RegistryFactory.deploy(owner.address)) as AgentRegistry;
    await registry.waitForDeployment();

    // 3. Deploy TradeEscrow
    const EscrowFactory = await ethers.getContractFactory("TradeEscrow");
    escrow = (await EscrowFactory.deploy(
      await nft.getAddress(),
      await registry.getAddress(),
      owner.address
    )) as TradeEscrow;
    await escrow.waitForDeployment();

    // 4. Mint token 0 (Kael) to playerA, token 1 (Lyra) to playerB
    await nft.mintCharacter(playerA.address, "Kael", 2, traitsA, "ipfs://kael");
    await nft.mintCharacter(playerB.address, "Lyra", 1, traitsB, "ipfs://lyra");

    // 5. Register agentA for token 0, agentB for token 1
    await registry.registerAgent(0, agentA.address, policyHash, oneWeek);
    await registry.registerAgent(1, agentB.address, policyHash, oneWeek);

    // 6. Players approve TradeEscrow
    await nft.connect(playerA).approve(await escrow.getAddress(), 0);
    await nft.connect(playerB).approve(await escrow.getAddress(), 1);
  });

  describe("Trade Proposal", () => {
    it("allows Agent A to propose trade, locking Token 0 into escrow", async () => {
      const tx = await escrow.connect(agentA).proposeTrade(0, 1, agentB.address);

      await expect(tx)
        .to.emit(escrow, "TradeProposed");

      // Token 0 is held in escrow contract
      expect(await nft.ownerOf(0)).to.equal(await escrow.getAddress());
      // Token 1 remains in Player B's wallet until acceptance
      expect(await nft.ownerOf(1)).to.equal(playerB.address);
    });

    it("reverts if unauthorized proposer attempts to propose", async () => {
      await expect(
        escrow.connect(outsider).proposeTrade(0, 1, agentB.address)
      ).to.be.revertedWithCustomError(escrow, "UnauthorizedProposer")
        .withArgs(outsider.address);
    });

    it("reverts if target wallet is not an authorized agent", async () => {
      await expect(
        escrow.connect(agentA).proposeTrade(0, 1, outsider.address)
      ).to.be.revertedWithCustomError(escrow, "UnauthorizedTarget")
        .withArgs(outsider.address);
    });

    it("reverts if offering a token not operated by caller agent", async () => {
      await expect(
        escrow.connect(agentA).proposeTrade(1, 0, agentB.address)
      ).to.be.revertedWithCustomError(escrow, "ProposerTokenMismatch")
        .withArgs(0, 1);
    });
  });

  describe("Trade Acceptance & Atomic Settlement", () => {
    let tradeId: string;

    beforeEach(async () => {
      const tx = await escrow.connect(agentA).proposeTrade(0, 1, agentB.address);
      const receipt = await tx.wait();
      // Extract tradeId from event
      const event = receipt?.logs.find((log: any) => {
        try {
          return escrow.interface.parseLog(log)?.name === "TradeProposed";
        } catch {
          return false;
        }
      });
      const parsed = escrow.interface.parseLog(event!);
      tradeId = parsed!.args[0];
    });

    it("allows target agent to accept, executing atomic two-way NFT swap", async () => {
      const tx = await escrow.connect(agentB).acceptTrade(tradeId);

      await expect(tx)
        .to.emit(escrow, "TradeSettled");

      // Token 0 transferred to Player B (target owner)
      expect(await nft.ownerOf(0)).to.equal(playerB.address);
      // Token 1 transferred to Player A (proposer owner)
      expect(await nft.ownerOf(1)).to.equal(playerA.address);

      const trade = await escrow.getTrade(tradeId);
      expect(trade.status).to.equal(1); // TradeStatus.SETTLED
    });

    it("reverts if non-target attempts to accept trade", async () => {
      await expect(
        escrow.connect(agentA).acceptTrade(tradeId)
      ).to.be.revertedWithCustomError(escrow, "NotTradeTarget")
        .withArgs(agentA.address, agentB.address);

      await expect(
        escrow.connect(outsider).acceptTrade(tradeId)
      ).to.be.revertedWithCustomError(escrow, "NotTradeTarget")
        .withArgs(outsider.address, agentB.address);
    });

    it("reverts if attempting to accept already-settled trade", async () => {
      await escrow.connect(agentB).acceptTrade(tradeId);

      await expect(
        escrow.connect(agentB).acceptTrade(tradeId)
      ).to.be.revertedWithCustomError(escrow, "TradeNotProposed")
        .withArgs(tradeId);
    });
  });

  describe("Trade Cancellation", () => {
    let tradeId: string;

    beforeEach(async () => {
      const tx = await escrow.connect(agentA).proposeTrade(0, 1, agentB.address);
      const receipt = await tx.wait();
      const event = receipt?.logs.find((log: any) => {
        try {
          return escrow.interface.parseLog(log)?.name === "TradeProposed";
        } catch {
          return false;
        }
      });
      const parsed = escrow.interface.parseLog(event!);
      tradeId = parsed!.args[0];
    });

    it("allows proposer agent to cancel and receive escrowed NFT back", async () => {
      const tx = await escrow.connect(agentA).cancelTrade(tradeId);

      await expect(tx)
        .to.emit(escrow, "TradeCancelled")
        .withArgs(tradeId, agentA.address, (await ethers.provider.getBlock("latest"))!.timestamp);

      // Token 0 returned to Player A
      expect(await nft.ownerOf(0)).to.equal(playerA.address);
      // Token 1 never left Player B
      expect(await nft.ownerOf(1)).to.equal(playerB.address);

      const trade = await escrow.getTrade(tradeId);
      expect(trade.status).to.equal(2); // TradeStatus.CANCELLED
    });

    it("allows target agent to cancel and release escrowed NFT back to proposer", async () => {
      await escrow.connect(agentB).cancelTrade(tradeId);
      expect(await nft.ownerOf(0)).to.equal(playerA.address);
    });

    it("reverts if non-participant attempts to cancel", async () => {
      await expect(
        escrow.connect(outsider).cancelTrade(tradeId)
      ).to.be.revertedWithCustomError(escrow, "NotTradeParticipant")
        .withArgs(outsider.address);
    });
  });
});
