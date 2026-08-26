// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CharacterNFT
 * @notice ERC-721 contract for autonomous Web3 RPG game characters.
 *         Each token represents a unique in-game commander and stores on-chain
 *         personality traits that drive autonomous AI agent decision-making.
 */
contract CharacterNFT is ERC721, ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    /// @notice Personality traits (0-100 scale) directly consumed by LangGraph AI agents
    struct Traits {
        uint8 riskTolerance;  // Staking appetite & willingness to take risks
        uint8 trustBaseline;  // Threshold for accepting trades from new agents
        uint8 aggression;     // Willingness to initiate trades & escalate
        uint8 patience;       // Delay tolerance and willingness to wait for better terms
    }

    /// @notice Archetypes mirroring MetaSpace RPG commander classes
    enum Archetype {
        SCAVENGER,
        STRATEGIST,
        BERSERKER,
        DIPLOMAT,
        HOARDER
    }

    struct Character {
        string name;
        Archetype archetype;
        Traits traits;
        address agentWalletAddress;
        bool agentRegistered;
    }

    /// @notice tokenId => Character data
    mapping(uint256 => Character) public characters;

    // ─── Events ───
    event CharacterMinted(
        uint256 indexed tokenId,
        string name,
        Archetype archetype,
        address indexed owner
    );

    event AgentWalletLinked(
        uint256 indexed tokenId,
        address indexed agentWallet
    );

    // ─── Custom Errors ───
    error TraitOutOfRange(string traitName, uint8 value);
    error TokenDoesNotExist(uint256 tokenId);
    error InvalidAgentWallet();

    constructor(address initialOwner)
        ERC721("MetaSpace Character", "MSCHAR")
        Ownable(initialOwner)
    {}

    /**
     * @notice Mints a new Character NFT with specified traits and metadata URI.
     * @param to Recipient of the NFT
     * @param name Character name
     * @param archetype Character class/archetype
     * @param traits 0-100 numerical trait scores
     * @param metadataURI IPFS URI containing character metadata JSON
     * @return tokenId The newly minted token's ID
     */
    function mintCharacter(
        address to,
        string calldata name,
        Archetype archetype,
        Traits calldata traits,
        string calldata metadataURI
    ) external onlyOwner returns (uint256) {
        if (traits.riskTolerance > 100) revert TraitOutOfRange("riskTolerance", traits.riskTolerance);
        if (traits.trustBaseline > 100) revert TraitOutOfRange("trustBaseline", traits.trustBaseline);
        if (traits.aggression > 100) revert TraitOutOfRange("aggression", traits.aggression);
        if (traits.patience > 100) revert TraitOutOfRange("patience", traits.patience);

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, metadataURI);

        characters[tokenId] = Character({
            name: name,
            archetype: archetype,
            traits: traits,
            agentWalletAddress: address(0),
            agentRegistered: false
        });

        emit CharacterMinted(tokenId, name, archetype, to);
        return tokenId;
    }

    /**
     * @notice Links an agent session-key wallet to a character NFT.
     * @param tokenId The character token ID
     * @param agentWallet The authorized session-key wallet address
     */
    function linkAgentWallet(uint256 tokenId, address agentWallet) external onlyOwner {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist(tokenId);
        if (agentWallet == address(0)) revert InvalidAgentWallet();

        characters[tokenId].agentWalletAddress = agentWallet;
        characters[tokenId].agentRegistered = true;

        emit AgentWalletLinked(tokenId, agentWallet);
    }

    /**
     * @notice Returns the personality traits for a given character token.
     * @param tokenId The token ID to query
     */
    function getTraits(uint256 tokenId) external view returns (Traits memory) {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist(tokenId);
        return characters[tokenId].traits;
    }

    /**
     * @notice Returns complete Character struct details for a given token.
     * @param tokenId The token ID to query
     */
    function getCharacter(uint256 tokenId) external view returns (Character memory) {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist(tokenId);
        return characters[tokenId];
    }

    /**
     * @notice Total number of tokens minted so far.
     */
    function totalMinted() external view returns (uint256) {
        return _nextTokenId;
    }

    // ─── Overrides required by ERC721URIStorage ───
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
