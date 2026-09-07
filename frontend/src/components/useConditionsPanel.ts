import { computed, ref, watch } from 'vue';
import type { AnnotationItem } from '../api';

export function useConditionsPanel(
  props: { item: AnnotationItem },
  emit: {
    (
      e: 'save',
      payload: {
        speechRateWpmOverride: number | null;
        distanceEstimateOverride: number | null;
      },
    ): void;
  },
) {
  const speechOverride = ref('');
  const distanceOverride = ref('');

  watch(
    () => props.item.id,
    () => {
      speechOverride.value =
        props.item.speechRateWpmOverride != null ? String(props.item.speechRateWpmOverride) : '';
      distanceOverride.value =
        props.item.distanceEstimateOverride != null
          ? String(props.item.distanceEstimateOverride)
          : '';
    },
    { immediate: true },
  );

  const headerEntries = computed(() => {
    const meta = props.item.headerMetadata;
    if (!meta) return [];
    return Object.entries(meta).slice(0, 12);
  });

  function save() {
    emit('save', {
      speechRateWpmOverride: speechOverride.value === '' ? null : Number(speechOverride.value),
      distanceEstimateOverride:
        distanceOverride.value === '' ? null : Number(distanceOverride.value),
    });
  }

  return {
    speechOverride,
    distanceOverride,
    headerEntries,
    save,
  };
}
