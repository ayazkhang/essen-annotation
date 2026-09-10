# DESIGN

## Data model

Two tables:

- **AnnotationItem** — one row per audio filename. Stores the disk path (not bytes), audio metadata measured on the server, immutable `originalTranscript`, editable `correctedTranscript`, status, and recording-condition fields (suggested + optional overrides).
- **AnnotationSpan** — character offsets into the corrected transcript, with typed attributes validated on write.

Status flow: `UNPAIRED` → `PENDING` or `AUTO_REJECTED` (≤15s) → `IN_PROGRESS` → `COMPLETED`. Duration always comes from the file, never the client.

## Why this shape

The AI upload keys rows by filename (`path` / `label`), so filename is the join. Original and corrected live on the same row for easy WER-style diffs. Spans point at corrected text so token CRUD is normal text editing, not a separate token graph.

## Choices worth calling out

- **Overlapping spans are allowed** — clinical dictation nests signals (drug inside a measurement phrase). Export lists each span on its own.
- **Word-click seek is proportional** — the AI JSON has no word timings, so each token gets an equal share of duration. Real timings can come later from the STT pipeline.
- **Distance is an estimate** — WAV: RMS vs quietest 10% of frames, mapped to `[0, 1]`. Compressed: bitrate-density fallback. UI and export label it as a proxy; overrides win on export.
- **Units** — mass→g, volume→l, length→cm. `mmHg`, `IE`, `Ch` stay as-is.
- **CRUD is not a span type** — it means edit/add/delete tokens on the corrected transcript. The six span types are NUMBER, FORMATTING_COMMAND, SPELLED_OUT, NAMED_ENTITY, MEDICAL_TERM, MEASUREMENT.

## Export (JSONL)

One object per line: audio ref, original + corrected text, spans (with sliced `text` + attributes), recording conditions (effective overrides), status, annotator, `exportedAt`.

## What we cut

Disk storage instead of MinIO. Proportional seek instead of forced alignment. Span attributes editable in the UI; offset changes mean recreate or use the API. No auth or multi-annotator workflows (out of scope). Demo WAVs under `demo/audio/` (`yarn generate:demo`); optional spoken clips under `demo/realtime/`.

## Next

MinIO if needed, real word timings, WER in the UI, span offset editing, a few route-level tests.
