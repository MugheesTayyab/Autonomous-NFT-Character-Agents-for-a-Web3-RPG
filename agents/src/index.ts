import config from './config';
import { AgentRunner } from './orchestrator/agentRunner';
import { EventBridge } from './orchestrator/eventBridge';

async function main() {
  console.log('====================================================');
  console.log('🧠 Autonomous NFT Character Agents — Cognitive Layer');
  console.log(`🔗 Backend Action API: ${config.backendApiUrl}`);
  console.log(`⚡ Model: ${config.openaiModel} | Temp: ${config.temperature}`);
  console.log('====================================================');

  const runner = new AgentRunner();
  const bridge = new EventBridge(runner);

  // Start webhook listener for real-time simulator / backend triggers
  bridge.startWebhookServer(3002);

  // Run initial orientation loop for all 5 agents
  console.log('\n🌟 Initializing cognitive loops for all 5 agents...');
  for (let tokenId = 0; tokenId < 5; tokenId++) {
    await runner.runAgent(tokenId, { eventType: 'SYSTEM_BOOT' });
  }

  if (config.autoHeartbeat) {
    runner.startHeartbeat(config.heartbeatIntervalMs);
  } else {
    console.log('\n💡 Tip: Enable AUTO_HEARTBEAT=true in .env to run continuous autonomous cycles.');
  }

  // Graceful shutdown
  const shutdown = () => {
    console.log('\nStopping agent runner and webhook server...');
    bridge.stopWebhookServer();
    runner.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal Agent Layer Error:', err);
    process.exit(1);
  });
}
