You are implementing Phase 08 of Bet Studio:

History + Result Management

Before making changes:

1. Read AGENTS.md.
2. Read docs/architecture.md.
3. Read docs/product-spec.md only for:
   - History workflow;
   - result/status behavior;
   - duplicate/edit/re-render/export behavior.
4. Read docs/data-model.md only for:
   - Bulletin;
   - BulletinSelection;
   - BulletinSelectionSnapshot;
   - SelectionResultSnapshot;
   - SettlementOverride;
   - Fixture;
   - FixtureResultDetails;
   - RenderRecord;
   - TemplateVersion.
5. Read docs/market-engine.md only for:
   - calculated/effective statuses;
   - manual overrides;
   - re-evaluation;
   - aggregate bulletin status.
6. Read docs/rendering-engine.md only for:
   - historical renders;
   - re-render semantics;
   - RenderRecord;
   - immutable inputs/fingerprints.
7. Inspect the implementation from Phases 01–07.
8. Reuse existing application services, repositories, settlement logic and renderer.

Do not modify provider architecture unless a small result-refresh integration is strictly required.

The repository and documentation are the source of truth.

Do not introduce or reference any project identity other than Bet Studio.

---

# Goal

Implement the History and Result Management workflow.

At the end of this phase, a user must be able to:

- browse saved bulletins;
- search/filter history;
- open a bulletin;
- inspect selections and current results;
- distinguish calculated status from manual override/effective status;
- manually set/reset selection status;
- re-evaluate one selection;
- re-evaluate a whole bulletin;
- refresh fixture result where existing provider workflow supports it;
- inspect relevant result/audit history;
- inspect previous renders;
- re-render/export the current bulletin state;
- reproduce a historical render where exact immutable inputs are available;
- edit or duplicate a bulletin through existing workflows;
- preserve historical snapshots and previous renders when current data changes.

Do not implement:

- bankroll/accounting;
- financial P/L dashboards;
- bookmaker settlement rules;
- social publishing;
- cloud history;
- multi-user audit systems;
- advanced analytics.

---

# 1. Preserve Separation of Responsibilities

History UI must orchestrate existing capabilities.

Do not reimplement:

- Market Engine logic;
- aggregate-status logic;
- PNG rendering;
- provider normalization;
- total-odd calculation.

Use existing Application use cases/services.

Conceptually:

History UI
   ↓
Application
   ↓
Domain + repositories + renderer/provider ports

React must not calculate settlement rules.

---

# 2. Historical vs Current State

Distinguish clearly between:

CURRENT operational state

and

HISTORICAL immutable records.

Current state may change when:

- fixture result is corrected;
- a selection is re-evaluated;
- manual override changes;
- bulletin is edited.

Historical records must remain unchanged, including:

- previous SelectionResultSnapshots;
- previous SettlementOverride audit entries;
- previous RenderRecords;
- immutable bulletin/render snapshots;
- historical TemplateVersion references;
- historical asset references.

Do not overwrite history to make current state look simpler.

---

# 3. History Listing

Implement a proper bulletin History view.

At minimum display:

- public bulletin code;
- creation/update date;
- bulletin type;
- mode;
- selection count;
- total odd;
- effective aggregate status;
- latest render indicator where useful.

Use the existing public code, e.g.:

BET #0001

Do not expose internal database IDs as the primary label.

---

# 4. History Filters

Support useful simple filters.

Recommended:

- text search by bulletin public code;
- status;
- type SINGLE/MULTI;
- mode PRE_MATCH/LIVE;
- date range where straightforward.

Optional if useful:

- competition;
- team.

Do not build an advanced query-builder UI.

---

# 5. History Status Filters

Support:

PENDING
GREEN
RED
VOID
MANUAL

Use the effective aggregate status.

Do not filter current history by stale persisted bulletin status if aggregate status is derived.

---

# 6. Default Ordering

Default to newest/recently updated first.

Use deterministic secondary ordering where timestamps can collide.

Do not rely on SQLite natural row order.

---

# 7. Pagination

Use simple pagination only if the existing list architecture benefits from it.

For a local-first v1:

- bounded pages or a simple limit/load-more is sufficient.

Do not add cursor infrastructure unless already established.

---

# 8. Bulletin Detail

Opening a history item should show:

- public code;
- type;
- mode;
- total odd;
- optional stake;
- current aggregate status;
- display configuration where useful;
- ordered selections;
- fixture context;
- market;
- odd;
- calculated status;
- manual override;
- effective status;
- result data;
- render history.

Keep core actions clear.

---

# 9. Selection Result Presentation

For every selection, distinguish:

Calculated
Manual override
Effective

Example conceptually:

Calculated: GREEN
Manual override: RED
Effective: RED

If there is no override:

Calculated: GREEN
Manual override: —
Effective: GREEN

Do not hide the origin of a manual result.

---

# 10. Fixture Facts

Where relevant show normalized facts used for evaluation.

Examples:

- fixture status;
- final score;
- half-time score where present;
- corners where relevant;
- kickoff;
- last result update timestamp.

Do not expose raw provider DTOs.

Use local normalized data.

---

# 11. Result Source

Where existing data model supports it, show whether current fixture/result data is:

- manually entered/local;
- synchronized from a provider;
- corrected locally.

Keep this informational.

Do not create a complicated provenance engine if one does not already exist.

---

# 12. Refresh Result

If Phase 04 exposes a provider result-refresh use case, allow an explicit:

Refresh result

action.

The flow should be:

provider refresh
→ normalized local FixtureResultDetails updated
→ optional explicit re-evaluation through Application
→ UI refresh

Do not let the provider adapter invoke React or renderer directly.

---

# 13. No Hidden Provider Calls

Opening History must not automatically call GOAL API.

Do not spend quota merely because a detail page was opened.

Provider refresh remains explicit.

---

# 14. Re-evaluate Selection

Provide an explicit action to re-evaluate one selection using the Phase 05 application service.

Re-evaluation must:

- use current local fixture facts;
- use persisted structured market configuration;
- update calculated result;
- preserve current manual override;
- create/update audit/snapshot state according to existing model;
- return calculated + effective status.

Do not execute settlement logic in the route/UI.

---

# 15. Re-evaluate Bulletin

Provide an explicit:

Re-evaluate bulletin

action.

It should:

- evaluate all relevant selections;
- preserve manual overrides;
- derive aggregate effective status;
- return a concise summary.

Example result conceptually:

{
  evaluated: 5,
  green: 3,
  red: 1,
  pending: 1,
  manual: 0,
  void: 0,
  bulletinStatus: "RED"
}

Use existing status logic.

---

# 16. Automatic Re-evaluation After Refresh

If result refresh is immediately followed by re-evaluation in the product workflow, coordinate this at Application level.

Acceptable:

Refresh & evaluate

as one explicit use case/action.

Avoid hidden coupling:

GoalApiProvider
→ MarketEngine

Provider adapters must remain unaware of settlement.

---

# 17. Manual Override Actions

Allow supported manual selection states according to Phase 05.

At minimum where current docs permit:

GREEN
RED
VOID
PENDING

If MANUAL is explicitly allowed as a manually assigned state, preserve it.

Do not invent extra statuses.

---

# 18. Override Reason

Allow an optional short reason/comment.

Examples:

- provider correction;
- official result review;
- manual settlement;
- missing statistic confirmed externally.

Validate maximum length.

Do not require a reason unless product-spec says so.

Do not allow executable markup.

---

# 19. Override Audit

Changing manual status must preserve audit history.

An audit entry should make it possible to understand conceptually:

- selection;
- previous effective/manual state where modeled;
- new manual state;
- reason;
- timestamp.

This is a local single-user app.

Do not add:

- user IDs;
- roles;
- IP audit;
- enterprise compliance logging

without an actual requirement.

---

# 20. Reset Override

Provide:

Reset to automatic

This must:

- clear the current active override;
- preserve historical override audit events;
- expose calculated status again as effective status.

Do not delete the audit trail.

Do not invent a fake AUTO settlement status.

---

# 21. Result Correction

Fixture facts may be corrected.

If score/corners/status changes:

- current calculated result may change after re-evaluation;
- historical result snapshots remain unchanged;
- previous renders remain unchanged.

Example:

first evaluation:
GREEN

provider correction:
score changes

new evaluation:
RED

Both historical evaluation records should remain understandable according to current snapshot/audit model.

---

# 22. SelectionResultSnapshot

Use SelectionResultSnapshot for meaningful evaluation history according to data-model.md.

Preserve useful metadata such as:

- calculated status;
- evaluator key;
- evaluator version;
- reason code;
- structured relevant facts/details;
- timestamp.

Do not store only a naked GREEN/RED without context where the model supports richer audit data.

---

# 23. Snapshot Noise

Do not append duplicate result snapshots unnecessarily.

If the same:

fixture facts
+
market config
+
evaluator version
+
calculated result

is evaluated repeatedly and nothing changed, follow existing idempotency policy.

Prefer avoiding meaningless duplicate records unless the data model explicitly records every attempt.

---

# 24. Result Timeline

Provide a compact result/audit timeline where useful.

Example:

12:05 — Calculated PENDING
14:02 — Calculated GREEN
14:10 — Manual override RED
14:16 — Override reset → effective GREEN

Do not create a complex event-sourcing UI.

The timeline should reflect records already persisted.

---

# 25. Current Effective Status

Current status must always resolve using:

manual override if active
otherwise calculated status

The History screen must use the same application/domain function used elsewhere.

Do not reimplement precedence in frontend code.

---

# 26. Bulletin Aggregate Status

Display aggregate bulletin status from effective selection statuses.

Use Phase 05 rules:

any RED
→ RED

else any PENDING
→ PENDING

else any MANUAL
→ MANUAL

else all VOID
→ VOID

else GREEN/VOID with at least one GREEN
→ GREEN

Do not duplicate this logic inconsistently.

---

# 27. VOID Presentation

VOID is a settlement state.

Do not implement payout recalculation here.

For example:

GREEN + VOID
→ aggregate GREEN

according to current aggregate policy.

Do not show financial return implications unless a future financial engine is implemented.

---

# 28. Existing Bulletin Editing

Provide an Edit action that opens the Phase 06 Bulletin Builder.

Do not build a second editing form inside History.

History detail should link into/reuse the canonical editor.

---

# 29. Historical Warning for Edits

Editing current bulletin state does not rewrite prior renders or immutable historical snapshots.

Make this behavior clear where necessary.

Do not imply that editing a bulletin modifies an already exported image.

---

# 30. Duplicate

Provide Duplicate through the existing Phase 06 use case.

Duplicate must retain existing semantics:

- new internal ID;
- new public code;
- fresh current selection state/snapshots as documented;
- no copied RenderRecords;
- no copied override audit;
- no provider sync history.

Do not implement a second duplicate strategy.

---

# 31. Render History

Show RenderRecords associated with the bulletin.

At minimum display useful metadata:

- rendered timestamp;
- status at render time where stored;
- format;
- template version;
- renderer version;
- dimensions;
- file availability;
- fingerprint shortened for UI if useful.

Do not expose internal filesystem paths.

---

# 32. Render Preview

Allow viewing an existing exported image when the output file still exists.

Use the controlled render/download endpoint from Phase 07.

Do not add generic filesystem access.

---

# 33. Missing Render File

If RenderRecord exists but file is missing:

show a controlled state such as:

File unavailable

Do not silently render a new image from current data and present it as the original.

Historical metadata remains valid even if the local file was removed.

---

# 34. Current Re-render / Export

Provide an action to create a new render from current persisted bulletin state.

Conceptually:

Render current state

This creates:

- a new immutable render input;
- new PNG;
- new RenderRecord.

It must not overwrite an earlier render record.

---

# 35. Historical Re-render

Where Phase 07 supports exact historical re-rendering, expose it separately.

Conceptually:

Re-render historical version

It must use:

- original immutable snapshot;
- original TemplateVersion;
- compatible renderer version;
- original immutable assets/fonts/config.

Do not use current mutable Team/Market data.

---

# 36. Historical Re-render Limitation

If the original renderer version is unavailable:

do not claim exact reproduction.

Show/report a controlled limitation.

Do not silently use the newest renderer and label it identical.

---

# 37. Render Fingerprints

Display fingerprint only as technical metadata where useful.

Do not make ordinary users compare long SHA-256 strings manually.

A shortened prefix is sufficient for UI, while full fingerprint remains available in data/debug details if needed.

---

# 38. Render Comparison

Do not implement visual diff tooling in this phase.

The user only needs to inspect previous/current renders.

Pixel-diff/history comparison is unnecessary v1 complexity.

---

# 39. Result + Render Relationship

A bulletin may have multiple renders over time.

Example:

13:00
PENDING render

16:55
GREEN render

Both are valid historical artifacts.

Do not mutate the pending RenderRecord when the bulletin later becomes GREEN.

---

# 40. Status Area Stability

Do not modify Rendering Engine layout in History.

A new GREEN/RED render should use the Phase 07 stable status/result region.

History only requests the render.

---

# 41. Export Naming

Use existing Phase 07 filename behavior.

Example:

BET-0001-feed-pending.png
BET-0001-feed-green.png

Do not create a competing History-specific naming convention.

---

# 42. History DTO

Define a dedicated history/list DTO if useful.

Do not expose raw persistence records.

Conceptually:

type BulletinHistoryListItem = {
  id: string;
  publicCode: string;
  type: BulletinType;
  mode: BulletinMode;
  selectionCount: number;
  totalOdd: string;
  effectiveStatus: SettlementStatus;
  createdAt: string;
  updatedAt: string;
  latestRender?: {
    id: string;
    createdAt: string;
  } | null;
};

Adapt to existing conventions.

---

# 43. Detail DTO

Use a coherent detail response rather than making the frontend perform many unrelated low-level requests if avoidable.

A bulletin-history detail may contain:

- bulletin metadata;
- selections;
- current result states;
- fixture facts;
- active overrides;
- a bounded recent result timeline;
- render summaries.

Do not return huge raw audit history by default.

---

# 44. History Application Service

Keep History queries/application behavior in Application layer.

Do not let React query repositories/SQLite directly.

Use focused query/use-case functions.

Avoid building CQRS infrastructure just because History is read-heavy.

---

# 45. Repository Queries

Add only the queries required for useful History behavior.

Examples:

listBulletins(filters)
getBulletinHistoryDetail(id)
listSelectionResultSnapshots(selectionId)
listSettlementOverrides(selectionId)
listRenderRecords(bulletinId)

Do not create a generic SQL filter DSL.

---

# 46. Query Efficiency

Avoid obvious N+1 behavior.

The History list should not load every selection/result/render row individually with one query per bulletin if a simple joined/aggregate query solves it.

At the same time, do not build premature caching.

SQLite can handle this v1 workload easily.

---

# 47. History Search

For public-code search:

support values such as:

BET #0001
0001

where straightforward.

Do not implement fuzzy search.

Team/competition search can use normal local normalized textual matching if included.

---

# 48. Date Filtering

If date range is implemented:

use explicit date boundaries and UTC persistence policy.

Do not compare locale-formatted date strings in SQL.

Presentation converts dates for display.

---

# 49. Result Refresh UX

For a fixture with provider mapping/configuration available:

show explicit refresh action.

For manual/local fixture without provider mapping:

do not show a broken provider action.

Allow local result editing only if current product architecture supports it.

---

# 50. Manual Fixture Result Editing

If local/manual fixtures need result management, provide a small structured edit workflow.

Potential fields:

- fixture status;
- home score;
- away score;
- home corners;
- away corners.

Half-time scores only if useful/currently supported.

Validate using the same normalized fixture fact rules.

Do not accept raw JSON.

---

# 51. Manual Result Validation

Scores/corners when present must be:

- integer;
- >= 0.

Do not allow:

NaN
negative values
decimal goals/corners.

Fixture status must use normalized enum.

Do not allow arbitrary strings.

---

# 52. Result Edit vs Settlement Override

Keep these concepts separate.

Changing:

final score 2–1 → 1–1

changes football facts and should require re-evaluation.

Setting:

calculated GREEN → manual RED

changes settlement override without changing football facts.

Do not treat manual override as fake score editing.

---

# 53. Result Edit Re-evaluation

After a manual fixture-result edit, provide an explicit or application-coordinated re-evaluation.

A coherent action may be:

Save result & re-evaluate

if it keeps UX simpler.

Do not duplicate evaluator rules in result form code.

---

# 54. Editing Finished Result

Allow correction of a FINISHED fixture result where product/data model permits.

Do not assume provider data is immutable.

Preserve historical result/evaluation snapshots.

---

# 55. Result Provenance

If result edit overrides provider-synchronized data, do not lose the ability to refresh later.

However, external refresh must not blindly overwrite intentional local authoritative corrections if current merge policy protects them.

Follow Phase 04 safe-merge rules.

Do not invent a second source-priority policy.

---

# 56. History Actions

A bulletin detail should expose only relevant actions.

Recommended:

- Edit;
- Duplicate;
- Re-evaluate;
- Refresh results where applicable;
- Render current;
- View previous renders.

Selection-specific:

- Re-evaluate;
- Set manual status;
- Reset manual override;
- inspect result history.

Avoid toolbar clutter.

---

# 57. Destructive Actions

Do not implement hard-delete of historical bulletins by default.

If archive/deactivation exists in product/data model, use it.

Historical bulletins with result/render records should remain available.

Do not add delete merely because this is called History.

---

# 58. Archive

If bulletin archive behavior already exists or is clearly documented:

allow archive/unarchive.

Archived bulletins:

- remain historically accessible;
- may be excluded from default history view;
- keep all result/render records.

Do not physically delete dependent history.

---

# 59. Status Badges

Use one shared semantic status presentation across History and Builder where possible.

Do not create different meanings/colors for GREEN/RED/etc in multiple screens.

Color must not be the sole indicator.

---

# 60. Result Timeline Ordering

Sort audit events explicitly.

Prefer:

timestamp ASC

for chronological timeline or DESC if the UI is explicitly newest-first.

Use a deterministic tie-breaker.

Do not rely on insertion order.

---

# 61. Latest Calculation

Define current calculated status from the authoritative current selection state.

Do not infer it by blindly taking the newest SelectionResultSnapshot if the model already has an explicit current calculated status field.

Snapshots are audit/history.

Current state and history should not be conflated.

---

# 62. Current Override

Likewise, determine active manual override from the documented current override representation.

If Phase 02/05 uses:

BulletinSelection.manualStatus nullable

use that as current state.

SettlementOverride rows remain audit history.

Do not repeatedly scan event history in React to derive current state.

---

# 63. Result Snapshot Version

Expose evaluator version in technical result-history details.

Example:

TOTAL_GOALS v1

This aids reproducibility/audit.

Do not clutter the primary selection card with technical metadata unless requested.

---

# 64. Reason Codes

Show friendly UI text derived from stable reasonCode values.

Example:

MISSING_CORNERS
→ "Corner data unavailable"

Do not persist localized prose as the core evaluation reason.

Keep stable codes authoritative.

---

# 65. Raw Details

Structured evaluator details may be shown in an expandable technical/details area where useful.

Do not dump raw JSON by default.

Do not expose internal stack traces.

---

# 66. History UI Structure

A reasonable desktop structure:

History list
→ Bulletin detail

Bulletin detail:
- summary header;
- selection result cards;
- result actions;
- render history.

Do not create a deeply nested admin interface.

Keep navigation simple.

---

# 67. Responsive Behavior

History must remain usable on narrower screens.

Tables may become cards where appropriate.

Do not require horizontal scrolling for core result/status information if avoidable.

---

# 68. Loading States

Provide clear states for:

- history loading;
- detail loading;
- refreshing result;
- re-evaluating;
- applying override;
- resetting override;
- rendering.

Do not lock the entire application for a single selection operation unnecessarily.

---

# 69. Error States

Handle:

- bulletin not found;
- selection not found;
- fixture missing;
- provider unavailable;
- result refresh failure;
- render file missing;
- historical renderer version unavailable;
- override validation failure.

Show actionable controlled errors.

Do not expose SQL/Playwright/provider stack traces.

---

# 70. Optimistic Updates

Do not use optimistic result/override mutations unless existing project patterns make them demonstrably safe.

For audit-sensitive result operations prefer:

request
→ persisted success
→ update UI

Correctness is more important than instant animation.

---

# 71. Confirmations

Require confirmation for potentially consequential operations where useful.

Examples:

- applying manual RED over calculated GREEN;
- resetting an override with an explicit audit implication;
- changing final fixture result.

Do not add confirmation to harmless actions like opening a render.

Keep confirmations informative rather than excessive.

---

# 72. Manual Override UI

Use explicit choices.

Example:

Manual status:
[GREEN] [RED] [VOID] [PENDING]

Reason:
[...]

Apply

Reset to automatic

Do not use an ambiguous toggle.

Do not allow the user to accidentally edit calculated status directly.

---

# 73. Current vs Historical Render Labels

Clearly distinguish:

Current render
Historical render

or equivalent timestamps/status labels.

Do not imply the latest export replaces prior exports.

---

# 74. Re-render Behavior

Re-rendering current state creates a new RenderRecord.

Re-rendering a historical version should also produce a new physical render artifact if implementation requires it, while retaining lineage/reference to the historical source.

Do not mutate the original RenderRecord.

---

# 75. Render Lineage

If simple and supported by schema, store a relation such as:

sourceRenderId

for a historical re-render.

Do not add this solely for theoretical purity if data model does not need it.

The essential requirement is preserving the original RenderRecord unchanged.

---

# 76. Current Data Corrections

Changing current Team/Market display data must not alter:

- old Selection snapshots;
- old result snapshots;
- old RenderRecords.

Extend historical-integrity tests to cover History UI/application queries.

---

# 77. Result Corrections and Render History

Test:

1. bulletin rendered PENDING;
2. fixture result becomes final;
3. bulletin re-evaluates GREEN;
4. new GREEN render created;
5. original PENDING render still exists and remains associated with its historical metadata.

This is a key end-to-end invariant.

---

# 78. Override and Render History

Test:

1. calculated GREEN;
2. render GREEN;
3. user manually overrides RED;
4. effective bulletin becomes RED;
5. render RED;
6. reset override;
7. effective returns GREEN;
8. both prior renders remain unchanged.

---

# 79. Duplicate Independence

Test that duplicating a historical bulletin:

- creates a new bulletin/public code;
- does not copy original render records;
- does not copy original override audit;
- does not mutate original history.

---

# 80. API Routes

Use focused routes consistent with current conventions.

Likely existing routes can be reused for evaluation/override/render.

Add History read routes only where needed.

Conceptually:

GET /api/history/bulletins
GET /api/history/bulletins/:id

GET /api/selections/:id/result-history
GET /api/bulletins/:id/renders

or reuse:

GET /api/bulletins
GET /api/bulletins/:id

with richer query/detail DTOs.

Do not duplicate resource routes unnecessarily.

---

# 81. Route Reuse

Prefer extending existing bulletin list/detail capabilities over creating parallel:

/api/history/...

if that would duplicate the same resource semantics.

Use a separate History query endpoint only if it materially simplifies filtering/aggregation.

Follow existing API style.

---

# 82. Input Validation

Validate:

- bulletin IDs;
- selection IDs;
- filters;
- date ranges;
- manual statuses;
- override reasons;
- fixture result edits;
- render IDs.

Do not trust UI controls as validation.

---

# 83. Authorization

Do not add authentication/authorization.

Local-first/no-auth remains v1 scope.

Do not introduce fake role checks.

---

# 84. Security

Ensure:

- result reason text safely escaped;
- no arbitrary HTML in audit comments;
- render files served only through controlled IDs;
- no arbitrary filesystem path;
- no provider secrets in history DTOs;
- no raw provider responses exposed;
- no SQL/internal exceptions exposed.

---

# 85. Data Retention

Do not auto-prune historical result/render records.

Local storage growth at v1 scale is acceptable.

Do not build retention policies before they are needed.

---

# 86. No Analytics Dashboard

Do not implement:

- win rate charts;
- ROI;
- profit/loss;
- team performance analytics;
- market success rates;
- trends;
- betting statistics dashboards.

Those are outside this phase.

History is operational/audit-oriented.

---

# 87. No Financial Logic

Do not calculate:

- winnings;
- returns;
- void-adjusted odds;
- P/L;
- bankroll.

Even though History shows results and odds, settlement status is not a financial engine.

---

# 88. No Background Provider Polling

Do not add:

cron
workers
queues
timers

to keep History automatically updated.

Result refresh remains explicit/manual in v1.

---

# 89. No Background Re-render

Do not automatically create a new image whenever status changes.

Rendering remains an explicit user action.

This prevents unnecessary duplicate artifacts and keeps History meaningful.

---

# 90. No Social Publishing

Do not publish completed results to external social networks.

History only manages local records and exports.

---

# 91. Unit Tests

Add focused pure tests where applicable for:

- status presentation mapping;
- history/filter parsing;
- audit/current-state resolution only if new pure functions are introduced.

Do not duplicate Market Engine truth-table tests.

---

# 92. Application Tests

At minimum cover:

- list history newest first;
- status filtering;
- public-code search;
- detail loads ordered selections;
- current calculated/manual/effective statuses correct;
- manual override persists;
- reset preserves audit;
- bulletin aggregate updates after override;
- result correction + re-evaluation;
- previous result snapshot preserved;
- previous RenderRecord preserved;
- current render creates new RenderRecord;
- historical re-render uses historical inputs;
- duplicate independent from history.

---

# 93. API Tests

Cover representative routes:

- history/list;
- detail;
- selection result history;
- apply override;
- reset override;
- re-evaluate;
- refresh result if integration exists;
- list renders;
- render current;
- historical re-render where supported.

Test:

- 400 invalid input;
- 404;
- provider unavailable;
- historical file unavailable;
- incompatible renderer version where feasible.

---

# 94. UI Tests

Add only valuable user-flow tests.

Examples:

- History list filters by status;
- open bulletin detail;
- calculated vs effective status displayed;
- apply override;
- reset override;
- render list displays multiple historical outputs.

Avoid brittle full-page snapshots.

---

# 95. Playwright E2E

If Playwright E2E remains reliable, add one end-to-end History flow.

Example:

1. create/use fixture + bulletin test data;
2. bulletin initially PENDING;
3. update fixture to FINISHED 2–1;
4. re-evaluate;
5. status becomes GREEN;
6. apply manual RED;
7. effective becomes RED;
8. reset override;
9. returns GREEN;
10. render current;
11. render appears in history.

No external provider call.

Keep E2E bounded.

---

# 96. Historical Render E2E

Do not add a large second E2E suite just for historical rendering if Phase 07 integration tests already cover it.

Prefer application/integration tests for detailed reproducibility behavior.

---

# 97. Deterministic Test Data

Use local deterministic dates/scores.

Do not depend on real football fixtures.

Do not depend on current date.

Do not require GOAL_API_KEY.

---

# 98. Provider Refresh Tests

When testing result refresh:

mock the provider port.

Do not call GOAL API in CI.

Verify normalized facts are persisted and re-evaluation is application-coordinated.

---

# 99. Migration Changes

Avoid schema changes unless genuinely required.

The existing Phase 02 model should already support this phase.

If a clear missing audit/current-state field blocks correct behavior:

- add the smallest migration;
- keep backwards compatibility;
- update data-model.md.

Do not redesign the data model.

---

# 100. Result Audit Schema Simplification

If current implementation already uses:

BulletinSelection.manualStatus
+
append-only SettlementOverride history

keep it.

Do not migrate to full event sourcing.

This gives:

fast current state
+
simple audit history

which is appropriate for v1.

---

# 101. RenderRecord Schema

Reuse Phase 07.

Do not duplicate render metadata into History-specific tables.

History reads RenderRecord.

---

# 102. Performance

History should be fast at local v1 scale.

Use indexes already defined for:

- bulletin dates/status-related queries;
- selection bulletin ID;
- result selection ID;
- override selection ID;
- RenderRecord bulletin ID.

Add an index only if query shape demonstrates a concrete need.

Do not over-index every field.

---

# 103. Empty History

Provide a useful empty state.

Example concept:

"No bulletins yet."

Link to/create a bulletin.

Do not show an empty table shell with no guidance.

---

# 104. No-result Filters

When filters return no rows:

show a distinct no-results state.

Allow clearing filters easily.

---

# 105. Deep Linking

If routing exists, bulletin History detail should have a stable route.

Example:

/history/:bulletinId

or existing bulletin detail route.

Do not expose raw database row-number URLs.

---

# 106. Back Navigation

Preserve History filters when returning from a detail page where straightforward.

Do not introduce global state machinery solely for this.

URL query parameters are acceptable for filter state if current router supports them.

---

# 107. Design Consistency

Use existing Bet Studio visual language.

History/result management should feel like the same product as Builder and Renderer.

Do not redesign navigation or introduce another component library.

---

# 108. Status Accessibility

Use text labels in addition to semantic color.

Ensure GREEN/RED/VOID/etc remain understandable in dark mode and for color-vision differences.

Reuse existing shared status tokens/components.

---

# 109. Documentation

Update docs/product-spec.md only where implementation resolves real History/result-management behavior.

Examples:

- refresh+evaluate workflow;
- audit/reset semantics;
- historical re-render availability.

Update docs/data-model.md only for factual schema/audit clarification.

Update docs/rendering-engine.md only if historical re-render semantics changed.

Do not copy the same full rules into all three docs.

---

# 110. README

Update README.md minimally.

It may mention:

- History;
- result management;
- manual overrides;
- re-evaluation;
- historical renders.

Do not turn README into an audit specification.

---

# 111. Quality Gates

Before completion run the repository's actual relevant commands.

At minimum:

- format/check;
- lint;
- typecheck;
- unit tests;
- integration tests;
- build.

Also run:

- relevant renderer tests if rendering code/integration changed;
- Playwright E2E if added and reliable.

Do not claim success unless the command actually ran successfully.

---

# 112. Manual Verification

If the environment permits, manually verify:

1. Open History.
2. Search by public bulletin code.
3. Filter PENDING/GREEN/RED.
4. Open bulletin detail.
5. Inspect calculated/effective statuses.
6. Re-evaluate one selection.
7. Re-evaluate whole bulletin.
8. Apply manual override.
9. Reset override.
10. Edit a local final score/corners where supported.
11. Confirm status changes after re-evaluation.
12. Inspect result timeline.
13. View previous render.
14. Render current state.
15. Confirm new RenderRecord appears without replacing old render.
16. Open existing bulletin in Builder.
17. Duplicate bulletin and verify separate public code/history.

Do not claim manual verification if not actually performed.

---

# 113. Historical Integrity Verification

Explicitly verify:

- current Team rename does not rewrite saved selection snapshot;
- current Market rename does not rewrite saved historical snapshot;
- fixture correction does not rewrite old SelectionResultSnapshot;
- manual override change does not rewrite old override audit;
- new render does not rewrite old RenderRecord;
- new TemplateVersion does not change old render reference.

Historical integrity is a hard requirement.

---

# 114. Git Diff Review

Before completion inspect the final diff.

Verify:

- Market Engine rules were not duplicated in UI;
- renderer logic was not duplicated;
- provider calls remain explicit;
- no finance/analytics features entered scope;
- no background polling/workers added;
- no historical rows are destructively overwritten;
- no local DB/export files accidentally committed;
- no `.env` or secrets committed;
- no raw filesystem paths exposed;
- docs reflect actual behavior;
- no previous/alternative project identity appears.

Remove unrelated changes.

---

# 115. Completion Report

At the end report concisely:

1. History list/filter/search behavior.
2. Bulletin detail/result presentation.
3. Calculated/manual/effective status behavior.
4. Re-evaluation behavior.
5. Manual override/reset audit behavior.
6. Fixture result editing/refresh behavior.
7. Result timeline/snapshot behavior.
8. Render history behavior.
9. Current vs historical re-render behavior.
10. Edit/duplicate integration.
11. Historical-integrity guarantees verified.
12. Tests added.
13. Exact quality commands executed and results.
14. Any intentionally deferred History/result feature.

Do not provide a long file-by-file narrative.

Do not commit or push unless explicitly requested.