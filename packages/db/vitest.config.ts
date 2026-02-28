import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: [],
    env: {
      DATABASE_URL: 'postgresql://decision_logger:decision_logger@localhost:5433/decision_logger_test',
    },
  },
});
