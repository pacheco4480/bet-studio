# Bet Studio

Bet Studio is a local-first application for creating, managing, evaluating and rendering professional football betting bulletins for social media.

It combines structured football data, deterministic market settlement, versioned rendering and local SQLite persistence. External football data can be synchronized when configured, but the core workflow remains usable manually without API credentials.

## Features

- Competition, team, fixture and market management.
- Optional GOAL API synchronization for selected football data.
- Bulletin Builder for `SINGLE` and `MULTI` bulletins.
- `PRE_MATCH` and `LIVE` bulletin modes.
- Up to 10 selections per bulletin.
- Fixture dropdown focused on upcoming/live fixtures, with an option to show older or finished fixtures.
- Deterministic market settlement for supported market families.
- Manual result entry and manual settlement overrides.
- History view with result management, audit timeline, duplicate/edit actions and render history.
- Deterministic FEED PNG export at `1080 x 1350`.
- Saved FEED theme variants and optional team-logo/initial display.
- Historical snapshots so saved bulletins and renders do not silently change when catalog data changes later.

## Tech Stack

- TypeScript
- React
- Vite
- Tailwind CSS
- Node.js 22
- Fastify
- SQLite
- Drizzle ORM
- Zod
- Vitest
- Playwright Chromium
- ESLint
- Prettier
- GitHub Actions

## Architecture

Bet Studio follows a small layered architecture:

```text
Presentation
    ↓
Application
    ↓
Domain
    ↑
Infrastructure
```

The Domain layer contains framework-independent rules such as settlement behavior and bulletin invariants. Application services coordinate use cases. Infrastructure owns SQLite, Drizzle, provider adapters and rendering adapters. Presentation contains the Fastify API and React UI.

See [docs/architecture.md](docs/architecture.md) for the full architecture notes.

## Getting Started

### Requirements

- Node.js `>=22 <23`
- npm

Playwright Chromium is required for PNG rendering and for optional E2E tests.

### Install

```bash
npm install
npx playwright install chromium
```

### Environment

Create a local `.env` from `.env.example`:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Available environment variables:

```text
NODE_ENV=development
API_HOST=127.0.0.1
API_PORT=3000
BET_STUDIO_DB_PATH=./data/bet-studio.db
GOAL_API_KEY=
GOAL_API_BASE_URL=https://api.goal-api.com/v1
GOAL_API_TIMEOUT_MS=10000
```

`GOAL_API_KEY` is optional. If it is empty, local workflows still work and provider sync actions fail gracefully.

Never commit `.env` or real API keys.

### Database

Run migrations before starting the app:

```bash
npm run db:migrate
```

The default local database path is `./data/bet-studio.db`.

### Run

```bash
npm run dev
```

The API runs on `127.0.0.1:3000` by default and the Vite web app runs on the port selected by Vite, normally `5173`.

## Football Data Provider

GOAL API integration is optional and server-side only. The provider can refresh configured competitions, teams, fixtures and fixture results, but provider responses are treated as untrusted input and normalized before persistence.

The current GOAL API adapter does not enable corners or provider logos as trusted capabilities. Corner markets can still be evaluated after corner totals are entered manually in History. Rendered team logos currently use the local initials fallback until safe provider asset ingestion is implemented.

Bet Studio does not require provider access for local competitions, teams, fixtures, bulletins, settlement, history or rendering.

See [docs/api-integration.md](docs/api-integration.md) for provider behavior and failure rules.

## Market Engine

Automatic settlement is deterministic and based on market codes plus validated parameters, never on natural-language market names.

Implemented evaluator families:

- `MATCH_RESULT`
- `TOTAL_GOALS`
- `DOUBLE_CHANCE`
- `BTTS`
- `TOTAL_CORNERS`
- `COMPOSITE`

Unsupported or unsafe automatic settlement resolves to `MANUAL` instead of guessing.

See [docs/market-engine.md](docs/market-engine.md).

## Rendering

The current production export format is:

```text
FEED
1080 x 1350
PNG
```

Rendering uses structured saved bulletin data, frozen snapshots, versioned templates and local assets. Playwright Chromium is used to render and export the final PNG. Historical render records are kept separately, so a new export does not overwrite old render metadata.

The Builder currently exposes three deterministic FEED themes: `LIME`, `ELECTRIC` and `MONO`. Team logo display can be toggled per bulletin; until safe provider asset caching is implemented, missing logos render as deterministic team initials.

Story `1080 x 1920` rendering is future scope.

See [docs/rendering-engine.md](docs/rendering-engine.md).

## Analytics

The Analytics tab summarizes saved local data:

- Bulletin and selection totals.
- GREEN/RED/PENDING/VOID/MANUAL breakdowns.
- Bulletin and selection win rates.
- Settled stake, realized return and realized profit for GREEN/RED/VOID bulletins with valid stake.
- Top markets and competitions by saved selections.

Pending and manual bulletins are excluded from realized financial performance.

## Testing

Common quality commands:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
```

Run the local CI-equivalent gate:

```bash
npm run verify
```

Optional E2E tests:

```bash
npm run test:e2e
```

Ordinary automated tests do not call the real football provider.

## Project Structure

```text
docs/        Product, architecture, data, market, provider and rendering docs
drizzle/     Database migrations
prompts/     Implementation phase prompts
src/domain   Framework-independent domain rules
src/application
             Use cases and service coordination
src/infrastructure
             Database, repositories, providers and rendering adapters
src/presentation
             Fastify API and React web app
```

## CI

GitHub Actions uses `npm ci` and runs formatting, linting, typechecking, tests and build. CI does not require GOAL API credentials.

## Security And Data

Bet Studio is local-first. Application data is stored locally, API credentials stay server-side, `.env` is ignored by git and generated exports/database files are not committed by default.

API errors use a stable envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message"
  }
}
```

## Documentation

- [docs/product-spec.md](docs/product-spec.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/data-model.md](docs/data-model.md)
- [docs/market-engine.md](docs/market-engine.md)
- [docs/rendering-engine.md](docs/rendering-engine.md)
- [docs/api-integration.md](docs/api-integration.md)
- [AGENTS.md](AGENTS.md)

## Future Scope

- Story `1080 x 1920` rendering.
- Additional football providers.
- Additional market families.
- Richer provider statistics when available.
- More template families.

## License

No license has been declared yet.

## Disclaimer

Bet Studio is a content and workflow tool. It does not provide betting advice, predictions or guaranteed outcomes.
