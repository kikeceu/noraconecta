import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { noraGet, noraPost, noraPatch } from '../nora-client.js';

export function registerLocationTools(server: McpServer) {
  server.tool(
    'list_countries',
    'Lista los países configurados en NORA.',
    {},
    async () => {
      const data = await noraGet('/locations/countries');
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'get_location_tree',
    'Obtiene el árbol de zonas de un país.',
    { countryId: z.string() },
    async ({ countryId }) => {
      const data = await noraGet(`/locations/tree/${countryId}`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'create_geo_node',
    'Crea una nueva zona (departamento, localidad, etc.).',
    { name: z.string(), levelId: z.string(), parentId: z.string() },
    async ({ name, levelId, parentId }) => {
      const data = await noraPost('/locations/nodes', { name, levelId, parentId });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'update_geo_node',
    'Actualiza el nombre de una zona.',
    { id: z.string(), name: z.string() },
    async ({ id, name }) => {
      const data = await noraPatch(`/locations/nodes/${id}`, { name });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'toggle_geo_node',
    'Activa o desactiva una zona.',
    { id: z.string() },
    async ({ id }) => {
      const data = await noraPatch(`/locations/nodes/${id}/toggle`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );
}
