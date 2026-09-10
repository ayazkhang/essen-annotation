import { onMounted, ref } from 'vue';
import { api, type JsonValue } from '../api';

export function useIngestView() {
  const audioMsg = ref('');
  const audioErr = ref('');
  const audioIssues = ref<string[]>([]);
  const transcriptJson = ref(`[
  { "path": "audio/op_report_long.wav", "label": "Single-Shot-Antibiose mit Cefuroxim..." },
  { "path": "audio/unknown.wav", "label": "This one will not match" }
]`);
  const transcriptMsg = ref('');
  const transcriptErr = ref('');
  const transcriptIssues = ref<string[]>([]);
  const pastePath = ref('');
  const pasteLabel = ref('');
  const pairing = ref<Awaited<ReturnType<typeof api.getPairing>> | null>(null);
  const selectedAudio = ref('');
  const selectedTranscript = ref('');

  function previewLabel(label: string | null | undefined): string {
    if (!label) return '(empty label)';
    return label.length > 120 ? `${label.slice(0, 117)}…` : label;
  }

  async function refreshPairing() {
    pairing.value = await api.getPairing();
  }

  async function onAudioChange(ev: Event) {
    const input = ev.target as HTMLInputElement;
    if (!input.files?.length) return;
    audioErr.value = '';
    audioMsg.value = '';
    audioIssues.value = [];
    try {
      const res = await api.uploadAudio(input.files);
      audioMsg.value = `Uploaded ${res.items.length} file(s).`;
      audioIssues.value = res.issues.map((i) => `${i.filename}: ${i.message}`);
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
    transcriptIssues.value = [];
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as JsonValue;
      const res = await api.uploadTranscripts(parsed);
      transcriptMsg.value = `Applied ${res.items.length} transcript row(s).`;
      transcriptIssues.value = res.issues.map((i) =>
        i.path ? `${i.path}: ${i.message}` : i.message,
      );
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
    transcriptIssues.value = [];
    try {
      const parsed = JSON.parse(transcriptJson.value) as JsonValue;
      const res = await api.uploadTranscripts(parsed);
      transcriptMsg.value = `Applied ${res.items.length} transcript row(s).`;
      transcriptIssues.value = res.issues.map((i) =>
        i.path ? `${i.path}: ${i.message}` : i.message,
      );
      await refreshPairing();
    } catch (e) {
      transcriptErr.value = e instanceof Error ? e.message : 'Invalid JSON';
    }
  }

  async function submitSingle() {
    transcriptErr.value = '';
    transcriptIssues.value = [];
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
    try {
      await api.manualPair(selectedAudio.value, selectedTranscript.value);
      selectedAudio.value = '';
      selectedTranscript.value = '';
      await refreshPairing();
    } catch (e) {
      transcriptErr.value = e instanceof Error ? e.message : 'Pairing failed';
    }
  }

  async function dropSide(itemId: string, drop: 'audio' | 'transcript') {
    try {
      await api.unpair(itemId, drop);
      await refreshPairing();
    } catch (e) {
      transcriptErr.value = e instanceof Error ? e.message : 'Unpair failed';
    }
  }

  onMounted(refreshPairing);

  return {
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
  };
}
