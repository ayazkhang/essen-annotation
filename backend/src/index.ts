import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { ingestRouter } from './routes/ingest.js';
import { itemsRouter } from './routes/items.js';

const app = express();
const port = Number(process.env.PORT ?? 3001);

const uploadRoot = path.resolve(process.env.UPLOAD_DIR ?? './uploads');
if (!fs.existsSync(uploadRoot)) {
  fs.mkdirSync(uploadRoot, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, node: process.version });
});

app.use('/api/ingest', ingestRouter);
app.use('/api/items', itemsRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
