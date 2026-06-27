import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { noraGet } from '../nora-client.js';

export function registerRequestTools(server: McpServer) {
  server.tool(
    'list_requests',
    'Lista pedidos con paginación.',
    { page: z.number().optional(), limit: z.number().optional() },
    async ({ page, limit }) => {
      const data = await noraGet('/requests', {
        page: page?.toString(),
        limit: limit?.toString(),
      });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'get_request',
    'Detalle completo de un pedido por ID.',
    { id: z.string() },
    async ({ id }) => {
      const data = await noraGet(`/requests/${id}`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );
}
