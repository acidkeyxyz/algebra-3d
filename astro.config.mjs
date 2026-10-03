import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

// Astro runs on Vite; the Three.js scene is a client-only Preact island.
export default defineConfig({
  // Deployed under acidkey.xyz/projects/algebra-3d/ (see README "Deploy").
  base: '/projects/algebra-3d',
  integrations: [preact()],
  vite: {
    build: { chunkSizeWarningLimit: 1200 },
  },
});
