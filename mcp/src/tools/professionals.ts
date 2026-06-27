import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { noraGet, noraPost, noraPatch, noraDelete } from '../nora-client.js';

export function registerProfessionalTools(server: McpServer) {
  server.tool(
    'list_professionals',
    'Lista profesionales con filtros opcionales.',
    {
      status: z
        .enum([
          'PENDING',
          'UNDER_REVIEW',
          'ACTIVE',
          'OBSERVATION',
          'SUSPENDED',
          'PAUSED',
          'REJECTED',
        ])
        .optional(),
      categoryId: z.string().optional(),
      departmentId: z.string().optional(),
      page: z.number().optional(),
      limit: z.number().optional(),
    },
    async ({ status, categoryId, departmentId, page, limit }) => {
      const data = await noraGet('/professionals', {
        status,
        categoryId,
        departmentId,
        page: page?.toString(),
        limit: limit?.toString(),
      });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'get_professional',
    'Detalle completo de un profesional por ID.',
    { id: z.string() },
    async ({ id }) => {
      const data = await noraGet(`/professionals/${id}`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'approve_professional',
    'Aprueba un profesional en UNDER_REVIEW.',
    { id: z.string() },
    async ({ id }) => {
      const data = await noraPost(`/professionals/${id}/approve`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'reject_professional',
    'Rechaza un profesional.',
    { id: z.string(), reason: z.string().optional() },
    async ({ id, reason }) => {
      const data = await noraPost(`/professionals/${id}/reject`, { reason });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'suspend_professional',
    'Suspende un profesional activo.',
    { id: z.string() },
    async ({ id }) => {
      const data = await noraPost(`/professionals/${id}/suspend`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'reactivate_professional',
    'Reactiva un profesional suspendido.',
    { id: z.string() },
    async ({ id }) => {
      const data = await noraPost(`/professionals/${id}/reactivate`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'assign_membership',
    'Asigna membresía paga a un profesional.',
    { id: z.string(), planId: z.string(), type: z.enum(['MONTHLY', 'ANNUAL']) },
    async ({ id, planId, type }) => {
      const data = await noraPost(`/professionals/${id}/membership`, { planId, type });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'cancel_membership',
    'Cancela la membresía activa de un profesional.',
    { id: z.string() },
    async ({ id }) => {
      const data = await noraDelete(`/professionals/${id}/membership`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'get_pending_data_changes',
    'Lista cambios sensibles de profesionales pendientes de revisión.',
    {},
    async () => {
      const data = await noraGet('/professionals/data-changes/pending');
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'mark_data_change_reviewed',
    'Marca como revisado un cambio sensible.',
    { requestId: z.string() },
    async ({ requestId }) => {
      const data = await noraPatch(`/professionals/data-changes/${requestId}/reviewed`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'generate_panel_session',
    'Genera link de acceso al panel web para un profesional.',
    { id: z.string() },
    async ({ id }) => {
      const data = await noraPost(`/professionals/${id}/generate-session`);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'set_badge',
    'Otorga o quita el badge de excelencia a un profesional.',
    { id: z.string(), hasBadge: z.boolean() },
    async ({ id, hasBadge }) => {
      const data = await noraPatch(`/professionals/${id}/badge`, { hasBadge });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'update_license_status',
    'Aprueba o rechaza la credencial habilitante de un profesional.',
    { id: z.string(), status: z.enum(['APPROVED', 'REJECTED']) },
    async ({ id, status }) => {
      const data = await noraPatch(`/professionals/${id}/license-status`, { status });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );
}
