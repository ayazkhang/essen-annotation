import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { ingestRouter } from './routes/ingest.js';
import { itemsRouter } from './routes/items.js';

export function createApp() {
  if (!fs.existsSync(env.uploadRoot)) {
    fs.mkdirSync(env.uploadRoot, { recursive: true });
  }

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, node: process.version });
  });

  app.use('/api/ingest', ingestRouter);
  app.use('/api/items', itemsRouter);
  app.use(errorHandler);

  return app;
}
