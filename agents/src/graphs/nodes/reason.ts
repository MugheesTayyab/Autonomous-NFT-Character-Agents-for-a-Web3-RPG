import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import config from '../../config';
import { AgentState, ReasoningOutput, ReasoningOutputSchema } from '../../types';
import { CHARACTER_PERSONAS } from '../../personas/archetypes';
import { buildSystemPrompt, calculateEffectiveTrust } from '../../personas/prompts';

export interface ReasonNodeOptions {
  modelOverride?: any;
  forceDeterministic?: boolean;
}

export function createReasonNode(options: ReasonNodeOptions = {}) {
  let structuredLlm: any = null;

  if (!options.forceDeterministic && config.openaiApiKey && config.openaiApiKey.startsWith('sk-')) {
    try {
      const chatModel =
        options.modelOverride ||
        new ChatOpenAI({
          openAIApiKey: config.openaiApiKey,
          modelName: config.openaiModel,
          temperature: config.temperature,
          configuration: config.openaiBaseUrl
            ? {
                baseURL: config.openaiBaseUrl,
                defaultHeaders: {
                  'HTTP-Referer': 'https://github.com/autonomous-nft',
                  'X-Title': 'Autonomous NFT Character Agents',
                },
              }
            : undefined,
        });

      structuredLlm = chatModel.withStructuredOutput(ReasoningOutputSchema);
    } catch {
      structuredLlm = null;
    }
  }

  return async function reasonNode(state: AgentState): Promise<Partial<AgentState>> {
    const persona = CHARACTER_PERSONAS[state.tokenId] || {
      tokenId: state.tokenId,
      name: state.name || `Agent #${state.tokenId}`,
      archetype: state.archetype || 'STRATEGIST',
      traits: state.traits || { riskTolerance: 50, trustBaseline: 50, aggression: 50, patience: 50 },
      bio: 'Autonomous Web3 agent',
      coreDirectives: [],
    };

    const observations = state.observations || {
      isStaked: false,
      stakedAt: null,
      estimatedPendingRewardsWei: '0',
      estimatedPendingRewardsFormatted: '0.0',
      totalRewardsClaimedWei: '0',
      openTrades: [],
      hasPendingIncomingTrades: false,
      incomingTrades: [],
      outgoingTrades: [],
      timestamp: Math.floor(Date.now() / 1000),
    };

    const memoryHistory = state.memoryHistory || [];

    // ── Attempt LLM Reasoning if structured model is available ──
    if (structuredLlm) {
      try {
        const systemPrompt = buildSystemPrompt(persona, observations, memoryHistory);
        const userPrompt = `Evaluate your current observations and determine your next move. Respond with JSON strictly matching schema.`;

        const decision = (await structuredLlm.invoke([
          new SystemMessage(systemPrompt),
          new HumanMessage(userPrompt),
        ])) as ReasoningOutput;

        return { reasoningOutput: decision };
      } catch (err: any) {
        console.warn(`[ReasonNode] LLM invocation failed for Token #${state.tokenId}, using deterministic heuristic: ${err.message}`);
      }
    }

    // ── Calibrated Deterministic Persona Engine (Fallback / Test Mode) ──
    const decision = executeDeterministicReasoning(persona, observations, memoryHistory);
    return { reasoningOutput: decision };
  };
}

/**
 * Deterministic reasoning engine implementing the exact mathematical constraints of each archetype
 */
export function executeDeterministicReasoning(
  persona: any,
  observations: any,
  memories: any[]
): ReasoningOutput {
  const { traits, archetype, tokenId } = persona;

  // 1. Priority 1: Handle Incoming Trade Proposals
  if (observations.hasPendingIncomingTrades && observations.incomingTrades.length > 0) {
    const trade = observations.incomingTrades[0];
    const effectiveTrust = calculateEffectiveTrust(traits.trustBaseline, trade.proposer_token_id, memories);

    // High trust baseline or high effective trust -> ACCEPT
    if (effectiveTrust >= 50 || traits.trustBaseline >= 80) {
      return {
        action: 'respondTrade',
        tradeId: trade.trade_id,
        tradeResponse: 'accept',
        justification: `Effective trust (${effectiveTrust}/100) and Trust Baseline (${traits.trustBaseline}/100) meet threshold to accept trade from Token #${trade.proposer_token_id}.`,
        intendedSentiment: 'POSITIVE',
        effectiveTrustScore: effectiveTrust,
      };
    } else {
      return {
        action: 'respondTrade',
        tradeId: trade.trade_id,
        tradeResponse: 'reject',
        justification: `Effective trust (${effectiveTrust}/100) below acceptable threshold. Aggression (${traits.aggression}) and Low Patience (${traits.patience}) dictate immediate rejection.`,
        intendedSentiment: 'NEUTRAL',
        effectiveTrustScore: effectiveTrust,
      };
    }
  }

  // 2. Priority 2: Staking Unstaked Assets (High Risk Tolerance)
  if (!observations.isStaked && traits.riskTolerance >= 50) {
    return {
      action: 'stake',
      justification: `Character is currently unstaked. High Risk Tolerance (${traits.riskTolerance}/100) mandates active staking into StakingVault for MLRD yield.`,
      intendedSentiment: 'POSITIVE',
    };
  }

  // 3. Priority 3: Propose Trade (Aggressive Archetypes, non-Hoarders)
  if (archetype !== 'HOARDER' && traits.aggression >= 60 && observations.outgoingTrades.length === 0) {
    // Select candidate target token different from self
    const targetCandidates = [0, 1, 2, 3, 4].filter((id) => id !== tokenId);
    const targetTokenId = targetCandidates[tokenId % targetCandidates.length];

    return {
      action: 'proposeTrade',
      targetTokenId,
      justification: `High Aggression score (${traits.aggression}/100) initiates trade proposal targeting Token #${targetTokenId} to capture strategic advantage.`,
      intendedSentiment: 'NEUTRAL',
    };
  }

  // 4. Default / Hoarder / Holding pattern: NOOP
  return {
    action: 'noop',
    justification: `Archetype (${archetype}) and Risk Tolerance (${traits.riskTolerance}/100) prefer holding position and observing market conditions.`,
    intendedSentiment: 'NEUTRAL',
  };
}
