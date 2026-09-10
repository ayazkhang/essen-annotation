<script setup lang="ts">
import './ingest-view.css';
import { useIngestView } from './useIngestView';

const {
  audioMsg,
  audioErr,
  audioIssues,
  transcriptJson,
  transcriptMsg,
  transcriptErr,
  transcriptIssues,
  pastePath,
  pasteLabel,
  pairing,
  selectedAudio,
  selectedTranscript,
  refreshPairing,
  onAudioChange,
  onTranscriptFile,
  submitJsonPaste,
  submitSingle,
  doPair,
  dropSide,
  previewLabel,
} = useIngestView();
</script>

<template>
  <section class="ingest-view">
    <div class="panel">
      <h2>Audio upload</h2>
      <p class="muted">.wav, .mp3, .m4a — max 50&nbsp;MB each. Duration is measured server-side.</p>
      <input type="file" accept=".wav,.mp3,.m4a,audio/*" multiple @change="onAudioChange" />
      <p v-if="audioMsg" class="ok">{{ audioMsg }}</p>
      <ul v-if="audioIssues.length" class="issue-list">
        <li v-for="(issue, i) in audioIssues" :key="i" class="err">{{ issue }}</li>
      </ul>
      <p v-else-if="audioErr" class="err">{{ audioErr }}</p>
    </div>

    <div class="panel">
      <h2>Transcript JSON</h2>
      <p class="muted">Array of <code>{ "path", "label" }</code>. Bad rows are reported; good rows kept.</p>
      <input type="file" accept=".json,application/json" @change="onTranscriptFile" />
      <textarea v-model="transcriptJson" rows="8" class="mono" />
      <button type="button" class="primary" @click="submitJsonPaste">Upload JSON</button>
      <p v-if="transcriptMsg" class="ok">{{ transcriptMsg }}</p>
      <ul v-if="transcriptIssues.length" class="issue-list">
        <li v-for="(issue, i) in transcriptIssues" :key="i" class="err">{{ issue }}</li>
      </ul>
      <p v-else-if="transcriptErr" class="err">{{ transcriptErr }}</p>
    </div>

    <div class="panel">
      <h2>Paste one transcript</h2>
      <label>
        Audio filename
        <input v-model="pastePath" class="mono" placeholder="op_report_long.wav" />
      </label>
      <label>
        Label
        <textarea v-model="pasteLabel" rows="3" placeholder="Model transcript…" />
      </label>
      <button type="button" @click="submitSingle">Save</button>
    </div>

    <div class="panel pairing">
      <div class="pair-head">
        <h2>Pairing</h2>
        <button type="button" @click="refreshPairing">Refresh</button>
      </div>
      <p class="muted">Matched by basename. Nothing is silently dropped.</p>

      <div class="cols">
        <div>
          <h3>Unmatched audio ({{ pairing?.unmatchedAudio.length ?? 0 }})</h3>
          <p v-if="!(pairing?.unmatchedAudio.length)" class="muted empty">None — all audio is paired or absent.</p>
          <ul>
            <li v-for="a in pairing?.unmatchedAudio ?? []" :key="a.id">
              <label>
                <input v-model="selectedAudio" type="radio" :value="a.id" />
                <span class="mono">{{ a.filename }}</span>
              </label>
              <button type="button" class="linkish" @click="dropSide(a.id, 'audio')">Remove</button>
            </li>
          </ul>
        </div>
        <div>
          <h3>Unmatched transcripts ({{ pairing?.unmatchedTranscripts.length ?? 0 }})</h3>
          <p v-if="!(pairing?.unmatchedTranscripts.length)" class="muted empty">None — all transcripts are paired or absent.</p>
          <ul>
            <li v-for="t in pairing?.unmatchedTranscripts ?? []" :key="t.id">
              <label>
                <input v-model="selectedTranscript" type="radio" :value="t.id" />
                <span class="mono">{{ t.filename }}</span>
              </label>
              <p class="preview muted">{{ previewLabel(t.label) }}</p>
              <button type="button" class="linkish" @click="dropSide(t.id, 'transcript')">Remove</button>
            </li>
          </ul>
        </div>
        <div>
          <h3>Paired ({{ pairing?.paired.length ?? 0 }})</h3>
          <p v-if="!(pairing?.paired.length)" class="muted empty">No paired items yet.</p>
          <ul>
            <li v-for="p in pairing?.paired ?? []" :key="p.id">
              <span class="mono">{{ p.filename }}</span>
              <span class="badge" :class="p.status">{{ p.status }}</span>
              <div class="pair-actions">
                <button type="button" class="linkish" @click="dropSide(p.id, 'transcript')">
                  Unpair transcript
                </button>
                <button type="button" class="linkish" @click="dropSide(p.id, 'audio')">
                  Unpair audio
                </button>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <button
        type="button"
        class="primary"
        :disabled="!selectedAudio || !selectedTranscript"
        @click="doPair"
      >
        Pair selected
      </button>
    </div>
  </section>
</template>
