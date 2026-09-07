<script setup lang="ts">
import './queue-view.css';
import { useQueueView } from './useQueueView';

const {
  items,
  loading,
  error,
  statusFilter,
  sort,
  order,
  statuses,
  load,
  formatDuration,
} = useQueueView();
</script>

<template>
  <section class="queue-view">
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
