import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { noraGet, noraPatch } from '../nora-client.js';

export function registerEscalationTools(server: McpServer) {
  server.tool(
    'list_escalations',
    'Lista escalaciones con filtros opcionales.',
    {
      status: z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED']).optional(),
      page: z.number().optional(),
      limit: z.number().optional(),
    },
    async ({ status, page, limit }) => {
      const data = await noraGet('/escalations', {
        status,
        page: page?.toString(),
        limit: limit?.toString(),
      });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'get_escalation',
    'Detalle de una escalación por ID.',
    { id: z.string() },
    async ({ id }) => {
      const data = await noraGet(`/escalations/${id}`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'change_escalation_status',
    'Cambia el estado de una escalación.',
    { id: z.string(), status: z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED']) },
    async ({ id, status }) => {
      const data = await noraPatch(`/escalations/${id}/status`, { status });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'resolve_escalation',
    'Resuelve una escalación con un texto de resolución.',
    { id: z.string(), resolution: z.string() },
    async ({ id, resolution }) => {
      const data = await noraPatch(`/escalations/${id}/resolve`, { resolution });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );
}
