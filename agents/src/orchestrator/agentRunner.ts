import { buildAgentGraph, GraphBuildOptions } from '../graphs/agentGraph';
import { CHARACTER_PERSONAS } from '../personas/archetypes';
import { AgentState } from '../types';
import config from '../config';

export class AgentRunner {
  private agentGraphs: Map<number, any> = new Map();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(options: GraphBuildOptions = {}) {
    this.initializeAgents(options);
  }

  private initializeAgents(options: GraphBuildOptions): void {
    for (let tokenId = 0; tokenId < 5; tokenId++) {
      const persona = CHARACTER_PERSONAS[tokenId];
      if (persona) {
        const graph = buildAgentGraph(options);
        this.agentGraphs.set(tokenId, graph);
      }
    }
  }

  public async runAgent(
    tokenId: number,
    triggerEvent?: { eventType: string; payload?: Record<string, any> }
  ): Promise<AgentState> {
    const persona = CHARACTER_PERSONAS[tokenId];
    if (!persona) {
      throw new Error(`Unknown character token ID ${tokenId}`);
    }

    const graph = this.agentGraphs.get(tokenId);
    if (!graph) {
      throw new Error(`No graph compiled for token ID ${tokenId}`);
    }

    console.log(`\n🤖 [AgentRunner] Waking Agent #${tokenId} (${persona.name}) [Archetype: ${persona.archetype}]`);
    if (triggerEvent) {
      console.log(` > Trigger: ${triggerEvent.eventType}`);
    }

    const initialState: AgentState = {
      tokenId,
      name: persona.name,
      archetype: persona.archetype,
      traits: persona.traits,
      triggerEvent,
    };

    const finalState = (await graph.invoke(initialState)) as AgentState;
    console.log(`🏁 [AgentRunner] Agent #${tokenId} completed cycle. Action: ${finalState.reasoningOutput?.action || 'noop'}`);
    return finalState;
  }

  public startHeartbeat(intervalMs = config.heartbeatIntervalMs): void {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log(`\n💓 [AgentRunner] Starting autonomous multi-agent heartbeat loop (${intervalMs / 1000}s interval)...`);

    this.heartbeatTimer = setInterval(async () => {
      if (!this.isRunning) return;

      for (let tokenId = 0; tokenId < 5; tokenId++) {
        try {
          await this.runAgent(tokenId, { eventType: 'HEARTBEAT' });
          // Small delay between agents to spread load
          await new Promise((r) => setTimeout(r, 1000));
        } catch (err: any) {
          console.warn(`[AgentRunner] Error in Agent #${tokenId} cycle: ${err.message}`);
        }
      }
    }, intervalMs);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    console.log('[AgentRunner] Heartbeat stopped.');
  }
}
