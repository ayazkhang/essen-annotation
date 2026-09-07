import path from 'node:path';
import fs from 'node:fs/promises';
import type { Express } from 'express';
import { ItemStatus, type AnnotationItem } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { analyzeAudioFile, estimateSpeechRateWpm } from '../lib/audio.js';
import { normalizeFilename, parseTranscriptJson } from '../lib/pairing.js';
import { computeItemStatus } from '../lib/status.js';
import { HttpError } from '../middleware/errorHandler.js';

export async function ingestAudioFiles(files: Express.Multer.File[]) {
  if (files.length === 0) {
    throw new HttpError(400, 'No audio files provided (field name: files)');
  }

  const created: AnnotationItem[] = [];
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

      if (existing?.storagePath) {
        await fs.unlink(path.join(env.uploadRoot, existing.storagePath)).catch(() => undefined);
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
      await fs.unlink(file.path).catch(() => undefined);
      issues.push({
        filename,
        message: e instanceof Error ? e.message : 'Failed to process audio',
      });
    }
  }

  return { items: created, issues };
}

function resolveTranscriptPayload(body: unknown): unknown {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const record = body as Record<string, unknown>;
    if (typeof record.json === 'string') {
      try {
        return JSON.parse(record.json);
      } catch {
        throw new HttpError(400, 'Malformed JSON in "json" field');
      }
    }
    if (Array.isArray(record.transcripts)) {
      return record.transcripts;
    }
  }
  return body;
}

async function upsertTranscriptRow(filename: string, label: string) {
  const existing = await prisma.annotationItem.findUnique({ where: { filename } });
  const hasAudio = Boolean(existing?.storagePath);
  const status = computeItemStatus({
    hasAudio,
    hasTranscript: true,
    durationSeconds: existing?.durationSeconds,
    currentStatus: existing?.status,
  });
  const speechRate = estimateSpeechRateWpm(label, existing?.durationSeconds ?? 0);

  return prisma.annotationItem.upsert({
    where: { filename },
    create: {
      filename,
      originalTranscript: label,
      correctedTranscript: label,
      speechRateWpmSuggested: speechRate || null,
      status,
    },
    update: {
      originalTranscript: existing?.originalTranscript ?? label,
      correctedTranscript: existing?.correctedTranscript ?? existing?.originalTranscript ?? label,
      speechRateWpmSuggested: speechRate || existing?.speechRateWpmSuggested,
      status,
    },
  });
}

export async function ingestTranscriptPayload(body: unknown) {
  const payload = resolveTranscriptPayload(body);
  const { rows, issues } = parseTranscriptJson(payload);
  const applied = [];
  for (const row of rows) {
    applied.push(await upsertTranscriptRow(row.path, row.label));
  }
  return { items: applied, issues, matchedCount: applied.length };
}

export async function ingestSingleTranscript(audioPath: unknown, label: unknown) {
  if (typeof audioPath !== 'string' || typeof label !== 'string') {
    throw new HttpError(400, 'Body must include string fields path and label');
  }
  const item = await upsertTranscriptRow(normalizeFilename(audioPath), label);
  return { item };
}

export async function getPairingOverview() {
  const items = await prisma.annotationItem.findMany({ orderBy: { filename: 'asc' } });
  return {
    paired: items
      .filter((i) => i.storagePath && i.originalTranscript)
      .map((i) => ({ id: i.id, filename: i.filename, status: i.status })),
    unmatchedAudio: items
      .filter((i) => i.storagePath && !i.originalTranscript)
      .map((i) => ({ id: i.id, filename: i.filename })),
    unmatchedTranscripts: items
      .filter((i) => i.originalTranscript && !i.storagePath)
      .map((i) => ({ id: i.id, filename: i.filename, label: i.originalTranscript })),
  };
}

export async function manualPair(audioItemId: unknown, transcriptItemId: unknown) {
  if (typeof audioItemId !== 'string' || typeof transcriptItemId !== 'string') {
    throw new HttpError(400, 'audioItemId and transcriptItemId are required');
  }

  const audio = await prisma.annotationItem.findUnique({ where: { id: audioItemId } });
  const transcript = await prisma.annotationItem.findUnique({ where: { id: transcriptItemId } });

  if (!audio?.storagePath) {
    throw new HttpError(400, 'audioItemId must reference an item with audio');
  }
  if (!transcript?.originalTranscript) {
    throw new HttpError(400, 'transcriptItemId must reference an item with a transcript');
  }

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

  return { item: updated };
}

export async function unpairItem(itemId: unknown, drop: unknown) {
  if (typeof itemId !== 'string' || (drop !== 'audio' && drop !== 'transcript')) {
    throw new HttpError(400, 'itemId and drop ("audio"|"transcript") required');
  }

  const item = await prisma.annotationItem.findUnique({ where: { id: itemId } });
  if (!item) {
    throw new HttpError(404, 'Item not found');
  }

  if (drop === 'audio') {
    if (item.storagePath) {
      await fs.unlink(path.join(env.uploadRoot, item.storagePath)).catch(() => undefined);
    }
    if (!item.originalTranscript) {
      await prisma.annotationItem.delete({ where: { id: itemId } });
      return { deleted: true as const };
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
    return { item: updated };
  }

  if (!item.storagePath) {
    await prisma.annotationItem.delete({ where: { id: itemId } });
    return { deleted: true as const };
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
  return { item: updated };
}
