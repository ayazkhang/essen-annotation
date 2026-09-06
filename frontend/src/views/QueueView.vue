<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { api, formatDuration, type AnnotationItem, type ItemStatus } from '../api';

const items = ref<AnnotationItem[]>([]);
const loading = ref(false);
const error = ref('');
const statusFilter = ref<string>('');
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

const statuses: Array<ItemStatus | ''> = [
  '',
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'AUTO_REJECTED',
  'UNPAIRED',
];
</script>

<template>
  <section>
    <div class="head">
      <div>
        <h1>Work queue</h1>
        <p class="muted">Items &gt; 15s are annotatable. ≤15s are auto-rejected.</p>
      </div>
      <RouterLink class="btn" to="/ingest">Upload audio / transcripts</RouterLink>
    </div>

    <div class="filters panel">
      <label>
        Status
        <select v-model="statusFilter">
          <option v-for="s in statuses" :key="s || 'all'" :value="s">
            {{ s || 'All' }}
          </option>
        </select>
      </label>
      <label>
        Sort
        <select v-model="sort">
          <option value="duration">Duration</option>
          <option value="status">Status</option>
          <option value="filename">Filename</option>
          <option value="updatedAt">Updated</option>
        </select>
      </label>
      <label>
        Order
        <select v-model="order">
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
      </label>
      <button type="button" @click="load">Refresh</button>
    </div>

    <p v-if="error" class="err">{{ error }}</p>
    <p v-if="loading" class="muted">Loading…</p>

    <div v-else class="table-wrap panel">
      <table>
        <thead>
          <tr>
            <th>Filename</th>
            <th>Duration</th>
            <th>Status</th>
            <th>Annotator</th>
            <th>Spans</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id">
            <td class="mono">{{ item.filename }}</td>
            <td>{{ formatDuration(item.durationSeconds) }}</td>
            <td><span class="badge" :class="item.status">{{ item.status }}</span></td>
            <td>{{ item.annotator || '—' }}</td>
            <td>{{ item._count?.spans ?? 0 }}</td>
            <td>
              <RouterLink
                v-if="item.status !== 'AUTO_REJECTED' && item.storagePath && item.originalTranscript"
                :to="`/items/${item.id}`"
              >
                Open
              </RouterLink>
              <span v-else-if="item.status === 'AUTO_REJECTED'" class="muted">Rejected</span>
              <RouterLink v-else to="/ingest">Fix pairing</RouterLink>
            </td>
          </tr>
          <tr v-if="items.length === 0">
            <td colspan="6" class="muted">No items yet. Seed the demo or upload files.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
}

h1 {
  margin: 0 0 0.25rem;
  font-size: 1.5rem;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: end;
  margin-bottom: 1rem;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.85rem;
  color: var(--muted);
}

select {
  min-width: 10rem;
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
  border: 1px solid var(--line);
  background: #fff;
}

.table-wrap {
  overflow-x: auto;
  padding: 0;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  text-align: left;
  padding: 0.65rem 0.85rem;
  border-bottom: 1px solid var(--line);
  font-size: 0.92rem;
}

th {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}

.btn {
  display: inline-block;
  padding: 0.45rem 0.8rem;
  border-radius: 6px;
  background: var(--accent);
  color: #fff;
  text-decoration: none;
  font-weight: 500;
}
</style>
