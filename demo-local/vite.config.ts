import { fileURLToPath, URL } from 'node:url';
import { defineConfig, mergeConfig } from 'vite';
import base from '../vite.config.ts';

/** Démo sans API : les variables viennent de ce dossier, pas du .env racine. */
export default defineConfig((env) =>
  mergeConfig(base, {
    envDir: fileURLToPath(new URL('.', import.meta.url)),
    mode: env.mode,
    server: { port: 5175 },
  }),
);
