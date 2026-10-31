import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    // The playtest demo (docs/demo.md) ships without them: it's hosted as a page.
    sourcemap: process.env.VITE_DEMO !== '1',
    // three.js alone is ~600 kB minified; it lives in the lazily loaded sandbox chunk.
    chunkSizeWarningLimit: 900,
  },
});
