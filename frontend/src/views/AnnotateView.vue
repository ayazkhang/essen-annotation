<script setup lang="ts">
import { ref, toRef } from 'vue';
import AudioPlayer from '../components/AudioPlayer.vue';
import TranscriptEditor from '../components/TranscriptEditor.vue';
import AnnotationPanel from '../components/AnnotationPanel.vue';
import ConditionsPanel from '../components/ConditionsPanel.vue';
import './annotate-view.css';
import { useAnnotateView } from './useAnnotateView';

const props = defineProps<{ id: string }>();

/** Keep player ref in this SFC so template `ref="player"` always binds. */
const player = ref<InstanceType<typeof AudioPlayer> | null>(null);

const {
  item,
  error,
  saving,
  selection,
  editor,
  tokens,
  spans,
  audioSrc,
  saveCorrected,
  markComplete,
  createSpan,
  updateSpan,
  removeSpan,
  saveConditions,
  onSelection,
} = useAnnotateView(toRef(props, 'id'));

function onWordClick(index: number) {
  player.value?.seekToToken(index);
}
</script>

<template>
  <div class="annotate-view">
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
        class="sticky-player"
        :src="audioSrc"
        :tokens="tokens"
        :duration-hint="item.durationSeconds"
      />
      <p v-else class="err">No audio attached.</p>

      <div class="layout">
        <TranscriptEditor
          ref="editor"
          :original="item.originalTranscript ?? ''"
          :corrected="item.correctedTranscript ?? ''"
          :spans="spans"
          @update:corrected="saveCorrected"
          @word-click="onWordClick"
          @selection="onSelection"
        />

        <div class="side">
          <AnnotationPanel
            :spans="spans"
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
  </div>
</template>
