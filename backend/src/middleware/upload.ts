import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { env } from '../config/env.js';
import { ALLOWED_AUDIO_EXTENSIONS } from '../lib/constants.js';
import { normalizeFilename } from '../lib/pairing.js';

if (!fs.existsSync(env.uploadRoot)) {
  fs.mkdirSync(env.uploadRoot, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.uploadRoot),
  filename: (_req, file, cb) => {
    const safe = normalizeFilename(file.originalname).replace(/[^\w.\-()+ ]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

export const audioUpload = multer({
  storage,
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 50 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!(ALLOWED_AUDIO_EXTENSIONS as readonly string[]).includes(ext)) {
      cb(new Error(`Rejected "${file.originalname}": only .wav, .mp3, .m4a allowed`));
      return;
    }
    cb(null, true);
  },
});

export { env as uploadEnv };
