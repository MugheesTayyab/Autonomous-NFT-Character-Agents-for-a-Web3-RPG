import { SimulatorEventType, SimulatorEventPayload } from '../types';

export const SIMULATED_ZONES = [
  'Obsidian Citadel',
  'Neon Undergrid',
  'Aether Spires',
  'Rustlands Periphery',
  'Solaris Sanctuary',
];

export const SIMULATED_ITEMS = [
  'Quantum Overclock Module',
  'Chrono-Disruption Core',
  'Aetherium Matrix Crystal',
  'Vanguard Aegis Plating',
  'Void-Forged Relic',
];

export function createSimulatedEvent(
  eventType: SimulatorEventType,
  targetTokenId: number,
  source: 'MANUAL_API' | 'AUTO_SCHEDULER' = 'MANUAL_API',
  customDetails: Record<string, any> = {}
): SimulatorEventPayload {
  const timestamp = Math.floor(Date.now() / 1000);
  const eventId = `sim_${eventType.toLowerCase()}_${targetTokenId}_${timestamp}_${Math.floor(Math.random() * 1000)}`;

  let title = '';
  let description = '';
  let extraDetails: Record<string, any> = {};

  switch (eventType) {
    case 'BATTLE_WON': {
      const opponentId = (targetTokenId + 1) % 5;
      const zone = SIMULATED_ZONES[Math.floor(Math.random() * SIMULATED_ZONES.length)];
      title = `Victory in ${zone}!`;
      description = `Character #${targetTokenId} achieved decisive victory against combatant in ${zone}. Combat confidence boosted by +25%.`;
      extraDetails = {
        zoneName: zone,
        opponentTokenId: opponentId,
        confidenceDelta: +0.25,
      };
      break;
    }

    case 'BATTLE_LOST': {
      const zone = SIMULATED_ZONES[Math.floor(Math.random() * SIMULATED_ZONES.length)];
      title = `Defeat in ${zone}`;
      description = `Character #${targetTokenId} took heavy damage during conflict in ${zone}. Immediate tactical retreat initiated; risk appetite depressed.`;
      extraDetails = {
        zoneName: zone,
        confidenceDelta: -0.30,
      };
      break;
    }

    case 'RARE_ITEM_DISCOVERED': {
      const item = SIMULATED_ITEMS[Math.floor(Math.random() * SIMULATED_ITEMS.length)];
      const nearbyTokens = [0, 1, 2, 3, 4].filter((id) => id !== targetTokenId).slice(0, 2);
      title = `Rare Item Sighted: ${item}`;
      description = `A high-tier ${item} was detected near Character #${targetTokenId}. Neighboring agents alerted for trade or resource acquisition.`;
      extraDetails = {
        itemName: item,
        nearbyTokenIds: nearbyTokens,
        estimatedValueWei: '25000000000000000000',
      };
      break;
    }

    case 'ZONE_TRANSITION': {
      const zone = SIMULATED_ZONES[Math.floor(Math.random() * SIMULATED_ZONES.length)];
      const zoneOccupants = [0, 1, 2, 3, 4].filter((id) => id !== targetTokenId).slice(0, 2);
      title = `Entering Zone: ${zone}`;
      description = `Character #${targetTokenId} traversed frontier gates into ${zone}. Zone occupants detected: Characters [${zoneOccupants.join(', ')}]. Relational memory scan triggered.`;
      extraDetails = {
        zoneName: zone,
        nearbyTokenIds: zoneOccupants,
      };
      break;
    }

    case 'HOSTILE_ACTION_DETECTED': {
      const aggressorId = (targetTokenId + 2) % 5;
      title = `Hostile Threat Signal from #${aggressorId}`;
      description = `Hostile scan and competitive positioning detected from Character #${aggressorId}. Aggression threshold evaluated for retaliatory trade or defensive hold.`;
      extraDetails = {
        aggressorTokenId: aggressorId,
        threatLevel: 'HIGH',
      };
      break;
    }

    case 'REWARD_POOL_SPIKE': {
      const multiplier = 2.5;
      title = `Staking Pool Multiplier Surge (${multiplier}x)`;
      description = `Network reward emissions surged by ${multiplier}x in StakingVault. Yield appetite triggered across all active autonomous agents.`;
      extraDetails = {
        multiplier,
        durationSeconds: 300,
      };
      break;
    }
  }

  return {
    eventId,
    eventType,
    targetTokenId,
    timestamp,
    source,
    details: {
      title,
      description,
      ...extraDetails,
      ...customDetails,
    },
  };
}
