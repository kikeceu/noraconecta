import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { noraGet, noraPost, noraPatch } from '../nora-client.js';

export function registerCategoryTools(server: McpServer) {
  server.tool(
    'list_categories',
    'Lista todas las categorías de servicios.',
    {},
    async () => {
      const data = await noraGet('/categories');
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'create_category',
    'Crea una nueva categoría de servicio.',
    {
      name: z.string(),
      description: z.string().optional(),
      requiresLicense: z.boolean().optional(),
      licenseLabel: z.string().optional(),
    },
    async ({ name, description, requiresLicense, licenseLabel }) => {
      const data = await noraPost('/categories', {
        name,
        description,
        requiresLicense,
        licenseLabel,
      });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'update_category',
    'Actualiza una categoría existente.',
    {
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      requiresLicense: z.boolean().optional(),
      licenseLabel: z.string().optional(),
    },
    async ({ id, ...body }) => {
      const data = await noraPatch(`/categories/${id}`, body);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'toggle_category',
    'Activa o desactiva una categoría.',
    { id: z.string() },
    async ({ id }) => {
      const data = await noraPatch(`/categories/${id}/toggle`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );
}
