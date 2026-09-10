import { SpanType } from '@prisma/client';
import { z } from 'zod';
import { MEASUREMENT_UNITS, normalizeMeasurement } from './units.js';
import type { JsonObject, JsonValue } from '../types/json.js';

const numberAttrs = z.object({
  rendering: z.enum(['digits', 'words']),
  normalizedValue: z.union([z.number(), z.string()]),
});

const formattingAttrs = z.object({
  command: z.enum([
    'newline',
    'paragraph',
    'period',
    'comma',
    'colon',
    'dash',
    'bracket_open',
    'bracket_close',
  ]),
  isCommand: z.boolean(),
});

const spelledAttrs = z.object({
  resolvedWord: z.string().min(1),
});

const namedEntityAttrs = z.object({
  entityType: z.enum(['human_name', 'organisation', 'place', 'date']),
});

const medicalAttrs = z.object({
  category: z.enum(['anatomy', 'procedure', 'diagnosis', 'drug', 'device']),
  note: z.string().optional().default(''),
});

const measurementAttrs = z
  .object({
    value: z.number(),
    unit: z.enum(MEASUREMENT_UNITS as [string, ...string[]]),
  })
  .transform((raw) => {
    const normalized = normalizeMeasurement(
      raw.value,
      raw.unit as Parameters<typeof normalizeMeasurement>[1],
    );
    return {
      value: raw.value,
      unit: raw.unit,
      normalizedValue: normalized.normalizedValue,
      baseUnit: normalized.baseUnit,
    };
  });

const schemas: Record<SpanType, z.ZodTypeAny> = {
  NUMBER: numberAttrs,
  FORMATTING_COMMAND: formattingAttrs,
  SPELLED_OUT: spelledAttrs,
  NAMED_ENTITY: namedEntityAttrs,
  MEDICAL_TERM: medicalAttrs,
  MEASUREMENT: measurementAttrs,
};

export type NumberAttributes = z.infer<typeof numberAttrs>;
export type FormattingCommandAttributes = z.infer<typeof formattingAttrs>;
export type SpelledOutAttributes = z.infer<typeof spelledAttrs>;
export type NamedEntityAttributes = z.infer<typeof namedEntityAttrs>;
export type MedicalTermAttributes = z.infer<typeof medicalAttrs>;
export type MeasurementAttributes = {
  value: number;
  unit: string;
  normalizedValue: number;
  baseUnit: string;
};

export type SpanAttributes =
  | NumberAttributes
  | FormattingCommandAttributes
  | SpelledOutAttributes
  | NamedEntityAttributes
  | MedicalTermAttributes
  | MeasurementAttributes;

export function parseSpanAttributes(
  type: SpanType,
  attributes: SpanAttributes | JsonObject | JsonValue,
): SpanAttributes {
  const schema = schemas[type];
  const result = schema.safeParse(attributes);
  if (!result.success) {
    throw new Error(`Invalid attributes for ${type}: ${result.error.message}`);
  }
  return result.data as SpanAttributes;
}

export function assertSpanOffsets(
  startOffset: number,
  endOffset: number,
  transcriptLength: number,
): void {
  if (!Number.isInteger(startOffset) || !Number.isInteger(endOffset)) {
    throw new Error('Span offsets must be integers');
  }
  if (startOffset < 0 || endOffset < 0) {
    throw new Error('Span offsets must be non-negative');
  }
  if (startOffset >= endOffset) {
    throw new Error('Span startOffset must be less than endOffset');
  }
  if (endOffset > transcriptLength) {
    throw new Error(
      `Span endOffset ${endOffset} exceeds transcript length ${transcriptLength}`,
    );
  }
}
