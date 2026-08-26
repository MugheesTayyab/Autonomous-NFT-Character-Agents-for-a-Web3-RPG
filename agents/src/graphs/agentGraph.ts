import { StateGraph, END, START } from '@langchain/langgraph';
import { AgentState } from '../types';
import { createObserveNode, ObserveNodeOptions } from './nodes/observe';
import { createReasonNode, ReasonNodeOptions } from './nodes/reason';
import { createActNode, ActNodeOptions } from './nodes/act';
import { createRememberNode } from './nodes/remember';

export interface GraphBuildOptions {
  observeOptions?: ObserveNodeOptions;
  reasonOptions?: ReasonNodeOptions;
  actOptions?: ActNodeOptions;
}

export function buildAgentGraph(options: GraphBuildOptions = {}) {
  const observeNode = createObserveNode(options.observeOptions);
  const reasonNode = createReasonNode(options.reasonOptions);
  const actNode = createActNode(options.actOptions);
  const rememberNode = createRememberNode();

  const workflow = new StateGraph<AgentState>({
    channels: {
      tokenId: { value: (x, y) => (y !== undefined ? y : x), default: () => 0 },
      name: { value: (x, y) => (y !== undefined ? y : x), default: () => '' },
      archetype: { value: (x, y) => (y !== undefined ? y : x), default: () => 'STRATEGIST' },
      traits: {
        value: (x, y) => (y !== undefined ? y : x),
        default: () => ({ riskTolerance: 50, trustBaseline: 50, aggression: 50, patience: 50 }),
      },
      triggerEvent: { value: (x, y) => (y !== undefined ? y : x), default: () => undefined },
      observations: { value: (x, y) => (y !== undefined ? y : x), default: () => undefined },
      memoryHistory: { value: (x, y) => (y !== undefined ? y : x), default: () => [] },
      reasoningOutput: { value: (x, y) => (y !== undefined ? y : x), default: () => undefined },
      actionResult: { value: (x, y) => (y !== undefined ? y : x), default: () => undefined },
      error: { value: (x, y) => (y !== undefined ? y : x), default: () => undefined },
    },
  });

  // 1. Add all 4 nodes
  (workflow as any).addNode('observe', observeNode);
  (workflow as any).addNode('reason', reasonNode);
  (workflow as any).addNode('act', actNode);
  (workflow as any).addNode('remember', rememberNode);

  // 2. Define edges: START -> observe -> reason
  (workflow as any).addEdge(START, 'observe');
  (workflow as any).addEdge('observe', 'reason');

  // 3. Conditional routing after reasoning:
  // If action is 'noop', bypass 'act' node and route directly to 'remember'.
  (workflow as any).addConditionalEdges('reason', (state: AgentState) => {
    if (!state.reasoningOutput || state.reasoningOutput.action === 'noop') {
      return 'remember';
    }
    return 'act';
  });

  // 4. Edges: act -> remember -> END
  (workflow as any).addEdge('act', 'remember');
  (workflow as any).addEdge('remember', END);

  return workflow.compile();
}
