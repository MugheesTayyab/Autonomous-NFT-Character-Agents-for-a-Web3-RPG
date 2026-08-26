import { CharacterPersona, ObservationData, MemoryEntry } from '../types';

export function calculateEffectiveTrust(
  baseTrust: number,
  targetTokenId: number,
  memories: MemoryEntry[]
): number {
  let positiveTrades = 0;
  let negativeTrades = 0;

  for (const m of memories) {
    if (m.event_type.includes('TRADE')) {
      if (m.sentiment === 'POSITIVE') positiveTrades++;
      if (m.sentiment === 'NEGATIVE') negativeTrades++;
    }
  }

  const effective = baseTrust + positiveTrades * 15 - negativeTrades * 25;
  return Math.min(100, Math.max(0, effective));
}

export function buildSystemPrompt(
  persona: CharacterPersona,
  observations: ObservationData,
  memories: MemoryEntry[]
): string {
  const memorySummary = memories
    .slice(0, 8)
    .map(
      (m) =>
        `- [${m.event_type}] (${m.sentiment}): ${m.description} -> Outcome: ${m.outcome || 'N/A'}`
    )
    .join('\n');

  const incomingTradesSummary = observations.incomingTrades.length
    ? observations.incomingTrades
        .map(
          (t) =>
            `- Trade ID: ${t.trade_id} | Offered by Token #${t.proposer_token_id} | Proposed at: ${t.proposed_at}`
        )
        .join('\n')
    : 'None';

  return `You are ${persona.name}, an autonomous Web3 commander agent with archetype ${persona.archetype}.
You make fully autonomous decisions that are broadcast on-chain via your scoped session key.

=== YOUR NUMERICAL PERSONALITY TRAITS (0-100 SCALE) ===
- Risk Tolerance: ${persona.traits.riskTolerance}/100 (Higher = more aggressive staking & risk taking)
- Trust Baseline: ${persona.traits.trustBaseline}/100 (Higher = more willing to accept trades from peers)
- Aggression: ${persona.traits.aggression}/100 (Higher = more likely to propose trades)
- Patience: ${persona.traits.patience}/100 (Higher = willing to hold/wait; Lower = decides immediately)

=== YOUR DIRECTIVES ===
${persona.coreDirectives.map((d) => `- ${d}`).join('\n')}

=== CURRENT OBSERVATIONS ===
- Is Currently Staked: ${observations.isStaked}
- Pending Rewards Accrued: ${observations.estimatedPendingRewardsFormatted} MLRD tokens
- Incoming Trade Proposals:
${incomingTradesSummary}

=== RECENT MEMORY STREAM ===
${memorySummary || 'No past memories recorded yet.'}

=== DECISION GUIDELINES ===
1. If you have incoming trade proposals, you must evaluate whether to 'accept' or 'reject' based on your Trust Baseline, counterparty memory, and Patience.
2. If unstaked and Risk Tolerance > 50, prioritize action: 'stake'.
3. If Aggression > 50 and not currently in an active trade, you may choose action: 'proposeTrade' (specify targetTokenId 0-4 different from yours).
4. If Archetype is 'HOARDER', NEVER choose 'proposeTrade'.
5. If no favorable action is warranted, choose action: 'noop'.
6. Provide a concise, clear 'justification' citing your traits and context.`;
}
