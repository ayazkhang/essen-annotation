import path from 'node:path';
import fs from 'node:fs';
import { ItemStatus, Prisma, type SpanType } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { estimateSpeechRateWpm } from '../lib/audio.js';
import { toJsonl } from '../lib/export.js';
import { assertSpanOffsets, parseSpanAttributes } from '../lib/spans.js';
import { HttpError } from '../middleware/errorHandler.js';

export async function listItems(query: {
  status?: string;
  sort?: string;
  order?: string;
}) {
  const where: Prisma.AnnotationItemWhereInput = {};
  if (query.status && Object.values(ItemStatus).includes(query.status as ItemStatus)) {
    where.status = query.status as ItemStatus;
  }

  const order = query.order === 'desc' ? 'desc' : 'asc';
  const sort = query.sort ?? 'filename';
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
  return { items };
}

export async function exportJsonl(status?: string) {
  const where: Prisma.AnnotationItemWhereInput = {};
  if (status && Object.values(ItemStatus).includes(status as ItemStatus)) {
    where.status = status as ItemStatus;
  } else {
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
  return toJsonl(items);
}

export async function getItem(id: string) {
  const item = await prisma.annotationItem.findUnique({
    where: { id },
    include: { spans: { orderBy: { startOffset: 'asc' } } },
  });
  if (!item) {
    throw new HttpError(404, 'Not found');
  }
  return { item };
}

export async function resolveAudioPath(id: string): Promise<string> {
  const item = await prisma.annotationItem.findUnique({ where: { id } });
  if (!item?.storagePath) {
    throw new HttpError(404, 'No audio for this item');
  }
  const filePath = path.join(env.uploadRoot, item.storagePath);
  if (!fs.existsSync(filePath)) {
    throw new HttpError(404, 'Audio file missing on disk');
  }
  return filePath;
}

export async function updateItem(
  id: string,
  body: {
    correctedTranscript?: unknown;
    status?: unknown;
    annotator?: unknown;
    speechRateWpmOverride?: unknown;
    distanceEstimateOverride?: unknown;
  },
) {
  const item = await prisma.annotationItem.findUnique({ where: { id } });
  if (!item) {
    throw new HttpError(404, 'Not found');
  }

  const data: Prisma.AnnotationItemUpdateInput = {};

  if (typeof body.correctedTranscript === 'string') {
    data.correctedTranscript = body.correctedTranscript;
    if (item.durationSeconds) {
      data.speechRateWpmSuggested = estimateSpeechRateWpm(
        body.correctedTranscript,
        item.durationSeconds,
      );
    }
    if (item.status === ItemStatus.PENDING) {
      data.status = ItemStatus.IN_PROGRESS;
      data.annotator = item.annotator ?? 'local-annotator';
    }
  }

  if (typeof body.annotator === 'string') {
    data.annotator = body.annotator;
  }

  if (typeof body.status === 'string' && Object.values(ItemStatus).includes(body.status as ItemStatus)) {
    data.status = body.status as ItemStatus;
  }

  if (body.speechRateWpmOverride === null) {
    data.speechRateWpmOverride = null;
  } else if (typeof body.speechRateWpmOverride === 'number') {
    data.speechRateWpmOverride = body.speechRateWpmOverride;
  }

  if (body.distanceEstimateOverride === null) {
    data.distanceEstimateOverride = null;
  } else if (typeof body.distanceEstimateOverride === 'number') {
    data.distanceEstimateOverride = body.distanceEstimateOverride;
  }

  const updated = await prisma.annotationItem.update({
    where: { id: item.id },
    data,
    include: { spans: { orderBy: { startOffset: 'asc' } } },
  });
  return { item: updated };
}

export async function createSpan(
  itemId: string,
  body: { type?: unknown; startOffset?: unknown; endOffset?: unknown; attributes?: unknown },
) {
  const item = await prisma.annotationItem.findUnique({ where: { id: itemId } });
  if (!item) {
    throw new HttpError(404, 'Not found');
  }

  const type = body.type as SpanType;
  const startOffset = body.startOffset as number;
  const endOffset = body.endOffset as number;
  const transcript = item.correctedTranscript ?? '';

  try {
    assertSpanOffsets(startOffset, endOffset, transcript.length);
    const attrs = parseSpanAttributes(type, body.attributes);
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

    return { span };
  } catch (e) {
    throw new HttpError(400, e instanceof Error ? e.message : 'Invalid span');
  }
}

export async function updateSpan(
  itemId: string,
  spanId: string,
  body: {
    type?: unknown;
    startOffset?: unknown;
    endOffset?: unknown;
    attributes?: unknown;
  },
) {
  const item = await prisma.annotationItem.findUnique({ where: { id: itemId } });
  if (!item) {
    throw new HttpError(404, 'Not found');
  }

  const existing = await prisma.annotationSpan.findFirst({
    where: { id: spanId, itemId: item.id },
  });
  if (!existing) {
    throw new HttpError(404, 'Span not found');
  }

  try {
    const startOffset = (body.startOffset as number | undefined) ?? existing.startOffset;
    const endOffset = (body.endOffset as number | undefined) ?? existing.endOffset;
    const type = (body.type as SpanType | undefined) ?? existing.type;
    const transcript = item.correctedTranscript ?? '';
    assertSpanOffsets(startOffset, endOffset, transcript.length);
    const attributes =
      body.attributes !== undefined
        ? parseSpanAttributes(type, body.attributes)
        : (existing.attributes as object);

    const span = await prisma.annotationSpan.update({
      where: { id: existing.id },
      data: { startOffset, endOffset, type, attributes },
    });
    return { span };
  } catch (e) {
    throw new HttpError(400, e instanceof Error ? e.message : 'Invalid span update');
  }
}

export async function deleteSpan(itemId: string, spanId: string) {
  const existing = await prisma.annotationSpan.findFirst({
    where: { id: spanId, itemId },
  });
  if (!existing) {
    throw new HttpError(404, 'Span not found');
  }
  await prisma.annotationSpan.delete({ where: { id: existing.id } });
}
