You are implementing Phase 03 of Bet Studio: CRUD for Competitions, Teams and Markets.

Before making changes:

1. Read AGENTS.md.
2. Read docs/architecture.md.
3. Read docs/product-spec.md.
4. Read docs/data-model.md.
5. Read docs/market-engine.md only for the Market model/configuration contract. Do not implement settlement logic yet.
6. Inspect the implementation from Phases 01 and 02.
7. Inspect existing repositories, schemas, migrations, route patterns, UI conventions, tests and scripts.

The repository and documentation are the source of truth.

Do not introduce or reference any project identity other than Bet Studio.

---

# Goal

Implement production-quality local CRUD workflows for:

- Competitions
- Teams
- Markets

At the end of this phase, a user should be able to manage these entities through the application UI and API while preserving the architecture and persistence rules already established.

This phase should include:

- application use cases;
- Fastify API routes;
- request/response validation;
- React management screens;
- create/read/update/archive or deactivate behavior;
- useful search/filter behavior;
- team aliases;
- competition/team associations where appropriate;
- team and competition local logos/assets where already supported by the data model;
- market configuration editing;
- error handling;
- automated tests;
- README updates only where needed.

Do not implement:

- external football provider synchronization;
- automatic market settlement;
- bulletin builder;
- rendering engine;
- results/history workflows.

---

# 1. Preserve Previous Architecture

Do not recreate the database or foundational infrastructure.

Reuse:

- existing database connection;
- migrations;
- domain models;
- repository interfaces;
- repository implementations;
- application error conventions;
- Fastify bootstrap;
- React/Vite structure;
- shared validation patterns;
- test infrastructure.

If something from Phase 02 is incomplete and directly blocks this phase, fix it with the smallest coherent change.

Do not perform unrelated refactors.

---

# 2. Scope of CRUD

Implement user-facing management for:

## Competitions

- list;
- create;
- open/view;
- edit;
- activate/deactivate or archive according to the existing model;
- search/filter where useful.

## Teams

- list;
- create;
- open/view;
- edit;
- activate/deactivate or archive;
- manage aliases;
- associate with competitions;
- manage local logo reference where already supported.

## Markets

- list;
- create;
- open/view;
- edit;
- activate/deactivate;
- configure automatic evaluation metadata;
- support manual-only markets safely.

Do not implement destructive hard-delete by default for historically referenced entities.

---

# 3. Application Layer

CRUD behavior must be implemented through application use cases/services rather than directly inside Fastify routes or React components.

Conceptually:

Presentation
↓
Application
↓
Repositories / Domain
↓
Infrastructure

Create focused use cases such as:

- listCompetitions
- getCompetition
- createCompetition
- updateCompetition
- setCompetitionActive

- listTeams
- getTeam
- createTeam
- updateTeam
- setTeamActive
- addTeamAlias
- removeTeamAlias
- assignTeamToCompetition
- removeTeamFromCompetition

- listMarkets
- getMarket
- createMarket
- updateMarket
- setMarketActive

The exact names may follow existing conventions.

Do not build a large generic CRUD framework.

Explicit small use cases are preferred.

---

# 4. API Design

Expose clear Fastify routes under:

/api

A reasonable REST-style structure is:

GET /api/competitions
POST /api/competitions
GET /api/competitions/:id
PATCH /api/competitions/:id

GET /api/teams
POST /api/teams
GET /api/teams/:id
PATCH /api/teams/:id

POST /api/teams/:id/aliases
DELETE /api/teams/:id/aliases/:aliasId

POST /api/teams/:id/competitions/:competitionId
DELETE /api/teams/:id/competitions/:competitionId

GET /api/markets
POST /api/markets
GET /api/markets/:id
PATCH /api/markets/:id

The exact route design may adapt to existing project conventions.

Do not expose database records directly.

Use explicit API DTOs.

---

# 5. Request Validation

Validate every API input.

Use Zod through the project's existing validation approach.

Validate:

- route parameters;
- query parameters;
- request bodies.

Do not rely on UI validation alone.

Invalid requests should return stable, useful 4xx responses.

Do not expose raw Zod, SQLite or Drizzle internals directly to users.

---

# 6. API Response Shape

Use a consistent response strategy.

Do not create elaborate envelope abstractions if the project does not need them.

For single resources, returning a clear resource DTO is sufficient.

For lists, support simple metadata only when useful.

Example conceptually:

{
"items": [...],
"total": 23
}

Do not add cursor pagination unless the current scale requires it.

Local v1 datasets are expected to remain small.

---

# 7. Error Semantics

Map application errors appropriately.

Examples:

ValidationError → 400
NotFoundError → 404
ConflictError → 409

Unexpected infrastructure errors → controlled 500

Do not return stack traces or raw SQL messages to the client.

Keep useful causes in server-side logs.

---

# 8. Competition Model

Follow docs/data-model.md.

Support the fields already defined there.

Likely fields include:

- id;
- name;
- shortName where defined;
- country/region information where defined;
- active state;
- logo/asset reference where supported;
- timestamps.

Do not add:

- standings;
- points tables;
- season statistics;
- fixtures browsing.

Those are out of scope.

---

# 9. Competition Validation

At minimum validate:

- non-empty name;
- sensible maximum lengths;
- short name if provided;
- country/region values according to current model;
- active state transitions.

Names do not need to be globally unique unless the data model explicitly requires it.

Different countries may contain competitions with similar names.

Avoid overly restrictive uniqueness rules based only on display names.

---

# 10. Competition Listing

The competition screen should support a useful local management workflow.

Recommended features:

- text search;
- active/inactive filter;
- clear create action;
- open/edit action;
- visible country/region where available.

Do not implement advanced pagination/filter builders.

---

# 11. Competition Deactivation

Prefer deactivation/archive over hard deletion.

If a competition is referenced historically, do not delete it.

A deactivated competition:

- remains readable;
- remains valid in historical records;
- may be hidden from default selection lists;
- can be reactivated where appropriate.

Follow the actual Phase 02 model.

---

# 12. Team Model

Follow docs/data-model.md.

Support existing fields such as:

- internal ID;
- canonical name;
- short name;
- country/region where defined;
- active state;
- local logo/asset reference;
- timestamps.

Do not embed provider IDs into Team.

Do not implement provider import.

---

# 13. Team Validation

Validate:

- non-empty canonical name;
- short name where provided;
- sensible maximum lengths;
- valid logo/asset reference if provided;
- no invalid self-association behavior.

Do not automatically invent abbreviations.

If `shortName` is not supplied, keep it null unless the existing domain model defines another rule.

---

# 14. Team Aliases

Implement alias management.

Users should be able to:

- view team aliases;
- add alias;
- remove/deactivate alias according to the model.

Aliases are intended for future provider matching and search.

Normalize alias text using the existing data model rules.

Safe normalization may include:

- Unicode normalization;
- trim;
- whitespace normalization;
- case-normalized comparison.

Do not perform fuzzy matching.

Do not silently merge teams because names are similar.

---

# 15. Alias Constraints

Prevent duplicate aliases for the same team according to normalized comparison.

Examples that should probably conflict after normalization:

"Man United"
" man united "
"MAN UNITED"

Do not globally prohibit the same alias across all teams if the data model does not require that.

Ambiguous aliases may exist and should be resolved manually in future provider workflows.

---

# 16. Team / Competition Associations

Implement management of CompetitionTeam associations.

A user should be able to:

- see competitions assigned to a team;
- assign team to competition;
- remove association.

Prevent duplicate associations.

Removing an association must not delete either entity.

Do not implement historical season membership unless already part of the documented model.

---

# 17. Team Listing

Provide a useful team management screen.

Recommended features:

- text search;
- active/inactive filter;
- competition filter if straightforward;
- team logo thumbnail if available;
- canonical name;
- short name;
- create/edit action.

Avoid complex data grids unless already part of the project.

---

# 18. Local Asset Selection

If Phase 02 implemented Asset and the application already has local asset-storage support, allow a team or competition to reference a local asset.

Keep this narrow.

Do not implement external URL downloading yet.

Do not build a full digital asset manager.

Acceptable initial workflow:

- user chooses/uploads a local supported image;
- backend validates and stores it through the existing asset infrastructure;
- entity references the resulting immutable/version-safe asset.

If asset-upload infrastructure does not yet exist and implementing it would materially expand this phase, it is acceptable to defer file upload and support selecting an existing local Asset record only.

Report that decision.

---

# 19. Asset Upload Safety

If upload is implemented:

Validate:

- file size;
- MIME type;
- supported extension/content;
- generated storage filename;
- no arbitrary filesystem path from the client.

Do not trust the original filename as a storage path.

Do not allow arbitrary executable files.

Do not expose unrestricted server filesystem browsing.

---

# 20. Market Model

Follow docs/data-model.md and the configuration contract in docs/market-engine.md.

Market fields include:

- id;
- code;
- name;
- category where supported;
- active;
- autoEvaluable;
- evaluatorKey;
- parameters;
- timestamps.

Market code must remain stable and unique.

Do not implement actual evaluation in this phase.

---

# 21. Market Code

Market code is a machine-readable stable identifier.

Examples conceptually:

HOME_WIN
OVER_2_5
BTTS_YES

Requirements:

- non-empty;
- unique;
- normalized format;
- stable once used historically.

Prefer a restricted format such as:

A-Z
0-9
_

if consistent with current docs.

Do not derive settlement behavior from the code string.

The code identifies configuration; evaluatorKey + parameters define automatic behavior.

---

# 22. Market Display Name

Market `name` is user-facing text.

Users may edit display names without changing the underlying evaluator behavior.

Do not parse the name to determine:

- result side;
- goal line;
- corner line;
- composite behavior.

Settlement metadata must remain structured.

---

# 23. Auto-Evaluable Markets

When:

autoEvaluable = true

require:

- evaluatorKey;
- valid parameters for that evaluatorKey.

Supported evaluator keys for configuration are:

MATCH_RESULT
TOTAL_GOALS
DOUBLE_CHANCE
BTTS
TOTAL_CORNERS
COMPOSITE

Do not implement their execution yet.

Use validation schemas consistent with docs/market-engine.md.

---

# 24. Manual-Only Markets

When:

autoEvaluable = false

the market may use:

evaluatorKey = null
parameters = null

or the exact representation already established in Phase 02.

Such a market is valid.

Do not force unsupported markets into fake evaluator configurations.

This is an important product capability.

---

# 25. Evaluator Parameter Schemas

Implement enough validation to safely create/edit market configurations.

Use discriminated validation based on evaluatorKey.

Expected parameter structures include:

MATCH_RESULT

{
result: "HOME" | "DRAW" | "AWAY"
}

TOTAL_GOALS

{
direction: "OVER" | "UNDER",
line: number
}

DOUBLE_CHANCE

{
outcome: "1X" | "X2" | "12"
}

BTTS

{
selection: "YES" | "NO"
}

TOTAL_CORNERS

{
direction: "OVER" | "UNDER",
line: number
}

COMPOSITE

{
operator: "AND" | "OR",
conditions: [...]
}

Do not implement evaluator execution.

---

# 26. Half-Line Validation

For initial automatic totals support, only accept the documented supported line format.

If docs/market-engine.md currently supports half-goal / half-corner lines only, enforce values such as:

0.5
1.5
2.5
3.5

and reject unsupported Asian/integer line semantics for auto-evaluable configurations.

Do not silently treat unsupported lines as ordinary Over/Under rules.

A user may instead create a manual-only market.

---

# 27. Composite Market Configuration

Support editing the currently documented composite configuration safely.

Do not turn the composite editor into a generic visual programming system.

For v1, keep composite conditions bounded and structured.

Prefer primitive evaluator conditions only.

Do not allow nested COMPOSITE conditions unless docs/market-engine.md explicitly requires them.

If the document is still ambiguous on nested composites, implement the simpler safe rule:

COMPOSITE children may not themselves use COMPOSITE.

Validate this at the boundary.

---

# 28. Composite Complexity Limit

Apply a small explicit maximum number of composite conditions.

The initial catalog only requires simple combinations.

A reasonable v1 limit is:

2 to 4 conditions

unless docs specify another limit.

This protects against accidental recursive or excessively complex configuration.

Do not implement arbitrary-depth trees.

Document the chosen limit if it was not previously explicit.

---

# 29. Market Editor UX

The Market editor should not ask users to type arbitrary JSON.

Provide structured controls.

Example:

Auto evaluation: [on]

Evaluator:
[ Total Goals ]

Direction:
[ Over ]

Line:
[ 2.5 ]

For manual-only market:

Auto evaluation: [off]

Do not expose raw persistence JSON as the normal user experience.

A developer/debug JSON view is unnecessary.

---

# 30. Composite Editor UX

For COMPOSITE markets, provide a simple structured editor.

Example conceptually:

Operator:
[ AND ]

Condition 1:
[ Match Result ]
Result:
[ Home ]

Condition 2:
[ Total Goals ]
Direction:
[ Over ]
Line:
[ 2.5 ]

Keep the UI constrained to supported evaluator families.

Do not create drag-and-drop workflow builders.

---

# 31. Market Categories

If `category` is currently free text, keep it simple.

Examples might include:

Result
Goals
Corners
Combined

Do not create a separate MarketCategory database entity unless already documented or concretely necessary.

Avoid adding CRUD for categories in this phase.

---

# 32. Market Deactivation

Markets used historically must not be hard-deleted.

Deactivated markets:

- remain readable;
- remain valid in historical data;
- are excluded from default active selection lists;
- may be reactivated.

Do not mutate historical selection snapshots when a market is renamed or deactivated.

---

# 33. Stable Historical Behavior

Editing current catalog data must not silently rewrite saved historical snapshots.

Example:

1. Team currently named "Team A".
2. Existing historical bulletin snapshot contains "Team A".
3. User renames current Team to "Team Alpha".
4. Historical snapshot remains "Team A".

The same principle applies to:

- competition names;
- market labels;
- logos/assets where snapshots reference stable assets.

Add or preserve integration tests proving this behavior where relevant.

---

# 34. UI Navigation

Add clear management navigation for:

- Competitions
- Teams
- Markets

Do not build the final application dashboard yet.

A simple application shell with these sections is sufficient.

Preserve existing design language from Phase 01.

---

# 35. UI Quality

The CRUD UI should be functional and professional, not merely raw debug forms.

Requirements:

- readable layout;
- clear labels;
- useful empty states;
- clear loading states;
- clear error states;
- create/edit actions obvious;
- keyboard-accessible forms;
- visible focus states;
- sensible form validation feedback.

Do not spend excessive time on animation or final visual polish.

---

# 36. Data Fetching

Use the simplest maintainable client data-fetching approach appropriate to the existing project.

Do not add a large state/data framework solely for three CRUD modules unless already present.

Plain fetch plus small hooks/services is acceptable.

If an established query library already exists in the repository, reuse it.

Do not create a custom generic API framework.

---

# 37. Client API Boundary

Keep backend requests in a small presentation/data-access layer rather than scattering `fetch()` calls throughout arbitrary components.

Example conceptually:

presentation/web/api/competitions.ts
presentation/web/api/teams.ts
presentation/web/api/markets.ts

Adapt naming to the current project.

Do not confuse this frontend API client with the Application layer.

---

# 38. Forms

Use controlled, validated forms consistent with current project conventions.

Avoid adding a form library unless it clearly simplifies current implementation.

If no form library exists, ordinary React state is sufficient for these forms.

Do not add dependencies purely for fashion.

---

# 39. Search

Implement simple text search for competition/team/market lists.

For local v1 scale:

- server-side simple query filtering or client-side filtering may both be acceptable;
- choose the approach that best fits existing architecture.

If the API already supports filters cleanly, prefer server filtering.

Do not implement full-text search infrastructure.

---

# 40. Filtering

Useful filters include:

Competitions:

- active status

Teams:

- active status
- competition where practical

Markets:

- active status
- auto/manual evaluation
- category if useful

Do not implement complex saved filters.

---

# 41. Sorting

Use predictable default sorting.

Examples:

Competitions → name
Teams → name
Markets → category/name or name

If explicit sorting is implemented, keep options small.

Do not build generic column-sort infrastructure unless already available.

---

# 42. Pagination

Do not add pagination unless the current implementation clearly benefits from it.

The expected v1 local dataset is manageable.

If pagination is already part of repository/application conventions, reuse it.

Otherwise keep list behavior simple.

---

# 43. Optimistic Updates

Do not introduce optimistic UI updates unless existing project conventions already support them safely.

For CRUD management, straightforward:

request
→ success
→ refresh/update local state

is sufficient.

Correctness is more important than perceived milliseconds of latency.

---

# 44. Confirmation Behavior

Require confirmation for actions that materially hide/deactivate data when useful.

Do not use confirmation dialogs for every ordinary edit.

Hard deletion should not be exposed unless the data model explicitly permits safe deletion.

---

# 45. Duplicate Conflicts

Handle uniqueness conflicts clearly.

Examples:

- duplicate Market.code;
- duplicate TeamAlias for same Team;
- duplicate CompetitionTeam association.

Return 409 or the project's existing equivalent.

Show a useful form-level message.

Do not expose SQLite constraint text.

---

# 46. API Tests

Add route/application tests for high-value CRUD behavior.

At minimum cover:

Competitions:

- list;
- create;
- get;
- update;
- deactivate;
- invalid input;
- not found.

Teams:

- create;
- update;
- alias add/remove;
- competition association;
- duplicate alias;
- duplicate association;
- deactivate.

Markets:

- create manual market;
- create valid auto-evaluable market;
- reject invalid evaluator parameters;
- duplicate code conflict;
- edit;
- deactivate.

Prefer Fastify inject or the project's existing in-process testing pattern.

Do not open real network ports unnecessarily.

---

# 47. Application Tests

Keep application-use-case tests focused on behavior rather than Fastify details.

Examples:

- deactivated entities excluded from active-only listing;
- alias normalization;
- market autoEvaluable invariants;
- manual market accepts null evaluator config;
- historical references remain valid after current entity edits.

Do not test every trivial getter.

---

# 48. UI Tests

Add only valuable UI tests.

Good candidates:

- management page loads;
- create form validation;
- successful create flow;
- market evaluator form changes fields based on evaluatorKey.

Do not create dozens of brittle component snapshots.

Use E2E only for one or two representative management workflows if Playwright is already reliable.

---

# 49. Market Configuration Test Matrix

Add table-driven validation tests covering at least:

MATCH_RESULT

- valid HOME
- invalid result

TOTAL_GOALS

- valid OVER 2.5
- valid UNDER 1.5
- invalid line

DOUBLE_CHANCE

- valid 1X
- invalid value

BTTS

- valid YES
- valid NO

TOTAL_CORNERS

- valid OVER 9.5
- invalid line

COMPOSITE

- valid AND combination
- valid OR combination
- too few conditions
- too many conditions
- invalid child
- nested composite rejected if prohibited

Again: validate configuration only.

Do not evaluate match results yet.

---

# 50. Domain Boundaries

Do not put CRUD behavior directly in domain entities when it is application orchestration.

Domain should contain invariants such as:

- valid Market config;
- valid Team alias value;
- stable codes.

Application should coordinate:

- repository lookup;
- create/update;
- conflict handling;
- association management.

Presentation should only handle transport/UI concerns.

---

# 51. Transactions

Use transactions where a single use case changes multiple related records.

Examples:

- create team + aliases if submitted together;
- update team + competition associations if handled atomically;
- asset reference assignment where consistency requires it.

Do not wrap simple single-row reads in transactions.

---

# 52. Repository Evolution

Extend Phase 02 repositories only as needed.

Avoid generic methods such as:

repository.query(anyFilters)

if explicit methods remain clearer.

Examples:

CompetitionRepository.list(...)
TeamRepository.list(...)
MarketRepository.findByCode(...)

are preferable to an over-generalized query DSL.

---

# 53. Hard Deletes

Do not expose general hard-delete operations for:

- Competition;
- Team;
- Market.

Historical data depends on stable references.

If a newly created unreferenced alias or association can be safely deleted, that is acceptable.

Follow foreign-key/history rules established in Phase 02.

---

# 54. Timestamp Behavior

Repository/application updates must maintain timestamps consistently.

Do not allow the client to supply authoritative:

createdAt
updatedAt

for ordinary CRUD operations.

The server/application owns persistence timestamps.

---

# 55. IDs

Clients may reference entities by stable internal ID.

Do not use list position or display name as identity.

Do not expose database row-number assumptions.

---

# 56. API Security Basics

Even though v1 has no authentication:

- validate all inputs;
- limit upload sizes if upload exists;
- do not accept arbitrary filesystem paths;
- do not accept executable market logic;
- do not expose environment values;
- do not return raw internal exceptions.

Do not add authentication merely because routes now exist.

Local-first/no-auth remains the documented scope.

---

# 57. No Provider Integration

Do not implement:

- GOAL API;
- football-data.org;
- OpenFootball;
- TheSportsDB;
- provider refresh buttons;
- provider mappings UI;
- automatic team import;
- automatic logo downloads.

Those belong to Phase 04.

Existing Provider/ProviderReference tables may remain untouched except where necessary to compile.

---

# 58. No Market Settlement

Do not implement:

- score evaluation;
- corner evaluation;
- GREEN/RED calculation;
- COMPOSITE execution;
- fixture settlement.

Those belong to Phase 05.

The CRUD market configuration must only prepare valid structured definitions.

---

# 59. No Bulletin Builder

Do not implement:

- bulletin creation;
- selection editing;
- odds calculations;
- total odd UI;
- preview;
- export.

Those belong to later phases.

---

# 60. No Rendering

Do not implement:

- HTML/SVG bulletin templates;
- text fitting;
- screenshot export;
- PNG generation.

That belongs to the Rendering Engine phase.

---

# 61. README

Update README.md only where the implemented CRUD phase changes actual usage.

Potential additions:

- brief indication that competition/team/market management is available;
- asset-upload restrictions if implemented;
- any new real development commands.

Do not turn README into a CRUD specification.

Do not reintroduce any other project/brand identity.

---

# 62. Documentation Corrections

If implementation reveals a small clear mismatch between:

- data-model.md;
- market-engine.md;
- product-spec.md;

update the relevant source-of-truth document.

Do not duplicate the same detailed rule into multiple files unnecessarily.

Do not silently change a material product decision.

---

# 63. Quality Gates

Before completion, run the repository's actual relevant quality gates.

At minimum:

- format/check;
- lint;
- typecheck;
- tests;
- build.

If migrations/schema changed to support this phase, also run the appropriate database/migration verification.

If Playwright smoke/CRUD E2E tests exist and are reliable, run them.

Fix failures caused by this implementation.

---

# 64. Manual UX Verification

Perform a basic manual verification of the management workflows if the environment allows it.

Check:

Competitions

- create;
- edit;
- deactivate;
- list/search.

Teams

- create;
- edit;
- alias management;
- competition assignment;
- deactivate.

Markets

- manual market creation;
- auto-evaluable market creation;
- evaluator-specific form behavior;
- invalid configuration feedback;
- deactivate.

Do not claim manual verification if it was not actually performed.

---

# 65. Final Diff Review

Before finishing:

- inspect Git diff;
- remove unrelated changes;
- ensure no local DB was committed;
- ensure no uploaded test asset was accidentally committed unless intended fixture data;
- ensure no `.env` was committed;
- ensure no secrets exist;
- ensure no provider implementation entered scope;
- ensure no settlement logic entered scope;
- ensure docs and code remain consistent.

---

# 66. Completion Report

At the end, report concisely:

1. Competition CRUD implemented.
2. Team CRUD/aliases/competition associations implemented.
3. Market CRUD and structured evaluator configuration implemented.
4. API routes added.
5. UI management screens added.
6. Asset workflow implemented or intentionally deferred.
7. Important validation/invariant decisions.
8. Tests added.
9. Exact quality commands run and results.
10. Any unresolved issue or intentionally deferred item.

Do not provide a long file-by-file narrative.

Do not commit or push unless explicitly requested.
