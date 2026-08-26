// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AgentRegistry
 * @notice On-chain verifiable registry linking Character NFT token IDs to their
 *         delegated session-key agent wallets and policy hashes.
 *
 *         Enables trustless authorization verification for StakingVault, TradeEscrow,
 *         and external verifiers while providing owners with an instant on-chain kill switch.
 */
contract AgentRegistry is Ownable {
    struct AgentRecord {
        address agentWallet;
        bytes32 policyHash;    // keccak256 of off-chain policy document (spend limits, allowed actions)
        uint256 registeredAt;
        uint256 expiresAt;     // Unix timestamp after which session key is invalid
        bool active;
    }

    /// @notice tokenId => AgentRecord
    mapping(uint256 => AgentRecord) public agentRecords;

    /// @notice agentWallet => tokenId reverse lookup
    mapping(address => uint256) public walletToToken;

    /// @notice Tracks whether a wallet is mapped to a token (specifically needed for tokenId 0)
    mapping(address => bool) public isWalletMapped;

    // ─── Events ───
    event AgentRegistered(
        uint256 indexed tokenId,
        address indexed agentWallet,
        bytes32 policyHash,
        uint256 expiresAt
    );

    event AgentUpdated(
        uint256 indexed tokenId,
        bytes32 newPolicyHash,
        uint256 newExpiresAt
    );

    event AgentRevoked(
        uint256 indexed tokenId,
        address indexed agentWallet
    );

    // ─── Custom Errors ───
    error InvalidAgentWallet();
    error InvalidDuration();
    error AgentNotActive(uint256 tokenId);
    error AgentAlreadyRevoked(uint256 tokenId);
    error WalletNotMapped(address wallet);

    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @notice Registers a session-key wallet as an authorized agent for a token ID.
     * @param tokenId The Character NFT token ID
     * @param agentWallet The generated session key wallet address
     * @param policyHash Hash of the scoped permissions policy document
     * @param duration Number of seconds the session key remains valid
     */
    function registerAgent(
        uint256 tokenId,
        address agentWallet,
        bytes32 policyHash,
        uint256 duration
    ) external onlyOwner {
        if (agentWallet == address(0)) revert InvalidAgentWallet();
        if (duration == 0) revert InvalidDuration();

        // If previous wallet was mapped to this token, clear previous mapping
        address prevWallet = agentRecords[tokenId].agentWallet;
        if (prevWallet != address(0) && isWalletMapped[prevWallet]) {
            delete isWalletMapped[prevWallet];
            delete walletToToken[prevWallet];
        }

        uint256 expiresAt = block.timestamp + duration;

        agentRecords[tokenId] = AgentRecord({
            agentWallet: agentWallet,
            policyHash: policyHash,
            registeredAt: block.timestamp,
            expiresAt: expiresAt,
            active: true
        });

        walletToToken[agentWallet] = tokenId;
        isWalletMapped[agentWallet] = true;

        emit AgentRegistered(tokenId, agentWallet, policyHash, expiresAt);
    }

    /**
     * @notice Updates the policy hash or extends the duration of an active agent.
     * @param tokenId The Character NFT token ID
     * @param newPolicyHash New policy hash (or existing if unchanged)
     * @param additionalDuration Additional seconds to add to expiresAt
     */
    function updateAgent(
        uint256 tokenId,
        bytes32 newPolicyHash,
        uint256 additionalDuration
    ) external onlyOwner {
        AgentRecord storage record = agentRecords[tokenId];
        if (!record.active) revert AgentNotActive(tokenId);

        record.policyHash = newPolicyHash;
        record.expiresAt += additionalDuration;

        emit AgentUpdated(tokenId, newPolicyHash, record.expiresAt);
    }

    /**
     * @notice Instantly revokes an agent wallet's authorization (Human Owner Kill Switch).
     * @param tokenId The Character NFT token ID to revoke
     */
    function revokeAgent(uint256 tokenId) external onlyOwner {
        AgentRecord storage record = agentRecords[tokenId];
        if (!record.active) revert AgentAlreadyRevoked(tokenId);

        address wallet = record.agentWallet;
        record.active = false;

        if (isWalletMapped[wallet]) {
            delete isWalletMapped[wallet];
            delete walletToToken[wallet];
        }

        emit AgentRevoked(tokenId, wallet);
    }

    /**
     * @notice Checks if a wallet is an active, authorized, non-expired agent.
     * @param wallet Address to check
     */
    function isAuthorizedAgent(address wallet) external view returns (bool) {
        if (!isWalletMapped[wallet]) return false;

        uint256 tokenId = walletToToken[wallet];
        AgentRecord storage record = agentRecords[tokenId];

        return record.active &&
               record.agentWallet == wallet &&
               block.timestamp < record.expiresAt;
    }

    /**
     * @notice Returns the token ID operated by a given agent wallet.
     * @param wallet Address of the agent session key
     */
    function getTokenForWallet(address wallet) external view returns (uint256) {
        if (!isWalletMapped[wallet]) revert WalletNotMapped(wallet);
        return walletToToken[wallet];
    }

    /**
     * @notice Returns the full AgentRecord for a token ID.
     */
    function getAgentRecord(uint256 tokenId) external view returns (AgentRecord memory) {
        return agentRecords[tokenId];
    }
}
