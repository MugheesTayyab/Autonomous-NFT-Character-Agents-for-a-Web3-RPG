// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./AgentRegistry.sol";

/**
 * @title TradeEscrow
 * @notice Trustless atomic escrow contract for agent-to-agent NFT trade settlements.
 *         Ensures atomic execution: either both assets are transferred to their respective
 *         new owners, or the trade is cancelled and the escrowed asset returned to the proposer.
 */
contract TradeEscrow is Ownable, ReentrancyGuard {
    IERC721 public immutable characterNFT;
    AgentRegistry public immutable agentRegistry;

    enum TradeStatus { PROPOSED, SETTLED, CANCELLED }

    struct Trade {
        address proposerWallet;    // Agent A session-key wallet
        address targetWallet;      // Agent B session-key wallet
        address proposerOwner;     // Human owner of the offered NFT (recorded at proposal time)
        uint256 offeredTokenId;    // Proposer's token offered
        uint256 requestedTokenId;  // Target's token requested
        TradeStatus status;
        uint256 proposedAt;
        uint256 settledAt;
    }

    /// @notice tradeId => Trade
    mapping(bytes32 => Trade) public trades;

    // ─── Events ───
    event TradeProposed(
        bytes32 indexed tradeId,
        address indexed proposerWallet,
        address indexed targetWallet,
        uint256 offeredTokenId,
        uint256 requestedTokenId,
        uint256 timestamp
    );

    event TradeSettled(
        bytes32 indexed tradeId,
        address proposerOwner,
        uint256 receivedTokenId,
        address targetOwner,
        uint256 deliveredTokenId,
        uint256 timestamp
    );

    event TradeCancelled(
        bytes32 indexed tradeId,
        address indexed cancelledBy,
        uint256 timestamp
    );

    // ─── Custom Errors ───
    error UnauthorizedProposer(address caller);
    error UnauthorizedTarget(address target);
    error ProposerTokenMismatch(uint256 callerTokenId, uint256 offeredTokenId);
    error TargetTokenMismatch(uint256 targetTokenId, uint256 requestedTokenId);
    error TradeNotProposed(bytes32 tradeId);
    error NotTradeTarget(address caller, address expectedTarget);
    error NotTradeParticipant(address caller);
    error TradeCollision(bytes32 tradeId);
    error ZeroAddress();

    constructor(
        address nftAddress,
        address registryAddress,
        address initialOwner
    ) Ownable(initialOwner) {
        if (nftAddress == address(0) || registryAddress == address(0)) {
            revert ZeroAddress();
        }
        characterNFT = IERC721(nftAddress);
        agentRegistry = AgentRegistry(registryAddress);
    }

    /**
     * @notice Proposes a new trade. Transfers the proposer's offered NFT into escrow.
     * @param offeredTokenId Token ID of character offered by proposer
     * @param requestedTokenId Token ID of character requested from target
     * @param targetWallet Session-key wallet of target character agent
     * @return tradeId Unique hash identifier for this trade
     */
    function proposeTrade(
        uint256 offeredTokenId,
        uint256 requestedTokenId,
        address targetWallet
    ) external nonReentrant returns (bytes32 tradeId) {
        // ── CHECKS ──
        if (!agentRegistry.isAuthorizedAgent(msg.sender)) {
            revert UnauthorizedProposer(msg.sender);
        }
        if (!agentRegistry.isAuthorizedAgent(targetWallet)) {
            revert UnauthorizedTarget(targetWallet);
        }

        uint256 proposerToken = agentRegistry.getTokenForWallet(msg.sender);
        if (proposerToken != offeredTokenId) {
            revert ProposerTokenMismatch(proposerToken, offeredTokenId);
        }

        uint256 targetToken = agentRegistry.getTokenForWallet(targetWallet);
        if (targetToken != requestedTokenId) {
            revert TargetTokenMismatch(targetToken, requestedTokenId);
        }

        tradeId = keccak256(abi.encodePacked(
            msg.sender,
            targetWallet,
            offeredTokenId,
            requestedTokenId,
            block.timestamp
        ));

        if (trades[tradeId].proposedAt != 0) {
            revert TradeCollision(tradeId);
        }

        address proposerOwner = characterNFT.ownerOf(offeredTokenId);

        // ── EFFECTS ──
        trades[tradeId] = Trade({
            proposerWallet: msg.sender,
            targetWallet: targetWallet,
            proposerOwner: proposerOwner,
            offeredTokenId: offeredTokenId,
            requestedTokenId: requestedTokenId,
            status: TradeStatus.PROPOSED,
            proposedAt: block.timestamp,
            settledAt: 0
        });

        // ── INTERACTIONS ──
        // Lock proposer's NFT into escrow
        characterNFT.transferFrom(proposerOwner, address(this), offeredTokenId);

        emit TradeProposed(
            tradeId,
            msg.sender,
            targetWallet,
            offeredTokenId,
            requestedTokenId,
            block.timestamp
        );
    }

    /**
     * @notice Target agent accepts the proposed trade. Performs atomic two-way NFT swap.
     * @param tradeId The ID of the trade to settle
     */
    function acceptTrade(bytes32 tradeId) external nonReentrant {
        Trade storage trade = trades[tradeId];

        // ── CHECKS ──
        if (trade.status != TradeStatus.PROPOSED) {
            revert TradeNotProposed(tradeId);
        }
        if (msg.sender != trade.targetWallet) {
            revert NotTradeTarget(msg.sender, trade.targetWallet);
        }
        if (!agentRegistry.isAuthorizedAgent(msg.sender)) {
            revert UnauthorizedTarget(msg.sender);
        }

        address targetOwner = characterNFT.ownerOf(trade.requestedTokenId);

        // ── EFFECTS ──
        trade.status = TradeStatus.SETTLED;
        trade.settledAt = block.timestamp;

        // ── INTERACTIONS: Atomic settlement ──
        // 1. Transfer target's NFT to proposer's human owner
        characterNFT.transferFrom(targetOwner, trade.proposerOwner, trade.requestedTokenId);

        // 2. Transfer proposer's escrowed NFT to target's human owner
        characterNFT.transferFrom(address(this), targetOwner, trade.offeredTokenId);

        emit TradeSettled(
            tradeId,
            trade.proposerOwner,
            trade.requestedTokenId,
            targetOwner,
            trade.offeredTokenId,
            block.timestamp
        );
    }

    /**
     * @notice Cancels a proposed trade. Returns the escrowed NFT to the proposer's owner.
     *         Can be called by either the proposer agent or the target agent.
     * @param tradeId The ID of the trade to cancel
     */
    function cancelTrade(bytes32 tradeId) external nonReentrant {
        Trade storage trade = trades[tradeId];

        // ── CHECKS ──
        if (trade.status != TradeStatus.PROPOSED) {
            revert TradeNotProposed(tradeId);
        }
        if (msg.sender != trade.proposerWallet && msg.sender != trade.targetWallet) {
            revert NotTradeParticipant(msg.sender);
        }

        // ── EFFECTS ──
        trade.status = TradeStatus.CANCELLED;

        // ── INTERACTIONS ──
        // Return escrowed NFT to original proposer owner
        characterNFT.transferFrom(address(this), trade.proposerOwner, trade.offeredTokenId);

        emit TradeCancelled(tradeId, msg.sender, block.timestamp);
    }

    /**
     * @notice View function to fetch complete Trade struct details.
     */
    function getTrade(bytes32 tradeId) external view returns (Trade memory) {
        return trades[tradeId];
    }
}
