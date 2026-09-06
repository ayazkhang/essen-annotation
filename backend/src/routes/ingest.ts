import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import { ItemStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import {
  ALLOWED_AUDIO_EXTENSIONS,
  MAX_UPLOAD_BYTES,
} from '../lib/constants.js';
import { normalizeFilename, parseTranscriptJson } from '../lib/pairing.js';
import { analyzeAudioFile, estimateSpeechRateWpm } from '../lib/audio.js';
import { computeItemStatus } from '../lib/status.js';

const uploadRoot = path.resolve(process.env.UPLOAD_DIR ?? './uploads');

if (!fs.existsSync(uploadRoot)) {
  fs.mkdirSync(uploadRoot, { recursive: true });
}

function extensionOf(filename: string): string {
  return path.extname(filename).toLowerCase();
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadRoot),
  filename: (_req, file, cb) => {
    const safe = normalizeFilename(file.originalname).replace(/[^\w.\-()+ ]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 50 },
  fileFilter: (_req, file, cb) => {
    const ext = extensionOf(file.originalname);
    if (!(ALLOWED_AUDIO_EXTENSIONS as readonly string[]).includes(ext)) {
      cb(new Error(`Rejected "${file.originalname}": only .wav, .mp3, .m4a allowed`));
      return;
    }
    cb(null, true);
  },
});

export const ingestRouter = Router();

ingestRouter.post('/audio', (req, res) => {
  upload.array('files', 50)(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({
          error: `File exceeds size limit of ${MAX_UPLOAD_BYTES} bytes`,
        });
        return;
      }
      res.status(400).json({ error: err.message });
      return;
    }
    if (err) {
      res.status(400).json({ error: err.message ?? 'Upload failed' });
      return;
    }

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) {
      res.status(400).json({ error: 'No audio files provided (field name: files)' });
      return;
    }

    const created = [];
    const issues: Array<{ filename: string; message: string }> = [];

    for (const file of files) {
      const filename = normalizeFilename(file.originalname);
      try {
        const analysis = await analyzeAudioFile(file.path);
        const existing = await prisma.annotationItem.findUnique({ where: { filename } });

        const hasTranscript = Boolean(existing?.originalTranscript);
        const status = computeItemStatus({
          hasAudio: true,
          hasTranscript,
          durationSeconds: analysis.durationSeconds,
          currentStatus: existing?.status,
        });

        const speechRate = estimateSpeechRateWpm(
          existing?.originalTranscript,
          analysis.durationSeconds,
        );

        // Replace previous stored file if re-uploading
        if (existing?.storagePath) {
          const oldPath = path.join(uploadRoot, existing.storagePath);
          await fsPromises.unlink(oldPath).catch(() => undefined);
        }

        const storagePath = path.basename(file.path);
        const item = await prisma.annotationItem.upsert({
          where: { filename },
          create: {
            filename,
            storagePath,
            mimeType: file.mimetype,
            fileSize: file.size,
            durationSeconds: analysis.durationSeconds,
            sampleRate: analysis.sampleRate,
            channels: analysis.channels,
            bitDepth: analysis.bitDepth,
            headerMetadata: analysis.headerMetadata as object,
            distanceEstimateSuggested: analysis.distanceEstimateSuggested,
            speechRateWpmSuggested: speechRate,
            status,
          },
          update: {
            storagePath,
            mimeType: file.mimetype,
            fileSize: file.size,
            durationSeconds: analysis.durationSeconds,
            sampleRate: analysis.sampleRate,
            channels: analysis.channels,
            bitDepth: analysis.bitDepth,
            headerMetadata: analysis.headerMetadata as object,
            distanceEstimateSuggested: analysis.distanceEstimateSuggested,
            speechRateWpmSuggested: speechRate,
            status,
          },
        });
        created.push(item);
      } catch (e) {
        await fsPromises.unlink(file.path).catch(() => undefined);
        issues.push({
          filename,
          message: e instanceof Error ? e.message : 'Failed to process audio',
        });
      }
    }

    res.status(201).json({ items: created, issues });
  });
});

ingestRouter.post('/transcripts', async (req, res) => {
  try {
    let payload: unknown = req.body;

    // Allow { transcripts: [...] } or raw array, or { json: "..." }
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const body = payload as Record<string, unknown>;
      if (typeof body.json === 'string') {
        try {
          payload = JSON.parse(body.json);
        } catch {
          res.status(400).json({
            error: 'Malformed JSON in "json" field',
            issues: [{ kind: 'malformed_entry', message: 'Could not parse JSON string' }],
          });
          return;
        }
      } else if (Array.isArray(body.transcripts)) {
        payload = body.transcripts;
      }
    }

    const { rows, issues } = parseTranscriptJson(payload);
    const applied = [];

    for (const row of rows) {
      const existing = await prisma.annotationItem.findUnique({ where: { filename: row.path } });
      const hasAudio = Boolean(existing?.storagePath);
      const status = computeItemStatus({
        hasAudio,
        hasTranscript: true,
        durationSeconds: existing?.durationSeconds,
        currentStatus: existing?.status,
      });

      const speechRate = estimateSpeechRateWpm(row.label, existing?.durationSeconds ?? 0);

      const item = await prisma.annotationItem.upsert({
        where: { filename: row.path },
        create: {
          filename: row.path,
          originalTranscript: row.label,
          correctedTranscript: row.label,
          speechRateWpmSuggested: speechRate || null,
          status,
        },
        update: {
          // Original is immutable once set — only fill if missing
          originalTranscript: existing?.originalTranscript ?? row.label,
          correctedTranscript: existing?.correctedTranscript ?? row.label,
          speechRateWpmSuggested: speechRate || existing?.speechRateWpmSuggested,
          status,
        },
      });
      applied.push(item);
    }

    // Single-item paste: { path, label }
    res.status(201).json({ items: applied, issues, matchedCount: applied.length });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Transcript ingest failed' });
  }
});

ingestRouter.post('/transcripts/single', async (req, res) => {
  const { path: audioPath, label } = req.body ?? {};
  if (typeof audioPath !== 'string' || typeof label !== 'string') {
    res.status(400).json({ error: 'Body must include string fields path and label' });
    return;
  }
  const filename = normalizeFilename(audioPath);
  const existing = await prisma.annotationItem.findUnique({ where: { filename } });
  const hasAudio = Boolean(existing?.storagePath);
  const status = computeItemStatus({
    hasAudio,
    hasTranscript: true,
    durationSeconds: existing?.durationSeconds,
    currentStatus: existing?.status,
  });
  const speechRate = estimateSpeechRateWpm(label, existing?.durationSeconds ?? 0);

  const item = await prisma.annotationItem.upsert({
    where: { filename },
    create: {
      filename,
      originalTranscript: label,
      correctedTranscript: label,
      speechRateWpmSuggested: speechRate,
      status,
    },
    update: {
      originalTranscript: existing?.originalTranscript ?? label,
      correctedTranscript: existing?.correctedTranscript ?? existing?.originalTranscript ?? label,
      speechRateWpmSuggested: speechRate || existing?.speechRateWpmSuggested,
      status,
    },
  });

  res.status(201).json({ item });
});

ingestRouter.get('/pairing', async (_req, res) => {
  const items = await prisma.annotationItem.findMany({ orderBy: { filename: 'asc' } });
  const unpairedAudio = items.filter((i) => i.storagePath && !i.originalTranscript);
  const unpairedTranscripts = items.filter((i) => i.originalTranscript && !i.storagePath);
  const paired = items.filter((i) => i.storagePath && i.originalTranscript);

  res.json({
    paired: paired.map((i) => ({ id: i.id, filename: i.filename, status: i.status })),
    unmatchedAudio: unpairedAudio.map((i) => ({ id: i.id, filename: i.filename })),
    unmatchedTranscripts: unpairedTranscripts.map((i) => ({
      id: i.id,
      filename: i.filename,
      label: i.originalTranscript,
    })),
  });
});

ingestRouter.post('/pairing/manual', async (req, res) => {
  const { audioItemId, transcriptItemId } = req.body ?? {};
  if (typeof audioItemId !== 'string' || typeof transcriptItemId !== 'string') {
    res.status(400).json({ error: 'audioItemId and transcriptItemId are required' });
    return;
  }

  const audio = await prisma.annotationItem.findUnique({ where: { id: audioItemId } });
  const transcript = await prisma.annotationItem.findUnique({ where: { id: transcriptItemId } });

  if (!audio?.storagePath) {
    res.status(400).json({ error: 'audioItemId must reference an item with audio' });
    return;
  }
  if (!transcript?.originalTranscript) {
    res.status(400).json({ error: 'transcriptItemId must reference an item with a transcript' });
    return;
  }

  // Move transcript onto the audio item; delete the orphan transcript row if different
  const status = computeItemStatus({
    hasAudio: true,
    hasTranscript: true,
    durationSeconds: audio.durationSeconds,
    currentStatus: audio.status,
  });

  const speechRate = estimateSpeechRateWpm(
    transcript.originalTranscript,
    audio.durationSeconds ?? 0,
  );

  const updated = await prisma.annotationItem.update({
    where: { id: audio.id },
    data: {
      originalTranscript: transcript.originalTranscript,
      correctedTranscript: transcript.correctedTranscript ?? transcript.originalTranscript,
      speechRateWpmSuggested: speechRate,
      status,
      annotator: audio.annotator ?? 'local-annotator',
    },
  });

  if (transcript.id !== audio.id) {
    await prisma.annotationItem.delete({ where: { id: transcript.id } });
  }

  res.json({ item: updated });
});

ingestRouter.post('/pairing/unpair', async (req, res) => {
  const { itemId, drop }: { itemId?: string; drop?: 'audio' | 'transcript' } = req.body ?? {};
  if (!itemId || (drop !== 'audio' && drop !== 'transcript')) {
    res.status(400).json({ error: 'itemId and drop ("audio"|"transcript") required' });
    return;
  }

  const item = await prisma.annotationItem.findUnique({ where: { id: itemId } });
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  if (drop === 'audio') {
    if (item.storagePath) {
      await fsPromises.unlink(path.join(uploadRoot, item.storagePath)).catch(() => undefined);
    }
    if (!item.originalTranscript) {
      await prisma.annotationItem.delete({ where: { id: itemId } });
      res.json({ deleted: true });
      return;
    }
    const updated = await prisma.annotationItem.update({
      where: { id: itemId },
      data: {
        storagePath: null,
        mimeType: null,
        fileSize: null,
        durationSeconds: null,
        sampleRate: null,
        channels: null,
        bitDepth: null,
        headerMetadata: undefined,
        distanceEstimateSuggested: null,
        status: ItemStatus.UNPAIRED,
      },
    });
    res.json({ item: updated });
    return;
  }

  // drop transcript
  if (!item.storagePath) {
    await prisma.annotationItem.delete({ where: { id: itemId } });
    res.json({ deleted: true });
    return;
  }

  const updated = await prisma.annotationItem.update({
    where: { id: itemId },
    data: {
      originalTranscript: null,
      correctedTranscript: null,
      speechRateWpmSuggested: null,
      speechRateWpmOverride: null,
      status: ItemStatus.UNPAIRED,
      spans: { deleteMany: {} },
    },
  });
  res.json({ item: updated });
});
