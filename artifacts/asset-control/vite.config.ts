import path from 'path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

const configDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(configDir, '..', '..');

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, repoRoot, '');
  const rawPort = env.PORT || process.env.PORT || '5173';
  const port = Number(rawPort);
  const basePath = env.BASE_PATH || process.env.BASE_PATH || '/';
  const apiPort = Number(env.API_PORT || process.env.API_PORT || 3000);

  if (command === 'serve' && (Number.isNaN(port) || port <= 0)) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  return {
    envDir: repoRoot,
    base: basePath,
    plugins: [
      react(),
      tailwindcss({ optimize: false }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(configDir, 'src'),
        '@assets': path.resolve(repoRoot, 'attached_assets'),
      },
      dedupe: ['react', 'react-dom'],
    },
    root: configDir,
    build: {
      outDir: path.resolve(configDir, 'dist/public'),
      emptyOutDir: true,
    },
    server: {
      port: Number.isFinite(port) && port > 0 ? port : 5173,
      strictPort: true,
      host: '0.0.0.0',
      allowedHosts: true,
      fs: {
        strict: true,
      },
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: Number.isFinite(port) && port > 0 ? port : 5173,
      host: '0.0.0.0',
      allowedHosts: true,
    },
  };
});
