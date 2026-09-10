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

    <div class="shortcut-strip" aria-label="Keyboard shortcuts">
      <span><kbd>Space</kbd> play</span>
      <span><kbd>J</kbd><kbd>L</kbd> ±2s</span>
      <span><kbd>[</kbd><kbd>]</kbd> speed</span>
      <span class="muted tip">Word click seeks (proportional)</span>
      <button type="button" class="linkish" @click="toggleHelp">
        {{ showHelp ? 'Hide keys' : 'All keys' }}
      </button>
    </div>
    <ul v-if="showHelp" class="help-list">
      <li><kbd>Space</kbd> / <kbd>K</kbd> — play / pause</li>
      <li><kbd>J</kbd> / <kbd>←</kbd> — back 2s · <kbd>Shift+←</kbd> — 5s</li>
      <li><kbd>L</kbd> / <kbd>→</kbd> — forward 2s · <kbd>Shift+→</kbd> — 5s</li>
      <li><kbd>[</kbd> / <kbd>]</kbd> — slower / faster</li>
    </ul>
  </div>
</template>
