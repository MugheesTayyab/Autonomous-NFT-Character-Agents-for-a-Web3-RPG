import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import { AgentService } from '../services/AgentService';
import { z } from 'zod';

export function registerAgentRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions & { agentService: AgentService },
  done: (err?: Error) => void
): void {
  const agentService = options.agentService;

  // ── 1. POST /agents/:tokenId/stake ──
  fastify.post('/agents/:tokenId/stake', async (request: FastifyRequest<{ Params: { tokenId: string } }>, reply: FastifyReply) => {
    const tokenId = parseInt(request.params.tokenId, 10);
    if (isNaN(tokenId)) {
      return reply.status(400).send({ success: false, reason: 'INVALID_TOKEN_ID' });
    }

    const result = await agentService.stake(tokenId);
    if (!result.success) {
      const statusCode = result.reason?.includes('CHARACTER_NOT_FOUND') ? 404 : 403;
      return reply.status(statusCode).send(result);
    }
    return reply.status(200).send(result);
  });

  // ── 2. POST /agents/:tokenId/unstake ──
  fastify.post('/agents/:tokenId/unstake', async (request: FastifyRequest<{ Params: { tokenId: string } }>, reply: FastifyReply) => {
    const tokenId = parseInt(request.params.tokenId, 10);
    if (isNaN(tokenId)) {
      return reply.status(400).send({ success: false, reason: 'INVALID_TOKEN_ID' });
    }

    const result = await agentService.unstake(tokenId);
    if (!result.success) {
      const statusCode = result.reason?.includes('CHARACTER_NOT_FOUND') ? 404 : 403;
      return reply.status(statusCode).send(result);
    }
    return reply.status(200).send(result);
  });

  // ── 3. POST /agents/:tokenId/proposeTrade ──
  const ProposeTradeSchema = z.object({
    targetTokenId: z.number().int().nonnegative(),
  });

  fastify.post('/agents/:tokenId/proposeTrade', async (request: FastifyRequest<{ Params: { tokenId: string }; Body: unknown }>, reply: FastifyReply) => {
    const tokenId = parseInt(request.params.tokenId, 10);
    if (isNaN(tokenId)) {
      return reply.status(400).send({ success: false, reason: 'INVALID_TOKEN_ID' });
    }

    const parsed = ProposeTradeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        reason: 'INVALID_REQUEST_BODY',
        details: parsed.error.format(),
      });
    }

    const result = await agentService.proposeTrade(tokenId, parsed.data.targetTokenId);
    if (!result.success) {
      const statusCode = result.reason?.includes('CHARACTER_NOT_FOUND') ? 404 : 403;
      return reply.status(statusCode).send(result);
    }
    return reply.status(200).send(result);
  });

  // ── 4. POST /agents/:tokenId/respondTrade ──
  const RespondTradeSchema = z.object({
    tradeId: z.string().min(10),
    response: z.enum(['accept', 'reject']),
  });

  fastify.post('/agents/:tokenId/respondTrade', async (request: FastifyRequest<{ Params: { tokenId: string }; Body: unknown }>, reply: FastifyReply) => {
    const tokenId = parseInt(request.params.tokenId, 10);
    if (isNaN(tokenId)) {
      return reply.status(400).send({ success: false, reason: 'INVALID_TOKEN_ID' });
    }

    const parsed = RespondTradeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        reason: 'INVALID_REQUEST_BODY',
        details: parsed.error.format(),
      });
    }

    const result = await agentService.respondTrade(tokenId, parsed.data.tradeId, parsed.data.response);
    if (!result.success) {
      const statusCode = result.reason?.includes('NOT_FOUND') ? 404 : 403;
      return reply.status(statusCode).send(result);
    }
    return reply.status(200).send(result);
  });

  // ── 5. GET /agents/:tokenId/status ──
  fastify.get('/agents/:tokenId/status', async (request: FastifyRequest<{ Params: { tokenId: string } }>, reply: FastifyReply) => {
    const tokenId = parseInt(request.params.tokenId, 10);
    if (isNaN(tokenId)) {
      return reply.status(400).send({ error: 'INVALID_TOKEN_ID' });
    }

    const status = agentService.getStatus(tokenId);
    if (!status) {
      return reply.status(404).send({ error: 'CHARACTER_NOT_FOUND', tokenId });
    }
    return reply.status(200).send(status);
  });

  // ── 6. GET /agents/:tokenId/memory ──
  fastify.get('/agents/:tokenId/memory', async (request: FastifyRequest<{ Params: { tokenId: string }; Querystring: { limit?: string } }>, reply: FastifyReply) => {
    const tokenId = parseInt(request.params.tokenId, 10);
    if (isNaN(tokenId)) {
      return reply.status(400).send({ error: 'INVALID_TOKEN_ID' });
    }

    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit || '20', 10)));
    const memories = agentService.getMemory(tokenId, limit);
    return reply.status(200).send({ tokenId, count: memories.length, memories });
  });

  // ── 7. Health & Status ──
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: Math.floor(Date.now() / 1000) };
  });

  done();
}
