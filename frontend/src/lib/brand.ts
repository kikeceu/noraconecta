export const brand = {
  name: import.meta.env.VITE_APP_NAME ?? 'NORA',
  fullName: import.meta.env.VITE_APP_FULL_NAME ?? 'NORA Conecta',
  tagline: import.meta.env.VITE_APP_TAGLINE ?? 'Tu profesional de confianza',
  url: import.meta.env.VITE_APP_URL ?? 'https://noraconecta.com',
} as const;
