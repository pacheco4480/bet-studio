You are implementing Phase 06 of Bet Studio:

Bulletin Builder

Before making changes:

1. Read AGENTS.md.
2. Read docs/architecture.md.
3. Read docs/product-spec.md in full.
4. Read docs/data-model.md only for:
   - Bulletin
   - BulletinSelection
   - BulletinSelectionSnapshot
   - Fixture
   - Market
   - Team
   - Competition
   - Template / TemplateVersion references where relevant
5. Read docs/market-engine.md only for:
   - selection statuses
   - calculated vs effective status
   - bulletin aggregate status
6. Inspect the implementation from Phases 01–05.
7. Inspect existing application use cases, repositories, API routes, frontend patterns, forms and tests.

Do not implement the final Rendering Engine in this phase.

Read rendering-engine.md only where necessary to preserve builder data contracts and preview-compatible layout requirements.

The repository and documentation are the source of truth.

Do not introduce or reference any project identity other than Bet Studio.

---

# Goal

Implement the complete Bulletin Builder workflow for Bet Studio.

At the end of this phase, a user should be able to:

- create a new bulletin;
- choose SINGLE or MULTI;
- choose PRE_MATCH or LIVE;
- add selections;
- select or create the football context required for each selection;
- choose a Market;
- enter odds;
- reorder selections;
- remove selections;
- edit bulletin metadata;
- configure optional display fields;
- see calculated total odd;
- save the bulletin;
- reopen and edit it;
- duplicate it;
- see effective settlement statuses where already available;
- see a useful deterministic preview representation;
- enforce all documented selection limits and invariants.

The builder should persist coherent bulletin data and historical snapshots.

Do not implement final PNG export or template rendering yet.

---

# 1. Preserve Existing Architecture

Reuse the implementation from previous phases.

Do not recreate:

- Competition CRUD;
- Team CRUD;
- Market CRUD;
- Provider integration;
- Market Engine;
- database schema;
- repository structure;
- application error conventions;
- frontend application shell.

If a small schema/application correction is directly required for the builder, make the smallest coherent change.

Avoid unrelated refactoring.

---

# 2. Builder Responsibilities

The builder is responsible for collecting and editing bulletin input.

It is not responsible for:

- external provider synchronization logic;
- market settlement mathematics;
- final graphic rendering;
- social publishing;
- payout calculations.

Conceptually:

User input
   ↓
Builder UI
   ↓
Application validation/use case
   ↓
Bulletin aggregate
   ↓
Persistence

Settlement status may be read from the Market Engine/application state, but the builder does not implement evaluator rules itself.

---

# 3. Bulletin Types

Support:

SINGLE
MULTI

Rules:

SINGLE
→ exactly 1 selection when saved as a valid final bulletin

MULTI
→ 2 to 10 selections when saved as a valid final bulletin

Maximum selections:

10

Do not allow more than 10.

---

# 4. Draft Editing State

The UI may temporarily contain an incomplete bulletin while the user is editing.

For example:

MULTI with only one selection temporarily

may be acceptable in client state.

However, a persisted/final valid bulletin must respect documented invariants.

If the current product/data model supports explicit drafts, use that model.

If no draft state exists, keep incomplete form state client-side until the minimum save requirements are met.

Do not weaken persisted invariants merely to make form editing easier.

---

# 5. Bulletin Modes

Support:

PRE_MATCH
LIVE

This mode is bulletin metadata/presentation context.

Do not create separate Market Engine logic for the two modes.

Do not duplicate builder implementation into two separate applications.

Use conditional behavior only where product requirements genuinely differ.

---

# 6. Create Bulletin

Implement an application use case for creating a bulletin.

Conceptually:

createBulletin(input)

It should:

1. validate bulletin metadata;
2. validate type/mode;
3. validate selection count;
4. resolve referenced fixtures/teams/markets;
5. validate each selection;
6. calculate total odd safely;
7. generate/allocate public bulletin code;
8. persist bulletin + ordered selections + required snapshots atomically;
9. return the created aggregate/DTO.

Do not make Fastify routes orchestrate these steps manually.

---

# 7. Update Bulletin

Implement coherent bulletin editing.

Conceptually:

updateBulletin(bulletinId, input)

Updates may include:

- type;
- mode;
- selections;
- selection order;
- odds;
- optional metadata;
- display toggles.

Use one coherent application transaction where appropriate.

Do not require the frontend to issue a long sequence of low-level table updates to save one bulletin.

---

# 8. Bulletin Aggregate Persistence

Persist a bulletin as an aggregate.

A save should be able to atomically maintain:

- Bulletin;
- ordered BulletinSelections;
- current selection snapshots where required;
- display configuration.

Avoid requiring the caller to coordinate repository writes manually.

Do not create generic CRUD semantics that can leave half a bulletin saved.

---

# 9. Selection Model

Each selection must contain the data required by the current product model.

At minimum:

- stable selection ID;
- position;
- fixture/context reference;
- market;
- odd;
- calculated/effective status where available;
- snapshot data required for historical integrity.

The user-facing selection must always show:

- home team;
- away team;
- market;
- odd.

Market is never an optional hidden data field in the builder.

---

# 10. Selection Ordering

Selection order must be explicit.

Use:

position

or the existing persisted equivalent.

Do not rely on:

- insertion order;
- database row order;
- DOM order alone.

The order saved must be the order reopened later.

---

# 11. Reordering

Allow selections to be reordered.

Use a simple accessible approach.

Acceptable implementations include:

- Move up / Move down controls;
- drag-and-drop only if existing project dependencies already support it cleanly.

Do not add a large drag-and-drop library merely for this feature.

Keyboard accessibility must remain possible.

---

# 12. Fixture Selection

Prefer selecting an existing local Fixture.

The fixture picker should make it easy to identify:

- competition;
- home team;
- away team;
- kickoff;
- fixture status.

Do not require provider connectivity.

Local/manual fixtures must work equally well.

---

# 13. Manual Fixture Fallback

The application is local-first.

If the required fixture does not exist, the user must still have a safe path to proceed.

Depending on existing Phase 04/CRUD architecture:

- link to/create a local fixture;
- provide a small inline create-fixture workflow;
- or provide a clearly reachable local fixture creation action.

Do not force the user to configure GOAL API merely to build a bulletin.

Keep inline fixture creation small if implemented.

Do not turn this phase into a large Fixture management module.

---

# 14. Team Context

For a normal fixture-backed selection, derive:

home team
away team

from the selected Fixture.

Do not allow the builder to create contradictory state such as:

fixture = Team A vs Team B
but selection snapshot = Team C vs Team D

unless the product explicitly supports free-form selections, which is not expected for v1.

---

# 15. Competition Context

Where available, derive competition from Fixture.

Do not maintain multiple conflicting authoritative competition choices inside the same selection.

If the fixture has no competition, keep it null unless the user/product workflow explicitly permits assigning one.

---

# 16. Market Selection

Allow selecting an active Market from the local catalog.

By default:

- active markets shown;
- inactive markets excluded from new selections.

Historical bulletins using inactive markets must still reopen correctly.

Do not prevent historical read/edit merely because the current Market became inactive.

---

# 17. Manual Markets

Manual-only markets are valid selections.

If:

autoEvaluable = false

the builder should allow them.

Their settlement status may remain:

MANUAL

until manually resolved.

Do not restrict the builder only to automatically evaluable markets.

---

# 18. Market Display

Show a useful market label in the builder.

Optionally include category/evaluation indicator.

Example conceptually:

Total Goals — Over 2.5
Automatic

or:

Player to score
Manual settlement

Do not expose raw JSON parameters as the primary selection UI.

---

# 19. Odds Input

Every selection requires an odd.

Use the decimal-safe representation established in Phase 02.

Do not convert canonical odds through uncontrolled JavaScript binary floating-point arithmetic.

Validate:

- required;
- positive;
- sensible numeric format;
- decimal precision according to documented policy.

Do not allow:

NaN
Infinity
negative values
zero

---

# 20. Minimum Odd

If the product spec does not define a special sportsbook-style minimum such as 1.01, do not invent one unnecessarily.

At minimum require:

odd > 0

or follow the stronger invariant already documented.

Do not encode bookmaker-specific validation without product requirements.

---

# 21. Decimal Entry UX

Accept normal user decimal entry appropriate to the application's locale conventions.

Internally normalize to the canonical decimal representation.

Do not make persistence depend on browser floating-point formatting.

If both comma and dot decimal input are supported, normalize explicitly and test it.

Do not silently misparse:

1,85

as:

185

---

# 22. Total Odd

Calculate bulletin total odd from selections.

For SINGLE:

totalOdd = selection odd

For MULTI:

totalOdd = product of selection odds

Use decimal-safe arithmetic.

Do not use naïve:

Number
*
Number

as the canonical calculation if Phase 02 established decimal-safe values.

---

# 23. Total Odd Rounding

Use one explicit deterministic display rounding rule.

If the documentation has already fixed the policy, use it.

Otherwise prefer:

- decimal-safe calculation;
- display to 2 decimal places;
- ROUND_HALF_UP.

Keep unrounded/canonical calculation strategy consistent.

Do not rely on browser locale defaults for persisted values.

Document the chosen rule if this is the first phase that makes it concrete.

---

# 24. Total Odd Source of Truth

Prefer deriving total odd from the current selections.

Do not allow the user to manually type a conflicting total odd.

If the data model persists totalOdd as a convenience/snapshot:

- calculate it server-side;
- never trust client-supplied totalOdd as authoritative.

---

# 25. Stake

Support optional stake only if it remains part of current product-spec.md.

If enabled:

- stake is optional;
- use decimal-safe representation;
- it is bulletin metadata only.

Do not calculate:

- payout;
- profit;
- bankroll;
- balance;
- wallet.

---

# 26. Bulletin Public Code

Display the public bulletin code after persistence.

Use the format already established in Phase 02.

Example:

BET #0001

Do not allow the normal create/edit form to arbitrarily modify the public code.

Internal ID and public code remain separate.

Duplicate must receive a new public code.

---

# 27. Display Options

Implement the optional display toggles documented for the bulletin.

These include, where still present in product-spec.md:

- show competition;
- show date/time;
- show stake;
- show result;
- show status;
- show bulletin ID.

Use the exact current model if names differ.

Do not infer visual layout in this phase beyond preview needs.

---

# 28. showStatus and showResult

Treat:

showStatus
showResult

as separate settings if product-spec.md defines both.

Do not collapse them into one toggle.

The future renderer will reserve stable geometry regardless of whether content is hidden.

The builder only manages the configuration.

---

# 29. Hidden Optional Data

Turning off a display toggle should normally hide presentation of the value, not destroy underlying business data.

Example:

showStake = false

must not necessarily erase an entered stake.

Likewise:

showCompetition = false

does not remove Fixture.competition.

Presentation configuration and domain data are separate concerns.

---

# 30. Display Date

Avoid using `createdAt` ambiguously as the visual event date.

If the bulletin needs a specific display date:

use an explicit:

displayDate

or the documented representation.

If date/time shown per selection comes from fixture kickoff, use fixture kickoff.

Do not infer a football date from database creation timestamp.

---

# 31. LIVE Metadata

For LIVE mode, display/use live-specific data only where already supported.

Examples may include:

- live minute;
- live score;
- status.

Do not invent live timing data.

If live minute is unavailable:

- leave it absent;
- do not fabricate from local clock.

The builder must still function.

---

# 32. Snapshot Creation

When saving a bulletin, create the historical snapshot data required by docs/data-model.md.

The snapshot should preserve relevant user-facing selection context at save time.

Examples may include:

- home team name;
- away team name;
- team short names;
- competition name;
- market label;
- market code/config;
- odd;
- immutable asset references;
- kickoff/display information where required.

Do not rely solely on mutable current Team/Market records for future historical reconstruction.

---

# 33. Snapshot Update Semantics

Distinguish:

current editable bulletin state

from:

historical immutable render/result snapshots.

Follow data-model.md carefully.

Do not append infinite immutable "historical" snapshots on every keystroke.

Create/update the correct current bulletin snapshot representation when the bulletin is deliberately saved.

Immutable render/result records belong to later finalized historical events.

If the current data model distinguishes snapshot types differently, follow it.

---

# 34. Historical Integrity

Editing a catalog entity later must not silently change the saved bulletin's preserved context where snapshots are authoritative.

Example:

Bulletin saved with:
"Manchester United"

Team renamed later to:
"Manchester Utd"

Historical snapshot remains:
"Manchester United"

Preserve tests from Phase 02 and extend them for builder save behavior.

---

# 35. Asset Snapshot References

Where team/competition logos are included in snapshot context, reference immutable/version-safe Asset identities.

Do not copy mutable arbitrary filesystem paths as the sole historical reference.

Do not download remote images inside bulletin save.

---

# 36. Current vs Historical Editing

A bulletin that is still being actively edited may update its current selection snapshots on save if that is the documented model.

A completed historical RenderRecord must later point to the exact snapshot/template inputs used at render time.

Do not implement final render freezing here, but keep the data flow compatible with it.

---

# 37. Save Validation

Server-side save validation must ensure:

- valid bulletin type;
- valid mode;
- valid selection count;
- unique positions;
- referenced fixtures exist;
- referenced markets exist;
- odd values valid;
- SINGLE/MULTI constraints respected;
- display configuration valid.

Do not trust client form state.

---

# 38. Duplicate Fixture Selections

Decide according to product-spec.md whether the same fixture may appear multiple times with different markets.

Unless explicitly prohibited, allow:

Team A vs Team B
HOME_WIN

and:

Team A vs Team B
OVER_2_5

as separate selections.

Do not automatically deduplicate solely by fixture ID.

---

# 39. Exact Duplicate Selection

If there is no documented reason to allow an exact duplicate:

same fixture
+
same market
+
same market configuration

consider preventing or warning about it.

Do not add a unique database constraint without checking whether future use cases may intentionally repeat selections.

If documentation is ambiguous, prefer a non-blocking UI warning over an irreversible schema restriction.

Report the decision.

---

# 40. Selection Status

Load/display the current effective status from the settlement/application layer where available.

Do not recalculate market rules in React.

The builder may trigger the existing evaluation use case explicitly if that is already part of workflow.

Do not couple every form keystroke to settlement evaluation.

---

# 41. Status for New Selections

For newly created selections without a final evaluation result, use the documented initial state.

Usually:

PENDING

for unresolved fixtures

or:

MANUAL

for manual-only markets when appropriate.

Use the existing Market Engine/application behavior rather than duplicating assumptions.

---

# 42. Bulletin Aggregate Status

Display aggregate bulletin status using the pure/domain behavior implemented in Phase 05.

Do not reimplement the precedence logic in the frontend.

The API/application DTO should provide or derive the effective aggregate result consistently.

---

# 43. Builder API

Expose focused bulletin endpoints.

A reasonable shape:

GET    /api/bulletins
POST   /api/bulletins
GET    /api/bulletins/:id
PATCH  /api/bulletins/:id

POST   /api/bulletins/:id/duplicate

Adapt to existing API conventions.

Do not expose direct CRUD endpoints for internal selection snapshot tables.

Selections are managed through the Bulletin aggregate.

---

# 44. Listing

Implement a basic bulletin list sufficient to support builder workflow.

Display useful metadata such as:

- public code;
- type;
- mode;
- number of selections;
- total odd;
- effective status;
- created/updated date.

Keep it simple.

Full History workflow belongs to a later phase.

---

# 45. Builder Route

Add a clear frontend route/view for creating/editing bulletins.

Conceptually:

/bulletins/new
/bulletins/:id

or the project's existing route conventions.

Do not require a large routing refactor if navigation is currently simpler.

---

# 46. Builder Layout

Use a clear editing layout.

Recommended conceptual structure:

Header / Bulletin settings

Selections
  Selection 1
  Selection 2
  ...

Summary / Preview

Actions:
  Save
  Duplicate where applicable

For desktop, a two-column editor/preview layout may be useful.

For narrower widths, stack sections.

Do not optimize only for a 1080x1350 graphic canvas.

The management UI itself must remain responsive.

---

# 47. Selection Card

Each selection editor card should make the important values obvious.

At minimum:

- position;
- fixture;
- home vs away;
- competition where available;
- market;
- odd;
- status where available;
- remove;
- reorder.

Avoid burying core fields inside multiple dialogs.

---

# 48. Add Selection

Provide an obvious Add Selection action.

Respect type:

SINGLE:
- do not allow adding a second selection

MULTI:
- allow until 10

At maximum:

disable/hide Add Selection appropriately and explain the limit.

Do not allow the 11th selection client-side or server-side.

---

# 49. Changing Type

Handle transitions carefully.

Example:

MULTI with 4 selections
→ user changes to SINGLE

Do not silently delete 3 selections.

Require explicit resolution.

Options:

- block the change until only one selection remains;
- ask for confirmation and clearly state which data would be removed.

Prefer blocking over destructive surprise.

---

# 50. Changing Mode

Changing PRE_MATCH ↔ LIVE should not destroy selections.

Only mode-specific display/config data may need adjustment.

Do not reset the whole bulletin.

---

# 51. Unsaved Changes

Protect against accidental loss where practical.

If existing frontend architecture supports navigation blocking simply, warn before leaving a dirty bulletin.

Do not add a complex global state persistence framework solely for this feature.

At minimum:

- Save state should be clear;
- failed save must not discard current form values.

---

# 52. Save Feedback

Provide clear states:

- unsaved;
- saving;
- saved;
- error.

Do not use ambiguous buttons that appear successful before server persistence completes.

Show server validation errors in useful context.

---

# 53. Autosave

Do not add autosave in v1 unless already explicitly documented.

Manual save is simpler and safer for this phase.

Do not create debounce/background persistence complexity unnecessarily.

---

# 54. Duplicate Bulletin

Implement duplication as an Application use case.

Duplicate should copy appropriate editable bulletin content:

- type;
- mode;
- selections;
- odds;
- display settings;
- optional stake/date metadata where appropriate.

Duplicate must NOT copy identity.

Generate:

- new internal ID;
- new public code;
- new timestamps.

Do not duplicate:

- historical RenderRecords;
- previous settlement audit history;
- provider sync history.

---

# 55. Duplicate Status Behavior

Do not blindly clone final settlement state as authoritative current state.

Follow product-spec/data-model semantics.

Prefer that the duplicate preserves selection definitions while its calculated state is re-derived from current fixture facts where appropriate.

If current documentation explicitly says duplicate should copy result state, follow it.

Do not silently copy manual overrides unless product requirements clearly require that.

Manual overrides are usually audit decisions tied to the original bulletin and should not automatically transfer.

Report the chosen behavior if docs were ambiguous.

---

# 56. Duplicate Snapshots

Create fresh snapshot records for the new bulletin.

Do not point the duplicate's mutable/current selections at the original bulletin's snapshot rows.

Immutable Asset references may safely be shared.

---

# 57. Edit Existing Bulletin

Opening a bulletin must restore:

- type;
- mode;
- ordered selections;
- fixtures/context;
- markets;
- odds;
- metadata;
- display settings;
- current calculated/effective status.

Do not rebuild it from current catalog labels when stored snapshots are the intended source.

---

# 58. Catalog Changes During Edit

If a referenced current Team/Market is inactive or renamed after the bulletin was created:

- preserve the bulletin;
- show the stored/reference context;
- allow safe editing.

Do not make a historical/existing bulletin invalid simply because a current catalog entry was deactivated.

For replacing the selection with a new market/fixture, use active current catalog data.

---

# 59. Deleted/Unavailable References

Historical integrity should normally prevent destructive deletion.

Still, handle unexpected missing references gracefully.

Do not crash the entire builder because one lookup is missing.

Show a controlled unresolved state and prevent unsafe save if required.

Do not fabricate replacement entities.

---

# 60. Fixture Search UX

Provide a practical fixture picker.

Useful search/filter criteria:

- team name;
- competition;
- date;
- fixture status.

Keep local dataset expectations in mind.

Do not implement Elasticsearch/full-text infrastructure.

A simple search endpoint or local filter is sufficient.

---

# 61. Fixture Date Display

Use explicit locale formatting at Presentation level.

Do not mutate UTC persistence values.

For deterministic stored/render data, keep canonical timestamps.

Browser display may use the application's chosen locale/timezone policy.

Do not mix display-formatted values back into persistence.

---

# 62. Provider Refresh From Builder

Do not make external synchronization a hidden side effect of opening the builder.

If a small explicit:

Refresh fixtures

action already exists from Phase 04, it may be linked/used.

Do not automatically spend provider quota on every fixture search.

Local data is primary.

---

# 63. Market Search UX

For the market picker, allow simple search by:

- name;
- category;
- possibly code for advanced/admin usefulness.

Prefer user-facing name/category.

Do not expose evaluator internals unless useful as a secondary indicator.

---

# 64. Selection Validation UI

Show errors next to the relevant selection.

Examples:

- fixture required;
- market required;
- invalid odd;
- duplicate warning;
- unsupported/inactive context.

Do not only display one generic "Invalid bulletin" message.

Server remains authoritative.

---

# 65. Overall Validation Summary

For multi-selection bulletins, a concise summary at Save time may be useful if several selections are invalid.

Avoid intrusive validation while every field is still being typed.

Follow existing form UX conventions.

---

# 66. Preview

Implement a deterministic builder preview representation.

This is NOT the final Rendering Engine.

The preview should visually communicate the bulletin structure using ordinary React/CSS.

It should show:

- bulletin identity where enabled;
- type/mode;
- selections;
- home/away names;
- market;
- odd;
- optional competition/date;
- optional stake;
- total odd;
- effective status/result where enabled.

Do not export PNG in this phase.

---

# 67. Preview Architecture

Keep preview input close to the future render-model contract.

Prefer mapping:

Bulletin aggregate / API DTO
       ↓
Preview model
       ↓
React preview component

Do not have the preview query repositories/providers itself.

Do not put Market Engine logic inside the preview.

---

# 68. Preview Is Not Render Source of Truth Yet

Do not promise pixel-identical output with the future renderer unless the architecture already intentionally shares the same logical component.

If rendering-engine.md plans shared React/CSS primitives, structure the preview so reuse is possible.

But do not prematurely implement Playwright screenshot/export.

---

# 69. Preview Density

Make the preview remain readable for:

1
2–3
4–6
7–8
9–10

selections.

Do not implement the final sophisticated typography fitting algorithm yet.

Simple CSS density classes are sufficient in this phase.

Avoid overflow.

---

# 70. Long Names

Test preview with long team and market names.

The builder preview must not break its layout.

Use:

- controlled wrapping;
- truncation only where acceptable;
- sensible responsive font sizes.

Do not permanently alter snapshot names to fit the preview.

Text fitting belongs to the Rendering Engine.

---

# 71. Status Area Stability

Where preview displays status/result, reserve a consistent region so toggling or changing:

PENDING
GREEN
RED
VOID
MANUAL

does not cause major layout shifts.

This mirrors the future rendering contract.

Do not implement final pixel geometry here.

---

# 72. Market Always Visible

The market must remain visible in every selection preview.

Do not hide it at compact density.

This is a product invariant.

---

# 73. Team Logos

If immutable local assets exist, preview may show local team logos.

Provide a graceful fallback when absent.

Do not fetch remote logo URLs directly from React.

Do not fail the selection because no logo exists.

---

# 74. Preview Status Colors

Use semantic styling consistent with current design direction.

Do not make color the only status indicator.

Include text/label/icon where appropriate.

Do not hardcode rendering-engine-specific color values in multiple places if design tokens already exist.

---

# 75. Bet Studio Design Direction

Keep the UI consistent with the established Bet Studio visual direction:

- modern;
- premium;
- dark;
- football analytics/betting oriented;
- restrained accent use;
- strong typography hierarchy.

Do not redesign the whole product.

Do not introduce a large UI framework solely for this phase.

---

# 76. Client State

Keep builder state local to the builder unless shared state is genuinely required.

Do not introduce Redux or another global state framework solely for the builder.

A reducer/custom hook may be appropriate for managing selection operations.

Prefer explicit state transitions.

---

# 77. Builder State Actions

If useful, model client state operations explicitly:

- setType
- setMode
- addSelection
- removeSelection
- updateSelection
- moveSelection
- setDisplayOption
- loadBulletin
- resetAfterSave

Do not create a generic event framework.

---

# 78. DTO Boundary

Do not expose Drizzle records directly to the builder.

Define clear bulletin read/write DTOs.

The write DTO should not allow clients to set server-owned fields such as:

- internal generated IDs where not required;
- createdAt;
- updatedAt;
- public code;
- calculated evaluator metadata;
- provider references.

---

# 79. Create DTO

A conceptual create DTO might include:

{
  type,
  mode,
  stake?,
  displayOptions,
  selections: [
    {
      fixtureId,
      marketId,
      odd
    }
  ]
}

Adapt to actual domain requirements.

Do not require the client to send duplicated:

homeTeamName
awayTeamName
marketLabel

when these are created server-side as trusted snapshots.

---

# 80. Snapshot Trust Boundary

Snapshot content must be generated by Application/Domain from trusted current entities/configuration.

Do not trust arbitrary client-supplied historical snapshot labels.

Otherwise a client could persist contradictory historical state.

The client submits references and editable business inputs.

The server constructs snapshots.

---

# 81. Update DTO

For update, prefer replacing/reconciling the aggregate selection list coherently rather than exposing raw table mutations.

Use selection IDs to preserve identity where appropriate.

Handle:

- existing selection updated;
- new selection added;
- selection removed;
- order changed.

Do not accidentally recreate every selection ID on every save if preserving identity is useful for settlement/audit.

---

# 82. Selection Identity During Edit

Preserve stable selection IDs for unchanged selections.

This matters because later:

- settlement overrides;
- result snapshots;
- audit/history

may reference the selection.

Do not implement "delete all selections and recreate them" on every edit unless the data model explicitly treats them as immutable replacement versions.

If aggregate replacement is used, ensure historical references cannot be broken.

---

# 83. Editing Evaluated Selections

If the user changes:

fixture
or
market

for an already evaluated selection, previous calculated evaluation may no longer be valid.

Invalidate/re-evaluate current calculated state through the existing application/domain rules.

Do not keep an old GREEN result attached to a different market.

---

# 84. Editing Odds

Changing odd does not change market settlement result.

Do not unnecessarily rerun Market Engine solely because odd changed.

It should update:

selection odd
total odd

while preserving settlement evaluation if all football/evaluator inputs remain unchanged.

---

# 85. Editing Fixture

Changing fixture should invalidate current automatic settlement output and re-evaluate if appropriate.

Do not preserve a result derived from the previous fixture as current calculated state.

Historical audit snapshots remain historical.

---

# 86. Editing Market

Changing market should invalidate current calculated status/evaluator metadata and allow re-evaluation under the new configuration.

Manual override behavior must follow product/data model policy.

If a manual override refers to the old selection definition, safest behavior is to require explicit handling rather than silently transfer it.

Do not guess.

---

# 87. Manual Overrides While Editing

Do not make destructive bulletin edits silently preserve misleading manual overrides.

If fixture/market changes materially alter a selection:

- follow documented override invalidation semantics;
- if undefined, clear current override only through an auditable reset/update path and report the decision.

Do not delete override audit history.

---

# 88. Transactions

Save bulletin aggregate changes in a short database transaction.

Do not perform provider HTTP calls inside that transaction.

Do not perform image downloads inside it.

Use local records already available.

---

# 89. Concurrency

This is a local single-user v1 application.

Do not implement distributed locking.

Still avoid obvious lost updates where practical.

If existing updatedAt/version semantics support simple optimistic concurrency, reuse them.

Do not add a complex event-sourcing system.

---

# 90. Search API Performance

Bulletin builder searches operate on local SQLite data.

Use reasonable query limits.

Do not return thousands of fixtures into the browser when a narrow search is possible.

A simple bounded list such as recent/upcoming fixtures plus search is sufficient.

---

# 91. Accessibility

Ensure:

- labels associated with controls;
- keyboard navigation;
- visible focus;
- buttons have clear accessible names;
- reorder operation has keyboard alternative;
- status is not conveyed by color alone;
- errors are understandable.

Do not defer basic accessibility to final polish.

---

# 92. Empty States

Handle:

no fixtures
no markets
no teams where relevant
no bulletins

with useful guidance.

For example:

"No fixtures available locally."

Offer a relevant local/create or explicit refresh action.

Do not show blank panels.

---

# 93. Loading States

Show loading states for:

- opening bulletin;
- fixture search;
- market lookup;
- save;
- duplicate.

Avoid global full-screen spinners for small local actions where unnecessary.

---

# 94. Error States

Handle:

- bulletin not found;
- failed save;
- invalid references;
- database failure;
- failed fixture lookup.

Do not lose form state after a failed save.

Do not expose SQL/internal stack traces.

---

# 95. Application Tests

Add focused application tests covering:

- create SINGLE with one selection;
- reject SINGLE with >1;
- reject MULTI with <2;
- create MULTI with 10;
- reject 11 selections;
- preserve selection order;
- derive trusted snapshot fields;
- decimal-safe total odd;
- update aggregate;
- duplicate gets new IDs/public code;
- duplicate snapshot independence;
- catalog rename does not mutate stored snapshot;
- inactive market remains readable on existing bulletin.

---

# 96. Total Odd Tests

Use representative cases.

Examples:

1.50 × 2.00
→ 3.00

1.55 × 1.85
→ deterministic expected decimal result

1.10 × 1.10 × 1.10
→ no binary floating-point artifact

Test final display rounding according to the chosen rule.

Do not write assertions against JS floating-point approximations.

---

# 97. API Tests

Cover:

POST bulletin
GET bulletin
PATCH bulletin
duplicate bulletin
list bulletins

Also test:

- invalid type/mode;
- bad selection count;
- invalid odd;
- missing fixture;
- missing market;
- 404;
- server-owned fields ignored/rejected as appropriate.

Use Fastify inject/in-process testing.

---

# 98. Builder UI Tests

Test high-value behavior.

At minimum:

- create page loads;
- switching SINGLE/MULTI affects selection controls;
- cannot add >10;
- market always displayed in selection card/preview;
- total odd updates;
- validation shown;
- reorder works;
- save payload correct;
- display toggles update preview.

Do not create huge snapshot suites.

---

# 99. Playwright

If current Playwright setup is reliable, add one representative E2E workflow.

Example:

1. open new bulletin;
2. choose MULTI;
3. add two selections;
4. choose fixtures/markets;
5. enter odds;
6. save;
7. reopen;
8. verify order and values persist.

Use local test data.

Do not call live GOAL API.

Keep E2E count small.

---

# 100. Fixture Test Data

Use deterministic local test fixtures.

Do not depend on current football schedules or real-world live matches.

Tests must remain stable over time.

---

# 101. No Provider Calls in Builder Tests

Builder tests must not require:

GOAL_API_KEY
internet
provider availability

The builder operates from local data.

---

# 102. No Final Rendering

Do not implement:

- PNG export;
- Playwright screenshot for bulletin graphics;
- renderer fingerprint;
- template geometry engine;
- font fitting engine;
- Story export.

These belong to Phase 07.

The ordinary builder preview is enough.

---

# 103. No History Workflow Yet

Do not implement the full History management feature yet.

Only provide enough bulletin listing/opening behavior to support creation/editing.

Features such as:

- historical render browsing;
- result timeline;
- export history;
- advanced status filters;

belong to a later phase.

---

# 104. No Social Publishing

Do not implement:

- Instagram;
- Facebook;
- X/Twitter;
- upload APIs;
- posting automation.

Export/publishing remains outside this phase.

---

# 105. No Betting Financial Engine

Do not add:

- payout;
- profit/loss;
- bankroll;
- balance;
- accounting;
- currency conversion.

Stake and odds remain metadata.

---

# 106. README

Update README.md minimally to reflect that bulletin creation/editing is now implemented.

Do not document every form field in README.

Keep detailed product behavior in product-spec.md.

Ensure only Bet Studio identity appears.

---

# 107. Product Documentation

Update docs/product-spec.md only where this phase resolves a real previously ambiguous builder behavior.

Potential examples:

- duplicate semantics;
- exact total-odd rounding;
- edit/override invalidation;
- draft behavior.

Do not silently create material product rules.

If ambiguity is not safely resolvable, report it.

---

# 108. Data Model Documentation

Update docs/data-model.md only for factual implementation alignment if needed.

Examples:

- snapshot lifecycle;
- selection identity during edits;
- derived total odd;
- displayOptions representation.

Do not duplicate UI details into data-model.md.

---

# 109. Rendering Contract Compatibility

If rendering-engine.md already defines a render input model, ensure builder data can later map cleanly into it.

Do not implement the renderer.

Avoid introducing builder-only structures that make future rendering dependent on React form internals.

---

# 110. Security Review

Verify:

- client cannot set server-owned historical snapshot fields;
- client cannot set arbitrary filesystem asset paths;
- input validation exists server-side;
- max 10 selections enforced server-side;
- market parameters are not executable input;
- IDs are validated;
- no provider secrets reach frontend;
- no raw persistence errors exposed.

---

# 111. Quality Gates

Before completion run the repository's actual quality commands.

At minimum:

- format/check;
- lint;
- typecheck;
- unit tests;
- integration tests;
- build.

Run:

- database/migration verification if schema changed;
- Playwright E2E if added and reliable.

Do not claim a command passed unless it actually completed successfully.

---

# 112. Manual Verification

If environment permits, manually verify:

1. Create SINGLE with one selection.
2. Save and reopen it.
3. Create MULTI with two selections.
4. Reorder selections.
5. Change one odd and verify total odd.
6. Toggle competition/date/status/result visibility.
7. Save and reopen.
8. Duplicate and confirm new public code.
9. Try to add an 11th selection and verify it is blocked.
10. Change MULTI with several selections to SINGLE and verify no silent data loss.
11. Use a manual-only market successfully.
12. Verify preview with 10 selections and long names.

Do not claim manual verification if it was not performed.

---

# 113. Git Diff Review

Before finishing inspect the final diff.

Verify:

- no renderer/export implementation entered scope;
- no provider calls were added to builder rendering/search implicitly;
- no payout engine was introduced;
- no local DB files were committed;
- no `.env` or secrets were committed;
- no arbitrary snapshot data is trusted from the client;
- selection identity/order is stable;
- docs match implemented behavior;
- no previous/alternative project identity appears.

Remove unrelated changes.

---

# 114. Completion Report

At the end report concisely:

1. Bulletin create/edit workflow implemented.
2. SINGLE/MULTI constraints.
3. PRE_MATCH/LIVE handling.
4. Fixture and Market selection behavior.
5. Decimal/total-odd strategy.
6. Display options implemented.
7. Snapshot behavior.
8. Selection reorder/edit semantics.
9. Duplicate behavior.
10. Preview behavior.
11. API/application endpoints/use cases.
12. Tests added.
13. Exact verification commands executed and results.
14. Any unresolved builder/product decision.

Do not provide a long file-by-file narrative.

Do not commit or push unless explicitly requested.