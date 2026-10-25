import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Determinism and bench-style tests run thousands of ticks; keep them on one thread
    // so timing-sensitive assertions aren't skewed by worker contention.
    fileParallelism: false,
  },
});
