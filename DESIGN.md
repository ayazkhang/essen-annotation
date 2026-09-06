# DESIGN

## Data model

Two tables:

- **`AnnotationItem`** — one work unit keyed by audio **filename**. Holds storage path (bytes on disk under `backend/uploads/`), server-measured audio metadata, immutable `originalTranscript`, mutable `correctedTranscript`, status, suggested/override recording-condition fields, and optional `annotator` label (no auth).
- **`AnnotationSpan`** — character offsets into the **corrected** transcript plus typed `attributes` JSON. Validated with Zod on write; measurement spans store `normalizedValue` / `baseUnit` at persist time.

Statuses: `UNPAIRED` → `PENDING` | `AUTO_REJECTED` (duration ≤ 15s) → `IN_PROGRESS` → `COMPLETED`. Duration routing never trusts the client.

## Why this shape

Filename is the natural join key from the AI JSON (`path` / `label`). Keeping original and corrected on the same row avoids a join for the hot path and makes WER-style comparisons trivial. Spans reference corrected offsets so token CRUD (edit/add/delete) stays a plain text edit rather than a parallel token graph—faster for annotators, simpler to export.

## Overlapping spans

**Allowed.** Clinical dictation often nests signals (e.g. a drug name inside a longer measurement phrase). Forbidding overlaps would force awkward workarounds. The UI highlights all overlapping types on a token; export lists every span independently.

## Word-click seek

The AI transcript format has **no word timestamps**. Seek uses **equal share of duration per whitespace token**. Documented in the player. Next step: optional forced alignment or storing model timings if the STT pipeline starts emitting them.

## Distance estimate

For WAV PCM: RMS of a mono mix vs the quietest 10% of frames (noise-floor proxy), mapped with `log10` into `[0, 1]`. For compressed audio without easy PCM: bitrate-density fallback. **Labelled as an estimate** in UI and export (`distanceEstimateMethod`). Annotator override is what export prefers.

## Unit normalization

Mass → grams, volume → litres, length → centimetres. `mmHg`, `IE`, `Ch` stay identity (no safe clinical conversion without context).

## Export schema (JSONL)

One object per line: `audio`, `originalTranscript`, `correctedTranscript`, `spans[]` (with sliced `text` + attributes), `recordingConditions` (header + effective overrides), `status`, `annotator`, `exportedAt`. Flat enough for training pipelines; spans keep offsets for reconstruction.

## CRUD vs span types

The brief lists CRUD among “six types.” **CRUD is transcript editing** (correct / add / delete tokens on the corrected string), not a span type. The six span types are NUMBER, FORMATTING_COMMAND, SPELLED_OUT, NAMED_ENTITY, MEDICAL_TERM, MEASUREMENT.

## Tradeoffs / cuts

- **Disk storage** instead of MinIO — fine for localhost / one annotator.
- **Synthetic demo WAVs** (tonal PCM) instead of real Common Voice clips — keeps the repo small and offline; labels still exercise pairing and spans.
- **No auth / multi-annotator** — out of scope.
- **Proportional word timing** — see above.
- Frontend build uses Vite proxy; production static hosting not wired (out of scope).

## Deliberate deviations

- Node engines field requires ≥22; local setup documented via fnm/nvm.
- `APPLICATION/octet-stream` accepted for uploads when the **extension** is valid (browsers lie about MIME).
- Re-uploading a transcript does **not** overwrite an existing immutable original; corrected is only seeded when missing.

## Next

Real medical audio seed; optional MinIO; word-level timings from the STT service; lightweight WER display against original vs corrected; span editing of offsets in the UI (today: recreate or edit attributes).
