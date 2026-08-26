import http from 'http';
import { AgentRunner } from './agentRunner';

export class EventBridge {
  private lastTriggered: Map<number, number> = new Map();
  private debounceMs = 3000;
  private server: http.Server | null = null;

  constructor(private runner: AgentRunner) {}

  public async onEventReceived(event: {
    eventType: string;
    affectedTokenIds: number[];
    payload?: Record<string, any>;
  }): Promise<void> {
    console.log(`\n⚡ [EventBridge] Event: '${event.eventType}' -> Affected: [${event.affectedTokenIds.join(', ')}]`);

    for (const tokenId of event.affectedTokenIds) {
      const now = Date.now();
      const last = this.lastTriggered.get(tokenId) || 0;

      if (now - last < this.debounceMs) {
        console.log(`[EventBridge] Skipping debounce for Token #${tokenId}`);
        continue;
      }

      this.lastTriggered.set(tokenId, now);

      try {
        await this.runner.runAgent(tokenId, {
          eventType: event.eventType,
          payload: event.payload,
        });
      } catch (err: any) {
        console.error(`[EventBridge] Error triggering agent #${tokenId}:`, err.message);
      }
    }
  }

  public startWebhookServer(port = 3002): void {
    if (this.server) return;

    this.server = http.createServer(async (req, res) => {
      if (req.method === 'POST' && req.url === '/webhook/event') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk.toString();
        });

        req.on('end', async () => {
          try {
            const parsed = JSON.parse(body);
            const affectedTokenIds = parsed.affectedTokenIds || (parsed.payload?.targetTokenId !== undefined ? [parsed.payload.targetTokenId] : [0]);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, queued: true }));

            await this.onEventReceived({
              eventType: parsed.eventType || 'UNKNOWN_EVENT',
              affectedTokenIds,
              payload: parsed.payload || parsed,
            });
          } catch (err: any) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
      } else if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', service: 'agent-layer' }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    this.server.listen(port, () => {
      console.log(`⚡ [EventBridge] Agent webhook listener active on http://127.0.0.1:${port}/webhook/event`);
    });
  }

  public stopWebhookServer(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}
