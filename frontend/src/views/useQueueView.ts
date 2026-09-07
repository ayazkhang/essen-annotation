import { onMounted, ref, watch } from 'vue';
import { api, formatDuration, type AnnotationItem, type ItemStatus } from '../api';

const STATUSES: Array<ItemStatus | ''> = [
  '',
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'AUTO_REJECTED',
  'UNPAIRED',
];

export function useQueueView() {
  const items = ref<AnnotationItem[]>([]);
  const loading = ref(false);
  const error = ref('');
  const statusFilter = ref('');
  const sort = ref('duration');
  const order = ref<'asc' | 'desc'>('desc');

  async function load() {
    loading.value = true;
    error.value = '';
    try {
      const res = await api.listItems({
        status: statusFilter.value || undefined,
        sort: sort.value,
        order: order.value,
      });
      items.value = res.items;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load queue';
    } finally {
      loading.value = false;
    }
  }

  onMounted(load);
  watch([statusFilter, sort, order], load);

  return {
    items,
    loading,
    error,
    statusFilter,
    sort,
    order,
    statuses: STATUSES,
    load,
    formatDuration,
  };
}
