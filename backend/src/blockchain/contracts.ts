import { Interface } from 'ethers';

export const REWARD_TOKEN_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function minters(address account) view returns (bool)',
  'function addMinter(address minter)',
  'function removeMinter(address minter)',
  'function mint(address to, uint256 amount)',
  'event MinterAdded(address indexed minter)',
  'event MinterRemoved(address indexed minter)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

export const CHARACTER_NFT_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function totalMinted() view returns (uint256)',
  'function getTraits(uint256 tokenId) view returns (tuple(uint8 riskTolerance, uint8 trustBaseline, uint8 aggression, uint8 patience))',
  'function getCharacter(uint256 tokenId) view returns (tuple(string name, uint8 archetype, tuple(uint8 riskTolerance, uint8 trustBaseline, uint8 aggression, uint8 patience) traits, address agentWalletAddress, bool agentRegistered))',
  'function mintCharacter(address to, string name, uint8 archetype, tuple(uint8 riskTolerance, uint8 trustBaseline, uint8 aggression, uint8 patience) traits, string metadataURI) returns (uint256)',
  'function linkAgentWallet(uint256 tokenId, address agentWallet)',
  'function approve(address to, uint256 tokenId)',
  'function setApprovalForAll(address operator, bool approved)',
  'function isApprovedForAll(address owner, address operator) view returns (bool)',
  'function getApproved(uint256 tokenId) view returns (address)',
  'event CharacterMinted(uint256 indexed tokenId, string name, uint8 archetype, address indexed owner)',
  'event AgentWalletLinked(uint256 indexed tokenId, address indexed agentWallet)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
];

export const AGENT_REGISTRY_ABI = [
  'function isAuthorizedAgent(address wallet) view returns (bool)',
  'function getTokenForWallet(address wallet) view returns (uint256)',
  'function getAgentRecord(uint256 tokenId) view returns (tuple(address agentWallet, bytes32 policyHash, uint256 registeredAt, uint256 expiresAt, bool active))',
  'function registerAgent(uint256 tokenId, address agentWallet, bytes32 policyHash, uint256 duration)',
  'function updateAgent(uint256 tokenId, bytes32 newPolicyHash, uint256 additionalDuration)',
  'function revokeAgent(uint256 tokenId)',
  'event AgentRegistered(uint256 indexed tokenId, address indexed agentWallet, bytes32 policyHash, uint256 expiresAt)',
  'event AgentUpdated(uint256 indexed tokenId, bytes32 newPolicyHash, uint256 newExpiresAt)',
  'event AgentRevoked(uint256 indexed tokenId, address indexed agentWallet)',
];

export const STAKING_VAULT_ABI = [
  'function REWARD_RATE() view returns (uint256)',
  'function stakes(uint256 tokenId) view returns (address originalOwner, uint256 stakedAt, uint256 rewardsClaimed)',
  'function getStakeInfo(uint256 tokenId) view returns (tuple(address originalOwner, uint256 stakedAt, uint256 rewardsClaimed))',
  'function pendingRewards(uint256 tokenId) view returns (uint256)',
  'function stake(uint256 tokenId)',
  'function unstake(uint256 tokenId)',
  'event CharacterStaked(uint256 indexed tokenId, address indexed agentWallet, address indexed originalOwner, uint256 timestamp)',
  'event CharacterUnstaked(uint256 indexed tokenId, address indexed agentWallet, uint256 rewardsPaid, uint256 timestamp)',
  'event RewardsClaimed(uint256 indexed tokenId, address indexed recipient, uint256 amount, uint256 timestamp)',
];

export const TRADE_ESCROW_ABI = [
  'function trades(bytes32 tradeId) view returns (address proposerWallet, address targetWallet, address proposerOwner, uint256 offeredTokenId, uint256 requestedTokenId, uint8 status, uint256 proposedAt, uint256 settledAt)',
  'function getTrade(bytes32 tradeId) view returns (tuple(address proposerWallet, address targetWallet, address proposerOwner, uint256 offeredTokenId, uint256 requestedTokenId, uint8 status, uint256 proposedAt, uint256 settledAt))',
  'function proposeTrade(uint256 offeredTokenId, uint256 requestedTokenId, address targetWallet) returns (bytes32)',
  'function acceptTrade(bytes32 tradeId)',
  'function cancelTrade(bytes32 tradeId)',
  'event TradeProposed(bytes32 indexed tradeId, address indexed proposerWallet, address indexed targetWallet, uint256 offeredTokenId, uint256 requestedTokenId, uint256 timestamp)',
  'event TradeSettled(bytes32 indexed tradeId, address proposerOwner, uint256 receivedTokenId, address targetOwner, uint256 deliveredTokenId, uint256 timestamp)',
  'event TradeCancelled(bytes32 indexed tradeId, address indexed cancelledBy, uint256 timestamp)',
];

export const rewardTokenInterface = new Interface(REWARD_TOKEN_ABI);
export const characterNftInterface = new Interface(CHARACTER_NFT_ABI);
export const agentRegistryInterface = new Interface(AGENT_REGISTRY_ABI);
export const stakingVaultInterface = new Interface(STAKING_VAULT_ABI);
export const tradeEscrowInterface = new Interface(TRADE_ESCROW_ABI);
