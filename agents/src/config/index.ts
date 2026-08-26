import dotenv from 'dotenv';

dotenv.config();

export interface AgentLayerConfig {
  backendApiUrl: string;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  openaiModel: string;
  temperature: number;
  heartbeatIntervalMs: number;
  autoHeartbeat: boolean;
  logLevel: string;
}

const rawApiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
const isOpenRouter = rawApiKey?.startsWith('sk-or-') || Boolean(process.env.OPENROUTER_API_KEY);

const config: AgentLayerConfig = {
  backendApiUrl: process.env.BACKEND_API_URL || 'http://127.0.0.1:3001',
  openaiApiKey: rawApiKey,
  openaiBaseUrl: process.env.OPENAI_BASE_URL || (isOpenRouter ? 'https://openrouter.ai/api/v1' : undefined),
  openaiModel: process.env.OPENAI_MODEL || (isOpenRouter ? 'google/gemini-2.0-flash-exp:free' : 'gpt-4o-mini'),
  temperature: parseFloat(process.env.TEMPERATURE || '0.2'),
  heartbeatIntervalMs: parseInt(process.env.HEARTBEAT_INTERVAL_MS || '15000', 10),
  autoHeartbeat: process.env.AUTO_HEARTBEAT === 'true',
  logLevel: process.env.LOG_LEVEL || 'info',
};

export default config;
