import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Basic Vite configuration for a React project.  This enables the
// @vitejs/plugin-react plugin which provides out‑of‑the‑box support
// for JSX syntax and fast HMR during development.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
