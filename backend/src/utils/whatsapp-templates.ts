// Templates 1-20: implemented in notification.service.ts, coordination.service.ts,
// payments.service.ts, and requests.controller.ts (AUT-213).
// Templates 21-24: registered as constants for AUT-216 (work completion and rating flows).

// ── Professional templates (phone number 7665) ──────────────────────────

/** Template 1 — New request assigned to professional */
export const TEMPLATE_PRO_NUEVO_PEDIDO = 'nora_pro_nuevo_pedido';

/** Template 2 — Reminder: pending request awaiting response */
export const TEMPLATE_PRO_RECORDATORIO_PEDIDO = 'nora_pro_recordatorio_pedido';

/** Template 3 — Reminder: visit scheduled for tomorrow */
export const TEMPLATE_PRO_VISITA_RECORDATORIO = 'nora_pro_visita_recordatorio';

/** Template 5 — Membership activated with a pending request */
export const TEMPLATE_PRO_MEMBRESIA_ACTIVADA_CON_PEDIDO = 'nora_pro_membresia_activada_con_pedido';

/** Template 6 — Membership activated (no pending request) */
export const TEMPLATE_PRO_MEMBRESIA_ACTIVADA = 'nora_pro_membresia_activada';

/** Template 7 — Upgrade membership to receive a request */
export const TEMPLATE_PRO_UPGRADE_MEMBRESIA = 'nora_pro_upgrade_membresia';

/** Template 8 — Visit confirmed: client name, address, date/time */
export const TEMPLATE_PRO_VISITA_CONFIRMADA_UBICACION = 'nora_pro_visita_confirmada_ubicacion';

/** Template 9 — Client accepted the proposed schedule */
export const TEMPLATE_PRO_CLIENTE_ACEPTO_HORARIO = 'nora_pro_cliente_acepto_horario';

/** Template 21 — Ask professional if work was completed */
export const TEMPLATE_PRO_CHECK_FINALIZACION = 'nora_pro_check_finalizacion';

/** Template 22 — Last attempt: ask professional if work was completed */
export const TEMPLATE_PRO_CHECK_FINALIZACION_ULTIMO = 'nora_pro_check_finalizacion_ultimo';

/** Template 23 — Ask professional to rate the user */
export const TEMPLATE_PRO_PEDIR_CALIFICACION_USUARIO = 'nora_pro_pedir_calificacion_usuario';

/** User cancelled the request without a confirmed visit */
export const TEMPLATE_PRO_USUARIO_CANCELO_PEDIDO = 'nora_pro_usuario_cancelo_pedido';

/** User cancelled with a confirmed visit */
export const TEMPLATE_PRO_USUARIO_CANCELO_VISITA = 'nora_pro_usuario_cancelo_visita';

/** Visit confirmed to the professional without GPS coordinates */
export const TEMPLATE_PRO_VISITA_CONFIRMADA = 'nora_pro_visita_confirmada';

// ── User templates (phone number 7668) ──────────────────────────────────

/** Template 10 — Professional accepted the request */
export const TEMPLATE_USER_PEDIDO_ACEPTADO = 'nora_user_pedido_aceptado';

/** Template 12 — No professional found */
export const TEMPLATE_USER_SIN_PROFESIONAL = 'nora_user_sin_profesional';

/** Template 13 — Reminder: professional visits tomorrow */
export const TEMPLATE_USER_VISITA_RECORDATORIO = 'nora_user_visita_recordatorio';

/** Template 14 — Professional marked work as finished */
export const TEMPLATE_USER_TRABAJO_FINALIZADO = 'nora_user_trabajo_finalizado';

/** Template 15 — Professional proposed alternative schedule */
export const TEMPLATE_USER_HORARIO_ALTERNATIVO = 'nora_user_horario_alternativo';

/** Template 17 — Visit confirmed: professional name, day, time */
export const TEMPLATE_USER_VISITA_CONFIRMADA = 'nora_user_visita_confirmada';

/** Template 19 — Reassigning after failed negotiation */
export const TEMPLATE_USER_REASIGNANDO_POR_NEGOCIACION = 'nora_user_reasignando_por_negociacion';

/** Profesional cancelled the request without confirmed visit */
export const TEMPLATE_USER_PRO_CANCELO_PEDIDO = 'nora_user_pro_cancelo_pedido';

/** Profesional cancelled with confirmed visit */
export const TEMPLATE_USER_PRO_CANCELO_VISITA = 'nora_user_pro_cancelo_visita';

// ── Description validation templates (AUT-295) ─────────────────────────

/** Description doesn't match selected service */
export const TEMPLATE_USER_DESCRIPCION_NO_RELACIONADA = 'nora_user_descripcion_no_relacionada';

/** Confirm if description matches selected service */
export const TEMPLATE_USER_CONFIRMAR_SERVICIO = 'nora_user_confirmar_servicio';
