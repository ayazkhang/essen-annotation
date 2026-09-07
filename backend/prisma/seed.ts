/**
 * Seed demo items: copies committed demo WAV files into uploads/ and inserts
 * paired transcripts including the worked clinical example from the brief.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient, ItemStatus } from '@prisma/client';
import { analyzeAudioFile } from '../src/lib/audio.js';
import { computeItemStatus } from '../src/lib/status.js';
import { parseSpanAttributes } from '../src/lib/spans.js';

const prisma = new PrismaClient();

const demoDir = path.resolve(__dirname, '../../demo/audio');
const uploadDir = path.resolve(__dirname, '../uploads');

const DEMO_ITEMS: Array<{
  file: string;
  label: string;
  spans?: Array<{
    type: 'NUMBER' | 'FORMATTING_COMMAND' | 'SPELLED_OUT' | 'NAMED_ENTITY' | 'MEDICAL_TERM' | 'MEASUREMENT';
    start: number;
    end: number;
    attributes: Record<string, unknown>;
  }>;
}> = [
  {
    file: 'op_report_long.wav',
    label:
      'Single-Shot-Antibiose mit Cefuroxim eintausendfuenfhundert Milligramm neue Zeile Prolene sechs null fortlaufend',
    spans: [
      {
        type: 'MEDICAL_TERM',
        start: 26,
        end: 35,
        attributes: { category: 'drug', note: 'Cefuroxim' },
      },
      {
        type: 'MEASUREMENT',
        start: 36,
        end: 69,
        attributes: { value: 1500, unit: 'mg' },
      },
      {
        type: 'FORMATTING_COMMAND',
        start: 70,
        end: 80,
        attributes: { command: 'newline', isCommand: true },
      },
      {
        type: 'MEDICAL_TERM',
        start: 81,
        end: 88,
        attributes: { category: 'device', note: 'suture' },
      },
      {
        type: 'NUMBER',
        start: 89,
        end: 99,
        attributes: { rendering: 'words', normalizedValue: '6/0' },
      },
    ],
  },
  {
    file: 'lagerung_long.wav',
    label:
      'Kontrollierte Rueckenlagerung des Patienten nach Desinfektion des OP-Gebietes mit Octenisept',
  },
  {
    file: 'short_reject.wav',
    label: 'Zu kurze Aufnahme fuer Annotation',
  },
];

async function copyDemo(file: string): Promise<string> {
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  const src = path.join(demoDir, file);
  const destName = `seed-${file}`;
  const dest = path.join(uploadDir, destName);
  fs.copyFileSync(src, dest);
  return destName;
}

async function main() {
  if (!fs.existsSync(demoDir)) {
    throw new Error(`Demo audio missing at ${demoDir}. Run: yarn generate:demo (from backend/)`);
  }

  await prisma.annotationSpan.deleteMany();
  await prisma.annotationItem.deleteMany();

  for (const demo of DEMO_ITEMS) {
    const src = path.join(demoDir, demo.file);
    if (!fs.existsSync(src)) {
      console.warn(`Skipping missing demo file: ${demo.file}`);
      continue;
    }

    const storagePath = await copyDemo(demo.file);
    const fullPath = path.join(uploadDir, storagePath);
    const analysis = await analyzeAudioFile(fullPath, demo.label);
    const status = computeItemStatus({
      hasAudio: true,
      hasTranscript: true,
      durationSeconds: analysis.durationSeconds,
    });

    const item = await prisma.annotationItem.create({
      data: {
        filename: demo.file,
        storagePath,
        mimeType: 'audio/wav',
        fileSize: fs.statSync(fullPath).size,
        durationSeconds: analysis.durationSeconds,
        sampleRate: analysis.sampleRate,
        channels: analysis.channels,
        bitDepth: analysis.bitDepth,
        headerMetadata: analysis.headerMetadata as object,
        distanceEstimateSuggested: analysis.distanceEstimateSuggested,
        speechRateWpmSuggested: analysis.speechRateWpmSuggested,
        originalTranscript: demo.label,
        correctedTranscript: demo.label,
        status,
        annotator: status === ItemStatus.AUTO_REJECTED ? null : 'local-annotator',
      },
    });

    if (demo.spans && status !== ItemStatus.AUTO_REJECTED) {
      for (const span of demo.spans) {
        const attributes = parseSpanAttributes(span.type, span.attributes);
        await prisma.annotationSpan.create({
          data: {
            itemId: item.id,
            type: span.type,
            startOffset: span.start,
            endOffset: span.end,
            attributes,
          },
        });
      }
    }

    console.log(`Seeded ${demo.file} → ${status} (${analysis.durationSeconds.toFixed(2)}s)`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
