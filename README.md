# Essen Annotation — Clinical STT Gold Standard Tool

Annotator-facing web app for correcting German clinical speech transcripts and marking structured spans (numbers, formatting commands, medical terms, measurements, etc.).

**Stack:** Node.js **22**, TypeScript, Express, Prisma, PostgreSQL, Vue 3 (Composition API / `<script setup>`), Yarn workspaces, Docker Compose for Postgres.

## Prerequisites

- Node.js **22** (see `.nvmrc`)
- Yarn classic (`corepack enable` then use the repo’s Yarn)
- Docker + Docker Compose

## Quick start

```bash
# 1. Database
docker compose up -d

# 2. Install, migrate, generate demo WAVs, seed
yarn install
yarn workspace backend generate:demo
yarn workspace backend prisma:migrate
yarn workspace backend seed

# 3. Run API + UI
yarn dev
```

- UI: http://localhost:5173  
- API: http://localhost:3001/api/health  

Demo items appear in the queue: two long clips ready to annotate (including the Cefuroxim worked example with spans), and one short clip auto-rejected (≤15s).

## Useful commands

| Command | Purpose |
|---------|---------|
| `yarn test` | Backend unit tests (routing, pairing, units, spans) |
| `yarn workspace backend seed` | Re-seed demo data |
| `yarn workspace backend generate:demo` | Regenerate `demo/audio/*.wav` |
| Export | Header link **Export JSONL**, or `GET /api/items/export.jsonl` |

## Upload formats

**Audio:** `.wav`, `.mp3`, `.m4a` (max 50 MB). Duration and header fields are read **server-side**.

**Transcripts:** JSON array:

```json
[
  { "path": "audio/880_NTX.wav", "label": "Kontrollierte Rueckenlagerung..." }
]
```

Pairing is by **basename**. Unmatched audio/transcripts are listed on **Ingest**; you can pair or unpair manually.

## Annotation workflow

1. Open a `PENDING` / `IN_PROGRESS` item from the queue.  
2. Play audio (shortcuts documented in the player). Click words to seek (proportional timing).  
3. Edit the **corrected** transcript (original stays immutable).  
4. Select spans → set type + attributes. Overlaps allowed.  
5. Review / override speech rate and distance estimate.  
6. Mark completed → export JSONL.

## Tests

```bash
yarn test
```

Covers the 15-second routing rule, transcript/audio pairing validation, measurement unit normalization, and span attribute/offset checks.
