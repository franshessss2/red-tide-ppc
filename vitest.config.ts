import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

// Kept separate from vite.config.ts so the React/Tailwind plugins are not
// loaded for the (DOM-free) store tests.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    // Needed so @testing-library/react's automatic DOM cleanup runs.
    globals: true,
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts'],
    restoreMocks: true,
  },
})
