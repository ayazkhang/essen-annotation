<script setup lang="ts">
import { useAudioPlayer } from './useAudioPlayer';

const props = defineProps<{
  src: string;
  tokens: string[];
  durationHint?: number | null;
}>();

const emit = defineEmits<{
  seekToToken: [index: number];
}>();

const {
  SPEED_OPTIONS,
  audioEl,
  playing,
  current,
  duration,
  rate,
  showHelp,
  progress,
  toggle,
  seek,
  onSeekBar,
  onRateChange,
  onPlay,
  onPause,
  onTimeUpdate,
  onLoadedMetadata,
  toggleHelp,
  seekToToken,
  timeForToken,
} = useAudioPlayer(props, emit);

defineExpose({ seekToToken, timeForToken });
</script>

<template>
  <div class="player panel">
    <audio
      ref="audioEl"
      :src="src"
      preload="metadata"
      @play="onPlay"
      @pause="onPause"
      @timeupdate="onTimeUpdate"
      @loadedmetadata="onLoadedMetadata"
    />

    <div class="controls">
      <button type="button" title="Jump back 2s (J / ←)" @click="seek(-2)">−2s</button>
      <button type="button" class="primary" @click="toggle">
        {{ playing ? 'Pause' : 'Play' }}
      </button>
      <button type="button" title="Jump forward 2s (L / →)" @click="seek(2)">+2s</button>
      <label class="rate">
        Speed
        <select :value="rate" @change="onRateChange">
          <option v-for="r in SPEED_OPTIONS" :key="r" :value="r">{{ r }}×</option>
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
      <summary @click="toggleHelp">Keyboard shortcuts</summary>
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
