# Realtime test samples (German clinical dictation)

Spoken German WAV files for trying the full annotator flow (player, transcript edit, spans).
Generated with `espeak-ng` (German voice) so you can hear words — not sine tones.

| File | Duration | What to try |
|------|----------|-------------|
| `op_cefuroxim.wav` | ~19s | MEDICAL_TERM, MEASUREMENT (1500 mg), FORMATTING_COMMAND, NUMBER (`sechs null`) |
| `lagerung_prep.wav` | ~18s | Queue item, correct umlauts, NAMED_ENTITY / MEDICAL_TERM |
| `spelled_cefuroxim.wav` | ~18s | SPELLED_OUT → Cefuroxim, MEASUREMENT (200 mg) |
| `short_note.wav` | ~1.6s | Must become **AUTO_REJECTED** (≤15s) |

`transcripts.json` is the AI first-pass format (with intentional plain-ASCII “ASR” style). One extra row has no audio so you can test unpaired transcripts.

## How to load in the UI

1. Open http://localhost:5173/ingest  
2. **Audio upload** — select all four `.wav` files in this folder  
3. **Transcript JSON** — upload `transcripts.json` (or paste its contents)  
4. Check **Pairing** — `missing_clip.wav` stays unmatched; others should pair  
5. Go to **Queue** → open a `PENDING` item → use the audio player  

Gold labels (what the speech is meant to say) are in the table above / spoken content; the JSON `label` fields are slightly “noisy” so you have something to correct.
