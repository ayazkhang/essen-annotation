<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import {
  api,
  type AnnotationItem,
  type AnnotationSpan,
  type SpanType,
} from '../api';
import AudioPlayer from '../components/AudioPlayer.vue';
import TranscriptEditor from '../components/TranscriptEditor.vue';
import AnnotationPanel from '../components/AnnotationPanel.vue';
import ConditionsPanel from '../components/ConditionsPanel.vue';

const props = defineProps<{ id: string }>();

const item = ref<AnnotationItem | null>(null);
const error = ref('');
const saving = ref(false);
const selection = ref<{ start: number; end: number; text: string } | null>(null);
const player = ref<InstanceType<typeof AudioPlayer> | null>(null);
const editor = ref<InstanceType<typeof TranscriptEditor> | null>(null);

const tokens = computed(() => editor.value?.tokens.map((t) => t.text) ?? []);
const spans = computed(() => item.value?.spans ?? []);

async function load() {
  error.value = '';
  try {
    const res = await api.getItem(props.id);
    item.value = res.item;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load item';
  }
}

async function saveCorrected(text: string) {
  if (!item.value) return;
  saving.value = true;
  try {
    const res = await api.updateItem(item.value.id, { correctedTranscript: text });
    item.value = res.item;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Save failed';
  } finally {
    saving.value = false;
  }
}

async function markComplete() {
  if (!item.value) return;
  const res = await api.updateItem(item.value.id, { status: 'COMPLETED' });
  item.value = res.item;
}

async function createSpan(payload: {
  type: SpanType;
  startOffset: number;
  endOffset: number;
  attributes: Record<string, unknown>;
}) {
  if (!item.value) return;
  try {
    await api.createSpan(item.value.id, payload);
    selection.value = null;
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Span create failed';
  }
}

async function updateSpan(payload: {
  id: string;
  type: SpanType;
  startOffset: number;
  endOffset: number;
  attributes: Record<string, unknown>;
}) {
  if (!item.value) return;
  try {
    await api.updateSpan(item.value.id, payload.id, payload);
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Span update failed';
  }
}

async function removeSpan(spanId: string) {
  if (!item.value) return;
  await api.deleteSpan(item.value.id, spanId);
  await load();
}

async function saveConditions(payload: {
  speechRateWpmOverride: number | null;
  distanceEstimateOverride: number | null;
}) {
  if (!item.value) return;
  const res = await api.updateItem(item.value.id, payload);
  item.value = res.item;
}

function onWordClick(index: number) {
  player.value?.seekToToken(index);
}

onMounted(load);
</script>

<template>
  <section v-if="item">
    <div class="head">
      <div>
        <RouterLink to="/">← Queue</RouterLink>
        <h1 class="mono">{{ item.filename }}</h1>
        <p>
          <span class="badge" :class="item.status">{{ item.status }}</span>
          <span class="muted"> · {{ item.annotator || 'unassigned' }}</span>
        </p>
      </div>
      <button type="button" class="primary" @click="markComplete">Mark completed</button>
    </div>

    <p v-if="error" class="err">{{ error }}</p>
    <p v-if="saving" class="muted">Saving…</p>

    <AudioPlayer
      v-if="item.storagePath"
      ref="player"
      :src="api.audioUrl(item.id)"
      :tokens="tokens"
      :duration-hint="item.durationSeconds"
    />
    <p v-else class="err">No audio attached.</p>

    <div class="layout">
      <TranscriptEditor
        ref="editor"
        :original="item.originalTranscript ?? ''"
        :corrected="item.correctedTranscript ?? ''"
        :spans="spans as AnnotationSpan[]"
        @update:corrected="saveCorrected"
        @word-click="onWordClick"
        @selection="selection = $event"
      />

      <div class="side">
        <AnnotationPanel
          :spans="spans as AnnotationSpan[]"
          :selection="selection"
          :transcript="item.correctedTranscript ?? ''"
          @create="createSpan"
          @update="updateSpan"
          @remove="removeSpan"
        />
        <ConditionsPanel :item="item" @save="saveConditions" />
      </div>
    </div>
  </section>
  <p v-else-if="error" class="err">{{ error }}</p>
  <p v-else class="muted">Loading…</p>
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
  margin: 0.35rem 0;
  font-size: 1.25rem;
}

.layout {
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
}

.side {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

@media (min-width: 960px) {
  .layout {
    grid-template-columns: 1.4fr 1fr;
    align-items: start;
  }
}
</style>
