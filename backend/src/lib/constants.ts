export const AUTO_REJECT_MAX_SECONDS = 15;

export const ALLOWED_AUDIO_EXTENSIONS = ['.wav', '.mp3', '.m4a'] as const;

/** Used when browsers send a generic MIME; extension check remains authoritative. */
export const ALLOWED_MIME_TYPES = [
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'application/octet-stream',
] as const;

export type AllowedExtension = (typeof ALLOWED_AUDIO_EXTENSIONS)[number];
