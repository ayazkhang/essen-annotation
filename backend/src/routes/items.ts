import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import * as itemsService from '../services/itemsService.js';

export const itemsRouter = Router();

itemsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await itemsService.listItems({
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      sort: typeof req.query.sort === 'string' ? req.query.sort : undefined,
      order: typeof req.query.order === 'string' ? req.query.order : undefined,
    });
    res.json(result);
  }),
);

itemsRouter.get(
  '/export.jsonl',
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const body = await itemsService.exportJsonl(status);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="gold-standard.jsonl"');
    res.send(body);
  }),
);

itemsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await itemsService.getItem(req.params.id));
  }),
);

itemsRouter.get(
  '/:id/audio',
  asyncHandler(async (req, res) => {
    const filePath = await itemsService.resolveAudioPath(req.params.id);
    res.sendFile(filePath);
  }),
);

itemsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await itemsService.updateItem(req.params.id, req.body ?? {}));
  }),
);

itemsRouter.post(
  '/:id/spans',
  asyncHandler(async (req, res) => {
    const result = await itemsService.createSpan(req.params.id, req.body ?? {});
    res.status(201).json(result);
  }),
);

itemsRouter.patch(
  '/:id/spans/:spanId',
  asyncHandler(async (req, res) => {
    res.json(await itemsService.updateSpan(req.params.id, req.params.spanId, req.body ?? {}));
  }),
);

itemsRouter.delete(
  '/:id/spans/:spanId',
  asyncHandler(async (req, res) => {
    await itemsService.deleteSpan(req.params.id, req.params.spanId);
    res.status(204).send();
  }),
);
