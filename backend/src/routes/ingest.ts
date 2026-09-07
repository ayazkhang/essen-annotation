import { Router } from 'express';
import multer from 'multer';
import { env } from '../config/env.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { audioUpload } from '../middleware/upload.js';
import * as ingestService from '../services/ingestService.js';

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
    const result = await ingestService.ingestTranscriptPayload(req.body);
    res.status(201).json(result);
  }),
);

ingestRouter.post(
  '/transcripts/single',
  asyncHandler(async (req, res) => {
    const result = await ingestService.ingestSingleTranscript(req.body?.path, req.body?.label);
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
    const result = await ingestService.manualPair(req.body?.audioItemId, req.body?.transcriptItemId);
    res.json(result);
  }),
);

ingestRouter.post(
  '/pairing/unpair',
  asyncHandler(async (req, res) => {
    const result = await ingestService.unpairItem(req.body?.itemId, req.body?.drop);
    res.json(result);
  }),
);
