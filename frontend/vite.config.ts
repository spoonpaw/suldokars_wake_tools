import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

// Port resolution order:
//   1. VITE_PORT env var (set by the .command launcher after finding a free port)
//   2. fallback 5184 (away from the SvelteKit default 5173 to avoid casual
//      collisions when no launcher is involved)
// strictPort:true means vite refuses to silently bind to a different port --
// if the chosen port is taken, fail loud instead of loading the wrong app.
const DEV_PORT = Number(process.env.VITE_PORT) || 5184;

export default defineConfig({
  plugins: [sveltekit()],
  clearScreen: false,
  server: {
    port: DEV_PORT,
    strictPort: true,
    host: '0.0.0.0', // required for mobile dev (device sees host machine)
    hmr: { port: DEV_PORT },
    watch: {
      ignored: ['**/src-tauri/**']
    }
  },
  test: {
    include: ['src/**/*.{test,spec}.ts'],
    environment: 'node',
    globals: false
  }
});
