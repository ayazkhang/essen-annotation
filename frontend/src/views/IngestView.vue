<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '../api';

const audioMsg = ref('');
const audioErr = ref('');
const transcriptJson = ref(`[
  { "path": "audio/op_report_long.wav", "label": "Single-Shot-Antibiose mit Cefuroxim..." },
  { "path": "audio/unknown.wav", "label": "This one will not match" }
]`);
const transcriptMsg = ref('');
const transcriptErr = ref('');
const pastePath = ref('');
const pasteLabel = ref('');
const pairing = ref<Awaited<ReturnType<typeof api.getPairing>> | null>(null);
const selectedAudio = ref('');
const selectedTranscript = ref('');

async function refreshPairing() {
  pairing.value = await api.getPairing();
}

async function onAudioChange(ev: Event) {
  const input = ev.target as HTMLInputElement;
  if (!input.files?.length) return;
  audioErr.value = '';
  audioMsg.value = '';
  try {
    const res = await api.uploadAudio(input.files);
    audioMsg.value = `Uploaded ${res.items.length} file(s).`;
    if (res.issues.length) {
      audioErr.value = res.issues.map((i) => `${i.filename}: ${i.message}`).join('; ');
    }
    await refreshPairing();
  } catch (e) {
    audioErr.value = e instanceof Error ? e.message : 'Upload failed';
  } finally {
    input.value = '';
  }
}

async function onTranscriptFile(ev: Event) {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  transcriptErr.value = '';
  transcriptMsg.value = '';
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const res = await api.uploadTranscripts(parsed);
    transcriptMsg.value = `Applied ${res.items.length} transcript row(s).`;
    if (res.issues.length) {
      transcriptErr.value = res.issues.map((i) => i.message).join('; ');
    }
    await refreshPairing();
  } catch (e) {
    transcriptErr.value = e instanceof Error ? e.message : 'Transcript upload failed';
  } finally {
    input.value = '';
  }
}

async function submitJsonPaste() {
  transcriptErr.value = '';
  transcriptMsg.value = '';
  try {
    const parsed = JSON.parse(transcriptJson.value);
    const res = await api.uploadTranscripts(parsed);
    transcriptMsg.value = `Applied ${res.items.length} transcript row(s).`;
    if (res.issues.length) {
      transcriptErr.value = res.issues.map((i) => i.message).join('; ');
    }
    await refreshPairing();
  } catch (e) {
    transcriptErr.value = e instanceof Error ? e.message : 'Invalid JSON';
  }
}

async function submitSingle() {
  transcriptErr.value = '';
  try {
    await api.pasteTranscript(pastePath.value, pasteLabel.value);
    transcriptMsg.value = `Pasted transcript for ${pastePath.value}`;
    pastePath.value = '';
    pasteLabel.value = '';
    await refreshPairing();
  } catch (e) {
    transcriptErr.value = e instanceof Error ? e.message : 'Paste failed';
  }
}

async function doPair() {
  if (!selectedAudio.value || !selectedTranscript.value) return;
  await api.manualPair(selectedAudio.value, selectedTranscript.value);
  selectedAudio.value = '';
  selectedTranscript.value = '';
  await refreshPairing();
}

async function dropSide(itemId: string, drop: 'audio' | 'transcript') {
  await api.unpair(itemId, drop);
  await refreshPairing();
}

onMounted(refreshPairing);
</script>

<template>
  <section class="grid">
    <div class="panel">
      <h2>Audio upload</h2>
      <p class="muted">.wav, .mp3, .m4a — max 50&nbsp;MB each. Duration is measured server-side.</p>
      <input type="file" accept=".wav,.mp3,.m4a,audio/*" multiple @change="onAudioChange" />
      <p v-if="audioMsg" class="ok">{{ audioMsg }}</p>
      <p v-if="audioErr" class="err">{{ audioErr }}</p>
    </div>

    <div class="panel">
      <h2>Transcript JSON</h2>
      <p class="muted">Array of <code>{ "path", "label" }</code>. Bad rows are reported; good rows kept.</p>
      <input type="file" accept=".json,application/json" @change="onTranscriptFile" />
      <textarea v-model="transcriptJson" rows="8" class="mono" />
      <button type="button" class="primary" @click="submitJsonPaste">Upload JSON</button>
      <p v-if="transcriptMsg" class="ok">{{ transcriptMsg }}</p>
      <p v-if="transcriptErr" class="err">{{ transcriptErr }}</p>
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
          <ul>
            <li v-for="t in pairing?.unmatchedTranscripts ?? []" :key="t.id">
              <label>
                <input v-model="selectedTranscript" type="radio" :value="t.id" />
                <span class="mono">{{ t.filename }}</span>
              </label>
              <button type="button" class="linkish" @click="dropSide(t.id, 'transcript')">Remove</button>
            </li>
          </ul>
        </div>
        <div>
          <h3>Paired ({{ pairing?.paired.length ?? 0 }})</h3>
          <ul>
            <li v-for="p in pairing?.paired ?? []" :key="p.id">
              <span class="mono">{{ p.filename }}</span>
              <span class="badge" :class="p.status">{{ p.status }}</span>
              <button type="button" class="linkish" @click="dropSide(p.id, 'transcript')">Unpair transcript</button>
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

<style scoped>
.grid {
  display: grid;
  gap: 1rem;
}

h2 {
  margin: 0 0 0.35rem;
  font-size: 1.1rem;
}

h3 {
  margin: 0 0 0.5rem;
  font-size: 0.95rem;
}

textarea,
input[type='text'],
input:not([type='file']):not([type='radio']) {
  width: 100%;
  margin: 0.35rem 0 0.75rem;
  padding: 0.5rem;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fff;
}

label {
  display: block;
  font-size: 0.85rem;
  color: var(--muted);
}

.ok {
  color: var(--accent);
  font-size: 0.9rem;
}

.pairing {
  grid-column: 1 / -1;
}

.pair-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.cols {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  margin: 1rem 0;
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

li {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  padding: 0.35rem 0;
  border-bottom: 1px solid var(--line);
  font-size: 0.9rem;
}

.linkish {
  border: none;
  background: transparent;
  color: var(--danger);
  padding: 0;
  font-size: 0.8rem;
}

@media (min-width: 900px) {
  .grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
