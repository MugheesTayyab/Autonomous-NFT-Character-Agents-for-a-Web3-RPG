import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Hardhat Ignition deployment module for Autonomous NFT Character Agents.
 * Deploys in strict dependency order:
 * 1. RewardToken (MLRD)
 * 2. CharacterNFT (MSCHAR)
 * 3. AgentRegistry
 * 4. StakingVault (references CharacterNFT, RewardToken, AgentRegistry)
 * 5. TradeEscrow (references CharacterNFT, AgentRegistry)
 * 6. Post-deployment setup: grants StakingVault minter role on RewardToken
 */
export default buildModule("FullDeployModule", (m) => {
  const deployer = m.getAccount(0);

  // 1. Deploy RewardToken (no contract dependencies)
  const rewardToken = m.contract("RewardToken", [deployer], {
    id: "RewardToken",
  });

  // 2. Deploy CharacterNFT (no contract dependencies)
  const characterNFT = m.contract("CharacterNFT", [deployer], {
    id: "CharacterNFT",
  });

  // 3. Deploy AgentRegistry (no contract dependencies)
  const agentRegistry = m.contract("AgentRegistry", [deployer], {
    id: "AgentRegistry",
  });

  // 4. Deploy StakingVault (depends on CharacterNFT, RewardToken, AgentRegistry)
  const stakingVault = m.contract(
    "StakingVault",
    [characterNFT, rewardToken, agentRegistry, deployer],
    {
      id: "StakingVault",
    }
  );

  // 5. Deploy TradeEscrow (depends on CharacterNFT, AgentRegistry)
  const tradeEscrow = m.contract(
    "TradeEscrow",
    [characterNFT, agentRegistry, deployer],
    {
      id: "TradeEscrow",
    }
  );

  // 6. Post-deployment step: Deployer grants StakingVault minter role on RewardToken
  m.call(rewardToken, "addMinter", [stakingVault], {
    id: "AddStakingVaultMinter",
    after: [rewardToken, stakingVault],
  });

  return {
    rewardToken,
    characterNFT,
    agentRegistry,
    stakingVault,
    tradeEscrow,
  };
});
