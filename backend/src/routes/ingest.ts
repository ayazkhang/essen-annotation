import { Router } from 'express';
import multer from 'multer';
import { env } from '../config/env.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { audioUpload } from '../middleware/upload.js';
import * as ingestService from '../services/ingestService.js';
import type { TranscriptUploadBody, UnpairDrop } from '../types/api.js';

export const ingestRouter = Router();

ingestRouter.post('/audio', (req, res, next) => {
  audioUpload.array('files', 50)(req, res, (err) => {
    void (async () => {
      try {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            throw new HttpError(400, `File exceeds size limit of ${env.MAX_UPLOAD_BYTES} bytes`);
          }
          throw new HttpError(400, err.message);
        }
        if (err) {
          throw new HttpError(400, err.message ?? 'Upload failed');
        }

        const files = (req.files as Express.Multer.File[] | undefined) ?? [];
        const result = await ingestService.ingestAudioFiles(files);
        res.status(201).json(result);
      } catch (e) {
        next(e);
      }
    })();
  });
});

ingestRouter.post(
  '/transcripts',
  asyncHandler(async (req, res) => {
    const result = await ingestService.ingestTranscriptPayload(req.body as TranscriptUploadBody);
    res.status(201).json(result);
  }),
);

ingestRouter.post(
  '/transcripts/single',
  asyncHandler(async (req, res) => {
    const pathValue = req.body?.path;
    const label = req.body?.label;
    if (typeof pathValue !== 'string' || typeof label !== 'string') {
      throw new HttpError(400, 'Body must include string fields path and label');
    }
    const result = await ingestService.ingestSingleTranscript(pathValue, label);
    res.status(201).json(result);
  }),
);

ingestRouter.get(
  '/pairing',
  asyncHandler(async (_req, res) => {
    res.json(await ingestService.getPairingOverview());
  }),
);

ingestRouter.post(
  '/pairing/manual',
  asyncHandler(async (req, res) => {
    const audioItemId = req.body?.audioItemId;
    const transcriptItemId = req.body?.transcriptItemId;
    if (typeof audioItemId !== 'string' || typeof transcriptItemId !== 'string') {
      throw new HttpError(400, 'audioItemId and transcriptItemId are required');
    }
    const result = await ingestService.manualPair(audioItemId, transcriptItemId);
    res.json(result);
  }),
);

ingestRouter.post(
  '/pairing/unpair',
  asyncHandler(async (req, res) => {
    const itemId = req.body?.itemId;
    const drop = req.body?.drop;
    if (typeof itemId !== 'string' || (drop !== 'audio' && drop !== 'transcript')) {
      throw new HttpError(400, 'itemId and drop ("audio"|"transcript") required');
    }
    const result = await ingestService.unpairItem(itemId, drop as UnpairDrop);
    res.json(result);
  }),
);
