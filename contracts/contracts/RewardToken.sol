// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title RewardToken
 * @notice ERC-20 utility and reward currency for the MetaSpace Autonomous NFT ecosystem.
 *         StakingVault is granted minter authority to emit rewards to stakers.
 *         Initial supply is minted to the initialOwner for system initialization & test faucet funding.
 */
contract RewardToken is ERC20, Ownable {
    /// @notice Addresses authorized to mint new reward tokens (e.g. StakingVault)
    mapping(address => bool) public minters;

    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);

    error NotAuthorizedMinter(address caller);
    error InvalidMinterAddress();

    modifier onlyMinter() {
        if (!minters[msg.sender]) {
            revert NotAuthorizedMinter(msg.sender);
        }
        _;
    }

    /**
     * @param initialOwner Address of the deployer / system admin
     */
    constructor(address initialOwner)
        ERC20("MetaSpace Reward Token", "MLRD")
        Ownable(initialOwner)
    {
        // Mint initial supply (1,000,000 MLRD) to deployer for agent setup and liquidity
        _mint(initialOwner, 1_000_000 * 10 ** decimals());
    }

    /**
     * @notice Grants minting authority to an address (e.g. StakingVault contract)
     * @param minter Address to authorize
     */
    function addMinter(address minter) external onlyOwner {
        if (minter == address(0)) revert InvalidMinterAddress();
        minters[minter] = true;
        emit MinterAdded(minter);
    }

    /**
     * @notice Revokes minting authority from an address
     * @param minter Address to de-authorize
     */
    function removeMinter(address minter) external onlyOwner {
        if (minter == address(0)) revert InvalidMinterAddress();
        minters[minter] = false;
        emit MinterRemoved(minter);
    }

    /**
     * @notice Mints new reward tokens to a recipient. Only callable by authorized minters.
     * @param to Recipient address
     * @param amount Token amount in wei
     */
    function mint(address to, uint256 amount) external onlyMinter {
        _mint(to, amount);
    }
}
