import { FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import {
  WsMessage,
  AgentStatusResponse,
  AgentThoughtPayload,
  ChainEventPayload,
  TradeRecord,
  SimulatorEventPayload,
} from '../types';

export class DashboardWebSocketHub {
  private static instance: DashboardWebSocketHub | null = null;
  private clients: Set<any> = new Set();
  private snapshotGetter: (() => any) | null = null;

  public static getInstance(): DashboardWebSocketHub {
    if (!DashboardWebSocketHub.instance) {
      DashboardWebSocketHub.instance = new DashboardWebSocketHub();
    }
    return DashboardWebSocketHub.instance;
  }

  public setSnapshotGetter(getter: () => any): void {
    this.snapshotGetter = getter;
  }

  public register(server: FastifyInstance): void {
    server.register(websocket);

    server.register(async (fastify) => {
      fastify.get('/ws/dashboard', { websocket: true }, (connection /* SocketStream */, req) => {
        const socket = connection.socket;
        this.clients.add(socket);
        console.log(`📡 [WebSocket] Dashboard client connected. Total clients: ${this.clients.size}`);

        // Send initial snapshot on connect if available
        if (this.snapshotGetter) {
          try {
            const snapshot = this.snapshotGetter();
            this.sendToSocket(socket, {
              type: 'SNAPSHOT',
              data: snapshot,
              timestamp: Math.floor(Date.now() / 1000),
            });
          } catch (err) {
            console.error('[WebSocket] Error sending snapshot to client:', err);
          }
        }

        socket.on('message', (message: any) => {
          try {
            const parsed = JSON.parse(message.toString());
            if (parsed.type === 'PING') {
              this.sendToSocket(socket, {
                type: 'SNAPSHOT',
                data: { pong: true },
                timestamp: Math.floor(Date.now() / 1000),
              });
            }
          } catch {
            // ignore malformed ping
          }
        });

        socket.on('close', () => {
          this.clients.delete(socket);
          console.log(`🔌 [WebSocket] Dashboard client disconnected. Total clients: ${this.clients.size}`);
        });

        socket.on('error', (err: any) => {
          console.warn('[WebSocket] Client socket error:', err.message);
          this.clients.delete(socket);
        });
      });
    });
  }

  public broadcast<T>(message: WsMessage<T>): void {
    const payload = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === 1) { // 1 = OPEN
        try {
          client.send(payload);
        } catch (err) {
          console.warn('[WebSocket] Error broadcasting to client:', err);
        }
      }
    }
  }

  private sendToSocket(socket: any, message: WsMessage): void {
    if (socket.readyState === 1) {
      socket.send(JSON.stringify(message));
    }
  }

  public broadcastCharacterUpdate(character: AgentStatusResponse): void {
    this.broadcast({
      type: 'CHARACTER_STATUS_UPDATE',
      data: character,
      timestamp: Math.floor(Date.now() / 1000),
    });
  }

  public broadcastAgentThought(thought: AgentThoughtPayload): void {
    this.broadcast({
      type: 'AGENT_THOUGHT',
      data: thought,
      timestamp: Math.floor(Date.now() / 1000),
    });
  }

  public broadcastChainEvent(event: ChainEventPayload): void {
    this.broadcast({
      type: 'CHAIN_EVENT',
      data: event,
      timestamp: Math.floor(Date.now() / 1000),
    });
  }

  public broadcastTradeUpdate(trade: TradeRecord): void {
    this.broadcast({
      type: 'TRADE_UPDATE',
      data: trade,
      timestamp: Math.floor(Date.now() / 1000),
    });
  }

  public broadcastSessionKeyEvent(event: {
    tokenId: number;
    walletAddress: string;
    expiresAt: number;
    eventType: 'REGISTERED' | 'REVOKED';
  }): void {
    this.broadcast({
      type: 'SESSION_KEY_EVENT',
      data: event,
      timestamp: Math.floor(Date.now() / 1000),
    });
  }

  public broadcastSimulatorEvent(event: SimulatorEventPayload): void {
    this.broadcast({
      type: 'SIMULATOR_EVENT',
      data: event,
      timestamp: Math.floor(Date.now() / 1000),
    });
  }

  public getClientCount(): number {
    return this.clients.size;
  }
}
