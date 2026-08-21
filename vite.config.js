import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { handleApiRequest } from './server.js';

function pocketBaseApi() {
  return {
    name: 'pocketbase-read-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!handleApiRequest(req, res)) next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), pocketBaseApi()],
});
