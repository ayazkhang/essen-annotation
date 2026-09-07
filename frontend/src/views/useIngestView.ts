import { onMounted, ref } from 'vue';
import { api } from '../api';

export function useIngestView() {
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

  return {
    audioMsg,
    audioErr,
    transcriptJson,
    transcriptMsg,
    transcriptErr,
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
  };
}
