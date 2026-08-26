import { EventEmitter } from 'events';
import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { registerAgentRoutes } from './routes';
import { registerSimulateAndDashboardRoutes } from './routes/simulate';
import { AgentService } from '../services/AgentService';
import { EventInjector } from '../simulator/injector';
import { SimulatorScheduler } from '../simulator/scheduler';
import {
  CharacterRepository,
  SessionKeyRepository,
  TradeRepository,
  AgentMemoryRepository,
  PolicyBlockRepository,
} from '../db/repositories';
import { getDatabase } from '../db/database';
import { DashboardWebSocketHub } from '../ws/dashboardWs';
import config from '../config';

export interface ServerDependencies {
  agentService: AgentService;
  injector?: EventInjector;
  scheduler?: SimulatorScheduler;
  charRepo?: CharacterRepository;
  sessionRepo?: SessionKeyRepository;
  tradeRepo?: TradeRepository;
  memoryRepo?: AgentMemoryRepository;
  policyBlockRepo?: PolicyBlockRepository;
  wsHub?: DashboardWebSocketHub;
}

export function buildServer(depsOrAgentService: ServerDependencies | AgentService): FastifyInstance {
  const isAgentService = typeof (depsOrAgentService as any).stake === 'function';
  const agentService = isAgentService
    ? (depsOrAgentService as AgentService)
    : (depsOrAgentService as ServerDependencies).agentService;

  const deps: Partial<ServerDependencies> = isAgentService
    ? {}
    : (depsOrAgentService as ServerDependencies);

  const db = getDatabase();
  const charRepo = deps.charRepo || new CharacterRepository(db);
  const sessionRepo = deps.sessionRepo || new SessionKeyRepository(db);
  const tradeRepo = deps.tradeRepo || new TradeRepository(db);
  const memoryRepo = deps.memoryRepo || new AgentMemoryRepository(db);
  const policyBlockRepo = deps.policyBlockRepo || new PolicyBlockRepository(db);
  const wsHub = deps.wsHub || DashboardWebSocketHub.getInstance();

  const eventBus = new EventEmitter();
  const injector = deps.injector || new EventInjector(memoryRepo, wsHub, eventBus);
  const scheduler = deps.scheduler || new SimulatorScheduler(injector, { enabled: false });

  const server = fastify({
    logger: config.nodeEnv === 'test' ? false : {
      level: config.logLevel,
    },
  });

  // 1. Enable CORS for Next.js frontend dashboard
  server.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  // 2. Register WebSocket hub
  wsHub.register(server);

  // 3. Register Agent Action API Routes
  server.register(registerAgentRoutes, { agentService });

  // 4. Register Simulator & Dashboard routes
  server.register(registerSimulateAndDashboardRoutes, {
    injector,
    scheduler,
    charRepo,
    sessionRepo,
    tradeRepo,
    memoryRepo,
    policyBlockRepo,
    agentService,
    wsHub,
  });

  return server;
}
