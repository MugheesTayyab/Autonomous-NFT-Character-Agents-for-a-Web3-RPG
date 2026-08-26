import { EventEmitter } from 'events';
import { AgentMemoryRepository } from '../db/repositories';
import { DashboardWebSocketHub } from '../ws/dashboardWs';
import { SimulatorEventPayload, SimulatorEventType } from '../types';
import { createSimulatedEvent } from './events';

export class EventInjector {
  constructor(
    private memoryRepo: AgentMemoryRepository,
    private wsHub: DashboardWebSocketHub,
    private eventBus: EventEmitter,
    private agentWebhookUrl = process.env.AGENT_WEBHOOK_URL || 'http://127.0.0.1:3002/webhook/event'
  ) {}

  public async injectEvent(
    eventType: SimulatorEventType,
    targetTokenId: number,
    source: 'MANUAL_API' | 'AUTO_SCHEDULER' = 'MANUAL_API',
    customDetails: Record<string, any> = {}
  ): Promise<SimulatorEventPayload> {
    const event = createSimulatedEvent(eventType, targetTokenId, source, customDetails);

    console.log(`\n🎮 [Simulator] Injected Event: '${event.eventType}' -> Target: Token #${targetTokenId} [Source: ${source}]`);
    console.log(` > ${event.details.title} — ${event.details.description}`);

    // 1. Record event in SQLite agent_memory
    try {
      this.memoryRepo.insertMemory({
        token_id: targetTokenId,
        event_type: `SIM_${event.eventType}`,
        description: `[SIMULATED] ${event.details.description}`,
        decision_metadata: JSON.stringify(event.details),
        outcome: 'Injected into cognitive pipeline',
        sentiment: event.eventType === 'BATTLE_WON' || event.eventType === 'REWARD_POOL_SPIKE' ? 'POSITIVE' : event.eventType === 'BATTLE_LOST' ? 'NEGATIVE' : 'NEUTRAL',
        timestamp: event.timestamp,
      });
    } catch (err: any) {
      console.warn(`[Simulator] Error logging memory for Token #${targetTokenId}:`, err.message);
    }

    // 2. Broadcast to connected WebSocket dashboards
    this.wsHub.broadcastSimulatorEvent(event);

    // 3. Publish to internal event bus
    const affectedTokens = [targetTokenId, ...(event.details.nearbyTokenIds || [])];
    this.eventBus.emit('simulatedEvent', {
      ...event,
      affectedTokenIds: Array.from(new Set(affectedTokens)),
    });

    // 4. Dispatch webhook to Agent Cognitive Layer if active
    this.dispatchToAgentWebhook({
      eventType: event.eventType,
      source: 'SIMULATOR',
      affectedTokenIds: Array.from(new Set(affectedTokens)),
      payload: event,
    }).catch(() => {
      // Non-blocking if agent layer is starting up or offline
    });

    return event;
  }

  private async dispatchToAgentWebhook(payload: Record<string, any>): Promise<void> {
    try {
      const res = await fetch(this.agentWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        // Agent webhook may return 4xx/5xx or be offline
      }
    } catch {
      // Agent layer is standalone; ignore fetch network errors
    }
  }
}
