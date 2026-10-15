import { defineConfig } from 'vitest/config';

// The rules count local calendar days. Pinning a zone that has a clock change makes the
// "across the clock change" date tests cross one on every machine.
process.env.TZ = 'America/New_York';

export default defineConfig({
  test: { include: ['tests/unit/**/*.test.js'], environment: 'node' },
});
