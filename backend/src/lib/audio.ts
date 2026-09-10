import fs from 'node:fs/promises';
import { parseFile } from 'music-metadata';
import type { JsonObject, JsonValue } from '../types/json.js';

export interface AudioAnalysis {
  durationSeconds: number;
  sampleRate: number | null;
  channels: number | null;
  bitDepth: number | null;
  headerMetadata: JsonObject;
  distanceEstimateSuggested: number | null;
  speechRateWpmSuggested: number | null;
}

function tokenize(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function estimateSpeechRateWpm(transcript: string | null | undefined, durationSeconds: number): number | null {
  if (!transcript || durationSeconds <= 0) return null;
  const tokens = tokenize(transcript).length;
  if (tokens === 0) return null;
  return (tokens / durationSeconds) * 60;
}


export function estimateDistanceFromPcm(
  samples: Float32Array,
  frameSize = 1024,
): number {
  if (samples.length === 0) return 0;

  let sumSq = 0;
  for (let i = 0; i < samples.length; i++) {
    sumSq += samples[i] * samples[i];
  }
  const rms = Math.sqrt(sumSq / samples.length);

  const frameRms: number[] = [];
  for (let i = 0; i + frameSize <= samples.length; i += frameSize) {
    let fSum = 0;
    for (let j = 0; j < frameSize; j++) {
      const s = samples[i + j];
      fSum += s * s;
    }
    frameRms.push(Math.sqrt(fSum / frameSize));
  }

  if (frameRms.length === 0) {
    return Math.min(1, Math.max(0, rms * 10));
  }

  frameRms.sort((a, b) => a - b);
  const floorCount = Math.max(1, Math.floor(frameRms.length * 0.1));
  let floorSum = 0;
  for (let i = 0; i < floorCount; i++) floorSum += frameRms[i];
  const noiseFloor = floorSum / floorCount;

  const ratio = rms / Math.max(noiseFloor, 1e-8);
  const mapped = Math.log10(ratio + 1) / Math.log10(50);
  return Math.min(1, Math.max(0, mapped));
}

/** Read PCM samples from a simple PCM WAV (16-bit LE). Returns null if not applicable. */
export async function readWavPcmSamples(filePath: string, maxSeconds = 30): Promise<Float32Array | null> {
  const buf = await fs.readFile(filePath);
  if (buf.length < 44) return null;
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    return null;
  }

  let offset = 12;
  let audioFormat = 1;
  let numChannels = 1;
  let sampleRate = 16000;
  let bitsPerSample = 16;
  let dataOffset = -1;
  let dataSize = 0;

  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    if (id === 'fmt ') {
      audioFormat = buf.readUInt16LE(chunkStart);
      numChannels = buf.readUInt16LE(chunkStart + 2);
      sampleRate = buf.readUInt32LE(chunkStart + 4);
      bitsPerSample = buf.readUInt16LE(chunkStart + 14);
    } else if (id === 'data') {
      dataOffset = chunkStart;
      dataSize = size;
      break;
    }
    offset = chunkStart + size + (size % 2);
  }

  if (dataOffset < 0 || audioFormat !== 1 || bitsPerSample !== 16) {
    return null;
  }

  const maxSamples = Math.floor(maxSeconds * sampleRate) * numChannels;
  const available = Math.floor(dataSize / 2);
  const count = Math.min(available, maxSamples);
  const mono = new Float32Array(Math.floor(count / numChannels));

  for (let i = 0, m = 0; i + numChannels <= count; i += numChannels, m++) {
    let sum = 0;
    for (let c = 0; c < numChannels; c++) {
      sum += buf.readInt16LE(dataOffset + (i + c) * 2) / 32768;
    }
    mono[m] = sum / numChannels;
  }
  return mono;
}

function collectNativeTags(
  native: Record<string, { id: string; value: JsonValue }[]> | undefined,
): JsonObject {
  if (!native) return {};
  const out: JsonObject = {};
  for (const [format, tags] of Object.entries(native)) {
    out[format] = tags.map((t) => ({ id: t.id, value: t.value as JsonValue }));
  }
  return out;
}

export async function analyzeAudioFile(
  filePath: string,
  transcript?: string | null,
): Promise<AudioAnalysis> {
  const metadata = await parseFile(filePath, { duration: true });
  const durationSeconds = metadata.format.duration ?? 0;
  const sampleRate = metadata.format.sampleRate ?? null;
  const channels = metadata.format.numberOfChannels ?? null;
  const bitDepth = metadata.format.bitsPerSample ?? null;

  const headerMetadata: JsonObject = {
    container: metadata.format.container ?? null,
    codec: metadata.format.codec ?? null,
    bitrate: metadata.format.bitrate ?? null,
    lossless: metadata.format.lossless ?? null,
    common: {
      title: metadata.common.title ?? null,
      artist: metadata.common.artist ?? null,
      comment: (metadata.common.comment as JsonValue) ?? null,
      description: (metadata.common.description as JsonValue) ?? null,
    },
    native: collectNativeTags(metadata.native as Record<string, { id: string; value: JsonValue }[]> | undefined),
  };

  let distanceEstimateSuggested: number | null = null;
  const pcm = await readWavPcmSamples(filePath);
  if (pcm) {
    distanceEstimateSuggested = estimateDistanceFromPcm(pcm);
  } else if (metadata.format.bitrate && durationSeconds > 0) {
    // Compressed formats: very rough proxy from average bitrate density (not calibrated).
    const mbps = metadata.format.bitrate / 1_000_000;
    distanceEstimateSuggested = Math.min(1, Math.max(0, mbps / 0.32));
  }

  return {
    durationSeconds,
    sampleRate,
    channels,
    bitDepth,
    headerMetadata,
    distanceEstimateSuggested,
    speechRateWpmSuggested: estimateSpeechRateWpm(transcript, durationSeconds),
  };
}
