# Essen Annotation — Clinical STT Gold Standard Tool

Annotator-facing web app for correcting German clinical speech transcripts and marking structured spans (numbers, formatting commands, medical terms, measurements, etc.).

**Stack:** Node.js **22**, TypeScript, Express, Prisma, PostgreSQL, Vue 3 (Composition API / `<script setup>`), Yarn, Docker Compose.

## Prerequisites

- Docker + Docker Compose
- Node.js **22** only if you run outside Docker (see `.nvmrc`)

## Quick start (Docker — recommended)

Dockerfiles live under `backend/docker/` and `frontend/docker/`. Dependencies install **inside** those containers (not a host `node_modules/`).

```bash
docker compose up --build
```

That will:

1. Start Postgres  
2. Install deps in the backend and frontend containers  
3. Run Prisma migrations + seed demo data (backend)  
4. Start API (`backend`) + Vue UI (`frontend`)  

- UI: http://localhost:5173  
- API: http://localhost:3001/api/health  

Demo items appear in the queue: two long clips ready to annotate (including the Cefuroxim worked example with spans), and one short clip auto-rejected (≤15s).

Stop with `Ctrl+C`, or in detached mode:

```bash
docker compose up --build -d
docker compose down
```

Set `SEED_ON_START=0` on the `backend` service in `docker-compose.yml` if you do not want the DB re-seeded on every container start.

## Demo audio files

Committed sample WAVs live under `demo/audio/` (`op_report_long.wav`, `lagerung_long.wav`, `short_reject.wav`). The backend seed copies them into uploads and loads transcripts/spans. Regenerate them when missing:

```bash
# Docker
docker compose exec backend yarn generate:demo

# Local (from backend/)
cd backend
yarn install
yarn generate:demo
```

That runs `backend/scripts/generate-demo-audio.ts` and writes the three WAVs into `demo/audio/`. Then re-seed:

```bash
docker compose exec backend yarn seed
# or locally:
cd backend && yarn seed
```

Spoken German practice clips (optional, not auto-seeded) are under `demo/realtime/` — see `demo/realtime/README.md`.

## Local development (optional, without Docker app)

```bash
docker compose up -d postgres
cd backend && yarn install && yarn generate:demo && yarn prisma:migrate && yarn seed && yarn dev
# in another terminal:
cd frontend && yarn install && yarn dev
```

Use `backend/.env` with `DATABASE_URL` pointing at `localhost:5432`.

## Useful commands

| Command | Purpose |
|---------|---------|
| `docker compose up --build` | Install deps, migrate, seed, run backend + frontend |
| `docker compose exec backend yarn generate:demo` | Create demo WAV files in `demo/audio/` |
| `docker compose exec backend yarn seed` | Re-seed demo data into the database |
| `docker compose exec backend yarn test` | Backend unit tests |
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
docker compose exec backend yarn test
# or locally:
cd backend && yarn install && yarn test
```

Covers the 15-second routing rule, transcript/audio pairing validation, measurement unit normalization, and span attribute/offset checks.
