import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { EventInjector } from '../../simulator/injector';
import { SimulatorScheduler } from '../../simulator/scheduler';
import {
  CharacterRepository,
  SessionKeyRepository,
  TradeRepository,
  AgentMemoryRepository,
  PolicyBlockRepository,
} from '../../db/repositories';
import { DashboardWebSocketHub } from '../../ws/dashboardWs';
import { AgentService } from '../../services/AgentService';
import { SimulatorEventType, DashboardSnapshot } from '../../types';
import config from '../../config';

export function registerSimulateAndDashboardRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions & {
    injector: EventInjector;
    scheduler: SimulatorScheduler;
    charRepo: CharacterRepository;
    sessionRepo: SessionKeyRepository;
    tradeRepo: TradeRepository;
    memoryRepo: AgentMemoryRepository;
    policyBlockRepo: PolicyBlockRepository;
    agentService: AgentService;
    wsHub: DashboardWebSocketHub;
  },
  done: (err?: Error) => void
): void {
  const {
    injector,
    scheduler,
    charRepo,
    sessionRepo,
    tradeRepo,
    memoryRepo,
    policyBlockRepo,
    agentService,
    wsHub,
  } = options;

  // Helper to compile full dashboard snapshot
  const buildSnapshot = (): DashboardSnapshot => {
    const characters = [0, 1, 2, 3, 4].map((id) => {
      const status = agentService.getStatus(id);
      if (status) {
        status.blockedActionCount = policyBlockRepo.countBlocksForToken(id);
        return status;
      }
      const char = charRepo.getCharacterByTokenId(id);
      return {
        tokenId: id,
        name: char?.name || `Agent #${id}`,
        archetype: char?.archetype || 'STRATEGIST',
        traits: {
          riskTolerance: char?.risk_tolerance || 50,
          trustBaseline: char?.trust_baseline || 50,
          aggression: char?.aggression || 50,
          patience: char?.patience || 50,
        },
        ownerAddress: char?.owner_address || '0x0000000000000000000000000000000000000000',
        sessionKey: {
          walletAddress: char?.current_agent_wallet || null,
          expiresAt: null,
          isActive: false,
          policyHash: null,
        },
        staking: {
          isStaked: Boolean(char?.is_staked),
          stakedAt: char?.staked_at || null,
          estimatedPendingRewardsWei: '0',
          estimatedPendingRewardsFormatted: '0.0000',
          totalRewardsClaimedWei: char?.total_rewards_claimed || '0',
        },
        openTrades: [],
        blockedActionCount: policyBlockRepo.countBlocksForToken(id),
      };
    });

    const activeTrades = tradeRepo.getAllOpenTrades();
    const recentMemories = memoryRepo.getAllRecentMemories(50);
    const policyBlocksSummary = policyBlockRepo.getBlocksSummary();

    // Map memory records to thoughts / chain events
    const recentThoughts = recentMemories
      .filter((m) => m.event_type.startsWith('THOUGHT') || m.event_type === 'STAKED' || m.event_type === 'UNSTAKED' || m.event_type.startsWith('TRADE_') || m.event_type === 'POLICY_REJECTED')
      .slice(0, 30)
      .map((m) => {
        const char = charRepo.getCharacterByTokenId(m.token_id);
        let meta: any = {};
        try {
          meta = JSON.parse(m.decision_metadata || '{}');
        } catch {
          // ignore
        }
        return {
          tokenId: m.token_id,
          characterName: char?.name || `Character #${m.token_id}`,
          archetype: char?.archetype || 'STRATEGIST',
          observationSummary: meta.observationSummary || m.description,
          reasoningSummary: meta.reasoningSummary || m.description,
          actionTaken: meta.actionTaken || m.event_type,
          transactionHash: meta.transactionHash,
          sentiment: m.sentiment,
          isSimulated: Boolean(meta.isSimulated || m.event_type.startsWith('SIM_')),
          timestamp: m.timestamp,
        };
      });

    const recentChainEvents = recentMemories
      .filter((m) => ['STAKED', 'UNSTAKED', 'TRADE_PROPOSED', 'TRADE_SETTLED', 'TRADE_CANCELLED'].includes(m.event_type))
      .slice(0, 30)
      .map((m) => ({
        eventType: m.event_type,
        tokenIds: [m.token_id],
        transactionHash: undefined,
        details: m.description,
        timestamp: m.timestamp,
      }));

    return {
      characters,
      activeTrades,
      recentThoughts,
      recentChainEvents,
      policyBlocksSummary,
      systemStats: {
        totalCharacters: characters.length,
        totalStaked: characters.filter((c) => c.staking.isStaked).length,
        totalTrades: activeTrades.length,
        activeSessionKeys: characters.filter((c) => c.sessionKey.isActive).length,
        simulatorRunning: scheduler.isActive(),
        network: config.nodeEnv === 'development' ? 'Polygon Amoy (Local/Testnet)' : 'Polygon Amoy',
      },
    };
  };

  // Wire snapshot getter into WebSocket Hub
  wsHub.setSnapshotGetter(buildSnapshot);

  // ── 1. GET /api/dashboard/snapshot ──
  fastify.get('/api/dashboard/snapshot', async () => {
    return buildSnapshot();
  });

  // ── 2. POST /api/simulate/event ──
  const SimulateEventSchema = z.object({
    eventType: z.enum([
      'BATTLE_WON',
      'BATTLE_LOST',
      'RARE_ITEM_DISCOVERED',
      'ZONE_TRANSITION',
      'HOSTILE_ACTION_DETECTED',
      'REWARD_POOL_SPIKE',
    ]),
    targetTokenId: z.number().int().min(0).max(4),
    customDetails: z.record(z.any()).optional(),
  });

  fastify.post('/api/simulate/event', async (request: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
    const parsed = SimulateEventSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        reason: 'INVALID_EVENT_PAYLOAD',
        errors: parsed.error.format(),
      });
    }

    const { eventType, targetTokenId, customDetails } = parsed.data;
    const event = await injector.injectEvent(
      eventType as SimulatorEventType,
      targetTokenId,
      'MANUAL_API',
      customDetails
    );

    return reply.status(200).send({
      success: true,
      event,
    });
  });

  // ── 3. GET /api/simulate/events ──
  fastify.get('/api/simulate/events', async () => {
    return {
      availableEvents: [
        {
          type: 'BATTLE_WON',
          label: 'Battle Won',
          description: 'Character wins combat; boosts confidence and triggers aggressive staking/trades.',
        },
        {
          type: 'BATTLE_LOST',
          label: 'Battle Lost',
          description: 'Character suffers tactical loss; decreases risk appetite and holds position.',
        },
        {
          type: 'RARE_ITEM_DISCOVERED',
          label: 'Rare Item Drop',
          description: 'Valuable item spotted; alerts nearby agents to negotiate acquisition trades.',
        },
        {
          type: 'ZONE_TRANSITION',
          label: 'Zone Transition',
          description: 'Character enters a new sector; scans relational memory of zone occupants.',
        },
        {
          type: 'HOSTILE_ACTION_DETECTED',
          label: 'Hostile Move',
          description: 'Hostile signal detected; high-aggression escalates, low-aggression de-escalates.',
        },
        {
          type: 'REWARD_POOL_SPIKE',
          label: 'Reward Pool Spike',
          description: 'Staking multiplier surges; triggers trait-weighted yield re-evaluation.',
        },
      ],
    };
  });

  // ── 4. POST /api/agent/thought ──
  const AgentThoughtSchema = z.object({
    tokenId: z.number().int().min(0).max(4),
    characterName: z.string(),
    archetype: z.enum(['SCAVENGER', 'STRATEGIST', 'BERSERKER', 'DIPLOMAT', 'HOARDER']),
    observationSummary: z.string(),
    reasoningSummary: z.string(),
    actionTaken: z.string(),
    transactionHash: z.string().optional(),
    sentiment: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE']),
    isSimulated: z.boolean().optional(),
  });

  fastify.post('/api/agent/thought', async (request: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
    const parsed = AgentThoughtSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        reason: 'INVALID_THOUGHT_PAYLOAD',
        errors: parsed.error.format(),
      });
    }

    const thought = {
      ...parsed.data,
      timestamp: Math.floor(Date.now() / 1000),
    };

    // Store in agent_memory
    memoryRepo.insertMemory({
      token_id: thought.tokenId,
      event_type: 'THOUGHT',
      description: `${thought.characterName}: ${thought.reasoningSummary}`,
      decision_metadata: JSON.stringify(thought),
      outcome: thought.actionTaken,
      sentiment: thought.sentiment,
      timestamp: thought.timestamp,
    });

    // Broadcast live to WebSocket clients
    wsHub.broadcastAgentThought(thought);

    return reply.status(200).send({ success: true });
  });

  // ── 5. POST /api/session-keys/:tokenId/revoke ──
  fastify.post('/api/session-keys/:tokenId/revoke', async (request: FastifyRequest<{ Params: { tokenId: string } }>, reply: FastifyReply) => {
    const tokenId = parseInt(request.params.tokenId, 10);
    if (isNaN(tokenId)) {
      return reply.status(400).send({ success: false, reason: 'INVALID_TOKEN_ID' });
    }

    const session = sessionRepo.getActiveSessionKey(tokenId);
    if (!session) {
      return reply.status(404).send({ success: false, reason: 'NO_ACTIVE_SESSION_KEY' });
    }

    sessionRepo.revokeSessionKey(tokenId);

    // Broadcast session key revocation to WebSocket clients
    wsHub.broadcastSessionKeyEvent({
      tokenId,
      walletAddress: session.wallet_address,
      expiresAt: session.expires_at,
      eventType: 'REVOKED',
    });

    // Also update character status on WS
    const updatedStatus = agentService.getStatus(tokenId);
    if (updatedStatus) {
      wsHub.broadcastCharacterUpdate(updatedStatus);
    }

    return reply.status(200).send({
      success: true,
      message: `Session key for Token #${tokenId} revoked instantly via Kill Switch.`,
    });
  });

  // ── 6. POST /api/simulate/toggle-scheduler ──
  fastify.post('/api/simulate/toggle-scheduler', async (request: FastifyRequest<{ Body: { enabled?: boolean } }>, reply: FastifyReply) => {
    const body = (request.body as { enabled?: boolean }) || {};
    const newStatus = body.enabled !== undefined ? body.enabled : !scheduler.isActive();
    scheduler.setEnabled(newStatus);

    return reply.status(200).send({
      success: true,
      schedulerRunning: scheduler.isActive(),
    });
  });

  done();
}
