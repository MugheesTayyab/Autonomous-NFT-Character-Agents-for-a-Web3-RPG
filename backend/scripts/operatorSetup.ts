import { JsonRpcProvider, Wallet, Contract, keccak256, toUtf8Bytes } from 'ethers';
import config from '../src/config';
import {
  CHARACTER_NFT_ABI,
  AGENT_REGISTRY_ABI,
} from '../src/blockchain/contracts';

const POLICIES = [
  {
    tokenId: 0, // Kael (Berserker)
    allowedActions: ['stake', 'unstake', 'proposeTrade', 'respondTrade'],
    spendLimits: { maxStakeCycles: 20, maxActiveTrades: 5 },
  },
  {
    tokenId: 1, // Lyra (Strategist)
    allowedActions: ['stake', 'unstake', 'proposeTrade', 'respondTrade'],
    spendLimits: { maxStakeCycles: 15, maxActiveTrades: 3 },
  },
  {
    tokenId: 2, // Rexx (Scavenger)
    allowedActions: ['stake', 'unstake', 'proposeTrade', 'respondTrade'],
    spendLimits: { maxStakeCycles: 25, maxActiveTrades: 5 },
  },
  {
    tokenId: 3, // Voss (Diplomat)
    allowedActions: ['stake', 'unstake', 'proposeTrade', 'respondTrade'],
    spendLimits: { maxStakeCycles: 10, maxActiveTrades: 4 },
  },
  {
    tokenId: 4, // Nyx (Hoarder) - Restrictive policy (no proposeTrade!)
    allowedActions: ['stake', 'unstake', 'respondTrade'],
    spendLimits: { maxStakeCycles: 5, maxActiveTrades: 1 },
  },
];

async function main() {
  console.log('====================================================');
  console.log('🛡️  Running Operator Setup Script (Phase 2)');
  console.log('====================================================');

  const provider = new JsonRpcProvider(config.httpRpcUrl);
  if (!config.operatorPrivateKey) {
    throw new Error('OPERATOR_PRIVATE_KEY is required in .env');
  }

  const operatorWallet = new Wallet(config.operatorPrivateKey, provider);
  console.log(`Operator Wallet: ${operatorWallet.address}`);

  const nftContract = new Contract(config.contracts.characterNft, CHARACTER_NFT_ABI, operatorWallet);
  const registryContract = new Contract(config.contracts.agentRegistry, AGENT_REGISTRY_ABI, operatorWallet);

  let currentNonce = await provider.getTransactionCount(operatorWallet.address, 'latest');

  // ── Step 1 & 2: Approvals for StakingVault and TradeEscrow ──
  console.log('\n[1/4] Setting approval for StakingVault...');
  const tx1 = await nftContract.setApprovalForAll(config.contracts.stakingVault, true, { nonce: currentNonce++ });
  await tx1.wait(1);
  console.log(`StakingVault approved: ${tx1.hash}`);

  console.log('\n[2/4] Setting approval for TradeEscrow...');
  const tx2 = await nftContract.setApprovalForAll(config.contracts.tradeEscrow, true, { nonce: currentNonce++ });
  await tx2.wait(1);
  console.log(`TradeEscrow approved: ${tx2.hash}`);

  // ── Step 3 & 4: Register session keys & Link Wallets ──
  console.log('\n[3/4] Registering 5 session keys in AgentRegistry & CharacterNFT...');
  const duration = 7 * 86400; // 7 days

  for (const policyDef of POLICIES) {
    const tokenId = policyDef.tokenId;
    const sessionKeyHex = config.agentSessionKeys[tokenId];
    if (!sessionKeyHex) {
      console.warn(`Skipping token ${tokenId}: No private key configured in AGENT_SESSION_KEY_${tokenId}`);
      continue;
    }

    const sessionWallet = new Wallet(sessionKeyHex, provider);
    const policyDocStr = JSON.stringify({
      version: '1.0',
      allowedActions: policyDef.allowedActions,
      spendLimits: policyDef.spendLimits,
    });
    const policyHash = keccak256(toUtf8Bytes(policyDocStr));

    console.log(`Registering Agent for Token #${tokenId} (${sessionWallet.address})...`);
    const regTx = await registryContract.registerAgent(tokenId, sessionWallet.address, policyHash, duration, { nonce: currentNonce++ });
    await regTx.wait(1);

    const linkTx = await nftContract.linkAgentWallet(tokenId, sessionWallet.address, { nonce: currentNonce++ });
    await linkTx.wait(1);
    console.log(`Token #${tokenId} registered & linked successfully.`);
  }

  // ── Step 5: Verification ──
  console.log('\n[4/4] Verifying on-chain authorization status...');
  for (let i = 0; i < 5; i++) {
    const key = config.agentSessionKeys[i];
    if (key) {
      const w = new Wallet(key, provider);
      const isAuth = await registryContract.isAuthorizedAgent(w.address);
      console.log(`Token #${i} Agent (${w.address}): isAuthorized = ${isAuth}`);
    }
  }

  console.log('\n✅ Operator setup complete! All agents ready for Phase 3.');
  console.log('====================================================');
}

main().catch((err) => {
  console.error('Operator setup failed:', err);
  process.exit(1);
});
