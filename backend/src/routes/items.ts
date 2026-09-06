import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { ItemStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { assertSpanOffsets, parseSpanAttributes } from '../lib/spans.js';
import { estimateSpeechRateWpm } from '../lib/audio.js';
import { toJsonl } from '../lib/export.js';

const uploadRoot = path.resolve(process.env.UPLOAD_DIR ?? './uploads');

export const itemsRouter = Router();

itemsRouter.get('/', async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const sort = typeof req.query.sort === 'string' ? req.query.sort : 'filename';
  const order = req.query.order === 'desc' ? 'desc' : 'asc';

  const where: Prisma.AnnotationItemWhereInput = {};
  if (status && Object.values(ItemStatus).includes(status as ItemStatus)) {
    where.status = status as ItemStatus;
  }

  const orderBy: Prisma.AnnotationItemOrderByWithRelationInput =
    sort === 'duration'
      ? { durationSeconds: order }
      : sort === 'status'
        ? { status: order }
        : sort === 'updatedAt'
          ? { updatedAt: order }
          : { filename: order };

  const items = await prisma.annotationItem.findMany({
    where,
    orderBy,
    include: { _count: { select: { spans: true } } },
  });

  res.json({ items });
});

itemsRouter.get('/export.jsonl', async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const where: Prisma.AnnotationItemWhereInput = {};
  if (status && Object.values(ItemStatus).includes(status as ItemStatus)) {
    where.status = status as ItemStatus;
  } else {
    // Default: export completed + anything with a corrected transcript
    where.OR = [
      { status: ItemStatus.COMPLETED },
      { correctedTranscript: { not: null } },
    ];
  }

  const items = await prisma.annotationItem.findMany({
    where,
    include: { spans: { orderBy: { startOffset: 'asc' } } },
    orderBy: { filename: 'asc' },
  });

  const body = toJsonl(items);
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="gold-standard.jsonl"');
  res.send(body);
});

itemsRouter.get('/:id', async (req, res) => {
  const item = await prisma.annotationItem.findUnique({
    where: { id: req.params.id },
    include: { spans: { orderBy: { startOffset: 'asc' } } },
  });
  if (!item) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json({ item });
});

itemsRouter.get('/:id/audio', async (req, res) => {
  const item = await prisma.annotationItem.findUnique({ where: { id: req.params.id } });
  if (!item?.storagePath) {
    res.status(404).json({ error: 'No audio for this item' });
    return;
  }
  const filePath = path.join(uploadRoot, item.storagePath);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Audio file missing on disk' });
    return;
  }
  res.sendFile(filePath);
});

itemsRouter.patch('/:id', async (req, res) => {
  const item = await prisma.annotationItem.findUnique({ where: { id: req.params.id } });
  if (!item) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const {
    correctedTranscript,
    status,
    annotator,
    speechRateWpmOverride,
    distanceEstimateOverride,
  } = req.body ?? {};

  const data: Prisma.AnnotationItemUpdateInput = {};

  if (typeof correctedTranscript === 'string') {
    data.correctedTranscript = correctedTranscript;
    if (item.durationSeconds) {
      data.speechRateWpmSuggested = estimateSpeechRateWpm(
        correctedTranscript,
        item.durationSeconds,
      );
    }
    if (item.status === ItemStatus.PENDING) {
      data.status = ItemStatus.IN_PROGRESS;
      data.annotator = item.annotator ?? 'local-annotator';
    }
  }

  if (typeof annotator === 'string') {
    data.annotator = annotator;
  }

  if (status && Object.values(ItemStatus).includes(status)) {
    data.status = status;
  }

  if (speechRateWpmOverride === null) {
    data.speechRateWpmOverride = null;
  } else if (typeof speechRateWpmOverride === 'number') {
    data.speechRateWpmOverride = speechRateWpmOverride;
  }

  if (distanceEstimateOverride === null) {
    data.distanceEstimateOverride = null;
  } else if (typeof distanceEstimateOverride === 'number') {
    data.distanceEstimateOverride = distanceEstimateOverride;
  }

  const updated = await prisma.annotationItem.update({
    where: { id: item.id },
    data,
    include: { spans: { orderBy: { startOffset: 'asc' } } },
  });

  res.json({ item: updated });
});

itemsRouter.post('/:id/spans', async (req, res) => {
  const item = await prisma.annotationItem.findUnique({ where: { id: req.params.id } });
  if (!item) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const { type, startOffset, endOffset, attributes } = req.body ?? {};
  try {
    const transcript = item.correctedTranscript ?? '';
    assertSpanOffsets(startOffset, endOffset, transcript.length);
    const attrs = parseSpanAttributes(type, attributes);

    const span = await prisma.annotationSpan.create({
      data: {
        itemId: item.id,
        type,
        startOffset,
        endOffset,
        attributes: attrs,
      },
    });

    if (item.status === ItemStatus.PENDING) {
      await prisma.annotationItem.update({
        where: { id: item.id },
        data: { status: ItemStatus.IN_PROGRESS, annotator: item.annotator ?? 'local-annotator' },
      });
    }

    res.status(201).json({ span });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid span' });
  }
});

itemsRouter.patch('/:id/spans/:spanId', async (req, res) => {
  const item = await prisma.annotationItem.findUnique({ where: { id: req.params.id } });
  if (!item) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const existing = await prisma.annotationSpan.findFirst({
    where: { id: req.params.spanId, itemId: item.id },
  });
  if (!existing) {
    res.status(404).json({ error: 'Span not found' });
    return;
  }

  try {
    const startOffset = req.body.startOffset ?? existing.startOffset;
    const endOffset = req.body.endOffset ?? existing.endOffset;
    const type = req.body.type ?? existing.type;
    const transcript = item.correctedTranscript ?? '';
    assertSpanOffsets(startOffset, endOffset, transcript.length);
    const attributes =
      req.body.attributes !== undefined
        ? parseSpanAttributes(type, req.body.attributes)
        : (existing.attributes as object);

    const span = await prisma.annotationSpan.update({
      where: { id: existing.id },
      data: { startOffset, endOffset, type, attributes },
    });
    res.json({ span });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Invalid span update' });
  }
});

itemsRouter.delete('/:id/spans/:spanId', async (req, res) => {
  const existing = await prisma.annotationSpan.findFirst({
    where: { id: req.params.spanId, itemId: req.params.id },
  });
  if (!existing) {
    res.status(404).json({ error: 'Span not found' });
    return;
  }
  await prisma.annotationSpan.delete({ where: { id: existing.id } });
  res.status(204).send();
});
