/**
 * Writes minimal mono PCM WAVs under demo/audio/ for offline seed/demo.
 * Prefer committed files when present; this recreates them if missing.
 */
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(__dirname, '../../demo/audio');
const RATE = 16_000;

const CLIPS: Array<{ name: string; seconds: number; freq: number }> = [
  { name: 'op_report_long.wav', seconds: 22, freq: 220 },
  { name: 'lagerung_long.wav', seconds: 18, freq: 330 },
  { name: 'short_reject.wav', seconds: 8, freq: 440 },
];

function writeWav(filePath: string, seconds: number, freq: number) {
  const samples = Math.floor(RATE * seconds);
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(RATE, 24);
  buffer.writeUInt32LE(RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples; i++) {
    const t = i / RATE;
    // Soft tone + quiet noise so RMS / distance estimate have signal
    const tone = Math.sin(2 * Math.PI * freq * t) * 0.25;
    const noise = (Math.random() * 2 - 1) * 0.02;
    const sample = Math.max(-1, Math.min(1, tone + noise));
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }

  fs.writeFileSync(filePath, buffer);
}

fs.mkdirSync(OUT, { recursive: true });
for (const clip of CLIPS) {
  const dest = path.join(OUT, clip.name);
  writeWav(dest, clip.seconds, clip.freq);
  console.log(`Wrote ${dest} (${clip.seconds}s)`);
}
