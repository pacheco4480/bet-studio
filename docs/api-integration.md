# Bet Studio — API Integration

## 1. Purpose

This document defines how Bet Studio integrates with external football-data providers.

Primary goals:

- Keep Bet Studio fully functional without external APIs.
- Treat the local database as the operational source of truth.
- Isolate provider-specific formats and behavior.
- Support multiple providers without changing domain logic.
- Minimize API quota consumption.
- Preserve manually created and manually corrected data.
- Provide reliable synchronization with safe failure behavior.
- Normalize external football data into stable internal models.
- Support fixture results and statistics required by the Market Engine.
- Keep API credentials outside frontend code and source control.

External APIs are synchronization sources.

They are not the application's operational database.

---

## 2. Core Principle

The fundamental rule is:

```text
External Provider
      ↓
Synchronization
      ↓
Local Database
      ↓
Bet Studio

Not:

Bet Studio UI
      ↓
External Provider
      ↓
Render / settlement / CRUD

The application must remain usable if every external provider is unavailable.

3. Source of Truth

The local SQLite database is the operational source of truth.

It owns:

Competitions.
Teams.
Team aliases.
Competition/team associations.
Fixtures.
Fixture results.
Fixture statistics stored locally.
Markets.
Bulletins.
Historical snapshots.
Provider mappings.

External providers may:

create candidate records;
update known records;
enrich existing records;
propose fixture results;
provide external identifiers;
provide artwork or logos.

They must not become the canonical domain identity.

4. Provider Independence

Application and domain code must never depend directly on provider-specific response structures.

Provider-specific types belong exclusively inside infrastructure adapters.

Valid:

GOAL API response
      ↓
GoalApiProvider
      ↓
Normalized ExternalFixture
      ↓
Synchronization service
      ↓
Local Fixture

Invalid:

GOAL API response
      ↓
React component

or:

football-data.org Match
      ↓
Market Engine
5. Provider Interface

Conceptual provider contract:

interface FootballDataProvider {
  readonly id: string;

  getCompetitions(
    query?: CompetitionsQuery
  ): Promise<ExternalCompetition[]>;

  getTeams(
    query: TeamsQuery
  ): Promise<ExternalTeam[]>;

  getFixtures(
    query: FixturesQuery
  ): Promise<ExternalFixture[]>;

  getFixture(
    externalFixtureId: string
  ): Promise<ExternalFixture | null>;
}

Providers may expose optional capabilities through separate interfaces.

Do not force every provider to implement data it does not support.

6. Provider Capabilities

Providers differ significantly in available data.

Capabilities must therefore be explicit.

Conceptual model:

type ProviderCapabilities = {
  competitions: boolean;
  teams: boolean;
  fixtures: boolean;
  liveScores: boolean;
  finalScores: boolean;
  fixtureStatistics: boolean;
  corners: boolean;
  teamLogos: boolean;
  competitionLogos: boolean;
};

A provider adapter must advertise only capabilities that have been verified.

Do not infer capabilities from provider marketing names.

7. Capability-Based Design

Application use cases should request capabilities rather than assume one provider supports everything.

Example:

Need fixtures
    ↓
select enabled provider with fixtures capability

Example:

Need corner statistics
    ↓
select enabled provider with corners capability

This allows combinations such as:

Provider A
→ competitions + fixtures + scores

Provider B
→ artwork

Provider C
→ match statistics

without changing domain logic.

8. Initial Provider Strategy

Recommended initial provider priority:

1. GOAL API
2. football-data.org
3. OpenFootball
4. TheSportsDB
5. Manual/local operation

This priority is not a permanent business rule.

Provider configuration must remain replaceable.

The first implementation should focus on one production-style API adapter rather than implementing all providers simultaneously.

Recommended first adapter:

GoalApiProvider

Before implementation, verify its current:

authentication method;
endpoint structure;
competition coverage;
fixture coverage;
statistics availability;
rate limits;
quota rules;
terms of use.

Provider documentation changes over time and must not be permanently encoded in architecture documentation without verification.

Phase 04 verified GOAL API against the official documentation at `https://goal-api.com/documentation`.

Implemented configuration:

- `GOAL_API_KEY`
- `GOAL_API_BASE_URL`, defaulting to `https://api.goal-api.com/v1`
- `GOAL_API_TIMEOUT_MS`, defaulting to `10000`

Verified request behavior:

- REST requests use `Authorization: Bearer <key>`.
- List responses use a JSON `success` flag, `data` payload and optional `pagination`.
- Pagination uses `limit`, `offset` and `hasMore`.
- Fixtures expose UTC kickoff through `kickoffUtc`.
- Rate-limit metadata is exposed through `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` and `X-RateLimit-Type`.

Implemented GOAL API adapter capabilities:

- competitions: supported through `/leagues`
- teams: supported through `/leagues/:id/teams`
- fixtures: supported through `/fixtures`, `/fixtures/date/:date` and `/leagues/:id/fixtures`
- liveScores: supported for manual refresh through fixture data
- finalScores: supported through fixture/result data
- fixtureStatistics: endpoint exists, but only fixture-level details needed by this phase are normalized
- corners: not enabled, because the public documentation does not specify a stable normalized corner field in the consumed fixture payload
- teamLogos and competitionLogos: not enabled, because safe local asset ingestion is not implemented yet

GOAL API status normalization is adapter-local. Documented/common values such as `NS`, `TBD`, `1H`, `2H`, `HT`, `FT`, `AET`, `PEN`, `PST`, `CANC` and `ABD` map to the Bet Studio fixture status model. Unknown provider status values map to `UNKNOWN`.

9. Manual Provider

Manual/local operation is conceptually the ultimate fallback.

It does not require a remote adapter.

Users must be able to:

create competitions manually;
create teams manually;
upload logos manually;
create fixtures manually;
enter final scores manually;
enter corner totals manually;
settle markets manually.

API integration must enhance this workflow, not replace it.

10. Provider Registry

Enabled providers should be managed through a registry.

Conceptual example:

interface ProviderRegistry {
  get(id: string): FootballDataProvider;

  list(): FootballDataProvider[];

  findByCapability(
    capability: keyof ProviderCapabilities
  ): FootballDataProvider[];
}

The registry belongs to infrastructure/application composition.

The domain layer must not know it exists.

11. Provider Configuration

Provider configuration may contain:

type ProviderConfig = {
  providerId: string;

  enabled: boolean;

  priority: number;

  baseUrl?: string;

  timeoutMs: number;

  capabilities: ProviderCapabilities;
};

Credentials must not be stored here if this configuration is persisted to the database.

Secrets belong to environment configuration.

12. Secrets

API credentials must:

remain server-side;
live in environment variables;
never appear in React bundles;
never be committed to Git;
never appear in screenshots or rendered bulletins;
never be written to ordinary logs.

Example:

GOAL_API_KEY=
FOOTBALL_DATA_API_KEY=
THESPORTSDB_API_KEY=

Commit:

.env.example

Do not commit:

.env
13. Environment Validation

Environment configuration must be validated at application startup.

Conceptual example:

const envSchema = z.object({
  GOAL_API_KEY: z.string().optional(),

  FOOTBALL_DATA_API_KEY: z.string().optional(),

  THESPORTSDB_API_KEY: z.string().optional()
});

A missing key for a disabled provider is valid.

A missing key for an enabled provider requiring authentication must produce a clear configuration error.

Do not fail the entire application if an optional provider is unavailable.

14. HTTP Client Boundary

Provider adapters should use a shared HTTP abstraction where useful.

Conceptual:

interface HttpClient {
  get<T>(
    url: string,
    options?: HttpRequestOptions
  ): Promise<HttpResponse<T>>;
}

Useful shared behavior:

timeout;
JSON parsing;
status handling;
sanitized logging;
retry policy;
request identifiers.

Do not expose provider HTTP responses outside infrastructure.

15. Timeouts

Every external request must have a finite timeout.

Never wait indefinitely.

Recommended initial range:

5–15 seconds

depending on provider behavior.

Timeout values belong to configuration.

A timeout should result in:

ProviderError

while preserving local data.

16. Retry Policy

Retries must be conservative.

Safe candidates:

network interruption;
transient 5xx response;
temporary service unavailable.

Do not automatically retry:

authentication failure;
malformed request;
invalid API key;
unsupported endpoint;
ordinary 4xx validation errors.

Avoid aggressive retry loops that consume quota.

Initial recommendation:

maximum 1 additional retry

for safe transient failures.

17. Rate Limits

Providers may enforce:

requests per minute;
requests per day;
subscription quota;
endpoint-specific limits.

Bet Studio must treat quota as limited infrastructure.

Never assume unlimited API access.

Where available, capture provider headers such as:

limit
remaining
reset
retry-after

through adapter-specific parsing.

Normalize them into internal quota metadata.

18. Quota State

Conceptual normalized model:

type ProviderQuota = {
  limit: number | null;
  remaining: number | null;
  resetsAt: Date | null;
};

Persist where useful.

The UI may display:

GOAL API
Last sync: 10:32

Quota:
743 remaining

only if reliable provider data is available.

Do not fabricate quota values when the provider does not expose them.

19. Rate-Limit Failure

HTTP 429 or equivalent provider response should normalize to:

RateLimitError

The synchronization operation must:

stop unnecessary requests;
preserve cached/local data;
store failure metadata;
expose a useful user-facing message;
optionally retain provider reset information.

Do not delete or invalidate local records because quota was exhausted.

20. Provider Errors

Infrastructure errors should normalize into stable application errors.

Examples:

ProviderError
RateLimitError
ValidationError

Provider-specific raw error payloads must not leak into presentation code.

Useful internal metadata may include:

providerId
operation
statusCode
requestId

Do not include API secrets.

21. Normalized External Models

Provider responses must first become normalized infrastructure models.

They are not domain entities.

21.1 External Competition
type ExternalCompetition = {
  externalId: string;

  name: string;
  shortName: string | null;

  countryCode: string | null;
  regionName: string | null;

  logoUrl: string | null;
};
21.2 External Team
type ExternalTeam = {
  externalId: string;

  name: string;
  shortName: string | null;

  countryCode: string | null;

  logoUrl: string | null;
};
21.3 External Fixture
type ExternalFixture = {
  externalId: string;

  competitionExternalId: string | null;

  homeTeamExternalId: string | null;
  awayTeamExternalId: string | null;

  homeTeamName: string;
  awayTeamName: string;

  kickoffAt: Date | null;

  status: NormalizedFixtureStatus;

  score: {
    home: number | null;
    away: number | null;
  };

  statistics?: {
    homeCorners: number | null;
    awayCorners: number | null;
  } | null;
};

Do not carry provider response objects beyond normalization.

22. Fixture Status Normalization

Different providers use different status values.

Each adapter must map them into the Bet Studio fixture status model.

Target statuses:

type FixtureStatus =
  | 'SCHEDULED'
  | 'LIVE'
  | 'FINISHED'
  | 'POSTPONED'
  | 'CANCELLED'
  | 'ABANDONED'
  | 'UNKNOWN';

Example conceptual mapping:

provider:
FT

→

Bet Studio:
FINISHED

Unknown provider states must map to:

UNKNOWN

Never guess a close-looking status.

23. Score Normalization

Final score must have explicit meaning.

Do not blindly map arbitrary provider score fields.

A provider may expose:

halftime
fulltime
extra time
penalties
current score

The adapter must know which value corresponds to Bet Studio's supported settlement interpretation.

For initial full-time markets, use the score corresponding to the provider's defined final match score.

Do not accidentally settle normal full-time markets using:

half-time score;
penalty shootout score;
unrelated aggregate score.

Provider-specific mapping requires explicit tests.

24. Corner Statistics

Corner totals are required by:

Cantos Mais/Menos

Normalized fixture statistics must support:

type ExternalFixtureStatistics = {
  homeCorners: number | null;
  awayCorners: number | null;
};

A provider without corner capability must return no corner data.

Never substitute:

shots
attacks
possession

or any other metric.

Missing corners result in the Market Engine returning:

MANUAL

when automatic settlement is attempted.

25. Statistics Provider Independence

The provider supplying statistics does not need to be the same provider supplying the fixture.

Conceptual flow:

Fixture Provider
      ↓
Local Fixture
      ↑
Statistics Provider

Statistics must attach to the correct local fixture through provider mappings or safe fixture matching.

Never merge statistics solely because two teams have similar names.

26. Synchronization Service

Provider adapters retrieve data.

Application synchronization services decide how that data affects the local database.

Conceptual:

Provider
   ↓
normalized records
   ↓
Synchronization Service
   ↓
matching
   ↓
merge policy
   ↓
repositories

The provider adapter must not directly write database records.

27. Synchronization Operations

Recommended use cases:

syncCompetitions
syncTeams
syncFixtures
syncFixtureResult
syncFixtureStatistics
syncAssets

Keep them independently callable.

Do not make one giant:

syncEverything()

operation mandatory.

This allows controlled quota usage.

28. Manual Refresh

Version 1 should prioritize explicit user-triggered synchronization.

Examples:

Refresh competitions
Refresh teams
Refresh fixtures
Refresh result
Refresh statistics

Benefits:

predictable quota usage;
easier debugging;
easier local development;
reduced background complexity.

Do not implement always-on global polling.

29. Automatic Refresh

Automatic refresh may later be used selectively.

Appropriate example:

LIVE bulletin editor open
+
specific live fixture visible

Potential controlled refresh:

periodically refresh that fixture

Only while needed.

Do not poll:

all competitions
all fixtures
all day
30. Initial Cache Strategy

Suggested defaults:

Competitions
approximately 24 hours
Teams
approximately 24 hours
Future fixtures
approximately 3–6 hours
Finished fixtures

Persist locally.

Do not repeatedly retrieve unchanged finished results without explicit reason.

Statistics

Persist once reliably retrieved for a finished fixture.

LIVE fixtures

Refresh only while actively needed.

These are initial defaults, not domain rules.

They belong to provider/application configuration.

31. Last Updated Metadata

The application should expose synchronization freshness.

Examples:

Competitions
Updated 2 hours ago
Fixtures
Updated 10 minutes ago
Corners
Not available

Do not represent old cached data as newly synchronized.

32. Safe Synchronization Rule

Provider synchronization must never destroy valid local information merely because an API returned:

empty response;
partial response;
timeout;
500;
malformed payload;
quota error.

Rule:

provider failure
≠
local deletion
33. Replace vs Merge

Synchronization should normally merge external information into local records.

Avoid blind replacement.

Conceptually:

Existing local record
+
normalized provider update
+
manual override policy
=
updated local record
34. Manual Overrides

Manual edits must remain first-class.

Example:

Provider team name:
Sport Lisboa e Benfica

User-selected display name:
Benfica

A later provider synchronization must not silently overwrite an explicitly protected manual value.

The implementation should distinguish:

provider-controlled value
manual override value
effective value

where needed.

Do not over-model every field initially.

Implement this distinction where actual user editing requires it.

35. Matching Priority

When synchronizing an external entity, use this order:

1. Existing ProviderReference
2. Explicit user mapping
3. Safe deterministic match
4. Manual resolution / create candidate

Do not use dangerous fuzzy auto-merges.

36. Existing Provider Reference

Best case:

providerId
+
externalId
↓
ProviderReference
↓
localEntityId

This mapping should always take precedence over name matching.

External IDs must never replace internal IDs.

37. Competition Matching

Potential deterministic matching inputs:

normalized exact name;
country;
known aliases;
explicit provider mapping.

Example:

Premier League
+
England

may be a strong match.

But:

Premier League

alone may be ambiguous across data sources or sports.

Unsafe matches should require confirmation.

38. Team Matching

Recommended priority:

ProviderReference
↓
explicit mapping
↓
exact normalized team name
↓
exact alias
↓
manual resolution

Do not automatically merge using fuzzy similarity alone.

For example:

United

is never sufficient.

39. Team Aliases

Aliases may assist deterministic matching.

Examples:

Manchester United
Manchester Utd
Man United

Alias comparison should use normalized text.

Normalization may safely include:

case normalization;
Unicode normalization;
whitespace normalization.

Do not remove semantically important words aggressively.

40. Fixture Matching

Fixture matching requires more care than team matching.

Preferred:

existing provider fixture reference

Otherwise potential matching tuple:

competition
+
home team
+
away team
+
kickoff time tolerance

All involved team mappings should already be resolved where practical.

41. Fixture Time Tolerance

Providers may differ slightly in kickoff timestamps after postponements or corrections.

If deterministic fallback matching uses kickoff time, apply an explicit limited tolerance.

Example conceptual policy:

same mapped teams
+
same competition when known
+
kickoff within configured tolerance

Do not match fixtures only because dates are close.

The exact tolerance should be documented in implementation configuration.

42. Provider References

Provider mappings must persist.

Conceptual:

ProviderReference
-----------------
provider
entity type
local entity ID
external ID

Supported entity types initially:

COMPETITION
TEAM
FIXTURE

A local entity may have references from multiple providers.

43. Multiple Providers

Example:

Team: Benfica

GOAL_API
externalId = 123

FOOTBALL_DATA
externalId = 1903

THESPORTSDB
externalId = 133602

All map to the same:

Bet Studio Team ID

Provider references must not create duplicate domain teams by design.

44. Provider Priority

Each integration use case may choose the first suitable enabled provider by configured priority.

Example:

fixtures:
GOAL_API
→ FOOTBALL_DATA
→ local

Example:

team artwork:
THESPORTSDB
→ GOAL_API
→ manual asset

Example:

corners:
provider with verified corner capability
→ manual input

Do not assume one global priority fits every resource type.

45. Fallback Behavior

Fallback should be deliberate.

Example:

Request fixtures
↓
primary unavailable
↓
secondary provider available and mapped
↓
use secondary

But provider fallback must not silently create inconsistent duplicate data.

Where mapping confidence is insufficient:

use local cached data

instead.

46. Provider Selection

Conceptual service:

interface ProviderSelector {
  select(
    capability: keyof ProviderCapabilities
  ): FootballDataProvider | null;
}

The exact implementation may be simpler.

The important rule is that provider choice belongs outside domain business logic.

47. Competition Synchronization

Conceptual flow:

User selects provider
      ↓
Fetch competitions
      ↓
Normalize
      ↓
Match existing provider references
      ↓
Match safe local candidates
      ↓
Create/update mappings
      ↓
Preview/import

For initial versions, user confirmation before importing large sets is preferable.

48. Team Synchronization

Recommended flow:

Select competition
      ↓
Fetch provider teams
      ↓
Normalize
      ↓
Resolve team mappings
      ↓
Preview unmatched teams
      ↓
Import/update

Do not automatically remove local teams absent from a provider response.

49. Fixture Synchronization

Recommended flow:

Select competition/date range
      ↓
Fetch fixtures
      ↓
Normalize teams/status/time
      ↓
Resolve mappings
      ↓
Create/update local fixtures
      ↓
Store provider references

Avoid requesting an entire season if only today's fixtures are needed.

50. Fixture Result Synchronization

For a saved fixture:

Local Fixture
      ↓
provider reference
      ↓
getFixture()
      ↓
normalize
      ↓
propose/update result

When final score becomes available, store it locally.

The Market Engine evaluates only after structured local/application result data exists.

51. Result Confirmation

For initial versions, Bet Studio may present provider settlement data for confirmation before applying it to an important historical bulletin.

Example:

Provider result:
Benfica 2–1 Porto

Corners:
Benfica 6
Porto 4

[Confirm]

This can be particularly useful while provider reliability is still being validated.

Do not make confirmation mandatory for every future workflow if automation is later trusted.

52. Fixture Statistics Synchronization

Statistics may require a separate provider request from fixture result retrieval.

Conceptual:

Local fixture
      ↓
statistics-capable provider
      ↓
normalized statistics
      ↓
local FixtureResultDetails

Initial required statistic:

corners

Do not persist every provider statistic merely because it is available.

53. Market-Driven Data Scope

External data should be driven by actual product requirements.

Current automatically evaluated markets require:

fixture status
full-time score
home corners
away corners

Therefore API integration should prioritize those fields.

Do not initially fetch or persist:

possession;
shots;
fouls;
offsides;
player statistics;
lineups;
referees;

unless another feature requires them.

54. Logo Synchronization

Remote logo URL:

provider
↓
download
↓
validate
↓
local asset
↓
Asset record

Rendering should use the local asset.

Do not render directly from external provider URLs.

55. Asset Validation

Before saving a provider image:

verify successful HTTP response;
enforce reasonable file size;
validate supported image MIME type;
avoid executable content;
generate controlled local filename;
never trust provider filename directly.

Allowed formats may initially include:

PNG
JPEG
WEBP
SVG

SVG requires safe handling before rendering.

56. Logo Replacement

Provider synchronization must not automatically replace a logo that the user explicitly selected manually.

Priority conceptually:

manual logo override
>
provider cached logo
>
placeholder

Provider artwork may be refreshed explicitly.

57. Request Validation

Every application request that triggers provider access must validate:

provider ID;
competition;
fixture;
requested date range;
pagination parameters;
required capabilities.

Never interpolate arbitrary unvalidated user strings into provider URLs.

58. Response Validation

External responses must be treated as untrusted input.

Validate normalized data before passing it into synchronization.

Use Zod or equivalent boundary validation where useful.

Check at minimum:

external ID
team names
dates
scores
statistics
response shape

Invalid records should not corrupt the local database.

59. Partial Provider Responses

One malformed record should not necessarily invalidate an entire large synchronization result.

Where safe:

valid records
→ process

invalid records
→ reject/report

Sync status may become:

PARTIAL

The synchronization record should report counts.

60. Synchronization Result

Conceptual result:

type SyncResult = {
  providerId: string;

  status:
    | 'SUCCESS'
    | 'PARTIAL'
    | 'FAILED';

  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  failed: number;

  warnings: SyncWarning[];
};

This is useful for both UI feedback and tests.

61. Transaction Boundaries

Database writes during synchronization should use transactions where consistency requires it.

Example:

create team
+
create provider reference

should generally succeed or fail together.

Do not wrap long external network calls inside database transactions.

Correct flow:

HTTP request
↓
normalize
↓
validate
↓
database transaction
62. Idempotency

Running the same synchronization repeatedly should not create duplicate entities.

Example:

sync competition
sync competition again

should normally result in:

0 duplicate competitions
0 duplicate teams

Provider references and uniqueness constraints should help guarantee this.

63. Pagination

If a provider paginates responses, the adapter owns pagination mechanics.

Application synchronization should receive normalized results or a controlled page abstraction.

Never leak provider page tokens into domain objects.

For large datasets, avoid unbounded automatic pagination.

Respect quota and configured limits.

64. Date Ranges

Fixture synchronization should use narrow date ranges where practical.

Example:

today
next 7 days
selected matchday

Prefer:

small requested window

over:

entire competition history

unless explicitly required.

65. Background Jobs

Version 1 does not require:

Redis;
queue workers;
schedulers;
distributed jobs.

Synchronization can run inside the local application process.

If long-running imports become necessary later, architecture may evolve without changing provider/domain contracts.

66. Concurrency

Prevent accidental duplicate synchronization of the same resource where practical.

Example:

Refresh fixtures

should disable or deduplicate an identical refresh already in progress.

No distributed locking is required for local v1.

67. Live Refresh

If LIVE support uses automatic refresh later:

page active
+
fixture LIVE
+
provider supports live score
↓
controlled polling

Stop when:

page closes;
user leaves live workflow;
fixture becomes FINISHED;
quota becomes constrained;
provider fails repeatedly.

Minimum polling interval must respect provider terms and rate limits.

68. Offline Behavior

If the computer has no internet connection:

Bet Studio must still support:

CRUD
bulletin creation
manual fixtures
manual results
manual corners
market settlement
history
rendering
export

External refresh controls should fail gracefully.

69. Local Cache Behavior

Cached provider-derived records should remain usable offline.

Example:

Last synchronized yesterday

is preferable to:

No teams available

just because the provider is currently unreachable.

70. Synchronization Metadata

Store useful metadata such as:

provider
resource type
scope
start time
completion time
status
records processed
safe error information

Do not store entire HTTP responses indefinitely without a specific debugging need.

71. Logging

Useful provider log events:

provider request started
provider request completed
provider request failed
rate limit reached
sync started
sync completed
mapping unresolved

Logs must never include:

API key
Authorization header
secret URL parameter
full sensitive environment configuration
72. Development Logging

Provider payload snippets may occasionally help debugging.

If enabled:

sanitize secrets;
limit payload size;
disable verbose provider logging by default;
never commit captured private keys.
73. Provider-Specific Tests

Each provider adapter requires tests for:

competition normalization;
team normalization;
fixture normalization;
status mapping;
score mapping;
malformed responses;
authentication failure handling;
rate-limit handling;
statistics mapping where supported.

Prefer stored minimal fixtures/mocks over live API calls in automated tests.

74. No Live API Calls in CI

GitHub Actions must not depend on external provider availability.

CI should use:

mock responses
fixture JSON
adapter tests

not real provider API requests.

Benefits:

no secret requirement;
no quota usage;
deterministic tests;
faster CI;
provider outages do not break builds.
75. Optional Manual Integration Tests

Developers may run provider integration checks locally.

Example conceptual command:

test:integration:goal-api

These tests may require an API key and network connectivity.

They must not run by default in CI.

76. Contract Fixtures

Keep small representative provider response samples.

Example:

tests/fixtures/providers/
├── goal-api/
│   ├── competition.json
│   ├── teams.json
│   ├── fixture-scheduled.json
│   ├── fixture-live.json
│   └── fixture-finished.json
└── football-data/

Do not store huge provider dumps.

Do not store confidential information.

77. Provider Contract Changes

External APIs may change.

When a provider response changes:

adapter test fails

rather than domain code silently breaking.

Only the provider adapter should normally require modification.

78. GOAL API Adapter

Suggested initial adapter:

GoalApiProvider

Initial target capabilities should be verified against current documentation before implementation.

Potential Bet Studio use cases:

competitions
teams
fixtures
fixture status
scores
live data
statistics where available

Do not assume corner statistics exist for every competition or plan.

The adapter must explicitly represent unavailable fields as unavailable.

79. football-data.org Adapter

Potential adapter:

FootballDataProvider

Useful potential roles:

competition data
teams
fixtures
schedules
results
league tables if ever needed

Bet Studio should use only required fields.

Its free tier may be useful as a fallback for several major competitions.

Statistics such as corners must be treated as a separate capability and must not be assumed part of the basic free fixture response.

80. OpenFootball Adapter

OpenFootball may be treated as a static/open-data provider.

Characteristics conceptually:

no traditional authenticated REST account required
static JSON datasets
fixtures/results focus
public/open data

Potential roles:

fallback fixture data;
development/testing;
historical/open datasets.

Limitations:

source freshness may differ from commercial/live providers;
artwork is not its primary role;
detailed live statistics should not be assumed.

Do not treat static dataset refresh behavior as live API behavior.

81. TheSportsDB Adapter

Potential provider:

TheSportsDbProvider

Recommended initial role:

team metadata
team artwork
competition artwork

It may support broader sports data, but Bet Studio should avoid depending on optional premium/live capabilities unless explicitly selected.

Provider artwork must still be downloaded and cached locally before rendering.

82. Provider Configuration UI

Future/local settings may expose:

Provider
Enabled
Connection status
Priority
Capabilities
Last successful sync
Quota information

API key value should never be displayed in full after configuration.

For initial local development, .env configuration is sufficient.

83. Connection Test

A provider may expose an application-level:

Test connection

action.

It should:

perform the cheapest suitable request;
verify authentication;
verify response parsing;
return normalized success/failure;
avoid unnecessary quota consumption.

Do not use a large fixture import merely to test credentials.

84. Provider Health

Conceptual state:

type ProviderHealth =
  | 'UNKNOWN'
  | 'AVAILABLE'
  | 'DEGRADED'
  | 'UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'MISCONFIGURED';

This is operational UI/application information.

It must not affect historical bulletin validity.

85. Provider Data Is Not Automatically Correct

External football data may contain:

delays;
incorrect scores;
naming differences;
missing statistics;
status inconsistencies.

Therefore provider data must be treated as external input, not unquestionable truth.

Manual correction must always remain possible.

86. Historical Bulletin Protection

Synchronizing a fixture must not silently mutate historical snapshots already used by saved bulletins.

Example:

Provider corrects team logo

Existing historical bulletin:

keeps saved snapshot

unless user explicitly refreshes historical content.

Likewise:

provider later changes fixture result

must not silently rewrite a manually confirmed historical settlement.

87. Result Updates and Historical Data

A local fixture may receive corrected provider results.

The application can then:

show the correction;
offer re-evaluation;
update calculated status if allowed;
preserve manual override;
create/update appropriate result snapshot.

Do not silently destroy the previous audit trail.

88. Network Security

Requirements:

HTTPS for remote providers.
Never disable TLS certificate validation.
Validate configurable base URLs if custom providers are introduced.
Restrict remote asset protocols.
Avoid server-side requests to arbitrary user-provided URLs.

Provider endpoint configuration should be controlled, not open SSRF input.

89. Dependency Policy

Do not install a provider SDK unless it provides clear value over ordinary HTTP requests.

Prefer:

native/platform HTTP
or existing HTTP abstraction

when the provider API is straightforward.

Provider SDKs must not leak into application/domain code.

90. Initial Implementation Scope

Version 1 should implement:

provider abstraction
provider registry/composition
one real API provider
competition synchronization
team synchronization
fixture synchronization
fixture result synchronization
corner synchronization if supported
provider mappings
safe error handling
manual refresh
last-sync metadata
local fallback

Do not initially implement all possible providers merely because this document defines them.

91. Suggested Implementation Order

Recommended sequence:

1. Provider contracts
2. Normalized external models
3. Provider registry
4. HTTP/error infrastructure
5. GoalApiProvider
6. Competition sync
7. Team sync
8. Fixture sync
9. Result sync
10. Statistics/corners sync
11. Provider mappings
12. UI refresh actions
13. Adapter tests
14. Sync integration tests

Implement only what is necessary for each stage.

92. Suggested Source Structure
src/
├── application/
│   └── synchronization/
│       ├── sync-competitions.ts
│       ├── sync-teams.ts
│       ├── sync-fixtures.ts
│       ├── sync-fixture-result.ts
│       └── sync-fixture-statistics.ts
│
├── infrastructure/
│   └── providers/
│       ├── football-data-provider.ts
│       ├── provider-capabilities.ts
│       ├── provider-registry.ts
│       ├── normalized-models.ts
│       │
│       ├── goal-api/
│       │   ├── goal-api-provider.ts
│       │   ├── goal-api-client.ts
│       │   ├── goal-api-mapper.ts
│       │   └── goal-api-schemas.ts
│       │
│       ├── football-data/
│       ├── openfootball/
│       └── thesportsdb/
│
└── shared/
    └── errors/
        ├── provider-error.ts
        └── rate-limit-error.ts

Do not create empty provider directories before they are implemented unless they serve a concrete purpose.

93. Synchronization Tests

Application synchronization tests should verify:

known provider reference updates correct entity
unknown safe match creates mapping
duplicate sync is idempotent
manual overrides survive sync
provider failure preserves local data
empty provider response does not delete data
invalid record does not corrupt database
partial sync returns PARTIAL
fixture result updates correctly
corners persist correctly
94. Provider Failure Tests

At minimum:

timeout
500 response
401/403 authentication error
429 rate limit
malformed JSON
unexpected schema
empty response
partial invalid records

All failures must produce controlled behavior.

95. Market Engine Integration

API providers do not settle bets.

Correct flow:

Provider
↓
ExternalFixture
↓
Sync service
↓
Local fixture/result
↓
Application evaluation request
↓
Market Engine
↓
Settlement

Forbidden:

Provider
↓
GREEN / RED

Settlement rules belong exclusively to the Market Engine.

96. Rendering Integration

The renderer must never query a football API.

Correct:

API synchronization
↓
local data
↓
bulletin snapshot
↓
renderer

Forbidden:

renderer
↓
provider logo URL

or:

renderer
↓
fixture API
97. Current Data Requirements

The initial market catalog requires automatic access to:

fixture status
home score
away score
home corners
away corners

Therefore provider evaluation must explicitly verify these capabilities.

A provider that supports fixtures and results but not corners remains useful.

Do not reject an otherwise useful provider simply because it lacks one optional capability.

98. Future Provider Requirements

Future markets may require:

half-time scores
cards
team corners
player statistics
shots

Add provider capabilities only when product requirements justify them.

Do not model all possible football statistics in advance.

99. Acceptance Criteria

API integration is correctly implemented when:

Bet Studio works without any provider configured.
External IDs never become domain primary keys.
Provider-specific response formats stay inside adapters.
External responses are validated.
One provider can be replaced without changing domain logic.
Synchronization is idempotent.
Manual records remain supported.
Manual overrides are not silently overwritten.
Provider failures preserve local data.
Empty responses do not trigger destructive deletion.
Rate limits are handled explicitly.
Secrets remain server-side.
No API keys reach frontend code.
Fixture status and scores normalize correctly.
Corner data is normalized only when genuinely available.
The Market Engine never calls providers.
The renderer never calls providers.
CI does not require real external APIs.
Provider adapters have normalization tests.
Sync operations expose useful success/failure metadata.
All project quality gates pass.
100. Guiding Principle

External APIs should improve Bet Studio without becoming a dependency for its core operation.

Prefer:

provider
+
adapter
+
normalized data
+
safe synchronization
+
local persistence
+
manual fallback

over:

UI directly coupled to remote API

Bet Studio owns its domain data.

Providers only supply external observations.
```
