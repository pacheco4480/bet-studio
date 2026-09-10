# Bet Studio

Bet Studio is a local-first application for creating, managing, evaluating and rendering professional football betting bulletins for social media.

It combines structured football data, deterministic market settlement, versioned visual templates and local persistence into a reproducible content-production workflow.

Instead of relying on manually edited graphics or AI-generated layouts, Bet Studio represents bulletins as structured data and generates their visual output through explicit, deterministic rendering rules.

---

## Project Status

Bet Studio is currently under active development.

The initial scope includes:

- Local-first operation.
- Football competition and team management.
- Market catalog management.
- PRE_MATCH and LIVE bulletins.
- SINGLE and MULTI bulletins.
- Up to 10 selections per bulletin.
- Automatic settlement for supported betting markets.
- Manual settlement overrides.
- Deterministic social-media rendering.
- Bulletin history and re-rendering.
- Optional football-data provider synchronization.

The first target export format is:

```text
1080 × 1350 px
Instagram Feed
4:5
```

A 1080 × 1920 Story format is planned as a future extension.

---

## Why Bet Studio?

Sports betting content workflows often depend on manually edited graphics, repeated copy/paste and fragmented data.

That creates problems such as:

- inconsistent layouts;
- duplicated design files;
- repeated manual work;
- difficult result updates;
- inconsistent market formatting;
- irreversible visual changes;
- limited historical reproducibility;
- external APIs becoming tightly coupled to the workflow.

Bet Studio approaches the problem as a deterministic publishing system.

Conceptually:

```text
Structured Bulletin Data
        +
Market Definitions
        +
Fixture Results
        +
Template Version
        +
Local Assets
        ↓
Deterministic Render
```

A bulletin can therefore be created, updated, evaluated and re-rendered without manually rebuilding the graphic.

---

## Core Features

### Bulletin Builder

Create football betting bulletins using:

- SINGLE or MULTI type;
- PRE_MATCH or LIVE mode;
- 1 to 10 selections;
- home and away teams;
- team logos;
- betting market;
- selection odd;
- total odd;
- optional competition;
- optional date and time;
- optional stake;
- result and status information.

Each bulletin receives a stable human-readable identifier such as:

```text
BET #0001
```

---

### Deterministic Rendering

Bet Studio generates social-media graphics from structured bulletin data.

The renderer is designed around:

- fixed output dimensions;
- adaptive density for 1–10 selections;
- independent team-name fitting;
- independent market-text fitting;
- stable status regions;
- local assets;
- explicit layout rules;
- versioned templates;
- deterministic fallback behavior.

The same render input and template version should produce the same layout.

Production rendering does not depend on generative AI.

---

### Market Engine

Bet Studio includes a deterministic domain engine for evaluating supported football betting markets.

Initial evaluator families:

```text
MATCH_RESULT
TOTAL_GOALS
DOUBLE_CHANCE
BTTS
TOTAL_CORNERS
COMPOSITE
```

The initial market catalog supports:

- Match Result;
- Total Goals Over/Under;
- Double Chance;
- Both Teams To Score;
- Total Corners Over/Under;
- Both Teams To Score OR Over 2.5 Goals;
- Match Result AND Over 1.5 Goals;
- Match Result AND Over 2.5 Goals;
- Match Result AND Over 3.5 Goals;
- Both Teams To Score AND Over 2.5 Goals;
- Both Teams To Score AND Over 3.5 Goals.

The engine operates on stable market codes and validated parameters.

It never determines settlement from display labels or natural-language interpretation.

When automatic settlement cannot be performed safely:

```text
MANUAL
```

is preferred over guessing.

---

## Settlement States

Selections and bulletins may use:

```text
PENDING
GREEN
RED
VOID
MANUAL
```

Automatic calculation and manual overrides remain separate.

Conceptually:

```text
effectiveStatus =
  manualStatus ?? calculatedStatus
```

This allows a fixture to be re-evaluated automatically without silently destroying an intentional manual correction.

---

## Composite Markets

Bet Studio supports reusable compound-market evaluation through deterministic composition.

Supported operators:

```text
AND
OR
```

For example:

```text
MATCH_RESULT
+
TOTAL_GOALS
```

can represent:

```text
Home Win AND Over 2.5 Goals
```

while:

```text
BTTS
+
TOTAL_GOALS
```

can represent:

```text
Both Teams To Score OR Over 2.5 Goals
```

Composite markets reuse existing evaluator logic instead of duplicating settlement rules.

---

## Historical Integrity

Historical bulletins are designed to remain reproducible.

A saved bulletin can preserve the relevant historical state, including:

- team names;
- team assets;
- competition information;
- market label;
- odds;
- result data;
- settlement information;
- evaluator version;
- template version;
- render configuration.

Changes to current catalog data should not silently alter historical bulletins.

Likewise, a future visual redesign should not destructively modify the template version used by an existing historical render.

---

## Local-First

Bet Studio is designed to remain useful without external services.

Core workflows should continue to work offline:

- competition management;
- team management;
- market management;
- manual fixture creation;
- manual score entry;
- manual corner entry;
- bulletin creation;
- market settlement;
- manual settlement;
- history;
- rendering;
- export.

External football APIs enhance the application through synchronization.

They are not the operational source of truth.

---

## Football Data Integration

Bet Studio uses a provider-independent integration architecture.

Conceptually:

```text
External Provider
       ↓
Provider Adapter
       ↓
Normalized External Data
       ↓
Synchronization Service
       ↓
Local Database
```

Provider-specific response formats remain isolated inside infrastructure adapters.

A provider may be used only for capabilities it actually supports.

For example:

```text
Provider A → fixtures and results
Provider B → team artwork
Provider C → match statistics
```

This prevents the application from depending on one provider for every type of football data.

Manual entry remains available when external data is missing or unavailable.

---

## Local Data Ownership

The local database is the application's operational source of truth.

External provider IDs are stored as references rather than domain identities.

Conceptually:

```text
Provider External ID
        ↓
ProviderReference
        ↓
Bet Studio Internal ID
```

A team, competition or fixture may therefore be associated with multiple external providers while retaining one stable internal identity.

---

## Technology Stack

Initial stack:

```text
TypeScript
React
Vite
Tailwind CSS

Node.js
Fastify

SQLite
Drizzle ORM
Zod

Vitest
Playwright

ESLint
Prettier
GitHub Actions
```

The rendering technology is selected according to deterministic output, typography reliability, local asset support, testability and exact export requirements.

---

## Architecture

Bet Studio follows a layered architecture:

```text
Presentation
     ↓
Application
     ↓
Domain
     ↑
Infrastructure
```

### Domain

Contains business rules and invariants.

Examples:

- market settlement;
- composite-market evaluation;
- bulletin status calculation;
- domain validation.

The Domain layer remains independent from infrastructure frameworks.

It must not directly depend on:

- React;
- Fastify;
- Drizzle;
- SQLite;
- HTTP clients;
- football providers;
- rendering libraries.

### Application

Coordinates use cases.

Examples:

- creating a bulletin;
- updating a bulletin;
- evaluating selections;
- synchronizing fixtures;
- requesting a render.

### Infrastructure

Implements technical adapters.

Examples:

- SQLite persistence;
- Drizzle repositories;
- football-data providers;
- asset storage;
- rendering implementation.

### Presentation

Handles user-facing boundaries.

Examples:

- React UI;
- Fastify routes;
- request/response handling;
- form interaction.

---

## Project Structure

The project is expected to evolve around a structure similar to:

```text
src/
├── domain/
│   ├── bulletin/
│   ├── competition/
│   ├── fixture/
│   ├── market/
│   └── team/
│
├── application/
│   ├── bulletins/
│   ├── competitions/
│   ├── fixtures/
│   ├── markets/
│   ├── rendering/
│   └── synchronization/
│
├── infrastructure/
│   ├── database/
│   ├── providers/
│   ├── rendering/
│   └── storage/
│
├── presentation/
│   ├── api/
│   └── web/
│
└── shared/
    ├── errors/
    ├── types/
    └── validation/
```

The final structure may be simplified where doing so improves clarity.

Architecture exists to enforce useful boundaries, not to maximize the number of layers or files.

---

## Documentation

Detailed engineering decisions live in:

```text
AGENTS.md

docs/
├── architecture.md
├── product-spec.md
├── data-model.md
├── market-engine.md
├── rendering-engine.md
└── api-integration.md
```

### `product-spec.md`

Defines:

```text
product behavior
functional requirements
user-visible rules
product constraints
```

### `architecture.md`

Defines:

```text
system structure
dependency boundaries
technical principles
```

### `data-model.md`

Defines:

```text
persistent entities
relationships
snapshots
historical-data strategy
```

### `market-engine.md`

Defines:

```text
market settlement
evaluator families
composite markets
settlement behavior
```

### `rendering-engine.md`

Defines:

```text
deterministic rendering
layout rules
templates
text fitting
asset behavior
```

### `api-integration.md`

Defines:

```text
provider adapters
normalization
synchronization
capabilities
failure behavior
```

### `AGENTS.md`

Defines:

```text
repository rules for AI coding agents
implementation discipline
quality requirements
```

---

## Development

### Requirements

Expected development requirements:

```text
Node.js 22 LTS
npm
Git
```

The project currently targets Node.js 22.

---

### Installation

```bash
npm install
```

---

### Environment

Copy:

```text
.env.example
```

to:

```text
.env
```

and configure only the integrations you intend to use.

The Phase 01 foundation only uses:

```text
NODE_ENV
API_HOST
API_PORT
```

External providers are optional and will be configured in later phases.
Bet Studio should remain operational without football API credentials.

Never commit:

```text
.env
```

---

### Database

Bet Studio uses SQLite for local persistence.

Database schema changes are managed through migrations.

Development and migration commands will be documented once the database tooling has been initialized.

---

### Development Server

```bash
npm run dev
```

This starts the Fastify API and Vite frontend together.

The API health endpoint is available at:

```text
GET /api/health
```

---

### Quality Gates

The project currently provides:

```bash
npm run format
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

Playwright browser binaries may need to be installed locally before running E2E tests:

```bash
npx playwright install
```

---

## Testing Strategy

Use the lowest-cost test level that reliably validates the required behavior.

### Unit Tests

Primary use cases include:

- market evaluators;
- composite AND/OR behavior;
- bulletin status aggregation;
- validation;
- text fitting;
- layout calculations.

### Integration Tests

Primary use cases include:

- repositories;
- database behavior;
- synchronization services;
- provider adapters;
- rendering pipeline.

### End-to-End Tests

E2E tests should cover a limited number of important user workflows.

Domain behavior should not be tested exclusively through browser automation.

---

## Market Engine Testing

Every automatically evaluated market family requires deterministic unit tests.

Tests should cover:

```text
GREEN
RED
PENDING
VOID where relevant
MANUAL fallback
missing data
invalid parameters
boundary values
```

Composite markets require dedicated AND/OR tests.

Table-driven tests are preferred when they make settlement rules easier to inspect.

---

## Rendering Tests

Important renderer scenarios include:

```text
1 selection
3 selections
6 selections
8 selections
10 selections
```

Test difficult content such as:

```text
long team names
long market labels
missing logos
large odds
LIVE 90+4'
PENDING
GREEN
RED
VOID
MANUAL
```

Important invariants include:

- exact canvas dimensions;
- no card overlap;
- no mandatory text overflow;
- stable status regions;
- preserved logo aspect ratios;
- deterministic layout selection.

A small curated set of visual regression tests may complement geometry tests.

---

## External API Testing

Normal automated tests and CI must not call live football APIs.

Provider adapters should instead use:

```text
small stored response fixtures
mocks
normalization tests
contract tests
```

This prevents:

- quota consumption;
- flaky CI;
- provider outages affecting builds;
- external credentials being required in CI.

Optional real-provider integration tests may be executed explicitly during local development.

---

## Rendering

The first production output target is:

```text
1080 × 1350 px
PNG
```

Rendering is based on:

```text
structured render model
+
versioned template
+
local assets
+
explicit layout rules
+
deterministic text fitting
```

The preview and final export should share the same core layout logic.

Preview scaling must not create a separate approximation of the production layout.

---

## Adaptive Layout

The initial renderer supports between 1 and 10 selections.

Conceptual density modes:

```text
1       → HERO
2–3     → LARGE
4–6     → MEDIUM
7–8     → COMPACT
9–10    → ULTRA_COMPACT
```

The renderer chooses a predefined deterministic mode rather than inventing a new layout for each bulletin.

As density increases, the renderer may reduce:

- spacing;
- logo size;
- typography size;
- decorative whitespace.

It must preserve:

- team identity;
- market;
- odd;
- status;
- legibility.

---

## Template Versioning

Templates are versioned.

Example:

```text
BETSTUDIO_FEED
v1
```

A later redesign may introduce:

```text
BETSTUDIO_FEED
v2
```

Existing historical bulletins may remain associated with v1.

Used historical template versions should not be destructively modified.

---

## Assets

Rendering uses controlled local assets.

Examples:

```text
branding
team logos
competition logos
icons
textures
template graphics
placeholders
```

Remote provider artwork should be downloaded, validated and stored locally before being used by the renderer.

Rendering must not depend on live external image URLs.

Historically significant assets should not be overwritten in a way that breaks deterministic re-rendering.

---

## Security

Core security rules include:

- API credentials remain server-side.
- `.env` is not committed.
- External responses are treated as untrusted input.
- Provider data is validated before persistence.
- Remote image downloads are validated.
- Raw infrastructure errors are not exposed directly to users.
- TLS verification remains enabled.
- Provider failures do not destroy valid local data.
- Arbitrary executable market rules are not accepted.

---

## Design Direction

The initial visual system follows a modern premium football analytics and sports-editorial direction.

The intended characteristics include:

- dark / near-black foundation;
- high-contrast typography;
- restrained accent colors;
- clear information hierarchy;
- strong match identity;
- compact but readable statistics;
- controlled status treatments;
- consistent spacing;
- professional social-media output.

Visual design should support the content rather than overpower it.

Exact colors, typography and layout values belong to versioned template configuration.

---

## Non-Goals for V1

Bet Studio is intentionally not intended to be:

- a sportsbook;
- a bookmaker;
- a bet-placement platform;
- a gambling payment service;
- a public social network;
- a multi-user SaaS platform.

Version 1 does not require:

```text
authentication
cloud database
Redis
queues
microservices
Kubernetes
payments
social-media auto-publishing
```

The objective is a focused, reliable local application.

---

## Engineering Principles

Bet Studio prioritizes:

```text
1. Correctness
2. Determinism
3. Domain integrity
4. Simplicity
5. Testability
6. Maintainability
7. Performance
8. Future extensibility
```

Prefer:

```text
clear business rules
+
small cohesive modules
+
explicit contracts
+
automated tests
+
safe fallbacks
```

over:

```text
speculative abstractions
+
unnecessary infrastructure
+
hidden behavior
```

---

## AI-Assisted Development

Bet Studio uses AI-assisted development workflows while keeping durable project knowledge inside the repository.

Coding agents are expected to:

- read `AGENTS.md`;
- consult only documentation relevant to the current task;
- inspect existing implementation before editing;
- make the smallest coherent change;
- preserve architectural boundaries;
- add or update appropriate tests;
- run relevant quality gates;
- inspect the resulting diff;
- avoid unrelated refactoring;
- report specification conflicts rather than inventing behavior.

AI may assist software development.

Runtime product correctness must remain deterministic.

AI is not used to determine:

- football results;
- market settlement;
- bulletin status;
- layout geometry;
- historical state.

---

## Development Roadmap

Initial implementation phases:

```text
1. Foundation and Architecture

2. Database and Domain Models

3. Competitions / Teams / Markets CRUD

4. Football Provider Architecture

5. Market Evaluation Engine

6. Bulletin Builder

7. Deterministic Rendering Engine

8. History and Result Management

9. Tests / Security / Error Handling

10. UX Polish / Documentation / Final Audit
```

Each phase should leave the repository in a stable and testable state.

---

## Screenshots

Application screenshots and production-quality bulletin examples will be added once the corresponding UI and rendering stages are complete.

Future examples may include:

```text
Dashboard
Competition Management
Team Management
Market Management
Bulletin Builder
Single Bulletin
Multi Bulletin
10-Selection Bulletin
Live Bulletin
Settled Bulletin
History
```

---

## Future Possibilities

Potential later extensions include:

- 1080 × 1920 Story rendering;
- additional template families;
- additional football providers;
- additional automatically evaluated markets;
- half-time markets;
- card markets;
- team corner markets;
- richer LIVE workflows;
- template customization;
- additional export formats.

Future functionality should preserve the project's core principles:

```text
local-first
deterministic
provider-independent
historically reproducible
```

---

## License

The project license will be defined before public distribution.

Third-party football data, club logos, competition logos, trademarks and other external assets remain subject to their respective licenses and rights holders.

The repository's software license does not automatically grant rights to third-party sports data or branding.

---

## Disclaimer

Bet Studio is a content creation and sports-data workflow application.

It does not place bets, accept wagers or provide bookmaker services.

External football data may contain delays, omissions or errors. Manual review and correction remain supported where accuracy is important.
