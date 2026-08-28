import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Only the pure logic under src/lib. Nothing here renders a component or
    // touches Supabase, so no jsdom and no environment setup is needed — the
    // suite runs in plain Node in well under a second, which is what keeps it
    // worth running on every save.
    include: ['src/**/*.test.ts'],
  },
})
