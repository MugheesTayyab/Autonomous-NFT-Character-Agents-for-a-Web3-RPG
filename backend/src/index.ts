import { EventEmitter } from 'events';
import config from './config';
import { getDatabase } from './db/database';
import {
  CharacterRepository,
  SessionKeyRepository,
  TradeRepository,
  AgentMemoryRepository,
  PolicyBlockRepository,
} from './db/repositories';
import { PolicyEngine } from './policyEngine/policyEngine';
import { TransactionSigner } from './blockchain/TransactionSigner';
import { BlockchainListener } from './blockchain/BlockchainListener';
import { AgentService } from './services/AgentService';
import { DashboardWebSocketHub } from './ws/dashboardWs';
import { EventInjector } from './simulator/injector';
import { SimulatorScheduler } from './simulator/scheduler';
import { buildServer } from './api/server';

async function main() {
  console.log('====================================================');
  console.log('🤖 Autonomous NFT Character Agents — Backend Service');
  console.log(`🌍 Environment: ${config.nodeEnv} | Port: ${config.port}`);
  console.log('====================================================');

  // 1. Initialize SQLite Database & Repositories
  const db = getDatabase();
  const charRepo = new CharacterRepository(db);
  const sessionRepo = new SessionKeyRepository(db);
  const tradeRepo = new TradeRepository(db);
  const memoryRepo = new AgentMemoryRepository(db);
  const policyBlockRepo = new PolicyBlockRepository(db);

  // 2. Event Bus & WebSocket Hub
  const eventBus = new EventEmitter();
  const wsHub = DashboardWebSocketHub.getInstance();

  // 3. Initialize Policy Engine & Blockchain Services
  const policyEngine = new PolicyEngine(charRepo, sessionRepo, tradeRepo, memoryRepo, policyBlockRepo);
  const txSigner = new TransactionSigner();
  const agentService = new AgentService(charRepo, sessionRepo, tradeRepo, memoryRepo, policyEngine, txSigner);

  // 4. Initialize Simulator Engine & Auto Scheduler
  const injector = new EventInjector(memoryRepo, wsHub, eventBus);
  const scheduler = new SimulatorScheduler(injector);

  // 5. Start Blockchain Event Listener
  const listener = new BlockchainListener(charRepo, sessionRepo, tradeRepo, memoryRepo);
  await listener.start();

  // 6. Start Fastify Server (with WebSocket + Action API + Dashboard Routes)
  const server = buildServer({
    agentService,
    injector,
    scheduler,
    charRepo,
    sessionRepo,
    tradeRepo,
    memoryRepo,
    policyBlockRepo,
    wsHub,
  });

  server.listen({ port: config.port, host: config.host }, (err, address) => {
    if (err) {
      console.error('Fatal: Server startup error:', err);
      process.exit(1);
    }
    console.log(`🚀 Action API & WebSocket listening on ${address}`);
    console.log(`📡 WebSocket endpoint: ws://${config.host}:${config.port}/ws/dashboard`);
    console.log(`📊 Snapshot endpoint:  http://${config.host}:${config.port}/api/dashboard/snapshot`);
    console.log('====================================================');

    // Start auto-fire simulator if configured
    scheduler.start();
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\nShutting down gracefully...');
    scheduler.stop();
    listener.stop();
    server.close(() => {
      console.log('Server stopped.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal initialization error:', err);
    process.exit(1);
  });
}
