// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./AgentRegistry.sol";
import "./RewardToken.sol";

/**
 * @title StakingVault
 * @notice Staking and reward accrual vault for autonomous Character NFTs.
 *         Only authorized agent session-key wallets (verified via AgentRegistry)
 *         can stake or unstake on behalf of their associated Character.
 *
 * Security:
 *  - Checks-Effects-Interactions (CEI) strictly enforced on all state transitions
 *  - ReentrancyGuard on all asset-moving functions
 *  - Immutable contract dependencies set in constructor
 */
contract StakingVault is Ownable, ReentrancyGuard {
    IERC721 public immutable characterNFT;
    RewardToken public immutable rewardToken;
    AgentRegistry public immutable agentRegistry;

    /// @notice Reward emission rate: 10 MLRD tokens per day per staked character (in wei per second: 10e18 / 86400)
    uint256 public constant REWARD_RATE = 115740740740740;

    struct StakeInfo {
        address originalOwner;  // Human player who owns the NFT
        uint256 stakedAt;       // Timestamp when stake began
        uint256 rewardsClaimed; // Total rewards claimed during stake
    }

    /// @notice tokenId => StakeInfo
    mapping(uint256 => StakeInfo) public stakes;

    // ─── Events ───
    event CharacterStaked(
        uint256 indexed tokenId,
        address indexed agentWallet,
        address indexed originalOwner,
        uint256 timestamp
    );

    event CharacterUnstaked(
        uint256 indexed tokenId,
        address indexed agentWallet,
        uint256 rewardsPaid,
        uint256 timestamp
    );

    event RewardsClaimed(
        uint256 indexed tokenId,
        address indexed recipient,
        uint256 amount,
        uint256 timestamp
    );

    // ─── Custom Errors ───
    error UnauthorizedAgent(address caller);
    error AgentTokenMismatch(uint256 callerTokenId, uint256 targetTokenId);
    error AlreadyStaked(uint256 tokenId);
    error NotStaked(uint256 tokenId);
    error ZeroAddress();

    constructor(
        address nftAddress,
        address rewardTokenAddress,
        address registryAddress,
        address initialOwner
    ) Ownable(initialOwner) {
        if (nftAddress == address(0) || rewardTokenAddress == address(0) || registryAddress == address(0)) {
            revert ZeroAddress();
        }
        characterNFT = IERC721(nftAddress);
        rewardToken = RewardToken(rewardTokenAddress);
        agentRegistry = AgentRegistry(registryAddress);
    }

    /**
     * @notice Stakes a character NFT into the vault.
     *         Caller must be the authorized agent session key for this token.
     *         NFT owner must have approved the StakingVault beforehand.
     * @param tokenId The character token ID to stake
     */
    function stake(uint256 tokenId) external nonReentrant {
        // ── CHECKS ──
        if (!agentRegistry.isAuthorizedAgent(msg.sender)) {
            revert UnauthorizedAgent(msg.sender);
        }
        uint256 agentTokenId = agentRegistry.getTokenForWallet(msg.sender);
        if (agentTokenId != tokenId) {
            revert AgentTokenMismatch(agentTokenId, tokenId);
        }
        if (stakes[tokenId].stakedAt > 0) {
            revert AlreadyStaked(tokenId);
        }

        address nftOwner = characterNFT.ownerOf(tokenId);

        // ── EFFECTS ──
        stakes[tokenId] = StakeInfo({
            originalOwner: nftOwner,
            stakedAt: block.timestamp,
            rewardsClaimed: 0
        });

        // ── INTERACTIONS ──
        characterNFT.transferFrom(nftOwner, address(this), tokenId);

        emit CharacterStaked(tokenId, msg.sender, nftOwner, block.timestamp);
    }

    /**
     * @notice Unstakes a character NFT and mints all accrued reward tokens to original owner.
     * @param tokenId The character token ID to unstake
     */
    function unstake(uint256 tokenId) external nonReentrant {
        // ── CHECKS ──
        if (!agentRegistry.isAuthorizedAgent(msg.sender)) {
            revert UnauthorizedAgent(msg.sender);
        }
        uint256 agentTokenId = agentRegistry.getTokenForWallet(msg.sender);
        if (agentTokenId != tokenId) {
            revert AgentTokenMismatch(agentTokenId, tokenId);
        }
        StakeInfo memory info = stakes[tokenId];
        if (info.stakedAt == 0) {
            revert NotStaked(tokenId);
        }

        uint256 rewards = _calculateRewards(tokenId);

        // ── EFFECTS ──
        delete stakes[tokenId];

        // ── INTERACTIONS ──
        characterNFT.transferFrom(address(this), info.originalOwner, tokenId);

        if (rewards > 0) {
            rewardToken.mint(info.originalOwner, rewards);
            emit RewardsClaimed(tokenId, info.originalOwner, rewards, block.timestamp);
        }

        emit CharacterUnstaked(tokenId, msg.sender, rewards, block.timestamp);
    }

    /**
     * @notice View function to calculate pending accrued rewards for a staked token.
     * @param tokenId The token ID to query
     */
    function pendingRewards(uint256 tokenId) external view returns (uint256) {
        return _calculateRewards(tokenId);
    }

    /**
     * @notice View function to fetch current StakeInfo struct.
     */
    function getStakeInfo(uint256 tokenId) external view returns (StakeInfo memory) {
        return stakes[tokenId];
    }

    /**
     * @notice Internal reward calculation: (elapsed seconds * rate) - claimed
     */
    function _calculateRewards(uint256 tokenId) internal view returns (uint256) {
        StakeInfo memory info = stakes[tokenId];
        if (info.stakedAt == 0) return 0;
        uint256 elapsed = block.timestamp - info.stakedAt;
        return (elapsed * REWARD_RATE) - info.rewardsClaimed;
    }
}
