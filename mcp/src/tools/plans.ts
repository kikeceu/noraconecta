import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { noraGet, noraPost, noraPatch, noraDelete } from '../nora-client.js';

export function registerPlanTools(server: McpServer) {
  server.tool(
    'list_plans',
    'Lista los planes de membresía.',
    {},
    async () => {
      const data = await noraGet('/plans');
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'create_plan',
    'Crea un nuevo plan de membresía.',
    {
      name: z.string(),
      monthlyPrice: z.number(),
      annualDiscountPct: z.number().optional(),
      features: z.array(z.string()).optional(),
    },
    async ({ name, monthlyPrice, annualDiscountPct, features }) => {
      const data = await noraPost('/plans', {
        name,
        monthlyPrice,
        annualDiscountPct,
        features,
      });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'update_plan',
    'Actualiza un plan existente.',
    {
      id: z.string(),
      name: z.string().optional(),
      monthlyPrice: z.number().optional(),
      annualDiscountPct: z.number().optional(),
      isActive: z.boolean().optional(),
      features: z.array(z.string()).optional(),
    },
    async ({ id, ...body }) => {
      const data = await noraPatch(`/plans/${id}`, body);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'deactivate_plan',
    'Desactiva un plan.',
    { id: z.string() },
    async ({ id }) => {
      const data = await noraDelete(`/plans/${id}`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );
}
