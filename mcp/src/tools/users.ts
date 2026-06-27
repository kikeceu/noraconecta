import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { noraGet, noraPatch } from '../nora-client.js';

export function registerUserTools(server: McpServer) {
  server.tool(
    'list_users',
    'Lista usuarios registrados.',
    { page: z.number().optional(), limit: z.number().optional() },
    async ({ page, limit }) => {
      const data = await noraGet('/users', {
        page: page?.toString(),
        limit: limit?.toString(),
      });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'get_user',
    'Detalle de un usuario por ID.',
    { id: z.string() },
    async ({ id }) => {
      const data = await noraGet(`/users/${id}`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'block_user',
    'Bloquea un usuario.',
    { id: z.string() },
    async ({ id }) => {
      const data = await noraPatch(`/users/${id}/block`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'unblock_user',
    'Desbloquea un usuario.',
    { id: z.string() },
    async ({ id }) => {
      const data = await noraPatch(`/users/${id}/unblock`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );
}
