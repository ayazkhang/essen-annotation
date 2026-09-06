<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

const props = defineProps<{
  src: string;
  /** Token strings used for proportional seek-on-click */
  tokens: string[];
  durationHint?: number | null;
}>();

const emit = defineEmits<{
  seekToToken: [index: number];
}>();

const audioEl = ref<HTMLAudioElement | null>(null);
const playing = ref(false);
const current = ref(0);
const duration = ref(0);
const rate = ref(1);
const showHelp = ref(true);

const progress = computed(() =>
  duration.value > 0 ? Math.min(100, (current.value / duration.value) * 100) : 0,
);

function toggle() {
  const el = audioEl.value;
  if (!el) return;
  if (el.paused) {
    void el.play();
  } else {
    el.pause();
  }
}

function seek(delta: number) {
  const el = audioEl.value;
  if (!el) return;
  el.currentTime = Math.max(0, Math.min(el.duration || duration.value, el.currentTime + delta));
}

function onSeekBar(ev: Event) {
  const el = audioEl.value;
  if (!el || !duration.value) return;
  const value = Number((ev.target as HTMLInputElement).value);
  el.currentTime = (value / 100) * duration.value;
}

function setRate(r: number) {
  rate.value = r;
  if (audioEl.value) audioEl.value.playbackRate = r;
}

/** Approximate token start time by equal share of duration (no word timings in AI JSON). */
function timeForToken(index: number): number {
  if (!props.tokens.length || !duration.value) return 0;
  return (index / props.tokens.length) * duration.value;
}

function seekToToken(index: number) {
  const el = audioEl.value;
  if (!el) return;
  el.currentTime = timeForToken(index);
  emit('seekToToken', index);
}

function onKey(ev: KeyboardEvent) {
  const tag = (ev.target as HTMLElement)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  switch (ev.key.toLowerCase()) {
    case ' ':
      ev.preventDefault();
      toggle();
      break;
    case 'arrowleft':
      ev.preventDefault();
      seek(ev.shiftKey ? -5 : -2);
      break;
    case 'arrowright':
      ev.preventDefault();
      seek(ev.shiftKey ? 5 : 2);
      break;
    case '[':
      setRate(Math.max(0.5, Math.round((rate.value - 0.25) * 100) / 100));
      break;
    case ']':
      setRate(Math.min(2, Math.round((rate.value + 0.25) * 100) / 100));
      break;
    case 'j':
      seek(-2);
      break;
    case 'l':
      seek(2);
      break;
    case 'k':
      toggle();
      break;
    default:
      break;
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKey);
});
onUnmounted(() => {
  window.removeEventListener('keydown', onKey);
});

watch(
  () => props.src,
  () => {
    current.value = 0;
    playing.value = false;
  },
);

defineExpose({ seekToToken, timeForToken });
</script>

<template>
  <div class="player panel">
    <audio
      ref="audioEl"
      :src="src"
      preload="metadata"
      @play="playing = true"
      @pause="playing = false"
      @timeupdate="current = audioEl?.currentTime ?? 0"
      @loadedmetadata="duration = audioEl?.duration || durationHint || 0"
    />

    <div class="controls">
      <button type="button" @click="seek(-2)" title="Jump back 2s (J / ←)">−2s</button>
      <button type="button" class="primary" @click="toggle">
        {{ playing ? 'Pause' : 'Play' }}
      </button>
      <button type="button" @click="seek(2)" title="Jump forward 2s (L / →)">+2s</button>
      <label class="rate">
        Speed
        <select :value="rate" @change="setRate(Number(($event.target as HTMLSelectElement).value))">
          <option v-for="r in [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]" :key="r" :value="r">
            {{ r }}×
          </option>
        </select>
      </label>
      <span class="mono time">
        {{ current.toFixed(1) }}s / {{ duration.toFixed(1) }}s
      </span>
    </div>

    <input
      class="seek"
      type="range"
      min="0"
      max="100"
      step="0.1"
      :value="progress"
      @input="onSeekBar"
    />

    <details class="help" :open="showHelp">
      <summary @click="showHelp = !showHelp">Keyboard shortcuts</summary>
      <ul>
        <li><kbd>Space</kbd> / <kbd>K</kbd> — play / pause</li>
        <li><kbd>J</kbd> / <kbd>←</kbd> — back 2s · <kbd>Shift+←</kbd> — 5s</li>
        <li><kbd>L</kbd> / <kbd>→</kbd> — forward 2s · <kbd>Shift+→</kbd> — 5s</li>
        <li><kbd>[</kbd> / <kbd>]</kbd> — slower / faster</li>
        <li>Click a word in the transcript to jump (proportional timing)</li>
      </ul>
    </details>
  </div>
</template>

<style scoped>
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.75rem;
}

.rate {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: var(--muted);
}

.time {
  margin-left: auto;
  font-size: 0.85rem;
}

.seek {
  width: 100%;
}

.help {
  margin-top: 0.75rem;
  font-size: 0.85rem;
  color: var(--muted);
}

.help ul {
  margin: 0.5rem 0 0;
  padding-left: 1.1rem;
}

kbd {
  font-family: var(--mono);
  background: var(--bg-deep);
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 0 0.3rem;
  font-size: 0.8rem;
}
</style>
