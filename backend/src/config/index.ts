import dotenv from 'dotenv';
import { isAddress } from 'ethers';

dotenv.config();

export interface AppConfig {
  port: number;
  host: string;
  nodeEnv: string;
  logLevel: string;
  dbPath: string;
  httpRpcUrl: string;
  wsRpcUrl: string;
  contracts: {
    rewardToken: string;
    characterNft: string;
    agentRegistry: string;
    stakingVault: string;
    tradeEscrow: string;
  };
  operatorPrivateKey?: string;
  agentSessionKeys: Record<number, string>;
}

function requireAddress(name: string, value: string | undefined): string {
  if (!value || !isAddress(value)) {
    throw new Error(`Configuration error: ${name} is not a valid Ethereum address. Received: '${value}'`);
  }
  return value;
}

const config: AppConfig = {
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '127.0.0.1',
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  dbPath: process.env.DB_PATH || './autonomous_nft.sqlite',
  httpRpcUrl: process.env.HTTP_RPC_URL || 'http://127.0.0.1:8545',
  wsRpcUrl: process.env.WS_RPC_URL || 'ws://127.0.0.1:8545',
  contracts: {
    rewardToken: requireAddress('REWARD_TOKEN_ADDRESS', process.env.REWARD_TOKEN_ADDRESS || '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0'),
    characterNft: requireAddress('CHARACTER_NFT_ADDRESS', process.env.CHARACTER_NFT_ADDRESS || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'),
    agentRegistry: requireAddress('AGENT_REGISTRY_ADDRESS', process.env.AGENT_REGISTRY_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3'),
    stakingVault: requireAddress('STAKING_VAULT_ADDRESS', process.env.STAKING_VAULT_ADDRESS || '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9'),
    tradeEscrow: requireAddress('TRADE_ESCROW_ADDRESS', process.env.TRADE_ESCROW_ADDRESS || '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9'),
  },
  operatorPrivateKey: process.env.OPERATOR_PRIVATE_KEY,
  agentSessionKeys: {
    0: process.env.AGENT_SESSION_KEY_0 || '',
    1: process.env.AGENT_SESSION_KEY_1 || '',
    2: process.env.AGENT_SESSION_KEY_2 || '',
    3: process.env.AGENT_SESSION_KEY_3 || '',
    4: process.env.AGENT_SESSION_KEY_4 || '',
  },
};

export default config;
