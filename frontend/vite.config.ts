import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const target = process.env.BUILD_TARGET;

  if (!target) {
    return {
      plugins: [react(), tailwindcss()],
      server: {
        host: true, 
        port: 5173,
        allowedHosts: [
	    'admin.noraconecta.local',
	    'app.noraconecta.local',
	    'noraconecta.local',
	    'www.noraconecta.local',
	  ],
        proxy: {
          '/api': {
            target: 'http://localhost:3000',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ''),
          },
        },
      },
    };
  }

  const targetEnv = loadEnv(target, process.cwd(), '');

  const entryMap: Record<string, string> = {
    admin: 'index-admin.html',
    app: 'index-app.html',
    landing: 'index-landing.html',
  };

  const entry = entryMap[target];
  if (!entry) {
    throw new Error(
      `Invalid BUILD_TARGET "${target}". Must be one of: admin, app, landing`,
    );
  }

  return {
    plugins: [react(), tailwindcss()],
    define: Object.fromEntries(
      Object.entries(targetEnv)
        .filter(([key]) => key.startsWith('VITE_'))
        .map(([key, val]) => [`import.meta.env.${key}`, JSON.stringify(val)]),
    ),
    build: {
      outDir: `dist/${target}`,
      emptyOutDir: true,
      rollupOptions: {
        input: entry,
      },
    },
  };
});
