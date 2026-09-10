You are implementing Phase 04 of Bet Studio:

Football Provider Architecture + GOAL API

Before making changes:

1. Read AGENTS.md.
2. Read docs/architecture.md.
3. Read docs/api-integration.md.
4. Read docs/data-model.md only for Provider, ProviderReference, Competition, Team, Fixture, FixtureResultDetails, Asset and SyncRecord.
5. Read docs/product-spec.md only for workflows affected by external football data.
6. Inspect the implementation from Phases 01–03.
7. Inspect existing domain models, repositories, application services, API routes, UI conventions, environment handling and tests.

Do not read rendering-engine.md.

Read market-engine.md only if needed to confirm exactly which fixture result/statistic fields must eventually be synchronized.

The repository and documentation are the source of truth.

Do not introduce or reference any project identity other than Bet Studio.

---

# Goal

Implement the first real external football-data integration for Bet Studio using GOAL API while preserving local-first behavior.

At the end of this phase, Bet Studio should have:

- a small provider abstraction;
- a GOAL API infrastructure adapter;
- normalized provider-independent external football models;
- provider capability metadata;
- synchronization application services;
- persistent ProviderReference mappings;
- safe competition/team/fixture synchronization;
- result synchronization where supported;
- corner/statistics synchronization only if actually supported by the verified GOAL API contract;
- manual refresh through the application;
- synchronization status/error feedback;
- last-sync metadata;
- offline/local fallback behavior;
- provider adapter tests using stored fixtures/mocks;
- no live external calls in normal automated tests or CI.

This phase must prove the provider boundary with one real integration.

Do not build a speculative provider framework for providers that are not implemented yet.

---

# 1. Verify GOAL API Before Implementing

Do not assume the GOAL API contract from memory, previous prompts or undocumented examples.

Before writing the real adapter, inspect the current official GOAL API documentation available to the development environment.

Verify at least:

- base URL;
- authentication mechanism;
- competition endpoints;
- team endpoints;
- fixture/match endpoints;
- fixture result fields;
- fixture status values;
- pagination behavior;
- date/range filters;
- rate-limit information if documented;
- error response structure;
- statistics support;
- corner statistics support;
- team logo support;
- competition logo support.

Do not invent unsupported endpoints or fields.

Do not hardcode quota numbers unless confirmed by current provider documentation.

If official documentation is unavailable or materially incomplete:

- do not guess;
- implement the provider boundary and mock/fixture contract;
- clearly report what prevents a verified live adapter;
- keep the application fully functional through local/manual data.

Do not silently substitute an unrelated provider.

---

# 2. Keep GOAL API Replaceable

GOAL API is the first adapter.

It is not part of the Domain model.

Provider-specific concepts must remain inside Infrastructure.

Do not allow types such as:

GoalApiFixture
GoalApiTeam
GoalApiCompetition
GoalApiResponse

to leak into:

- Domain;
- generic Application use cases;
- React components;
- repository interfaces.

The boundary should conceptually be:

GOAL API JSON
      ↓
GoalApiProvider
      ↓
Normalized External Models
      ↓
Synchronization Application Service
      ↓
Local Domain / Database

---

# 3. Do Not Overbuild Multi-Provider Architecture

Design enough abstraction so another provider can be added later.

Do not implement:

- automatic multi-provider failover;
- provider scoring;
- load balancing;
- complex health engines;
- provider orchestration graphs;
- generic plugin systems;
- distributed quotas;
- provider event buses;
- background workers.

One real provider is enough for this phase.

Future providers should be implementable without changing the Domain, but they do not need to be implemented now.

---

# 4. Provider Contract

Create a small provider contract representing only capabilities required by current synchronization workflows.

A conceptual shape may be:

interface FootballDataProvider {
  readonly code: string;
  readonly capabilities: ProviderCapabilities;

  listCompetitions(...): Promise<ExternalCompetition[]>;
  listTeams(...): Promise<ExternalTeam[]>;
  listFixtures(...): Promise<ExternalFixture[]>;
  getFixture(...): Promise<ExternalFixture | null>;
}

Adapt this to actual requirements.

Do not force every provider to implement unsupported operations.

If optional capabilities are clearer as separate interfaces, use them.

For example:

FixtureStatisticsProvider
ArtworkProvider

But do not split the provider into many tiny interfaces without a concrete reason.

---

# 5. Provider Capabilities

Represent provider capabilities explicitly.

Relevant capabilities may include:

- competitions;
- teams;
- fixtures;
- liveScores;
- finalScores;
- fixtureStatistics;
- corners;
- teamLogos;
- competitionLogos.

Capabilities should represent verified adapter behavior.

Do not claim:

corners: true

unless the implemented GOAL API adapter can actually retrieve normalized corner data reliably.

Do not persist capability flags in the database unless persistence is already clearly required.

Static adapter metadata is sufficient for v1.

---

# 6. Normalized External Models

Define provider-independent external models at the Application/port boundary.

Keep them separate from persisted Domain entities.

At minimum define concepts equivalent to:

ExternalCompetition
ExternalTeam
ExternalFixture

Use explicit nullable fields where external data may be absent.

Do not model every field returned by GOAL API.

Normalize only data Bet Studio currently needs.

---

# 7. ExternalCompetition

Normalize only relevant fields.

Conceptually:

type ExternalCompetition = {
  providerCode: string;
  externalId: string;
  name: string;
  shortName?: string | null;
  country?: string | null;
  logoUrl?: string | null;
};

Adapt according to verified provider data.

Do not let provider response structures escape the adapter.

---

# 8. ExternalTeam

Conceptually normalize:

type ExternalTeam = {
  providerCode: string;
  externalId: string;
  name: string;
  shortName?: string | null;
  country?: string | null;
  logoUrl?: string | null;
};

Do not automatically create invented short names.

If the provider does not supply a short name, use null.

---

# 9. ExternalFixture

Normalize the fields currently needed by Bet Studio.

Conceptually:

type ExternalFixture = {
  providerCode: string;
  externalId: string;

  competitionExternalId: string | null;

  homeTeamExternalId: string;
  awayTeamExternalId: string;

  kickoffAt: Date | string;

  status: NormalizedFixtureStatus;

  homeScore: number | null;
  awayScore: number | null;

  halfTimeHomeScore?: number | null;
  halfTimeAwayScore?: number | null;

  homeCorners?: number | null;
  awayCorners?: number | null;
};

The exact representation should follow existing project date/value conventions.

Do not mix provider-specific status strings into Domain Fixture.

---

# 10. Fixture Status Normalization

Centralize GOAL API → Bet Studio fixture status mapping inside the adapter.

Bet Studio currently recognizes:

SCHEDULED
LIVE
FINISHED
POSTPONED
CANCELLED
ABANDONED
UNKNOWN

Map provider values explicitly.

Do not determine status through fuzzy string matching.

Unknown or newly introduced provider values must map safely to:

UNKNOWN

and may generate a diagnostic warning.

Do not silently interpret an unknown status as FINISHED.

---

# 11. Suspended / Paused Provider States

Inspect the real GOAL API status vocabulary.

If the provider exposes concepts such as:

- PAUSED;
- SUSPENDED;
- INTERRUPTED;

do not arbitrarily collapse them without considering the documented Bet Studio status model.

If the existing normalized status model cannot represent an important provider state safely:

- identify the conflict;
- make the smallest domain/documentation correction needed if behavior is unambiguous;
- otherwise report the ambiguity rather than guessing.

Do not silently use ABANDONED for a match that may resume.

---

# 12. Score Normalization

Normalize scores deliberately.

Do not confuse:

- current score;
- final score;
- half-time score;
- extra-time score;
- penalty score;
- aggregate score.

Bet Studio's current FixtureResultDetails requires the specific structured fields documented in data-model.md.

Do not populate final score fields from unrelated aggregate or penalty fields.

If a score cannot be interpreted confidently, leave it null.

---

# 13. Corner Statistics

Bet Studio's initial Market Engine will eventually require:

homeCorners
awayCorners

Only implement automatic corner synchronization if current GOAL API documentation and responses provide reliable structured corner totals.

If corners require:

- a separate endpoint;
- another subscription/tier;
- another request;

model this explicitly.

If GOAL API does not provide them in the available integration:

- keep the fields nullable;
- preserve manual corner entry;
- report the capability as unavailable;
- do not fabricate values;
- do not scrape them from display text.

Missing corners are valid application state.

---

# 14. Provider Configuration

Add only environment variables actually required by the GOAL API integration.

Examples conceptually:

GOAL_API_KEY=
GOAL_API_BASE_URL=

Use the exact authentication configuration required by the verified API.

Do not expose provider keys to Vite/browser code.

Provider requests must originate server-side.

Add placeholders to `.env.example`.

Never commit real credentials.

---

# 15. Optional Provider Configuration

Bet Studio must still start if GOAL API credentials are absent.

Provider integration should become unavailable/disabled gracefully.

Core local workflows must continue working.

Do not make application startup depend on a third-party football service.

A missing provider key is not necessarily a fatal application configuration error.

Validate:

- format when configured;
- required combination of provider settings;

but permit provider-disabled local mode.

---

# 16. HTTP Client

Create a small reusable HTTP boundary for provider calls if useful.

Requirements:

- HTTPS;
- timeout;
- abort support where available;
- controlled retry policy;
- normalized error handling.

Do not add a heavyweight networking framework if native fetch is sufficient.

Use the runtime's supported HTTP/fetch implementation unless the existing repository already uses another maintained client.

---

# 17. Timeout

Use an explicit finite timeout.

A reasonable provider request range is approximately:

5–15 seconds

unless official documentation suggests otherwise.

Do not allow provider calls to hang indefinitely.

Make timeout configuration simple.

Do not turn timeout tuning into a complex subsystem.

---

# 18. Retry Policy

Retries should be conservative.

At most one automatic retry is appropriate for transient failures such as:

- connection reset;
- selected 5xx;
- possibly 429 when provider response gives a safe retry signal.

Do not retry:

- authentication errors;
- validation errors;
- ordinary 4xx errors;
- deterministic malformed requests.

Do not create retry storms.

---

# 19. Rate Limits

Respect provider rate limits.

If GOAL API returns reliable rate-limit metadata:

- parse useful headers/fields;
- expose useful diagnostic state;
- respect Retry-After where applicable.

Do not invent rate-limit counters.

Do not persist ProviderRateLimitState unless reliable data and an actual use case justify it.

In-memory/local awareness is sufficient initially.

---

# 20. Provider Errors

Normalize provider failures into stable application/infrastructure error categories.

Useful concepts include:

ProviderError
ProviderAuthenticationError
ProviderRateLimitError
ProviderUnavailableError
ProviderValidationError

Follow existing error conventions.

Do not expose raw GOAL API payloads or API keys to the UI.

Preserve useful internal causes for logging/debugging.

---

# 21. Response Validation

Treat GOAL API responses as untrusted external input.

Validate responses before normalization.

Use Zod or the existing runtime validation approach.

Do not type-cast arbitrary JSON with:

as GoalApiResponse

without runtime validation.

Prefer schemas focused on fields the adapter actually consumes.

Do not reproduce the provider's entire API schema unnecessarily.

---

# 22. Pagination

If GOAL API paginates list endpoints:

- handle pagination according to official documentation;
- use bounded requests;
- stop correctly;
- detect malformed pagination;
- avoid accidental infinite loops.

Do not fetch an entire provider dataset when a narrower operation is possible.

Prefer competition/date-scoped synchronization.

---

# 23. Date Ranges

Fixture synchronization should request narrow useful date ranges.

Do not repeatedly download years of fixtures.

Support explicit synchronization windows in the Application layer.

Examples:

- selected competition;
- from date;
- to date.

Apply reasonable limits to arbitrary user-supplied ranges if necessary.

---

# 24. Synchronization Architecture

Provider adapters must not write directly to SQLite.

Use:

Provider Adapter
      ↓
Normalized Models
      ↓
Sync Application Service
      ↓
Repositories / Transaction
      ↓
Database

The synchronization service decides how external records map into local entities.

Infrastructure provider adapters only retrieve and normalize data.

---

# 25. Synchronization Operations

Implement focused synchronization use cases.

Likely operations:

syncCompetitions
syncTeams
syncFixtures
syncFixtureResult

Add:

syncFixtureStatistics

only if currently required and supported.

Do not create one giant:

syncEverything()

operation as the primary architecture.

A convenience orchestration operation may exist later, but each resource should remain understandable and testable.

---

# 26. Manual Refresh First

Synchronization is user-triggered in v1.

Provide appropriate UI/API actions such as:

Refresh competitions
Refresh teams
Refresh fixtures
Refresh result

Exact UX should remain simple.

Do not create:

- cron jobs;
- background workers;
- queues;
- daemon polling.

LIVE polling belongs to a later workflow if needed.

---

# 27. Competition Sync

Competition synchronization should:

1. fetch normalized competitions;
2. resolve existing ProviderReference mappings;
3. update mapped local records safely;
4. create new local records where policy permits;
5. create/update ProviderReference mappings;
6. report counts/results.

Do not delete local competitions because they disappeared from one API response.

Do not deactivate entities automatically from a partial provider response unless explicitly documented.

---

# 28. Team Sync

Team synchronization should follow the same safety principle.

Priority for resolving an external team:

1. existing ProviderReference;
2. explicit/manual mapping;
3. deterministic safe matching where documentation permits;
4. otherwise require/create an unresolved/manual resolution path.

Do not fuzzy-auto-merge teams.

Do not merge two local teams because names merely look similar.

---

# 29. Team Alias Matching

Team aliases may help deterministic matching.

Normalize according to existing Phase 03 rules.

A safe alias match must be unambiguous.

If:

one external name → multiple possible teams

do not choose automatically.

Report unresolved mapping.

Do not implement similarity scores in this phase.

---

# 30. Fixture Sync

Fixture synchronization should resolve:

- competition;
- home team;
- away team;
- kickoff;
- provider fixture reference.

Prefer existing ProviderReference first.

If provider fixture mapping does not exist, safe deterministic matching may use:

competition
+
home team
+
away team
+
kickoff tolerance

only where all required mappings are unambiguous.

Do not match solely by team-name strings.

---

# 31. Kickoff Tolerance

Use a small explicit configurable tolerance only if needed for deterministic fixture reconciliation.

Do not hide the value inside matching code.

If docs/api-integration.md already defines a tolerance, use it.

Otherwise choose a conservative value and document it.

Do not use broad tolerances that can confuse multiple fixtures between the same teams.

---

# 32. Safe Merge

Provider synchronization must preserve local ownership.

External updates may update fields designated as provider-managed.

They must not silently overwrite manual/local authoritative values.

In particular:

- manual settlement overrides survive;
- historical snapshots survive;
- manually selected assets should survive provider refresh;
- local entity identity never changes.

Define merge behavior explicitly.

---

# 33. Empty Provider Responses

An empty result is not proof that all local data should be deleted.

Never interpret:

[]

as:

delete everything

unless the provider contract and requested operation explicitly guarantee that semantic, which is not expected in this phase.

Return a valid sync result with zero records or warning metadata.

---

# 34. Partial Provider Responses

If some items fail validation:

- preserve valid local data;
- process safe valid items where appropriate;
- report partial result;
- do not silently discard the fact that some records failed.

Use SyncRecord status such as:

SUCCESS
PARTIAL
FAILED

according to the existing model.

---

# 35. Transactions

Perform HTTP work outside database transactions.

Preferred flow:

HTTP request
→ validate
→ normalize
→ resolve
→ short database transaction
→ persist

Do not hold SQLite transactions open while waiting for GOAL API.

Use transactions when multiple local writes form one consistency boundary.

---

# 36. Idempotency

Synchronization should be idempotent.

Running the same synchronization twice with unchanged provider data should not create:

- duplicate competitions;
- duplicate teams;
- duplicate fixtures;
- duplicate ProviderReferences.

Add tests for this.

---

# 37. ProviderReference

Use the ProviderReference infrastructure created in Phase 02.

Mappings must associate:

provider
+
entity type
+
local entity
+
external ID

Do not add external GOAL API IDs directly to Competition, Team or Fixture columns unless the existing model explicitly requires a cached convenience field, which is not expected.

---

# 38. Provider Record

Ensure GOAL API has a stable Provider record/code.

Use a neutral stable machine code such as the one defined by current docs/configuration.

Do not store the API key in the database.

Provider configuration/secrets remain environment/configuration concerns.

---

# 39. SyncRecord

Create a SyncRecord for meaningful synchronization operations.

Record useful metadata such as:

- provider;
- resource/scope;
- start;
- completion;
- status;
- processed count;
- created count;
- updated count;
- unresolved count;
- failed/invalid count;
- sanitized warning/error summary.

Do not store large raw provider responses in SyncRecord.

Do not store secrets.

---

# 40. Synchronization Results

Return a useful structured result from sync operations.

Conceptually:

{
  status: "SUCCESS",
  processed: 20,
  created: 4,
  updated: 16,
  unresolved: 0,
  failed: 0
}

Adapt to existing conventions.

This result should be useful both for tests and UI feedback.

---

# 41. Unresolved Mappings

Do not overbuild a complex mapping-management subsystem.

For this phase, unresolved entities may be:

- reported to the caller;
- listed in sync details;
- skipped safely.

If a very small manual resolution UI fits cleanly with existing CRUD screens, it may be implemented.

Do not expand this phase into a full reconciliation product.

The essential requirement is:

never guess an ambiguous identity.

---

# 42. Fixture Result Sync

Implement result refresh using the provider fixture identity where possible.

Update structured FixtureResultDetails.

Do not run Market Engine settlement yet.

Result synchronization and market settlement remain separate responsibilities.

Conceptually:

GOAL API
   ↓
FixtureResultDetails updated

NOT:

GOAL API
   ↓
direct GREEN / RED mutation

Phase 05 will evaluate selections from normalized local fixture data.

---

# 43. Result Corrections

Football providers may correct a result after initial publication.

Allow current FixtureResultDetails to be updated when provider data changes safely.

Do not mutate:

- historical BulletinSelectionSnapshot;
- historical SelectionResultSnapshot;
- previous RenderRecord metadata.

Historical evaluation/audit concerns remain separate from current fixture state.

---

# 44. LIVE Data

Do not create continuous LIVE polling.

A manually requested refresh of a LIVE fixture may retrieve the latest available score.

That is sufficient in this phase.

Do not assume GOAL API offers true real-time data unless confirmed.

Do not describe delayed data as live.

---

# 45. Assets / Logos

If GOAL API supplies logo URLs and existing asset infrastructure can safely consume them, add controlled artwork synchronization.

Requirements:

- HTTPS;
- restricted expected host behavior if practical;
- timeout;
- maximum file size;
- verify content type;
- verify actual supported image format;
- generate internal storage name;
- store locally;
- create immutable/version-safe Asset;
- associate appropriately.

Rendering must never depend on a remote URL.

---

# 46. Remote SVG

Do not automatically accept arbitrary remote SVG as trusted rendering content.

If GOAL API provides SVG assets:

either:

- safely sanitize/rasterize using an already justified implementation;

or:

- defer SVG ingestion and accept only known-safe raster formats in v1.

Prefer the simpler safe approach.

Do not introduce a large SVG security pipeline merely for this phase.

---

# 47. Manual Asset Priority

If a Team or Competition already has a manually assigned local logo, provider refresh must not silently replace it.

Use explicit source/priority semantics where existing Asset/entity modeling supports them.

A provider logo may fill a missing asset.

It should not override intentional manual user choice without explicit user action.

---

# 48. Cache Behavior

The local database is already the primary operational cache/source of truth.

Do not introduce:

- Redis;
- external cache;
- filesystem response cache framework.

Avoid repeated provider requests when fresh local data is already sufficient.

If a lightweight last-sync timestamp is useful, reuse SyncRecord/provider metadata.

Do not build a sophisticated cache invalidation system.

---

# 49. Suggested Refresh Freshness

Keep freshness policy outside Domain.

If needed, define simple configuration/defaults.

Reasonable conceptual defaults may be:

competitions / teams:
  approximately 24h

future fixtures:
  approximately 3–6h

finished fixtures:
  persist locally

But do not hardcode these values throughout the codebase.

User-triggered explicit refresh should still be possible.

These values are application/integration policy, not football domain rules.

---

# 50. UI

Add a small synchronization UX integrated with the existing management screens.

The UI should clearly communicate:

- provider configured / unavailable;
- refresh action;
- loading state;
- last successful refresh where available;
- success/partial/failure;
- created/updated/unresolved counts where useful.

Do not expose:

- API key;
- raw HTTP responses;
- stack traces;
- provider internal DTOs.

---

# 51. Competition UI Integration

On the Competitions management area, provide a simple GOAL API refresh/import action if supported.

Do not redesign the entire CRUD UI.

After successful sync:

- refresh the list;
- show concise synchronization feedback.

---

# 52. Team UI Integration

Allow synchronization for teams in a selected competition when the provider contract supports that workflow.

Prefer explicit context:

Select competition
→ Refresh teams

rather than indiscriminately importing every team available from the provider.

---

# 53. Fixture Management

Phase 03 may not yet contain a complete fixture management screen.

Implement only the smallest UI/API surface needed to demonstrate fixture synchronization.

Do not turn this phase into full Fixture CRUD if that was not already part of the planned scope.

A simple synchronization endpoint/service plus a minimal view/debug-management surface is acceptable.

Keep future Bulletin Builder needs in mind without implementing them.

---

# 54. API Routes

Expose application synchronization operations through Fastify.

Possible structure:

GET  /api/providers
GET  /api/providers/goal/status

POST /api/sync/competitions
POST /api/sync/competitions/:competitionId/teams
POST /api/sync/fixtures
POST /api/sync/fixtures/:fixtureId/result

Adapt route design to existing project conventions.

Do not expose generic arbitrary provider URL proxy endpoints.

The browser must not be able to ask the server to fetch an arbitrary URL.

---

# 55. SSRF Protection

Never implement endpoints such as:

POST /api/fetch-url
{
  "url": "..."
}

Provider base URLs must come from trusted server configuration.

Artwork URL fetching must be tightly constrained and validated.

Do not accept arbitrary local/file/private network URLs.

---

# 56. Logging

Log useful synchronization information.

Include:

- provider code;
- operation;
- duration;
- counts;
- normalized error type.

Do not log:

- API keys;
- Authorization headers;
- full sensitive request URLs if they include credentials;
- enormous response bodies.

Keep logging concise.

---

# 57. Tests Must Not Call GOAL API

Normal:

npm test
CI
Vitest

must not make live GOAL API requests.

Use:

- mocked HTTP responses;
- small stored JSON fixtures;
- adapter contract tests.

Do not make CI dependent on:

GOAL_API_KEY

or internet access.

---

# 58. Provider Test Fixtures

Store a small curated set of provider response fixtures.

Include only enough real/sanitized shape to validate the adapter.

Useful scenarios:

- competition response;
- team response;
- scheduled fixture;
- live fixture where supported;
- finished fixture;
- postponed/cancelled fixture where available;
- fixture with missing fields;
- error response;
- paginated response where applicable;
- statistics/corners response if implemented.

Do not commit huge API dumps.

Do not commit credentials or signed URLs.

---

# 59. Adapter Tests

Test:

- authentication request construction without exposing key;
- URL/query construction;
- response validation;
- competition normalization;
- team normalization;
- fixture normalization;
- fixture status mapping;
- score mapping;
- nullable fields;
- pagination;
- timeout/error mapping;
- rate-limit handling where supported;
- malformed provider response handling.

Do not test native fetch itself.

---

# 60. Sync Tests

Add integration/application tests covering:

- first competition sync creates records;
- second identical sync is idempotent;
- existing ProviderReference resolves identity;
- team sync does not duplicate existing mapped team;
- ambiguous/unresolved team is not guessed;
- fixture sync creates/matches correctly;
- partial invalid response does not delete valid local data;
- result refresh updates FixtureResultDetails;
- missing corners remain null;
- manual/local values survive provider refresh according to merge policy;
- SyncRecord is written correctly.

Use an isolated test database.

---

# 61. Offline Tests

Add a test proving provider failure does not make existing local data unavailable.

Conceptually:

1. local competitions/teams/fixtures exist;
2. provider request fails;
3. sync operation reports failure;
4. existing local records still exist unchanged;
5. ordinary local CRUD remains usable.

Local-first behavior is a core invariant.

---

# 62. No Live API Test in CI

If a developer-only real integration command is useful, make it explicit and opt-in.

For example conceptually:

test:integration:goal

It may require:

GOAL_API_KEY

and network access.

Do not include it in normal CI.

Do not automatically execute it from `npm test`.

Only add this if it provides genuine development value.

---

# 63. Provider Documentation

Document only verified GOAL API details needed by the implementation.

Update docs/api-integration.md where the implementation establishes real behavior.

Do not copy large sections of external provider documentation into the repository.

Document:

- adapter capabilities;
- configuration variables;
- unsupported capabilities;
- important normalization decisions;
- relevant provider limitations.

Do not hardcode undocumented rate-limit claims.

---

# 64. README

Update README.md minimally.

Add actual setup details such as:

GOAL_API_KEY

only if the adapter genuinely consumes them.

Explain that provider configuration is optional.

Do not turn README into external API documentation.

Do not reference any project identity other than Bet Studio.

---

# 65. Dependency Policy

Prefer existing dependencies and native platform capabilities.

Only add a new dependency when it clearly solves a real requirement.

Potentially unnecessary additions include:

- Axios when native fetch is sufficient;
- retry libraries for one retry;
- caching libraries;
- generic provider frameworks;
- queue libraries;
- cron libraries.

Explain any significant dependency added.

---

# 66. Do Not Implement Other Providers

Do not implement:

- football-data.org;
- OpenFootball;
- TheSportsDB;

in this phase.

Do not create fake adapter classes for them.

The architecture should allow them later without having placeholder implementations.

GOAL API is enough to validate the abstraction.

---

# 67. Do Not Implement Automatic Fallback Chains

Do not implement:

GOAL API fails
→ automatically try Provider B
→ automatically try Provider C

yet.

Cross-provider fallback introduces identity/mapping and freshness complexity.

For v1 at this stage:

GOAL API available
→ explicit synchronization

GOAL API unavailable
→ local/manual workflow remains available

is sufficient.

---

# 68. Do Not Implement Market Settlement

Do not calculate:

GREEN
RED
VOID

from synchronized fixture data in this phase.

Only synchronize normalized football facts.

Phase 05 Market Engine consumes those facts later.

This separation must remain explicit.

---

# 69. Do Not Implement Rendering

Do not:

- generate bulletin images;
- download assets for direct rendering without local persistence;
- implement template layout logic;
- invoke Playwright for graphic export.

Rendering remains a later phase.

---

# 70. Do Not Implement Background Infrastructure

Do not add:

- cron;
- BullMQ;
- Redis;
- queues;
- worker processes;
- WebSockets purely for sync;
- scheduled cloud jobs.

Manual synchronization is sufficient.

---

# 71. Security Review

Before completion verify:

- GOAL API key is server-only;
- `.env` remains ignored;
- no credentials appear in fixtures;
- logs redact secrets;
- provider response is runtime validated;
- HTTP timeout exists;
- arbitrary URL fetching is impossible;
- TLS verification is not disabled;
- uploaded/downloaded assets are constrained;
- no provider data is trusted blindly.

---

# 72. Quality Gates

Before completion run the repository's actual quality commands.

At minimum:

- format/check;
- lint;
- typecheck;
- tests;
- build.

Also run any database migration/integration verification affected by changes.

Run Playwright only if this phase changes a workflow covered by reliable E2E tests.

Do not claim a command passed unless it actually ran successfully.

---

# 73. Manual Verification

If the environment and valid GOAL API credentials are available, manually verify a small bounded real synchronization flow.

For example:

1. provider status available;
2. synchronize a small competition set or selected competition;
3. synchronize teams for one competition;
4. synchronize a narrow fixture date range;
5. refresh one fixture result.

Avoid consuming unnecessary quota.

Do not perform broad bulk imports merely for verification.

If valid credentials are unavailable:

- do not block implementation;
- verify with mocks/fixtures;
- report that live verification was not performed.

Never invent a successful live verification.

---

# 74. Git Diff Review

Before finishing inspect the final diff.

Check that:

- no `.env` exists in tracked files;
- no API key is present;
- no local DB/test DB was added;
- provider fixture files are small and intentional;
- no unrelated CRUD redesign occurred;
- no Market Engine logic was implemented;
- no rendering logic was implemented;
- no unused multi-provider framework was created;
- docs match actual implementation.

---

# 75. Completion Report

At the end report concisely:

1. Provider abstraction implemented.
2. Verified GOAL API capabilities used.
3. GOAL API configuration required.
4. Normalized models implemented.
5. Fixture status mapping decisions.
6. Competition/team/fixture/result synchronization implemented.
7. Corners supported or explicitly unavailable.
8. Asset/logo behavior implemented or deferred.
9. Mapping/idempotency behavior.
10. Sync UI/API added.
11. Tests added.
12. Exact verification commands executed and their results.
13. Whether a real GOAL API request was tested.
14. Any provider limitation or unresolved documentation issue.

Do not provide a long file-by-file narrative.

Do not commit or push unless explicitly requested.