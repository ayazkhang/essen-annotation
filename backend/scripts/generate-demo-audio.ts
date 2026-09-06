/**
 * Generate small demo WAV files (PCM 16-bit mono 16 kHz) without external deps.
 * Durations: two >15s (annotatable), one ≤15s (auto-reject).
 */
import fs from 'node:fs';
import path from 'node:path';

const SAMPLE_RATE = 16000;
const CHANNELS = 1;
const BITS = 16;

function writeWav(filePath: string, durationSeconds: number, freq = 220): void {
  const numSamples = Math.floor(SAMPLE_RATE * durationSeconds);
  const dataSize = numSamples * CHANNELS * (BITS / 8);
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(CHANNELS, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * CHANNELS * (BITS / 8), 28);
  buffer.writeUInt16LE(CHANNELS * (BITS / 8), 32);
  buffer.writeUInt16LE(BITS, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    // Speech-like: amplitude envelope + harmonic stack, quieter first 0.3s (noise floor)
    const envelope =
      t < 0.3 ? 0.02 : 0.35 * (0.6 + 0.4 * Math.sin(2 * Math.PI * 3 * t));
    const sample =
      envelope *
      (Math.sin(2 * Math.PI * freq * t) * 0.6 +
        Math.sin(2 * Math.PI * freq * 2 * t) * 0.25 +
        (Math.random() - 0.5) * 0.05);
    const int16 = Math.max(-32767, Math.min(32767, Math.floor(sample * 32767)));
    buffer.writeInt16LE(int16, 44 + i * 2);
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);
  console.log(`Wrote ${filePath} (${durationSeconds}s, ${buffer.length} bytes)`);
}

const outDir = path.resolve(__dirname, '../../demo/audio');
writeWav(path.join(outDir, 'op_report_long.wav'), 22, 180);
writeWav(path.join(outDir, 'lagerung_long.wav'), 18, 200);
writeWav(path.join(outDir, 'short_reject.wav'), 8, 240);
