You are implementing Phase 02 of Bet Studio: Database + Domain Models.

Before making changes:

1. Read AGENTS.md.
2. Read docs/architecture.md.
3. Read docs/data-model.md.
4. Read docs/product-spec.md only where needed to understand entity behavior.
5. Inspect the implementation produced in Phase 01.
6. Inspect existing package scripts, TypeScript configuration, tests and conventions.

Do not read market-engine.md, rendering-engine.md or api-integration.md unless a specific data-model dependency requires clarification.

The repository and its documentation are the source of truth.

Do not introduce or reference any project identity other than Bet Studio.

---

## Goal

Implement the persistent data foundation and core domain models required by Bet Studio.

At the end of this phase, the repository should have:

- SQLite persistence configured;
- Drizzle ORM configured;
- versioned database migrations;
- stable internal identifiers;
- domain models for the initial core entities;
- persistence models separated from domain models;
- repository interfaces where they are useful;
- infrastructure repository implementations;
- database constraints and indexes;
- historical snapshot structures required by the documented model;
- deterministic/public bulletin code support;
- database and domain tests;
- seed/bootstrap support only where genuinely useful;
- quality gates passing.

This phase must establish a reliable persistence and domain foundation.

Do not implement complete CRUD screens, provider synchronization, market settlement or rendering yet.

---

# 1. Preserve Existing Foundation

Do not recreate or replace Phase 01 infrastructure unnecessarily.

Preserve:

- package manager;
- Node version;
- project scripts;
- React/Vite setup;
- Fastify setup;
- TypeScript setup;
- ESLint;
- Prettier;
- Vitest;
- Playwright;
- CI.

Add only what Phase 02 requires.

If Drizzle or SQLite dependencies are already present, use them.

If they are not present, add the smallest supported dependency set required for SQLite + Drizzle.

---

# 2. Database Technology

Use:

- SQLite;
- Drizzle ORM;
- Drizzle migrations.

The database is local-first.

Do not introduce:

- PostgreSQL;
- MySQL;
- Prisma;
- remote database services;
- cloud database dependencies.

SQLite is the operational database for v1.

---

# 3. Database Location

Use a configurable local database path.

Provide a sensible development default.

Example conceptually:

BET_STUDIO_DB_PATH=./data/bet-studio.db

Do not hardcode an absolute machine path.

Ensure local database files and SQLite auxiliary files are ignored by Git.

Examples:

*.db
*.db-shm
*.db-wal
*.sqlite
*.sqlite3

Do not ignore migrations.

---

# 4. Environment Configuration

Extend the existing server environment schema only as needed.

Example:

BET_STUDIO_DB_PATH

Use Zod validation through the existing configuration system.

Do not add provider API variables in this phase.

Update `.env.example` accordingly.

---

# 5. Internal IDs

All domain entities must use application-owned immutable internal IDs.

External provider identifiers must never become primary keys.

Choose one consistent ID strategy appropriate for a local TypeScript application.

Preferred characteristics:

- generated locally;
- string-safe;
- globally unique enough for this application;
- not dependent on SQLite row numbers;
- stable across exports/imports.

Examples of acceptable approaches include UUIDs or another well-supported application-generated identifier.

Do not use provider IDs as domain IDs.

Do not expose database autoincrement row IDs as the domain identity if avoidable.

Use one consistent approach unless a documented entity requires otherwise.

---

# 6. Domain vs Persistence Models

Do not use Drizzle table-row types as domain entities throughout the application.

Maintain a useful separation:

Domain Model
↕
Mapper
↕
Persistence Record

Do not create elaborate mapping frameworks.

Simple explicit mapping functions are preferred.

The Domain layer must remain independent from:

- Drizzle;
- SQLite;
- SQL;
- database connection objects.

---

# 7. Initial Domain Entities

Implement the domain models needed by the documented data model.

Initial core entities include:

- Competition
- Team
- TeamAlias
- CompetitionTeam
- Provider
- ProviderReference
- Asset
- Fixture
- FixtureResultDetails
- Market
- Bulletin
- BulletinSelection
- BulletinSelectionSnapshot
- SelectionResultSnapshot
- SettlementOverride
- Template
- TemplateVersion
- RenderRecord
- SyncRecord

Only include `ProviderRateLimitState` if docs/data-model.md still treats it as useful rather than mandatory.

Do not invent unrelated entities.

---

# 8. Keep Domain Models Focused

Do not create rich entity classes with dozens of methods merely because the project uses a Domain layer.

Prefer simple explicit domain types/value objects plus pure behavior where behavior already exists.

Examples:

- ID types;
- enums;
- invariant validation;
- constructors/factories when useful.

Avoid an anemic-vs-rich-domain ideological rewrite.

Use the simplest model that preserves invariants and separation.

---

# 9. Competition

Implement Competition according to docs/data-model.md.

Expected concerns include:

- internal ID;
- name;
- short name where documented;
- region/country information where documented;
- active/archive state;
- timestamps.

Do not add ranking, standings or season logic in this phase.

---

# 10. Team

Implement Team according to docs/data-model.md.

Expected concerns include:

- internal ID;
- canonical name;
- short name where supported;
- local display information;
- active/archive state;
- timestamps.

Do not embed provider-specific IDs directly on Team.

Provider mappings belong to ProviderReference.

---

# 11. TeamAlias

Implement team aliases as separate persistent records.

Aliases support future deterministic provider matching.

Requirements:

- belong to one Team;
- contain normalized/searchable alias data where useful;
- enforce sensible uniqueness to avoid duplicate aliases for the same team;
- preserve original/display alias where appropriate.

Do not implement fuzzy matching in this phase.

---

# 12. CompetitionTeam

Implement competition/team association according to the documented model.

Use an association table/entity rather than embedding competition IDs directly as a single field on Team.

A team may participate in multiple competitions over time.

Do not prematurely model full season-registration history unless docs/data-model.md explicitly requires it.

---

# 13. Provider

Implement local provider metadata.

Provider is application configuration/metadata, not an external SDK object.

It may include:

- internal ID;
- stable code;
- display name;
- enabled state if documented;
- timestamps.

Do not store secrets or API keys in the Provider table.

---

# 14. ProviderReference

Implement provider mappings.

A ProviderReference must associate:

- provider;
- local entity type;
- local entity ID;
- external ID.

Initial entity types should support at least:

- COMPETITION;
- TEAM;
- FIXTURE.

Use constraints/indexes to prevent duplicate mappings.

A local entity may have mappings from multiple providers.

Do not use a single polymorphic foreign key that pretends SQLite can enforce all cross-table references if that produces false safety.

Choose a pragmatic persistence design and document any constraint that must be enforced in application logic.

---

# 15. Asset

Implement Asset for controlled local assets.

Expected use cases include:

- team logos;
- competition logos;
- template assets;
- placeholders;
- branding assets.

Include only fields documented or clearly required, such as:

- internal ID;
- asset type/category;
- local path or storage reference;
- MIME type;
- optional content hash;
- metadata/timestamps.

Important:

historically referenced assets must be compatible with immutable/versioned rendering.

Prefer content-addressed/version-safe semantics over mutable "same path, replaced contents" semantics.

Do not implement remote downloading in this phase.

---

# 16. Fixture

Implement Fixture according to the data model.

Expected concerns include:

- internal ID;
- competition reference where known;
- home team;
- away team;
- kickoff timestamp;
- normalized status;
- result relationship/details;
- timestamps.

Supported fixture statuses:

SCHEDULED
LIVE
FINISHED
POSTPONED
CANCELLED
ABANDONED
UNKNOWN

Enforce obvious invariants, including:

- home and away team cannot be the same;
- score/corner values must not be negative;
- canonical timestamps stored consistently.

Do not implement provider synchronization.

---

# 17. FixtureResultDetails

Implement structured result details.

At minimum include:

- homeScore
- awayScore
- halfTimeHomeScore where documented
- halfTimeAwayScore where documented
- homeCorners
- awayCorners

Do not use a generic `extraData` JSON field as the primary place for current required market data.

Structured fields should exist for data already required by the product.

Optional future statistics do not need dedicated columns yet.

Scores and corners must be nullable because data may be incomplete.

Validate non-negative integer values when present.

---

# 18. Market

Implement Market persistence according to the updated model.

Expected fields include:

- internal ID;
- code;
- name/display label;
- optional category;
- active state;
- autoEvaluable;
- evaluatorKey;
- parameters;
- timestamps.

Important:

`parameters` must exist.

Persist parameter configuration in a structured form appropriate for SQLite, such as validated JSON.

At the persistence boundary it may be represented as unknown/JSON, but do not spread unchecked `unknown` throughout application/domain code.

Do not implement Market Engine evaluation in this phase.

Do not infer logic from market names.

Ensure market `code` is unique and stable.

---

# 19. Market Parameters

For now, persist structured parameters safely.

Do not yet implement full evaluator-specific runtime behavior.

It is acceptable to define persistence-safe parameter types and basic schemas if docs/data-model.md requires them.

Avoid duplicating the entire market-engine implementation before Phase 05.

The important Phase 02 requirement is:

Market can store stable evaluator configuration.

---

# 20. Bulletin

Implement the Bulletin aggregate persistence/domain foundation.

Expected fields include:

- internal ID;
- public code;
- type;
- mode;
- calculated/effective status representation according to docs;
- optional stake;
- optional total odd if persisted;
- display configuration/toggles;
- selected template/version references where appropriate;
- timestamps.

Supported types:

SINGLE
MULTI

Supported modes:

PRE_MATCH
LIVE

Supported statuses:

PENDING
GREEN
RED
VOID
MANUAL

Do not implement complete bulletin-building use cases yet.

---

# 21. Bulletin Public Code

Use the project-neutral public identifier format documented after the branding cleanup.

Use:

BET #0001

or the exact neutral format currently present in the latest docs.

Do not reintroduce any previous branding prefix.

Requirements:

- human readable;
- unique;
- sequential or deterministic according to docs;
- generated safely under SQLite transactions where necessary.

Keep internal ID and public code separate.

Do not use public code as the primary key.

If exact code-generation behavior is not fully specified in docs/data-model.md, implement the simplest safe local sequential approach and document it.

---

# 22. Bulletin Selection Count

Enforce documented selection constraints at domain/application boundaries.

Valid count:

1..10

SINGLE must contain exactly:

1 selection

MULTI may contain:

2..10 selections

If the existing product specification permits a different transitional creation state, follow the docs.

Do not weaken final saved-bulletin invariants merely to simplify persistence.

---

# 23. Odds

Odds must be persisted using a decimal-safe representation.

Do not use JavaScript floating-point arithmetic as the canonical storage behavior.

Use one consistent strategy, for example:

- decimal string;
- scaled integer;
- another explicitly safe representation supported by the chosen implementation.

The database representation must round-trip without unexpected binary floating-point changes.

Do not implement complex financial/accounting infrastructure.

---

# 24. Stake

Stake, if persisted, must also use decimal-safe representation.

Keep currency/payment systems out of scope.

Stake here is bulletin metadata, not a wallet or transaction system.

---

# 25. Total Odd

If total odd is persisted, ensure its representation is decimal-safe.

If the current docs define it as derived rather than authoritative, follow that rule.

Do not implement market arithmetic beyond what is needed to persist or validate the value.

If the documentation leaves this unresolved, prefer avoiding duplicated sources of truth and note the decision in the completion report.

---

# 26. Bulletin Status

Inspect docs/data-model.md carefully.

Avoid introducing stale duplicated status if the documented design now prefers deriving aggregate bulletin status from selections.

If persisted status is treated as a materialized/cache field, updates must eventually be transactional with selection updates.

For Phase 02, prefer the simplest correct model consistent with the docs.

Do not create two conflicting authoritative status representations.

---

# 27. BulletinSelection

Implement selection persistence.

Expected concerns include:

- internal ID;
- bulletin ID;
- position;
- fixture reference where applicable;
- market reference;
- odd;
- calculated status;
- manual/effective settlement relationship as documented;
- timestamps.

Position must be deterministic.

Enforce uniqueness:

bulletin + position

Selection order must never depend on database row order.

---

# 28. BulletinSelectionSnapshot

Implement immutable historical snapshot support.

The snapshot should preserve enough display/business context to reconstruct the selection as it existed when saved/rendered.

Follow docs/data-model.md.

Expected examples may include:

- team names;
- team short names;
- competition name;
- market label;
- market code/config;
- odd;
- referenced asset versions/IDs.

Do not fetch current catalog values during historical reconstruction when snapshot values exist.

Do not duplicate arbitrary entire database records as opaque blobs if structured snapshot fields are documented.

---

# 29. Historical Asset Integrity

If a snapshot references an asset, that reference must remain historically stable.

Use one of the documented safe approaches, such as:

- immutable asset record;
- versioned asset record;
- content hash/content-addressed asset.

Do not rely on a mutable file path whose contents can be replaced later without creating a new historical version.

---

# 30. SelectionResultSnapshot

Implement historical result snapshot persistence.

Follow docs/data-model.md.

Expected concerns include:

- selection reference;
- calculated/effective result state;
- score/result data relevant at evaluation time;
- evaluator metadata where documented;
- timestamps/versioning.

Do not implement evaluation logic itself.

The data model should be capable of storing the result produced later by the Market Engine.

---

# 31. SettlementOverride

Implement manual settlement override persistence.

Manual override history must remain distinguishable from automatic calculation.

Requirements:

- selection association;
- manual status;
- optional reason;
- created timestamp;
- clear/revert semantics according to docs.

Do not overwrite calculated settlement fields when a manual override is created.

If docs/data-model.md leaves "latest active override" semantics ambiguous, choose the simplest auditable model:

append-only override history with an explicit clear/reset action represented in data

or another equally clear approach.

Do not silently mutate or delete previous override history merely to reset to automatic.

---

# 32. Template

Implement Template as the logical template identity.

Keep it separate from TemplateVersion.

Examples conceptually:

Template
code = BETSTUDIO_FEED

TemplateVersion
version = 1

Do not implement rendering behavior in Phase 02.

---

# 33. TemplateVersion

Template versions must support historical immutability.

Expected concerns:

- template ID;
- version number;
- format;
- configuration;
- asset references;
- timestamps.

Once referenced historically, a version should not be destructively mutated through normal application workflows.

Use a uniqueness constraint such as:

template + version

Persist configuration in a validated structured form suitable for later renderer consumption.

Do not build the full rendering configuration engine yet.

---

# 34. RenderRecord

Implement RenderRecord persistence.

Expected metadata includes:

- bulletin;
- template/version;
- output format;
- output path/reference;
- created timestamp;
- render config/hash metadata where documented.

Do not render actual images in this phase.

RenderRecord should be capable of recording future successful exports.

---

# 35. SyncRecord

Implement SyncRecord persistence for future provider synchronization.

Expected metadata includes:

- provider;
- resource/scope;
- started time;
- completed time;
- status;
- record counts;
- sanitized error/warning metadata.

Do not implement synchronization logic yet.

Supported status may include:

SUCCESS
PARTIAL
FAILED

as documented.

Do not store secrets or full raw HTTP payload dumps.

---

# 36. Timestamps

Store canonical timestamps consistently.

Use UTC internally.

Prefer one database representation throughout the schema.

Do not mix arbitrary locale-formatted date strings with canonical persistence timestamps.

Presentation formatting belongs outside persistence.

---

# 37. Archive / Deactivate

Historical entities should generally be deactivated/archived rather than destructively removed when deletion would break history.

Follow docs/data-model.md.

Use fields such as:

active
archivedAt

only where the model actually requires them.

Do not add both to every table without reason.

---

# 38. Foreign Keys

Enable SQLite foreign-key enforcement.

Use real foreign keys where the relational model supports them.

Define appropriate cascading behavior deliberately.

Avoid broad `ON DELETE CASCADE` on historical records where deletion would destroy auditability.

Prefer restrictive behavior for historically important entities unless docs explicitly require cascade.

Join/child records that have no meaning without their parent may use cascade when safe.

---

# 39. Constraints

Use database constraints where they provide real integrity.

Examples:

- unique market code;
- unique bulletin public code;
- unique provider code;
- unique template code;
- unique template/version;
- unique bulletin selection position;
- non-negative numeric fields where practical;
- valid association uniqueness.

Do not rely only on frontend validation.

Do not attempt to encode every domain rule into SQL if application/domain validation is clearer.

---

# 40. Indexes

Add indexes for obvious expected access patterns documented in the model.

Examples may include:

- provider reference lookup;
- fixture kickoff;
- fixture status;
- competition/team associations;
- bulletin created time;
- bulletin public code;
- selection bulletin/position;
- sync records by provider/date.

Do not create speculative indexes for hypothetical analytics.

---

# 41. JSON Columns

SQLite JSON/text storage may be used for structured configurable fields such as:

- market parameters;
- template configuration;
- display configuration;
- sanitized sync metadata.

Requirements:

- validate on read/write at boundaries;
- do not spread raw unvalidated JSON into domain logic;
- keep query-critical relational fields as real columns.

Do not store entire relational entities as giant JSON documents.

---

# 42. Schema Organization

Organize Drizzle schema files by cohesive domain area where useful.

Avoid both extremes:

- one enormous schema file;
- dozens of tiny files containing one trivial column definition.

Choose a structure that is easy to navigate.

---

# 43. Migrations

Create the initial real database migration.

The migration must establish the schema required by this phase.

Requirements:

- generated/versioned consistently;
- committed;
- reproducible from an empty database;
- non-interactive in CI/tests.

Do not edit migration history manually after generation unless technically necessary and reviewed.

Do not use runtime push/sync as the canonical production migration approach.

---

# 44. Database Bootstrap

Provide a small infrastructure module for:

- opening the SQLite database;
- enabling foreign keys;
- constructing Drizzle;
- closing resources where necessary.

Avoid a global hidden singleton if the existing architecture/testing approach benefits from dependency injection.

Prefer explicit construction in composition/bootstrap code.

---

# 45. Test Database

Tests must not use the developer's normal local database file.

Use isolated test databases.

Acceptable strategies:

- temporary SQLite files;
- in-memory SQLite where fully compatible with the chosen driver/migration flow.

Each test or test suite should have deterministic setup/cleanup.

Do not depend on test execution order.

---

# 46. Repository Interfaces

Create repository interfaces only where application/domain boundaries need them in the foreseeable next phases.

Likely useful repositories include:

- CompetitionRepository
- TeamRepository
- MarketRepository
- FixtureRepository
- BulletinRepository

Potentially others where required by snapshots/templates.

Do not create a repository abstraction for every table automatically.

Association/history tables may be handled through aggregate-oriented repositories or focused persistence services.

Follow the simplest boundary consistent with architecture.md.

---

# 47. Repository Implementations

Infrastructure repositories should use Drizzle.

At minimum, implement enough operations to prove the persistence architecture.

Examples:

- create;
- get by internal ID;
- basic list;
- update where appropriate;
- existence/lookup by stable code.

Do not implement full user-facing CRUD use cases or API routes.

Repository methods should return domain/application models, not raw Drizzle records.

---

# 48. Aggregate Persistence

Where Bulletin is treated as an aggregate, prefer coherent aggregate persistence rather than requiring callers to manually orchestrate many table writes.

For example, later saving a bulletin should be capable of atomically persisting:

- bulletin;
- selections;
- relevant snapshots.

Do not fully implement builder workflows yet, but design repository boundaries so transactional aggregate persistence remains possible.

Avoid generic CRUD repositories that make aggregate consistency harder.

---

# 49. Transactions

Use transactions for operations that must remain consistent.

Examples:

- bulletin + selections + snapshots;
- entity + provider reference;
- public-code sequence allocation where needed.

Do not hold transactions open around UI or network operations.

This phase contains no provider HTTP calls.

---

# 50. Public Code Sequence Safety

If bulletin public codes use sequential numbering, make the allocation safe under SQLite transactions.

Avoid:

SELECT MAX(code) + 1

without appropriate transactional protection if concurrent writes could duplicate identifiers.

A dedicated sequence/counter table is acceptable if it remains simple.

Do not use a complex distributed ID service.

---

# 51. Seeds

Do not create large fake datasets.

A minimal seed may be useful for stable built-in configuration, such as:

- initial provider metadata;
- initial template logical entry;

only if documentation requires it now.

Do not seed betting markets in this phase if their definitive catalog belongs to the Market Engine/CRUD phase and would duplicate future work.

If no seed is needed, do not create one merely for demonstration.

---

# 52. Domain Validation

Add domain-level validation for invariants that are already clearly specified.

Examples:

- valid selection count;
- SINGLE/MULTI constraints;
- team cannot play itself;
- non-negative score/corners;
- stable non-empty codes;
- valid statuses;
- decimal-safe odd format.

Use factories/schema helpers where they simplify correctness.

Do not duplicate Zod schemas everywhere.

---

# 53. Decimal Representation Tests

Add tests proving decimal values round-trip through persistence unchanged.

Examples:

1.10
1.55
2.10
12.50

If stored as strings, ensure trailing semantic precision behavior is deliberate.

Document whether canonical values normalize:

2.10 → "2.10"

or:

2.10 → "2.1"

Prefer a representation suitable for display/business rules without accidental ambiguity.

---

# 54. Migration Tests

At minimum verify that:

- a fresh database can apply all migrations;
- foreign keys are enabled;
- core tables exist;
- key constraints behave as expected.

Do not depend solely on TypeScript compilation as database validation.

---

# 55. Repository Tests

Add focused integration tests for repository behavior.

High-value examples:

- create/read competition;
- create/read team and alias;
- fixture with result details round-trip;
- market parameters round-trip;
- bulletin with ordered selections round-trip;
- unique market code enforcement;
- unique bulletin public code enforcement;
- provider mapping uniqueness;
- historical snapshot persistence;
- manual override history persistence.

Do not exhaustively test Drizzle itself.

---

# 56. Historical Integrity Tests

Add tests demonstrating that a historical snapshot is independent of later catalog changes.

Conceptual test:

1. create Team named "Original Name";
2. create a bulletin snapshot storing that name;
3. rename current Team to "New Name";
4. reload historical bulletin snapshot;
5. snapshot still returns "Original Name".

Likewise, where practical test stable historical asset reference semantics.

This is a core product invariant.

---

# 57. No Market Settlement Yet

Do not implement:

- MATCH_RESULT evaluation;
- TOTAL_GOALS evaluation;
- DOUBLE_CHANCE evaluation;
- BTTS evaluation;
- TOTAL_CORNERS evaluation;
- COMPOSITE evaluation;
- bulletin aggregate settlement logic beyond basic structural status representation.

Those belong to the Market Engine phase.

This phase only creates data structures capable of supporting them.

---

# 58. No Provider Integration Yet

Do not implement:

- GOAL API;
- football-data.org;
- OpenFootball;
- TheSportsDB;
- HTTP provider clients;
- external synchronization.

Provider and ProviderReference persistence may exist because they are part of the data model.

Actual external integration belongs to a later phase.

---

# 59. No Rendering Yet

Do not implement:

- SVG renderer;
- HTML screenshot renderer;
- image export;
- text fitting;
- template layout engine.

Template/TemplateVersion/RenderRecord persistence may exist because they are part of the data model.

Actual rendering belongs to a later phase.

---

# 60. No Full CRUD UI/API Yet

Do not build complete management screens or REST CRUD endpoints in this phase.

A minimal internal/dev route is not needed merely to prove database access.

Prefer integration tests to prove persistence.

CRUD application/API behavior belongs to Phase 03.

---

# 61. Fastify Integration

Only integrate database lifecycle into Fastify bootstrap if useful and clean.

Examples:

- create DB connection during application composition;
- close DB on shutdown if driver requires it.

Do not expose database objects globally through route handlers.

Do not add product routes yet.

---

# 62. Dependency Direction Verification

Ensure Domain contains no imports from:

- infrastructure;
- Drizzle;
- SQLite;
- Fastify;
- React.

If useful, add a lightweight architecture test or lint rule only if it can be implemented simply.

Do not add a heavyweight architecture-analysis framework for this purpose.

---

# 63. Error Handling

Use existing project error conventions.

Persistence errors should not leak raw SQLite messages to future presentation code.

However, do not wrap every single Drizzle error in unnecessary boilerplate.

Translate errors where the application needs stable semantics, especially:

- not found;
- conflict/uniqueness;
- persistence failure.

Keep useful original error causes internally.

---

# 64. README

Update README.md only where Phase 02 changes actual development usage.

Examples:

- database path variable;
- migration command;
- database setup command;
- test information.

Do not rewrite unrelated sections.

Remove any old placeholder that is now resolved.

Ensure only Bet Studio identity is used.

---

# 65. Documentation Consistency

If implementation reveals a small factual mismatch in docs/data-model.md, fix the relevant documentation as part of this phase only when the intended behavior is already clear.

Known items to verify include:

- `FixtureResultDetails` includes `homeCorners` and `awayCorners`;
- `Market` includes `parameters`;
- bulletin public code uses the current Bet Studio-neutral format;
- historical asset references are immutable/version-safe.

Do not silently make material product decisions that are still ambiguous.

Report such ambiguities instead.

---

# 66. Quality Gates

Before finishing, run the repository's actual relevant commands.

At minimum:

- format/check;
- lint;
- typecheck;
- tests;
- build.

Also run:

- migration generation/check as appropriate;
- fresh database migration test.

Use only scripts that actually exist or add clear scripts where needed.

Do not claim success without execution.

---

# 67. Git Diff Review

Before completion:

- inspect changed files;
- ensure no local database was committed;
- ensure no `.env` was committed;
- ensure no generated test DB was committed;
- ensure migration files are committed;
- ensure lockfile changes are intentional;
- ensure no unrelated formatting noise exists;
- ensure no provider or rendering implementation slipped into scope.

---

# 68. Completion Report

At the end, report concisely:

1. Database architecture implemented.
2. Main domain models added.
3. Main schema/migration decisions.
4. Internal ID strategy chosen.
5. Decimal representation chosen.
6. Bulletin public-code strategy chosen.
7. Repository boundaries implemented.
8. Tests added.
9. Exact quality/migration commands run and results.
10. Any documented decision that remained unresolved.

Do not provide a long file-by-file narrative.

Do not commit or push unless explicitly requested.
