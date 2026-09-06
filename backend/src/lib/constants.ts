export const AUTO_REJECT_MAX_SECONDS = 15;
export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES ?? 50 * 1024 * 1024);
export const ALLOWED_AUDIO_EXTENSIONS = ['.wav', '.mp3', '.m4a'] as const;
export const ALLOWED_MIME_TYPES = [
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'application/octet-stream', // browsers sometimes send this; we still check extension
] as const;

export type AllowedExtension = (typeof ALLOWED_AUDIO_EXTENSIONS)[number];
