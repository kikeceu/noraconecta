import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { noraGet, noraPatch, noraPost } from '../nora-client.js';

export function registerMetricTools(server: McpServer) {
  server.tool(
    'get_metrics',
    'Métricas del dashboard: pedidos, profesionales, tasa de aceptación, escalaciones.',
    { geoNodeId: z.string().optional() },
    async ({ geoNodeId }) => {
      const data = await noraGet('/admin/metrics', { geoNodeId });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'get_config',
    'Lista la configuración del sistema.',
    {},
    async () => {
      const data = await noraGet('/config');
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'update_config',
    'Actualiza un valor de configuración.',
    { key: z.string(), value: z.string() },
    async ({ key, value }) => {
      const data = await noraPatch(`/config/${key}`, { value });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'get_membership_discount',
    'Estado actual del descuento de membresía.',
    {},
    async () => {
      const data = await noraGet('/admin/membership-discount');
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'set_membership_discount',
    'Activa o desactiva el descuento de membresía.',
    {
      active: z.boolean(),
      discountPct: z.number().optional(),
      durationHours: z.number().optional(),
    },
    async ({ active, discountPct, durationHours }) => {
      const data = await noraPost('/admin/membership-discount', {
        active,
        discountPct,
        durationHours,
      });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );
}
