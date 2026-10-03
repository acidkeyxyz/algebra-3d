import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

// Astro runs on Vite; the Three.js scene is a client-only Preact island.
export default defineConfig({
  integrations: [preact()],
  vite: {
    build: { chunkSizeWarningLimit: 1200 },
  },
});
