import { ItemStatus } from '@prisma/client';
import { routeByDuration } from './pairing.js';

/**
 * Recompute status after audio/transcript changes.
 * UNPAIRED when either side is missing; otherwise duration routing applies.
 * Does not downgrade COMPLETED / IN_PROGRESS unless unpaired or auto-rejected.
 */
export function computeItemStatus(input: {
  hasAudio: boolean;
  hasTranscript: boolean;
  durationSeconds: number | null | undefined;
  currentStatus?: ItemStatus | null;
}): ItemStatus {
  if (!input.hasAudio || !input.hasTranscript) {
    return ItemStatus.UNPAIRED;
  }

  const routed = routeByDuration(input.durationSeconds);
  if (routed === 'AUTO_REJECTED') {
    return ItemStatus.AUTO_REJECTED;
  }

  const current = input.currentStatus;
  if (current === ItemStatus.IN_PROGRESS || current === ItemStatus.COMPLETED) {
    return current;
  }

  return ItemStatus.PENDING;
}
