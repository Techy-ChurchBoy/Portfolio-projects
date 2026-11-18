import { defineConfig } from 'vite';

// Relative base so the build works from any sub-path (GitHub Pages, a folder, etc.).
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 900 },
});
