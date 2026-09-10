You are implementing Phase 05 of Bet Studio:

Market Engine + Green / Red / Void

Before making changes:

1. Read AGENTS.md.
2. Read docs/architecture.md.
3. Read docs/market-engine.md in full.
4. Read docs/data-model.md only for:
   - Market
   - Fixture
   - FixtureResultDetails
   - Bulletin
   - BulletinSelection
   - SelectionResultSnapshot
   - SettlementOverride
5. Read docs/product-spec.md only for settlement/status behavior.
6. Inspect the implementation from Phases 01–04.
7. Inspect existing domain types, market configuration schemas, fixture status types, repositories and tests.

Do not read rendering-engine.md unless a status-display contract requires clarification.

Do not modify provider integration except where a small type alignment is strictly necessary.

The repository and documentation are the source of truth.

Do not introduce or reference any project identity other than Bet Studio.

---

# Goal

Implement the deterministic football Market Engine for Bet Studio.

At the end of this phase, the system must be able to evaluate supported selections from normalized local fixture data and produce:

PENDING
GREEN
RED
VOID
MANUAL

The implementation must include:

- pure domain evaluators;
- evaluator registry;
- evaluator-specific parameter validation;
- centralized fixture-state handling;
- structured evaluation results;
- evaluator versioning;
- composite AND/OR markets;
- manual override resolution;
- bulletin aggregate status calculation;
- re-evaluation application service;
- result snapshots where appropriate;
- comprehensive table-driven tests.

Do not implement:

- betting payouts;
- bookmaker settlement rules;
- Asian handicap;
- player markets;
- rendering;
- automatic background settlement;
- social publishing.

---

# 1. Domain Purity

The Market Engine belongs to Domain.

It must not import or depend on:

- React;
- Fastify;
- Drizzle;
- SQLite;
- fetch;
- HTTP;
- provider SDKs;
- environment variables;
- filesystem APIs;
- Playwright;
- rendering code.

The core evaluator behavior must be pure and deterministic.

Conceptually:

Market definition +
Fixture facts
↓
Market Engine
↓
Evaluation result

No I/O belongs inside evaluator functions.

---

# 2. Evaluation Statuses

Use the documented settlement statuses:

PENDING
GREEN
RED
VOID
MANUAL

Meanings:

PENDING
→ outcome is not yet final or fixture is not settleable yet

GREEN
→ selection won according to implemented rule

RED
→ selection lost according to implemented rule

VOID
→ selection is void according to explicit fixture-state policy

MANUAL
→ automatic settlement cannot be performed safely

Do not introduce extra settlement states without explicit documentation.

---

# 3. Calculated vs Effective Status

Preserve automatic calculation separately from manual override.

Conceptually:

calculatedStatus = engine result

effectiveStatus =
manualStatus ?? calculatedStatus

Re-evaluation must update calculated status only.

It must never silently remove or overwrite an intentional manual override.

---

# 4. Evaluation Input

Define a strongly typed provider-independent evaluation input.

Conceptually:

type MarketEvaluationInput = {
market: {
code: string;
autoEvaluable: boolean;
evaluatorKey: EvaluatorKey | null;
parameters: unknown;
};

fixture: {
status: FixtureStatus;
homeScore: number | null;
awayScore: number | null;
halfTimeHomeScore?: number | null;
halfTimeAwayScore?: number | null;
homeCorners?: number | null;
awayCorners?: number | null;
};
};

Adapt to existing domain types.

Do not pass GOAL API DTOs into the engine.

Do not require display labels for evaluation.

---

# 5. Evaluation Output

Return structured results.

Conceptually:

type MarketEvaluationResult = {
status: SettlementStatus;
evaluatorKey: EvaluatorKey | null;
evaluatorVersion: number | null;
reasonCode: MarketEvaluationReasonCode;
details?: Record<string, unknown>;
};

Keep `details` small and diagnostic.

Do not return free-form natural-language reasoning as the primary result.

UI-friendly text can later be derived from reasonCode.

---

# 6. Evaluator Version Ownership

Evaluator implementations own their current version.

The caller should not normally pass evaluatorVersion as part of ordinary evaluation input.

Each evaluator exposes its current version.

Example conceptually:

const totalGoalsEvaluator = {
key: "TOTAL_GOALS",
version: 1,
evaluate(...)
};

The result stores:

evaluatorVersion: 1

Historical snapshots may preserve the version used.

Do not promise historical re-execution of old evaluator behavior unless versioned evaluator implementations actually exist.

For v1, storing prior output + evaluatorVersion is sufficient.

---

# 7. Evaluator Registry

Implement an explicit registry for supported evaluator families.

Initial evaluator keys:

MATCH_RESULT
DOUBLE_CHANCE
TOTAL_GOALS
BTTS
TOTAL_CORNERS
COMPOSITE

Do not create one evaluator implementation per Market.code.

Use reusable evaluator families parameterized by structured market configuration.

Example:

HOME_WIN
DRAW
AWAY_WIN

all use:

MATCH_RESULT

with different parameters.

---

# 8. Evaluation Order

Centralize evaluation order.

Use this conceptual order:

1. validate market/input;
2. evaluate fixture state;
3. verify market is auto-evaluable;
4. resolve evaluator;
5. validate evaluator parameters;
6. verify required fixture data exists;
7. execute evaluator;
8. return structured result.

Do not repeat fixture-state logic independently inside every evaluator.

---

# 9. Fixture State Policy

Use the documented policy.

For:

SCHEDULED
→ PENDING

LIVE
→ PENDING

POSTPONED
→ PENDING

FINISHED
→ evaluate market

CANCELLED
→ VOID

ABANDONED
→ MANUAL

UNKNOWN
→ MANUAL

If Phase 04 introduced an additional normalized status such as SUSPENDED, follow the now-documented rule.

If SUSPENDED exists and no explicit rule has yet been documented, do not guess silently. Prefer PENDING only if the project documentation has been updated to define it as unresolved/not-final.

Keep fixture-state behavior centralized and tested.

---

# 10. Missing Fixture

If a selection has no usable fixture/result facts:

do not guess.

Return:

MANUAL

with a stable reason code such as:

MISSING_FIXTURE_DATA

or the existing documented equivalent.

Do not convert missing data into RED.

---

# 11. Non-Auto-Evaluable Market

When:

autoEvaluable = false

return:

MANUAL

with a stable reason such as:

MARKET_MANUAL_ONLY

Do not try to infer outcome from market.code or name.

---

# 12. Missing Evaluator

When a market claims:

autoEvaluable = true

but:

evaluatorKey = null

or the evaluator cannot be resolved:

return:

MANUAL

with a stable diagnostic reason.

Do not throw for ordinary persisted invalid configuration if the system can safely classify it as manual-required.

However, programmer errors/internal impossible states may still throw according to existing project conventions.

---

# 13. Invalid Parameters

Validate parameters at runtime before evaluation.

If parameters are invalid:

return:

MANUAL

with a stable reason such as:

INVALID_MARKET_PARAMETERS

Do not silently coerce malformed values.

Do not evaluate using partial defaults.

---

# 14. MATCH_RESULT

Parameters:

{
result: "HOME" | "DRAW" | "AWAY"
}

Requires:

homeScore
awayScore

Fixture must be FINISHED.

Evaluation:

homeScore > awayScore
→ actual result HOME

homeScore === awayScore
→ actual result DRAW

homeScore < awayScore
→ actual result AWAY

If actual result matches configured result:

GREEN

otherwise:

RED

---

# 15. MATCH_RESULT Tests

Cover at minimum:

HOME

- 2–1 → GREEN
- 0–0 → RED
- 1–3 → RED

DRAW

- 0–0 → GREEN
- 2–2 → GREEN
- 1–0 → RED

AWAY

- 0–2 → GREEN
- 1–1 → RED
- 3–1 → RED

Also test:

- missing score → MANUAL
- negative score rejected/invalid input
- non-finished fixture handled before evaluator

---

# 16. DOUBLE_CHANCE

Parameters:

{
outcome: "1X" | "X2" | "12"
}

Requires:

homeScore
awayScore

Determine final match result.

Rules:

1X
→ HOME or DRAW = GREEN
→ AWAY = RED

X2
→ DRAW or AWAY = GREEN
→ HOME = RED

12
→ HOME or AWAY = GREEN
→ DRAW = RED

---

# 17. DOUBLE_CHANCE Tests

Cover all final-result combinations for:

1X
X2
12

Use table-driven tests.

Also cover:

- missing score;
- invalid outcome;
- fixture state pre-check.

---

# 18. TOTAL_GOALS

Parameters:

{
direction: "OVER" | "UNDER";
line: number;
}

Requires:

homeScore
awayScore

Calculate:

totalGoals = homeScore + awayScore

For supported half-lines:

OVER
→ GREEN when totalGoals > line
→ RED otherwise

UNDER
→ GREEN when totalGoals < line
→ RED otherwise

---

# 19. Supported Goal Lines

Follow docs/market-engine.md.

Initial automatic evaluation supports half-goal lines only.

Examples:

0.5
1.5
2.5
3.5
4.5

Do not implement integer pushes or Asian totals.

If a persisted auto-evaluable market uses an unsupported line:

return MANUAL

with an explicit reason.

Do not silently reinterpret the line.

---

# 20. TOTAL_GOALS Tests

Examples:

OVER 2.5

- 2–1 → GREEN
- 1–1 → RED
- 0–0 → RED

UNDER 2.5

- 1–0 → GREEN
- 1–1 → GREEN
- 2–1 → RED

OVER 0.5

- 1–0 → GREEN
- 0–0 → RED

UNDER 0.5

- 0–0 → GREEN
- 1–0 → RED

Also test:

- supported boundary lines;
- unsupported integer line;
- malformed negative line;
- missing score.

---

# 21. BTTS

Parameters:

{
selection: "YES" | "NO"
}

Requires:

homeScore
awayScore

Determine:

bothScored =
homeScore > 0 && awayScore > 0

YES:
bothScored → GREEN
otherwise → RED

NO:
!bothScored → GREEN
otherwise → RED

---

# 22. BTTS Tests

YES:

1–1 → GREEN
3–2 → GREEN
1–0 → RED
0–0 → RED

NO:

0–0 → GREEN
2–0 → GREEN
0–3 → GREEN
1–1 → RED

Also cover missing score and invalid selection parameter.

---

# 23. TOTAL_CORNERS

Parameters:

{
direction: "OVER" | "UNDER";
line: number;
}

Requires:

homeCorners
awayCorners

Calculate:

totalCorners =
homeCorners + awayCorners

For supported half-lines:

OVER
→ GREEN when totalCorners > line
→ RED otherwise

UNDER
→ GREEN when totalCorners < line
→ RED otherwise

---

# 24. Missing Corner Data

If fixture is FINISHED but:

homeCorners == null

or:

awayCorners == null

return:

MANUAL

Use an explicit reason such as:

MISSING_CORNERS

Do not infer corners from another statistic.

Do not convert missing corners into zero.

---

# 25. Supported Corner Lines

Follow docs/market-engine.md.

Initial catalog examples include half-lines such as:

7.5
8.5
9.5
10.5
11.5

Keep validation based on supported half-line semantics rather than hardcoding only these five exact values if docs permit additional positive half-lines.

Do not support Asian/integer push semantics in v1.

---

# 26. TOTAL_CORNERS Tests

OVER 9.5:

6 + 5 = 11 → GREEN
4 + 5 = 9 → RED

UNDER 9.5:

4 + 4 = 8 → GREEN
5 + 5 = 10 → RED

Also test:

- zero corners;
- missing home corners;
- missing away corners;
- invalid negative corners;
- unsupported line.

---

# 27. COMPOSITE Evaluator

Implement COMPOSITE by reusing existing evaluator logic.

Do not duplicate MATCH_RESULT / TOTAL_GOALS / BTTS logic inside COMPOSITE.

Parameters:

{
operator: "AND" | "OR";
conditions: [
{
evaluatorKey: ...;
parameters: ...;
}
];
}

Follow the configuration rules established in Phase 03.

---

# 28. No Nested Composite in V1

Composite children must use primitive evaluator families only:

MATCH_RESULT
DOUBLE_CHANCE
TOTAL_GOALS
BTTS
TOTAL_CORNERS

Do not allow:

COMPOSITE
inside
COMPOSITE

in v1.

Reject/return MANUAL for invalid nested configuration according to the engine's invalid-parameter policy.

This avoids cycles and arbitrary recursion.

---

# 29. Composite Condition Limit

Use the Phase 03 documented maximum.

If Phase 03 established:

2..4 conditions

preserve that rule.

Do not silently change the limit.

The engine must not evaluate unbounded arbitrary condition trees.

---

# 30. Composite AND

Follow docs/market-engine.md exactly.

At minimum:

all GREEN
→ GREEN

any RED
→ RED

If no RED but a child requires MANUAL
→ MANUAL

If no RED/MANUAL but a child remains PENDING
→ PENDING

VOID behavior must follow the currently documented composite semantics.

Do not invent bookmaker-specific void-leg financial behavior here.

---

# 31. Composite OR

Follow docs/market-engine.md exactly.

At minimum:

any GREEN
→ GREEN

all RED
→ RED

If no GREEN and a child requires MANUAL
→ MANUAL

If no GREEN/MANUAL but a child remains PENDING
→ PENDING

VOID behavior must follow the current documented rule.

Do not infer payout behavior.

---

# 32. Composite Short-Circuiting

Use deterministic short-circuiting where semantics allow it.

Examples:

AND:
one RED is sufficient for RED according to current documented rules.

OR:
one GREEN is sufficient for GREEN.

However:

do not make short-circuiting change externally visible semantics.

Tests should verify composite result, not implementation order.

---

# 33. Composite Fixture State

Top-level fixture-state policy should be applied before child evaluation.

For example:

fixture LIVE
→ overall market PENDING

Do not independently settle primitive children from an unfinished fixture.

This keeps one consistent settlement boundary.

---

# 34. Composite Tests

Add table-driven tests covering:

AND:
GREEN + GREEN → GREEN
GREEN + RED → RED
RED + GREEN → RED
RED + RED → RED
RED + MANUAL → documented result
GREEN + MANUAL → documented result
GREEN + PENDING → documented result
VOID combinations according to docs

OR:
GREEN + GREEN → GREEN
GREEN + RED → GREEN
RED + GREEN → GREEN
RED + RED → RED
GREEN + MANUAL → documented result
RED + MANUAL → documented result
RED + PENDING → documented result
VOID combinations according to docs

Also test:

- nested COMPOSITE rejection;
- too many conditions;
- malformed child parameters;
- unsupported child evaluator.

---

# 35. Initial Composite Market Scenarios

Ensure the engine can represent/evaluate the existing configured combinations, including:

BTTS YES OR OVER 2.5

HOME WIN AND OVER 1.5
DRAW AND OVER 1.5
AWAY WIN AND OVER 1.5

HOME WIN AND OVER 2.5
DRAW AND OVER 2.5
AWAY WIN AND OVER 2.5

HOME WIN AND OVER 3.5
DRAW AND OVER 3.5
AWAY WIN AND OVER 3.5

BTTS YES AND OVER 2.5
BTTS YES AND OVER 3.5

Do not create new composite catalog variants that are not already required.

---

# 36. Slash Semantics

Where existing configured market labels use a slash conceptually representing:

Result / Total Goals

preserve the documented interpretation:

AND

Do not reinterpret `/` as alternative/OR.

The engine should still operate only from structured parameters, never from the slash character in a label.

---

# 37. Reason Codes

Define stable reason codes for evaluation outcomes.

Prefer an enum/union.

Useful categories may include:

FIXTURE_SCHEDULED
FIXTURE_LIVE
FIXTURE_POSTPONED
FIXTURE_CANCELLED
FIXTURE_ABANDONED
FIXTURE_UNKNOWN

MARKET_MANUAL_ONLY
MISSING_EVALUATOR
UNSUPPORTED_EVALUATOR
INVALID_MARKET_PARAMETERS
MISSING_SCORE
MISSING_CORNERS

MATCH_RESULT_MATCHED
MATCH_RESULT_NOT_MATCHED

TOTAL_GOALS_MATCHED
TOTAL_GOALS_NOT_MATCHED

DOUBLE_CHANCE_MATCHED
DOUBLE_CHANCE_NOT_MATCHED

BTTS_MATCHED
BTTS_NOT_MATCHED

TOTAL_CORNERS_MATCHED
TOTAL_CORNERS_NOT_MATCHED

COMPOSITE_MATCHED
COMPOSITE_FAILED
COMPOSITE_PENDING
COMPOSITE_MANUAL
COMPOSITE_INVALID

Use names consistent with existing project conventions.

Do not create dozens of redundant codes without value.

---

# 38. Details Metadata

Evaluation details may contain useful structured diagnostic facts.

Examples:

{
actualResult: "HOME"
}

{
totalGoals: 3,
line: 2.5,
direction: "OVER"
}

{
totalCorners: 11
}

For composite:

{
childStatuses: ["GREEN", "RED"]
}

Keep details deterministic and serializable.

Do not include Date objects, errors, stack traces or functions.

---

# 39. Input Validation

Validate fixture facts.

Scores and corners, when present, must be:

- integers;
- > = 0.

Reject or safely classify malformed inputs.

Do not round:

2.8 goals

into:

3 goals

Malformed football facts should not produce GREEN/RED.

---

# 40. Market Configuration Validation Reuse

Reuse the evaluator parameter schemas created in Phase 03 where practical.

Do not create two conflicting definitions for:

TOTAL_GOALS parameters
BTTS parameters
etc.

Prefer schemas/types in a shared Domain market location.

CRUD validation and Market Engine evaluation should agree on configuration shape.

---

# 41. No Natural-Language Settlement

Never evaluate from:

market.name
displayLabel
user-entered sentence
AI output
regex parsing of market title

Only structured evaluatorKey + validated parameters are executable.

A renamed market must preserve the same settlement behavior.

---

# 42. No Arbitrary Executable Rules

Do not store or execute:

JavaScript
expressions
eval()
Function()
SQL
scripts

from Market.parameters.

Market configuration is declarative only.

Evaluator code remains trusted source code.

---

# 43. Manual Override Model

Integrate with the existing Phase 02 override persistence model.

A manual action may set:

GREEN
RED
VOID
PENDING

according to documented product behavior.

If MANUAL is itself allowed as an explicit manual override in the current model, preserve that behavior.

Do not change it silently.

Optional reason may be stored.

---

# 44. Reset to Automatic

Support:

Reset to automatic

according to the existing override model.

Reset means:

effectiveStatus returns to calculatedStatus

It must not erase historical audit information if Phase 02 implemented append-only override history.

Do not delete historical override records merely to simplify UI state.

---

# 45. Manual Override Resolution

Implement a pure/easily tested function such as conceptually:

resolveEffectiveStatus(
calculatedStatus,
currentManualOverride
)

Rules:

manual exists
→ manual status

no manual
→ calculated status

Do not embed this logic in React.

---

# 46. Re-evaluation Service

Implement an Application-layer use case/service for re-evaluating one selection.

Conceptually:

1. load selection;
2. load market configuration;
3. load fixture facts;
4. invoke pure Market Engine;
5. persist calculated result;
6. preserve manual override;
7. store result/audit snapshot where required;
8. return calculated + effective status.

The Application layer coordinates I/O.

The Domain engine remains pure.

---

# 47. Bulletin Re-evaluation

If repository/application structure supports it cleanly, implement a use case to re-evaluate all selections in one bulletin.

Conceptually:

reEvaluateBulletin(bulletinId)

Do not require the UI to invoke one HTTP request per selection.

Keep operations deterministic.

Use a transaction where persistence consistency requires it.

---

# 48. Fixture-triggered Re-evaluation

Design the application service so Phase 04 result sync can later invoke re-evaluation explicitly.

Do not tightly couple the Market Engine directly to provider synchronization.

Preferred boundary:

fixture sync completes
→ Application may request re-evaluation

not:

provider adapter
→ Market Engine directly

If automatic invocation is not yet needed in this phase, leave a clear application-level use case without background event infrastructure.

---

# 49. Selection Calculated Result

Persist calculated evaluation separately from manual state.

At minimum preserve:

- calculated status;
- evaluator key;
- evaluator version;
- reason code;
- evaluated timestamp;
- relevant structured evaluation details where model supports it.

Use the existing data model rather than introducing duplicate competing fields.

---

# 50. SelectionResultSnapshot

Where docs/data-model.md requires historical evaluation snapshots, persist the facts necessary for audit/reconstruction.

Do not store only:

GREEN

without enough context to understand which evaluator version/result facts produced it.

Follow the existing snapshot schema.

Do not mutate previous historical snapshots when re-evaluating current operational state unless the model explicitly defines a replaceable current snapshot.

---

# 51. Re-evaluation Idempotency

Evaluating the same:

market configuration +
fixture facts +
evaluator version

must produce the same calculated result.

Repeated re-evaluation must not create inconsistent current status.

If audit snapshots are append-only, avoid unnecessary duplicate audit records when nothing changed unless docs explicitly require recording every invocation.

Keep current-state persistence idempotent.

---

# 52. Bulletin Aggregate Status

Implement a pure Domain function for bulletin status based on effective selection statuses.

Rules:

if any selection is RED
→ RED

else if any selection is PENDING
→ PENDING

else if any selection is MANUAL
→ MANUAL

else if all selections are VOID
→ VOID

else if every remaining selection is GREEN or VOID
and at least one is GREEN
→ GREEN

Do not infer aggregate status from persisted stale bulletin status.

---

# 53. Bulletin Status Examples

Examples:

GREEN
→ GREEN

GREEN + GREEN
→ GREEN

GREEN + VOID
→ GREEN

VOID + VOID
→ VOID

GREEN + PENDING
→ PENDING

GREEN + MANUAL
→ MANUAL

GREEN + RED
→ RED

PENDING + RED
→ RED

MANUAL + RED
→ RED

Add table-driven tests.

---

# 54. Derived Bulletin Status

Prefer bulletin aggregate status as a derived Domain result in v1.

Do not create a second authoritative persisted bulletin status if Phase 02 left this as derived.

If the existing database already contains a materialized status field:

- inspect why it exists;
- keep it explicitly non-authoritative/cache-only;
- update it transactionally if current architecture depends on it.

Do not allow it to become stale silently.

---

# 55. VOID Semantics

VOID in this phase is a settlement status only.

Do not implement financial payout logic.

For example, do not yet calculate:

void odd = 1.00

or recompute financial return.

That belongs to future betting/financial logic if ever required.

Bulletin aggregate status rules may treat GREEN + VOID as GREEN as documented.

---

# 56. Cancelled Fixture

CANCELLED
→ VOID

for currently supported selection settlement policy.

Apply this before market-specific evaluation.

Do not mark cancelled selections GREEN or RED based on partial score.

---

# 57. Abandoned Fixture

ABANDONED
→ MANUAL

Do not assume automatic VOID unless documentation explicitly changes later.

Different competition/bookmaker rules may differ, so manual review is safest.

---

# 58. Postponed Fixture

POSTPONED
→ PENDING

Do not VOID merely because kickoff date changed.

---

# 59. Unknown Fixture Status

UNKNOWN
→ MANUAL

Do not settle from score alone when fixture state cannot be trusted.

---

# 60. LIVE Fixture

LIVE
→ PENDING

for all v1 pre-match settlement rules.

Even if current score already mathematically guarantees some outcome, do not settle early.

Example:

Over 0.5 with current score 1–0

while LIVE

must still remain:

PENDING

Settlement occurs only when fixture state allows evaluation.

This keeps rules simple and consistent.

---

# 61. PRE_MATCH vs LIVE Bulletin Mode

Bulletin display mode must not change football settlement mathematics in this phase.

A selection inside a LIVE bulletin still evaluates according to the fixture-state policy.

Do not create separate evaluator implementations for:

PRE_MATCH
LIVE

unless product rules explicitly require different settlement contracts later.

---

# 62. Supported Market Catalog Compatibility

Ensure Phase 03 market configurations for the initial catalog can be evaluated without migration hacks.

If Phase 03 created configuration that contradicts market-engine.md:

- fix the smallest clear mismatch;
- migrate data/schema only if required;
- update relevant documentation;
- report the correction.

Do not maintain two incompatible parameter formats.

---

# 63. Unsupported Markets

Examples that remain manual/not automatically evaluated include:

- goalscorers;
- player shots;
- player cards;
- player assists;
- exact score;
- card totals if not implemented;
- offsides;
- Asian handicap;
- Asian totals;
- bookmaker-specific bet builders;
- unsupported custom markets.

These may exist as:

autoEvaluable = false

and resolve to:

MANUAL

Do not attempt fuzzy/general settlement.

---

# 64. DNB

Do not implement Draw No Bet unless it has been explicitly reintroduced into current documentation.

It is not part of the current initial evaluator catalog.

Do not add it opportunistically.

---

# 65. Half-Time Markets

Do not implement half-time settlement merely because half-time scores exist.

Half-time score fields are data-model support for future markets.

No HALF_TIME evaluator is required in this phase unless docs explicitly changed.

---

# 66. Application API

Expose minimal endpoints/use cases necessary to trigger and inspect settlement.

Possible routes:

POST /api/selections/:id/evaluate

POST /api/bulletins/:id/evaluate

PATCH /api/selections/:id/settlement-override

DELETE or POST reset endpoint according to existing API conventions.

Adapt to existing architecture.

Do not create generic endpoints that accept arbitrary evaluator payloads from the browser and execute them directly.

Evaluation should use persisted Market + Fixture + Selection data.

---

# 67. Override API

Support explicit manual settlement actions.

Example body conceptually:

{
"status": "GREEN",
"reason": "Manual review"
}

Validate allowed values.

Do not accept arbitrary strings.

Reset must have an explicit endpoint/action.

Do not use a magic status string such as:

"AUTO"

unless already defined by the API contract.

---

# 68. Minimal UI Integration

Add only a small settlement-management UI where existing screens make it useful.

For example:

- current calculated status;
- manual/effective status;
- Evaluate / Re-evaluate action;
- Set GREEN;
- Set RED;
- Set VOID;
- Set PENDING;
- Reset to automatic;
- optional reason.

Do not build the final Bulletin Builder here if it is scheduled for Phase 06.

A simple fixture/selection admin surface or development-facing integration is enough.

---

# 69. UI Status Clarity

Where both calculated and manual statuses exist, do not hide the distinction.

Example conceptually:

Calculated: GREEN
Manual override: RED
Effective: RED

This is important for auditability.

Do not show only RED without indicating that it came from an override where relevant.

---

# 70. Provider Independence Test

Add at least one test showing that the Market Engine evaluates from normalized fixture facts without importing or constructing a GOAL API response object.

The Domain engine should remain usable with manually entered fixtures.

---

# 71. Pure Evaluator Tests

Most Market Engine tests should be pure unit tests.

They should not require:

- SQLite;
- HTTP;
- Fastify;
- browser;
- provider mock server.

This keeps the engine fast and reliable.

---

# 72. Table-Driven Testing

Prefer table-driven tests for evaluator truth tables.

Example structure conceptually:

[
{
score: [2, 1],
parameters: {...},
expected: "GREEN"
},
...
]

This makes market rules easy to audit.

---

# 73. Fixture State Test Matrix

Test every supported fixture state independently of evaluator family.

For a valid market:

SCHEDULED → PENDING
LIVE → PENDING
POSTPONED → PENDING
CANCELLED → VOID
ABANDONED → MANUAL
UNKNOWN → MANUAL
FINISHED → evaluator runs

If SUSPENDED exists, test its documented behavior.

This should be centralized rather than duplicated across evaluator test files unnecessarily.

---

# 74. Invalid Data Safety Tests

Explicitly test that malformed input never silently produces GREEN/RED.

Examples:

homeScore = -1
corner = -2
goal line = 2
goal line = NaN
unknown evaluator
malformed parameters

Safe result should follow documented validation policy, generally:

MANUAL

or a domain validation failure at a trusted construction boundary.

Do not let inconsistent invalid-data behavior vary by evaluator accidentally.

---

# 75. Determinism Tests

Evaluate identical input multiple times and verify identical:

status
reasonCode
details
evaluatorVersion

No evaluator may depend on:

Date.now()
Math.random()
system locale
network
database state
environment variables

---

# 76. Composite Reuse Test

Where practical, verify COMPOSITE delegates to the same primitive evaluator registry rather than maintaining duplicated rule implementations.

Do not test private implementation details excessively, but structure code so rule reuse is obvious.

---

# 77. Application Integration Tests

Add focused integration tests for:

- persisted market + fixture + selection evaluation;
- calculated status persistence;
- manual override preservation;
- reset to automatic;
- bulletin aggregate status;
- re-evaluation after fixture score correction;
- missing corner data → MANUAL;
- cancelled fixture → VOID;
- provider-origin fixture and manually-created fixture behave identically once normalized locally.

Use isolated test databases.

---

# 78. Historical Evaluation Test

Add a test proving evaluator metadata is preserved historically.

Conceptually:

1. evaluate selection;
2. result records evaluatorVersion = 1;
3. persist snapshot;
4. update unrelated current market display label;
5. historical result snapshot still preserves original evaluation metadata.

Do not require implementing old-version replay.

---

# 79. No Live Provider Calls

Market Engine tests must never call GOAL API or any external provider.

Even application integration tests should use local fixture facts.

Do not require API credentials.

---

# 80. Performance

The engine evaluates at most a small number of selections per bulletin.

Do not optimize prematurely.

A bulletin contains at most:

10 selections

Simple synchronous pure evaluation is sufficient.

Do not introduce workers, queues, parallel-processing frameworks or caches.

---

# 81. Logging

Pure Domain evaluators should not log.

Application orchestration may log useful high-level evaluation failures if current conventions require it.

Do not log every successful GREEN/RED evaluation by default.

Do not log sensitive or huge payloads.

---

# 82. Error Handling

Ordinary unsupported/missing settlement information should produce structured:

MANUAL

where documented.

Do not throw exceptions for expected states such as:

missing corners
manual-only market
unknown external fixture state already normalized to UNKNOWN

Reserve exceptions for genuine programming/infrastructure failures.

---

# 83. Documentation

Update docs/market-engine.md only where implementation resolves a previously ambiguous but necessary behavior.

Ensure it accurately reflects:

- evaluator version ownership;
- nested composite prohibition;
- composite condition limit;
- fixture-state policy;
- reason-code behavior;
- supported lines.

Do not rewrite the document unnecessarily.

---

# 84. Data Model Documentation

Update docs/data-model.md only if implementation requires small factual alignment, such as:

- current calculated result fields;
- evaluatorVersion persistence;
- manual override reset model;
- derived bulletin status.

Do not duplicate the entire Market Engine specification into data-model.md.

---

# 85. README

Update README.md minimally.

It may state that deterministic market evaluation is now implemented.

Do not add giant truth tables to README.

Keep technical detail in docs/market-engine.md.

Do not reference any project identity other than Bet Studio.

---

# 86. Do Not Implement Odds Payout Logic

Do not calculate:

stake return
potential winnings
profit
void-adjusted payout
accumulator payout

This phase concerns selection settlement status only.

Odds remain selection metadata.

---

# 87. Do Not Implement Bookmaker Rules

Do not assume specific bookmaker settlement terms.

Examples that may vary:

- abandoned-match settlement;
- postponed match time limits;
- player participation requirements;
- void leg payout treatment.

Where current Bet Studio policy is intentionally generic:

use the documented safe state.

Usually:

MANUAL

rather than guessing.

---

# 88. Do Not Implement Automatic Background Re-evaluation

Do not add:

cron
queues
workers
database triggers
polling loops

for settlement.

Manual/application-triggered re-evaluation is sufficient.

Provider synchronization may invoke an application use case later without background infrastructure.

---

# 89. Do Not Implement Rendering

Do not introduce status graphic rendering, PNG export or layout changes in this phase.

Rendering should consume effective statuses later.

The Market Engine itself must know nothing about visual representation.

---

# 90. Security

Verify:

- no `eval()`;
- no arbitrary executable market parameters;
- runtime parameter validation exists;
- composite depth is bounded;
- condition count is bounded;
- malformed external/local facts cannot create false GREEN/RED;
- provider-specific data does not enter Domain directly.

---

# 91. Quality Gates

Before completion run the actual repository quality commands.

At minimum:

- format/check;
- lint;
- typecheck;
- unit tests;
- integration tests;
- build.

Run database/migration verification if schema changed.

Run Playwright only if this phase changes an existing E2E-covered workflow and the suite is reliable.

Do not claim success unless commands actually completed successfully.

---

# 92. Manual Verification

If the current UI/API permits practical verification, test a small representative set manually:

1. Finished fixture 2–1 + HOME_WIN → GREEN.
2. Finished fixture 1–1 + HOME_WIN → RED.
3. LIVE fixture + OVER_2_5 → PENDING.
4. CANCELLED fixture → VOID.
5. Finished fixture without corners + corners market → MANUAL.
6. Manual override GREEN → RED produces effective RED.
7. Reset override returns to calculated GREEN.
8. Multi selection with GREEN + VOID → bulletin GREEN.
9. Multi selection with GREEN + RED → bulletin RED.

Do not claim manual verification if it was not performed.

---

# 93. Git Diff Review

Before finishing inspect the final diff.

Verify:

- no provider-specific types leaked into Domain;
- no rendering implementation appeared;
- no payout logic appeared;
- no arbitrary script evaluator exists;
- no unrelated CRUD redesign occurred;
- no generated/local database files were committed;
- tests cover evaluator truth tables;
- docs match implemented semantics;
- no previous/alternative project identity appears.

Remove unrelated changes.

---

# 94. Completion Report

At the end report concisely:

1. Evaluator families implemented.
2. Fixture-state policy implemented.
3. Supported goal/corner-line policy.
4. Composite AND/OR behavior.
5. Nested composite policy.
6. Evaluator versioning strategy.
7. Reason-code strategy.
8. Manual override/reset behavior.
9. Bulletin aggregate-status behavior.
10. Re-evaluation application/API behavior.
11. Tests added.
12. Exact quality commands executed and results.
13. Any ambiguity or intentionally unsupported market.

Do not provide a long file-by-file narrative.

Do not commit or push unless explicitly requested.
