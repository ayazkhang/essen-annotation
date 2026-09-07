import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    env: {
      DATABASE_URL: 'postgresql://essen:essen@localhost:5432/essen_annotation?schema=public',
      UPLOAD_DIR: './uploads',
      PORT: '3001',
    },
  },
});
