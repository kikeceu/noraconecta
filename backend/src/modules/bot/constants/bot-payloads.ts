export const BOT_PAYLOADS = {
  // User payloads
  NOTIFY_WHEN_AVAILABLE: 'notify_when_available',
  NO_NOTIFY: 'no_notify',
  CONFIRMO_VISITA_USER: 'confirmo_visita_user',
  CANCELAR_VISITA: 'cancelar_visita',
  SEGUIR_ESPERANDO: 'seguir_esperando',
  CANCELAR_PEDIDO: 'cancelar_pedido',
  SI_ME_VIENE: 'si_me_viene',
  NO_ME_VIENE: 'no_me_viene',
  CONFORME_BTN: 'conforme_btn',
  OBSERVACIONES_BTN: 'observaciones_btn',
  NO_CONFORME_BTN: 'no_conforme_btn',

  // Professional payloads
  VER_DETALLES: 'ver_detalles',
  NO_PUEDO: 'no_puedo',
  NO_PUEDO_IR: 'no_puedo_ir',
  CONFIRMO_VISITA: 'confirmo_visita',
  SI_FINALICE: 'si_finalice',
  PENDIENTE: 'pendiente',
  NO_PUDE: 'no_pude',
  VER_COMO_FUNCIONA: 'ver_como_funciona',
} as const;

export type BotPayload = (typeof BOT_PAYLOADS)[keyof typeof BOT_PAYLOADS];
