# Bet Studio — Data Model

## 1. Purpose

This document defines the persistent data model for Bet Studio.

Goals:

- Stable internal identifiers.
- Local-first operation.
- Provider-independent football data.
- Deterministic bulletin reconstruction.
- Safe manual overrides.
- Historical integrity.
- Simple SQLite persistence.
- Clear domain relationships.

Implementation details such as repository classes belong to `architecture.md`.

Detailed market settlement logic belongs to `market-engine.md`.

---

## 2. General Rules

### Internal IDs

All persisted entities must use Bet Studio internal IDs.

External provider IDs must never be used as primary keys.

Recommended ID format:

- UUID or equivalent collision-resistant string ID.

Example:

```text
team.id = "..."
providerReference.externalId = "1234"

The exact ID generator may be selected during implementation, but IDs must:

Be generated locally.
Be immutable.
Not expose database row ordering.
Remain stable across provider changes.
3. Common Timestamps

Persistent entities should include timestamps where useful:

createdAt
updatedAt

Use UTC internally.

Display formatting belongs to the presentation layer.

4. Competition

Represents a football competition.

Examples:

Premier League
LaLiga
UEFA Champions League
Liga Portugal Betclic

Conceptual model:

type Competition = {
  id: CompetitionId;
  name: string;
  shortName: string | null;
  countryCode: string | null;
  regionName: string | null;
  logoAssetId: AssetId | null;
  active: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

Rules:

name is required.
name does not need to be globally unique.
Archived competitions must remain available to historical bulletins.
Deactivation must not delete historical references.
A competition may have zero or many teams.
A competition may have references to multiple external providers.
5. Team

Represents a football team.

Conceptual model:

type Team = {
  id: TeamId;
  name: string;
  shortName: string | null;
  countryCode: string | null;
  logoAssetId: AssetId | null;
  active: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

Rules:

name is required.
A team may participate in multiple competitions.
A team may exist without belonging to a competition.
Team deletion must not invalidate historical bulletins.
Manual logo selection may override provider-derived logos.
6. Team Alias

Stores alternate names used to identify the same team.

Examples:

Manchester United
Manchester Utd
Man United
Man Utd

Conceptual model:

type TeamAlias = {
  id: TeamAliasId;
  teamId: TeamId;
  value: string;
  normalizedValue: string;
  createdAt: Date;
};

Rules:

Alias matching should be case-insensitive.
Normalized aliases should support reliable matching.
Duplicate aliases for the same team should be prevented.
Aliases must not be used as primary display names unless explicitly selected.
7. Competition-Team Association

A many-to-many relationship between competitions and teams.

Conceptual model:

type CompetitionTeam = {
  competitionId: CompetitionId;
  teamId: TeamId;
  season: string | null;
  active: boolean;
};

Notes:

season is optional in the initial version.
The same team may appear in the same competition across multiple seasons.
Season-specific modeling must remain lightweight initially.

Suggested uniqueness:

competitionId + teamId + season
8. Provider

Represents an external football-data source.

Conceptual model:

type Provider = {
  id: ProviderId;
  code: string;
  displayName: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

Examples:

GOAL_API
FOOTBALL_DATA
OPENFOOTBALL
THESPORTSDB

Do not store API secrets directly in this table.

Secrets belong to environment/configuration storage.

9. Provider Reference

Maps a local entity to an external provider entity.

Conceptual model:

type ProviderReference = {
  id: ProviderReferenceId;
  providerId: ProviderId;
  entityType:
    | 'COMPETITION'
    | 'TEAM'
    | 'FIXTURE';
  localEntityId: string;
  externalId: string;
  createdAt: Date;
  updatedAt: Date;
};

Suggested uniqueness:

providerId + entityType + externalId

Also prevent duplicate mappings for the same local entity/provider where inappropriate.

Provider references must be removable without deleting the local entity.

10. Asset

Represents locally usable visual media.

Initial uses:

Team logos
Competition logos
OwlClub branding
Placeholder images
Template assets

Conceptual model:

type Asset = {
  id: AssetId;
  type:
    | 'TEAM_LOGO'
    | 'COMPETITION_LOGO'
    | 'BRAND'
    | 'TEMPLATE'
    | 'PLACEHOLDER'
    | 'OTHER';

  source:
    | 'LOCAL'
    | 'PROVIDER'
    | 'GENERATED';

  filePath: string;
  mimeType: string | null;
  originalUrl: string | null;
  providerId: ProviderId | null;
  createdAt: Date;
  updatedAt: Date;
};

Rules:

Rendering must use local/cached assets where available.
Provider URLs must not be required at render time.
Missing assets must have safe fallbacks.
Historical bulletins must not break solely because an external URL changes.
11. Fixture

Represents a football match.

Conceptual model:

type Fixture = {
  id: FixtureId;

  competitionId: CompetitionId | null;

  homeTeamId: TeamId;
  awayTeamId: TeamId;

  kickoffAt: Date | null;

  status: FixtureStatus;

  homeScore: number | null;
  awayScore: number | null;

  liveMinute: number | null;

  sourceType:
    | 'MANUAL'
    | 'SYNCED';

  createdAt: Date;
  updatedAt: Date;
};

Initial fixture statuses:

type FixtureStatus =
  | 'SCHEDULED'
  | 'LIVE'
  | 'FINISHED'
  | 'POSTPONED'
  | 'CANCELLED'
  | 'ABANDONED'
  | 'UNKNOWN';

Rules:

Scores may remain null until known.
Result data must never be invented.
Manual fixtures must be fully supported.
A synchronized fixture may be manually corrected.
Historical bulletin data must not depend exclusively on current fixture values.
12. Fixture Result Details

Some betting markets require information beyond the final score.

The initial model should support optional structured result details without forcing all possible football statistics into the core fixture table.

Conceptual model:

type FixtureResultDetails = {
  fixtureId: FixtureId;

  halfTimeHomeScore: number | null;
  halfTimeAwayScore: number | null;

  homeCorners: number | null;
  awayCorners: number | null;

  extraData: unknown | null;

  updatedAt: Date;
};

extraData may later hold validated structured information required by additional market evaluators.

Do not use unvalidated arbitrary JSON as a substitute for properly modeled frequently used fields.

13. Market

Represents a selectable betting market definition.

Conceptual model:

type Market = {
  id: MarketId;

  code: string;
  name: string;
  category: string | null;

  active: boolean;
  autoEvaluable: boolean;

  evaluatorKey: string | null;
  parameters: unknown | null;

  createdAt: Date;
  updatedAt: Date;
};

Examples:

HOME_WIN
DRAW
AWAY_WIN
OVER_2_5
UNDER_2_5
BTTS_YES
DOUBLE_CHANCE_1X

Rules:

code must be unique.
code is a stable domain identifier.
Display name may change without changing the code.
evaluatorKey links the market to domain evaluation logic.
parameters stores validated evaluator configuration where applicable.
Market rules themselves are not stored as executable user-provided code.
Unsupported markets may have autoEvaluable = false.
14. Bulletin

Represents one betting bulletin.

Conceptual model:

type Bulletin = {
  id: BulletinId;

  publicCode: string;

  type:
    | 'SINGLE'
    | 'MULTI';

  mode:
    | 'PRE_MATCH'
    | 'LIVE';

  status: BulletinStatus;

  stake: number | null;

  totalOdd: number | null;

  templateId: TemplateId;
  templateVersion: number;

  renderConfig: BulletinRenderConfig;

  createdAt: Date;
  updatedAt: Date;
};

Initial bulletin statuses:

type BulletinStatus =
  | 'PENDING'
  | 'GREEN'
  | 'RED'
  | 'VOID'
  | 'MANUAL';

Rules:

SINGLE contains exactly one selection.
MULTI contains between 1 and 10 selections.
publicCode is human-readable and unique.

Example:

BET #0001

The exact format may be configurable later.

totalOdd may be calculated from selections.
Historical bulletin rendering must preserve its template version.
Bulletin records must remain reconstructable after later team/market edits.
15. Bulletin Selection

Represents one betting leg inside a bulletin.

Conceptual model:

type BulletinSelection = {
  id: BulletinSelectionId;

  bulletinId: BulletinId;
  position: number;

  fixtureId: FixtureId | null;

  marketId: MarketId | null;

  odd: number;

  calculatedStatus: SelectionStatus;

  manualStatus: SelectionStatus | null;

  createdAt: Date;
  updatedAt: Date;
};

Selection statuses:

type SelectionStatus =
  | 'PENDING'
  | 'GREEN'
  | 'RED'
  | 'VOID'
  | 'MANUAL';

Rules:

position defines deterministic visual ordering.
Position must be unique inside a bulletin.
odd must be greater than zero.
Maximum selections per bulletin: 10.
A selection may reference a local fixture.
manualStatus overrides calculatedStatus when present.
Automatic evaluation must not overwrite the stored manual override.

Effective status:

manualStatus ?? calculatedStatus
16. Bulletin Snapshot Data

Historical bulletins must not change visually or semantically when source entities are later renamed or modified.

Therefore each selection must preserve display snapshots used when the bulletin was created/rendered.

Conceptual model:

type BulletinSelectionSnapshot = {
  selectionId: BulletinSelectionId;

  homeTeamName: string;
  awayTeamName: string;

  homeTeamLogoAssetId: AssetId | null;
  awayTeamLogoAssetId: AssetId | null;

  competitionName: string | null;

  marketCode: string;
  marketName: string;

  kickoffAt: Date | null;

  createdAt: Date;
};

Example:

If:

Liga NOS

is later renamed to:

Liga Portugal Betclic

an old bulletin may continue rendering with the historical value stored in its snapshot.

The application may explicitly offer a future "refresh snapshot" action, but must never perform it silently.

17. Selection Result Snapshot

When a bulletin is settled, store the result used for evaluation.

Conceptual model:

type SelectionResultSnapshot = {
  selectionId: BulletinSelectionId;

  homeScore: number | null;
  awayScore: number | null;

  fixtureStatus: FixtureStatus | null;

  evaluatedAt: Date | null;

  evaluationVersion: string | null;

  resultSource:
    | 'FIXTURE'
    | 'MANUAL'
    | 'PROVIDER'
    | null;

  createdAt: Date;
  updatedAt: Date;
};

Purpose:

Preserve what result was used.
Prevent future provider corrections from silently changing old settlements.
Allow deterministic re-evaluation.
Support debugging.
18. Manual Settlement Override

Manual overrides should remain auditable.

Conceptual model:

type SettlementOverride = {
  id: SettlementOverrideId;

  selectionId: BulletinSelectionId;

  previousStatus: SelectionStatus | null;
  newStatus: SelectionStatus;

  reason: string | null;

  createdAt: Date;
};

Initial local version does not require user IDs.

Rules:

Do not erase calculated settlement history.
Latest active manual override determines effective status.
Optional reason should be supported.

A simpler implementation may store manualStatus on the selection plus an override history table.

19. Render Configuration

Bulletin-specific rendering choices must be persisted.

Conceptual example:

type BulletinRenderConfig = {
  showCompetition: boolean;
  showDate: boolean;
  showTime: boolean;
  showStake: boolean;
  showTotalOdd: boolean;
  showResult: boolean;
  showBulletinCode: boolean;
};

Do not store calculated layout coordinates here unless they are intentionally part of a persisted rendering contract.

Layout rules belong to templates.

20. Template

Represents a bulletin design.

Conceptual model:

type Template = {
  id: TemplateId;

  code: string;
  name: string;

  bulletinType:
    | 'SINGLE'
    | 'MULTI';

  mode:
    | 'PRE_MATCH'
    | 'LIVE';

  active: boolean;

  currentVersion: number;

  createdAt: Date;
  updatedAt: Date;
};

Rules:

Template code must be stable and unique.
Visual revisions require versioning when they could alter historical renders.
Historical bulletins keep the version originally used.
21. Template Version

Stores immutable rendering configuration for a template release.

Conceptual model:

type TemplateVersion = {
  id: TemplateVersionId;

  templateId: TemplateId;
  version: number;

  config: unknown;

  createdAt: Date;
};

Suggested uniqueness:

templateId + version

Once referenced by a saved bulletin, a template version must not be modified destructively.

Create a new version instead.

The exact configuration schema belongs to rendering-engine.md.

22. Render Record

Optionally track generated assets.

Conceptual model:

type RenderRecord = {
  id: RenderRecordId;

  bulletinId: BulletinId;

  templateId: TemplateId;
  templateVersion: number;

  outputFormat: 'FEED' | 'STORY';

  filePath: string;

  createdAt: Date;
};

Initial output format:

FEED = 1080 × 1350

Future:

STORY = 1080 × 1920

A bulletin may have multiple render records.

23. Synchronization Record

Tracks external-data synchronization activity.

Conceptual model:

type SyncRecord = {
  id: SyncRecordId;

  providerId: ProviderId;

  resourceType:
    | 'COMPETITIONS'
    | 'TEAMS'
    | 'FIXTURES'
    | 'RESULTS'
    | 'ASSETS';

  scopeKey: string | null;

  status:
    | 'SUCCESS'
    | 'PARTIAL'
    | 'FAILED';

  startedAt: Date;
  completedAt: Date | null;

  recordsProcessed: number | null;

  errorCode: string | null;
  errorMessage: string | null;
};

scopeKey may identify context such as:

competition:<id>
date:2026-09-10
fixture:<id>

Do not store secrets in synchronization records.

24. Provider Rate-Limit State

Where supported, store non-sensitive quota metadata.

Conceptual model:

type ProviderRateLimitState = {
  providerId: ProviderId;

  limit: number | null;
  remaining: number | null;
  resetsAt: Date | null;

  updatedAt: Date;
};

This data is informational and must not be assumed available for every provider.

25. Manual Versus Synced Data

Manual data must remain first-class.

Recommended provenance fields where relevant:

type DataOrigin =
  | 'MANUAL'
  | 'PROVIDER'
  | 'MIXED';

Do not create duplicate entities solely because one came from an API and another was manually created.

Synchronization should attempt matching using:

Existing provider reference.
Explicit user mapping.
Safe deterministic matching rules.
Otherwise require/manual create a new mapping.

Never perform risky automatic merges based only on approximate names.

26. Deletion Policy

Prefer archival over destructive deletion for referenced domain entities.

Safe to hard-delete

Typically:

Unused aliases.
Failed temporary imports.
Unreferenced drafts where explicitly requested.
Prefer archive/deactivate
Competitions
Teams
Markets
Templates
Preserve
Historical bulletins
Bulletin selections
Settlement snapshots
Template versions used by bulletins

Database foreign keys must protect historical integrity.

27. Numeric Data
Odds

Store using a representation that avoids accidental floating-point business errors.

Implementation may use:

SQLite numeric/text representation with application-level decimal handling.

Do not rely on binary floating-point arithmetic for settlement-critical calculations without explicit handling.

Initial display should support standard decimal odds.

Example:

1.85
2.10
12.50
Scores

Store as non-negative integers.

Stake

If implemented as currency-sensitive data, use decimal-safe storage.

Do not assume cents are sufficient for every future representation unless currency is explicitly modeled.

28. Time Data

Store timestamps in UTC.

Fixtures should retain enough information to correctly display local match date/time.

If provider timezone information is available, normalize it at import boundaries.

Presentation determines displayed timezone.

Do not store formatted strings such as:

"10 September, 20:00"

as canonical date data.

29. Initial Relational Overview
Competition
    │
    ├────────< CompetitionTeam >──────── Team
    │                                      │
    │                                      └────< TeamAlias
    │
    └────────< Fixture >───────────────────┘
                     │
                     │
                     └────< BulletinSelection
                               │
Bulletin ──────────────────────┤
                               │
                               ├──── BulletinSelectionSnapshot
                               ├──── SelectionResultSnapshot
                               └──── SettlementOverride

Market ────────────────────────┘

Provider
   │
   ├────< ProviderReference
   ├────< SyncRecord
   └──── ProviderRateLimitState

Asset
   ├──── Competition
   ├──── Team
   └──── BulletinSelectionSnapshot

Template
   └────< TemplateVersion
             │
             └──── Bulletin

Bulletin
   └────< RenderRecord
30. Suggested Initial Database Tables

The initial SQLite schema should approximately contain:

competitions
teams
team_aliases
competition_teams

providers
provider_references
provider_rate_limits
sync_records

assets

fixtures
fixture_result_details

markets

bulletins
bulletin_selections
bulletin_selection_snapshots
selection_result_snapshots
settlement_overrides

templates
template_versions
render_records

Exact SQL and Drizzle schemas belong to implementation.

31. Recommended Indexes

At minimum consider indexes for:

competitions.active
teams.active

team_aliases.normalized_value

competition_teams.competition_id
competition_teams.team_id

fixtures.kickoff_at
fixtures.competition_id
fixtures.home_team_id
fixtures.away_team_id
fixtures.status

provider_references.provider_id
provider_references.external_id

bulletins.created_at
bulletins.status
bulletins.public_code

bulletin_selections.bulletin_id
bulletin_selections.fixture_id

sync_records.provider_id
sync_records.started_at

Do not add indexes without a real access pattern.

32. Initial Uniqueness Constraints

Recommended:

markets.code
templates.code
bulletins.public_code

team_aliases(team_id, normalized_value)

competition_teams(
  competition_id,
  team_id,
  season
)

provider_references(
  provider_id,
  entity_type,
  external_id
)

template_versions(
  template_id,
  version
)

bulletin_selections(
  bulletin_id,
  position
)

SQLite null semantics must be considered when implementing season-based uniqueness.

33. Database Migrations

Use migrations from the first schema version.

Rules:

Every schema change requires a migration.
Do not edit historical migrations after they are shared.
Never rely on destructive automatic schema synchronization.
Development resets are acceptable only for explicitly disposable local development databases.
Production-like user data should be migrated safely.
34. Seed Data

Seed data may provide:

Default markets.
Initial template definitions.
Known providers.
Optional starter competitions.

Seeds must be:

Idempotent where practical.
Separate from user-created data.
Safe to re-run.

Do not hardcode complete current football rosters into application source code.

Competition/team data should come from:

Synchronization,
import,
or manual CRUD.
35. Import/Export Considerations

The model should permit future backup/export of local data.

A future backup may include:

database
assets
template versions
configuration

Do not make backup/export a first-version requirement unless explicitly implemented.

Avoid persistence choices that make future export unnecessarily difficult.

36. Historical Integrity

This is a critical system invariant.

Once a bulletin has been saved, later changes to:

Team names
Team logos
Competition names
Market display names
Fixtures
Templates
Provider data

must not silently alter the historical meaning or appearance of that bulletin.

Use:

Selection snapshots
Result snapshots
Template versions
Stable internal IDs

to preserve reproducibility.

37. Determinism Invariant

A historical render should be reproducible from:

Bulletin
+
Bulletin selections
+
Selection snapshots
+
Result snapshots
+
Render configuration
+
Template version
+
Required local assets

External APIs must not be required to reproduce an existing saved bulletin.

38. Validation Invariants

At minimum:

Competition
name != empty
Team
name != empty
Fixture
homeTeamId != awayTeamId
scores >= 0 when present
Market
code != empty
name != empty
code unique
Bulletin
SINGLE → exactly 1 selection
MULTI → 1..10 selections
Selection
odd > 0
position >= 1
position <= 10
Score
integer
>= 0
Template
currentVersion >= 1

Domain validation must enforce these rules even if UI validation already exists.

39. First-Version Scope

Implement only data required by current Bet Studio functionality.

Do not initially model:

Players
Referees
Stadiums
Detailed match events
Full standings
Full league tables
User accounts
Permissions
Payments
Bookmakers
Currency systems
Bet placement transactions

Add these only if future product requirements require them.

40. Guiding Principle

Persist enough information to guarantee:

Correct domain behavior.
Reliable manual operation.
Provider independence.
Historical reproducibility.
Deterministic rendering.

Do not persist data merely because an external API happens to return it.
```
