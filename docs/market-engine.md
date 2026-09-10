# Bet Studio — Market Engine

## 1. Purpose

The Market Engine evaluates football betting selections from structured fixture result data.

Its responsibilities are:

- Determine whether a selection is PENDING, GREEN, RED, VOID or MANUAL.
- Evaluate supported betting markets deterministically.
- Support compound markets through reusable AND/OR composition.
- Remain independent from UI, database and external APIs.
- Support manual settlement overrides.
- Preserve historical settlement reproducibility.
- Avoid duplicated business logic.

The Market Engine must never infer outcomes from natural-language labels.

Detailed persistence rules belong to `data-model.md`.

---

## 2. Core Principles

The engine must follow these rules:

1. Never guess.
2. Never perform network requests.
3. Never depend on UI state.
4. Never depend directly on database or ORM models.
5. Use stable market codes and validated parameters.
6. Reuse evaluator families instead of duplicating market-specific logic.
7. Prefer MANUAL over an unsafe automatic settlement.
8. Given the same input and evaluator version, always return the same result.
9. Manual overrides must never be silently removed.
10. All automatically evaluable markets require automated tests.

---

## 3. Settlement Status

```ts
type SettlementStatus =
  | 'PENDING'
  | 'GREEN'
  | 'RED'
  | 'VOID'
  | 'MANUAL';
PENDING

The event cannot yet be settled because the required match state/result is not final.

Examples:

Match has not started.
Match is live and the selected market requires full-time result.
Match is postponed.
Required final result is not yet available.
GREEN

The selection won.

RED

The selection lost.

VOID

The selection is explicitly void according to a supported settlement rule.

MANUAL

The system cannot evaluate the selection safely.

Examples:

Required statistics are missing.
Market configuration is unsupported.
Fixture status is ambiguous.
Settlement requires bookmaker-specific interpretation.
Unsupported market type.
4. Effective Status

Calculated status and manual override must remain separate.

effectiveStatus =
  manualStatus ?? calculatedStatus;

Automatic re-evaluation may update calculatedStatus.

It must never overwrite or remove manualStatus.

5. Engine Boundary

The Market Engine belongs to the Domain layer.

It must not directly import or access:

React
Fastify
Drizzle
SQLite
HTTP clients
football APIs
filesystem
environment variables
provider SDKs

Conceptual interface:

interface MarketEngine {
  evaluate(input: MarketEvaluationInput): MarketEvaluationResult;
}
6. Evaluation Input

Conceptual input:

type MarketEvaluationInput = {
  market: {
    code: string;
    evaluatorKey: string | null;
    parameters: unknown;
    autoEvaluable: boolean;
  };

  fixture: {
    status: FixtureStatus;

    homeScore: number | null;
    awayScore: number | null;

    halfTimeHomeScore?: number | null;
    halfTimeAwayScore?: number | null;

    homeCorners?: number | null;
    awayCorners?: number | null;

    extraData?: unknown;
  };

  evaluatorVersion: string;
};

Each evaluator must validate its own parameter schema.

Avoid unvalidated parameter access.

7. Evaluation Result
type MarketEvaluationResult = {
  status: SettlementStatus;

  evaluatorKey: string | null;
  evaluatorVersion: string | null;

  reasonCode: string;

  details?: Record<string, unknown>;
};

Example:

{
  status: 'GREEN',
  evaluatorKey: 'TOTAL_GOALS',
  evaluatorVersion: '1',
  reasonCode: 'TOTAL_ABOVE_LINE'
}

reasonCode must be machine-readable.

Presentation text must not live inside domain logic.

8. Evaluation Order

Every automatic evaluation must follow this sequence:

1. Validate input
        ↓
2. Evaluate fixture status
        ↓
3. Confirm market is auto-evaluable
        ↓
4. Resolve evaluator
        ↓
5. Validate evaluator parameters
        ↓
6. Confirm required result data exists
        ↓
7. Execute evaluator
        ↓
8. Return structured result
9. Fixture Status

Initial fixture statuses:

type FixtureStatus =
  | 'SCHEDULED'
  | 'LIVE'
  | 'FINISHED'
  | 'POSTPONED'
  | 'CANCELLED'
  | 'ABANDONED'
  | 'UNKNOWN';

Default settlement behavior:

Fixture status	Default result
SCHEDULED	PENDING
LIVE	PENDING
FINISHED	Evaluate market
POSTPONED	PENDING
CANCELLED	VOID
ABANDONED	MANUAL
UNKNOWN	MANUAL

ABANDONED must not automatically resolve to VOID because settlement may depend on bookmaker or competition rules.

A market may support special live settlement only if explicitly implemented later.

10. Market Catalog vs Market Engine

These concepts must remain separate.

Market Catalog

Persistent configuration defining what the user can select.

Example:

Name: Mais de 2.5 Golos
Code: OVER_2_5
Evaluator: TOTAL_GOALS
Parameters:
  direction = OVER
  line = 2.5
Market Engine

Domain code defining how evaluator families behave.

The Market CRUD must never allow arbitrary executable code.

A custom market must either:

reference a supported evaluator and valid parameters, or
be marked autoEvaluable = false.

Unsupported custom markets settle as MANUAL.

11. Evaluator Registry

The engine must use a central evaluator registry.

Conceptual example:

const evaluatorRegistry = {
  MATCH_RESULT: matchResultEvaluator,
  DOUBLE_CHANCE: doubleChanceEvaluator,
  TOTAL_GOALS: totalGoalsEvaluator,
  BTTS: bothTeamsToScoreEvaluator,
  TOTAL_CORNERS: totalCornersEvaluator,
  COMPOSITE: compositeEvaluator
};

Do not create one evaluator implementation for each market code.

The initial supported markets must be covered by these six evaluator families.

12. Evaluator Contract
interface MarketEvaluator<TParameters = unknown> {
  readonly key: string;
  readonly version: string;

  evaluate(
    fixture: MarketFixtureResult,
    parameters: TParameters
  ): MarketEvaluationResult;
}

Each evaluator must:

be deterministic;
validate parameters;
validate required result data;
never mutate inputs;
never perform I/O;
return only supported settlement statuses;
have unit tests.
13. Evaluator Family: Match Result

Evaluator key:

MATCH_RESULT

Parameters:

type MatchResultParameters = {
  result: 'HOME' | 'DRAW' | 'AWAY';
};

Requires:

homeScore
awayScore
HOME
homeScore > awayScore → GREEN
otherwise → RED
DRAW
homeScore === awayScore → GREEN
otherwise → RED
AWAY
awayScore > homeScore → GREEN
otherwise → RED

Initial market codes:

HOME_WIN
DRAW
AWAY_WIN
14. Evaluator Family: Total Goals

Evaluator key:

TOTAL_GOALS

Parameters:

type TotalGoalsParameters = {
  direction: 'OVER' | 'UNDER';
  line: number;
};

Requires:

homeScore
awayScore

Calculate:

totalGoals = homeScore + awayScore;
OVER
totalGoals > line → GREEN
otherwise → RED
UNDER
totalGoals < line → GREEN
otherwise → RED

Initial implementation supports half-goal lines.

Examples:

0.5
1.5
2.5
3.5
4.5

Integer and Asian lines must not be evaluated unless explicitly implemented.

Unsupported line:

MANUAL
15. Evaluator Family: Double Chance

Evaluator key:

DOUBLE_CHANCE

Parameters:

type DoubleChanceParameters = {
  outcome: '1X' | 'X2' | '12';
};

Requires:

homeScore
awayScore
1X
homeScore >= awayScore → GREEN
otherwise → RED
X2
awayScore >= homeScore → GREEN
otherwise → RED
12
homeScore !== awayScore → GREEN
otherwise → RED

Initial market codes:

DOUBLE_CHANCE_1X
DOUBLE_CHANCE_X2
DOUBLE_CHANCE_12
16. Evaluator Family: Both Teams To Score

Evaluator key:

BTTS

Parameters:

type BttsParameters = {
  selection: 'YES' | 'NO';
};

Requires:

homeScore
awayScore

Calculate:

bothTeamsScored =
  homeScore > 0 &&
  awayScore > 0;
YES
bothTeamsScored → GREEN
otherwise → RED
NO
!bothTeamsScored → GREEN
otherwise → RED

Initial market codes:

BTTS_YES
BTTS_NO
17. Evaluator Family: Total Corners

Evaluator key:

TOTAL_CORNERS

Parameters:

type TotalCornersParameters = {
  direction: 'OVER' | 'UNDER';
  line: number;
};

Requires:

homeCorners
awayCorners

Calculate:

totalCorners =
  homeCorners + awayCorners;
OVER
totalCorners > line → GREEN
otherwise → RED
UNDER
totalCorners < line → GREEN
otherwise → RED

Initial implementation supports half-lines such as:

7.5
8.5
9.5
10.5
11.5

The market catalog may define which lines are visible.

If corner data is missing:

MANUAL

Do not infer corner totals from any other statistic.

18. Evaluator Family: Composite

Evaluator key:

COMPOSITE

Composite markets combine multiple deterministic conditions.

Supported operators:

type CompositeOperator =
  | 'AND'
  | 'OR';

Conceptual parameters:

type CompositeParameters = {
  operator: CompositeOperator;

  conditions: Array<{
    evaluatorKey: string;
    parameters: unknown;
  }>;
};

A composite evaluator must execute supported evaluator conditions using the same domain rules.

It must not duplicate evaluator logic.

Example:

HOME_WIN
+
OVER_2_5

must reuse:

MATCH_RESULT
TOTAL_GOALS

rather than implementing result and goal logic again.

18.1 AND Logic

All required conditions must succeed.

Truth table:

A	B	Result
GREEN	GREEN	GREEN
GREEN	RED	RED
RED	GREEN	RED
RED	RED	RED

Short-circuit behavior:

RED + MANUAL → RED
RED + PENDING → RED

because a failed required condition already guarantees the composite bet cannot win.

If no condition is RED but at least one required condition is unresolved:

GREEN + PENDING → PENDING
GREEN + MANUAL → MANUAL

VOID inside composite conditions must not be guessed.

If a component produces VOID and no explicit composite VOID rule exists:

MANUAL
18.2 OR Logic

At least one condition must succeed.

Truth table:

A	B	Result
GREEN	GREEN	GREEN
GREEN	RED	GREEN
RED	GREEN	GREEN
RED	RED	RED

Short-circuit behavior:

GREEN + MANUAL → GREEN
GREEN + PENDING → GREEN

because one successful condition is sufficient.

If no condition is GREEN:

RED + PENDING → PENDING
RED + MANUAL → MANUAL

VOID inside composite conditions must not be guessed.

If a component produces VOID and no explicit rule exists:

MANUAL
19. Initial Supported Market Catalog

Version 1 must support the following market families.

19.1 Resultado Final

Display category:

Resultado Final

Markets:

HOME_WIN
DRAW
AWAY_WIN

Evaluator:

MATCH_RESULT
19.2 Total de Golos Mais/Menos

Display category:

Total de Golos Mais/Menos

Evaluator:

TOTAL_GOALS

Examples:

Over 0.5
Under 0.5

Over 1.5
Under 1.5

Over 2.5
Under 2.5

Over 3.5
Under 3.5

Over 4.5
Under 4.5

The catalog may include additional supported half-lines later without changing evaluator logic.

19.3 Hipótese Dupla

Display category:

Hipótese Dupla

Markets:

DOUBLE_CHANCE_1X
DOUBLE_CHANCE_X2
DOUBLE_CHANCE_12

Evaluator:

DOUBLE_CHANCE
19.4 Ambas as Equipas Marcam

Display category:

Ambas as Equipas Marcam

Markets:

BTTS_YES
BTTS_NO

Evaluator:

BTTS
19.5 Cantos Mais/Menos

Display category:

Cantos Mais/Menos

Evaluator:

TOTAL_CORNERS

Example supported lines:

Over 7.5
Under 7.5

Over 8.5
Under 8.5

Over 9.5
Under 9.5

Over 10.5
Under 10.5

Over 11.5
Under 11.5

The market catalog controls available lines.

20. Ambas as Equipas Marcam OR Mais de 2.5

Display category:

Ambas as Equipas Marcam ou Mais de 2.5

Market code:

BTTS_YES_OR_OVER_2_5

Evaluator:

COMPOSITE

Definition:

BTTS YES
OR
TOTAL GOALS OVER 2.5

Conceptual configuration:

{
  "operator": "OR",
  "conditions": [
    {
      "evaluatorKey": "BTTS",
      "parameters": {
        "selection": "YES"
      }
    },
    {
      "evaluatorKey": "TOTAL_GOALS",
      "parameters": {
        "direction": "OVER",
        "line": 2.5
      }
    }
  ]
}

Examples:

1-1 → GREEN
2-1 → GREEN
3-0 → GREEN
4-0 → GREEN
1-0 → RED
0-0 → RED

Explanation:

1-1
BTTS = GREEN
Over 2.5 = RED
OR → GREEN
3-0
BTTS = RED
Over 2.5 = GREEN
OR → GREEN
21. Resultado Final AND Total de Golos 1.5

Display category:

Resultado Final / Total de Golos (1.5)

The slash represents a combined AND market.

Supported market codes:

HOME_WIN_AND_OVER_1_5
DRAW_AND_OVER_1_5
AWAY_WIN_AND_OVER_1_5

Evaluator:

COMPOSITE

Example configuration for home win:

{
  "operator": "AND",
  "conditions": [
    {
      "evaluatorKey": "MATCH_RESULT",
      "parameters": {
        "result": "HOME"
      }
    },
    {
      "evaluatorKey": "TOTAL_GOALS",
      "parameters": {
        "direction": "OVER",
        "line": 1.5
      }
    }
  ]
}

Examples for HOME_WIN_AND_OVER_1_5:

2-0 → GREEN
2-1 → GREEN
3-0 → GREEN

1-0 → RED
1-1 → RED
0-2 → RED

Equivalent DRAW and AWAY variants use the same structure.

22. Resultado Final AND Total de Golos 2.5

Display category:

Resultado Final / Total de Golos (2.5)

Supported market codes:

HOME_WIN_AND_OVER_2_5
DRAW_AND_OVER_2_5
AWAY_WIN_AND_OVER_2_5

Evaluator:

COMPOSITE

Example for home win:

2-1 → GREEN
3-0 → GREEN
3-1 → GREEN

2-0 → RED
1-1 → RED
1-2 → RED
23. Resultado Final AND Total de Golos 3.5

Display category:

Resultado Final / Total de Golos (3.5)

Supported market codes:

HOME_WIN_AND_OVER_3_5
DRAW_AND_OVER_3_5
AWAY_WIN_AND_OVER_3_5

Evaluator:

COMPOSITE

Examples for HOME_WIN_AND_OVER_3_5:

3-1 → GREEN
4-1 → GREEN

2-1 → RED
3-0 → RED
2-2 → RED
24. Ambas as Equipas Marcam AND Total de Golos 2.5

Display category:

Ambas as Equipas Marcam e Total de Golos (2.5)

Market code:

BTTS_YES_AND_OVER_2_5

Evaluator:

COMPOSITE

Definition:

BTTS YES
AND
TOTAL GOALS OVER 2.5

Examples:

2-1 → GREEN
2-2 → GREEN
3-1 → GREEN

1-1 → RED
3-0 → RED
1-0 → RED
25. Ambas as Equipas Marcam AND Total de Golos 3.5

Display category:

Ambas as Equipas Marcam e Total de Golos (3.5)

Market code:

BTTS_YES_AND_OVER_3_5

Evaluator:

COMPOSITE

Definition:

BTTS YES
AND
TOTAL GOALS OVER 3.5

Examples:

2-2 → GREEN
3-1 → GREEN
3-2 → GREEN

2-1 → RED
1-2 → RED
4-0 → RED
1-1 → RED
26. Market Parameter Storage

Market records must support validated parameters.

Conceptual Market model:

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

parameters must be validated according to evaluatorKey.

Examples:

Over 2.5 Goals
{
  "evaluatorKey": "TOTAL_GOALS",
  "parameters": {
    "direction": "OVER",
    "line": 2.5
  }
}
Double Chance 1X
{
  "evaluatorKey": "DOUBLE_CHANCE",
  "parameters": {
    "outcome": "1X"
  }
}
BTTS YES
{
  "evaluatorKey": "BTTS",
  "parameters": {
    "selection": "YES"
  }
}
27. Required Fixture Result Data

Current evaluators require only:

Full-time score
Match status
Corner totals

Optional future-compatible fields:

Half-time score
extraData

Initial structured result model must support:

type MarketFixtureResult = {
  status: FixtureStatus;

  homeScore: number | null;
  awayScore: number | null;

  halfTimeHomeScore?: number | null;
  halfTimeAwayScore?: number | null;

  homeCorners?: number | null;
  awayCorners?: number | null;
};

Do not add unrelated match statistics until required by a supported market.

28. Missing Data Behavior
Full-time market without score

If fixture is FINISHED but score is unavailable:

MANUAL
Corner market without corners
MANUAL
Scheduled fixture
PENDING
Live fixture
PENDING
Postponed fixture
PENDING
Cancelled fixture
VOID
Abandoned fixture
MANUAL
Unknown fixture state
MANUAL
Unsupported evaluator
MANUAL
autoEvaluable = false
MANUAL

The engine must never invent missing statistics.

29. Custom Markets

The Markets CRUD may allow custom markets.

A custom market with a supported evaluator configuration may remain auto-evaluable.

Example:

Name:
Mais de 5.5 Golos

Evaluator:
TOTAL_GOALS

Parameters:
direction = OVER
line = 5.5

provided the evaluator accepts that line.

A custom market with no supported evaluator must use:

autoEvaluable = false
evaluatorKey = null

and returns:

MANUAL

Do not infer evaluator behavior from the custom market name.

30. Unsupported Markets

The engine must not automatically evaluate markets requiring data or rules not explicitly implemented.

Examples:

Player goals
Player shots
Player cards
Player assists
First goalscorer
Anytime goalscorer
Exact score
Cards
Offsides
Asian handicap
Asian totals
Bet builders beyond explicit composite definitions
bookmaker-specific special markets

These may still exist as manual markets.

31. Manual Override

Any selection status may be overridden manually.

Example:

Calculated:
GREEN

Manual:
VOID

Effective:
VOID

Requirements:

Preserve calculated status.
Preserve manual status.
Preserve override history where implemented.
Allow reset to automatic evaluation.
Re-evaluation must not remove the override.

Recommended manual actions:

GREEN
RED
VOID
PENDING
Reset to automatic

Optional override reason:

Bookmaker settled selection as void.
32. Re-Evaluation

A selection may be re-evaluated when:

fixture status changes;
final score becomes available;
corner statistics become available;
provider synchronization updates result data;
user manually requests recalculation.

Re-evaluation updates:

calculatedStatus

but not:

manualStatus
33. Evaluator Versioning

Every evaluator must expose a version.

Example:

TOTAL_GOALS
version = 1

Store the evaluator version used during settlement.

Change evaluator version only when observable settlement behavior changes.

Purpose:

Historical reproducibility.
Debugging.
Auditability.
Safe future rule changes.
34. Bulletin Aggregate Status

The Market Engine evaluates individual selections.

Bulletin-level status is calculated separately in domain logic.

Use each selection's:

effectiveStatus

Rules:

Any RED
Bulletin = RED
No RED and at least one PENDING
Bulletin = PENDING
No RED/PENDING and at least one MANUAL
Bulletin = MANUAL
All selections VOID
Bulletin = VOID
Remaining selections are GREEN or VOID and at least one GREEN
Bulletin = GREEN

Examples:

GREEN + GREEN
→ GREEN
GREEN + VOID
→ GREEN
GREEN + RED
→ RED
GREEN + PENDING
→ PENDING
GREEN + MANUAL
→ MANUAL
VOID + VOID
→ VOID
35. MULTI and VOID

VOID must not count as a losing selection.

Examples:

GREEN + GREEN + VOID
→ GREEN
GREEN + RED + VOID
→ RED
VOID + VOID
→ VOID

The settlement engine must not initially implement bookmaker-specific monetary payout rules.

If a future odds recalculation uses VOID as effective odd 1.00, that logic must be explicitly implemented outside the selection outcome evaluator.

Do not mix outcome settlement and payout calculation.

36. Reason Codes

Evaluators should return machine-readable reason codes.

Recommended initial values:

FIXTURE_NOT_STARTED
FIXTURE_LIVE
FIXTURE_POSTPONED
FIXTURE_CANCELLED
FIXTURE_ABANDONED
FIXTURE_UNKNOWN

MISSING_SCORE
MISSING_CORNERS

UNSUPPORTED_MARKET
UNSUPPORTED_EVALUATOR
INVALID_MARKET_PARAMETERS
MANUAL_SETTLEMENT_REQUIRED

HOME_WIN_MATCHED
HOME_WIN_NOT_MATCHED

DRAW_MATCHED
DRAW_NOT_MATCHED

AWAY_WIN_MATCHED
AWAY_WIN_NOT_MATCHED

DOUBLE_CHANCE_MATCHED
DOUBLE_CHANCE_NOT_MATCHED

TOTAL_ABOVE_LINE
TOTAL_NOT_ABOVE_LINE

TOTAL_BELOW_LINE
TOTAL_NOT_BELOW_LINE

BTTS_MATCHED
BTTS_NOT_MATCHED

CORNERS_ABOVE_LINE
CORNERS_NOT_ABOVE_LINE

CORNERS_BELOW_LINE
CORNERS_NOT_BELOW_LINE

COMPOSITE_AND_MATCHED
COMPOSITE_AND_FAILED

COMPOSITE_OR_MATCHED
COMPOSITE_OR_FAILED

COMPOSITE_PENDING
COMPOSITE_MANUAL

Reason codes improve:

unit tests;
debugging;
history;
user-facing explanations;
auditability.
37. Validation Rules

Before automatic settlement:

Scores
integer
>= 0
Corners
integer
>= 0
Total lines
number
> 0
supported by evaluator
Market
code exists
autoEvaluable = true
evaluatorKey exists
parameters valid

Invalid input must never silently result in GREEN or RED.

38. Recommended Source Structure
src/domain/market/
├── market-engine.ts
├── market-evaluator.ts
├── market-evaluator-registry.ts
├── market-evaluation-result.ts
├── market-parameters.ts
├── settlement-status.ts
│
├── evaluators/
│   ├── match-result.ts
│   ├── double-chance.ts
│   ├── total-goals.ts
│   ├── both-teams-to-score.ts
│   ├── total-corners.ts
│   └── composite.ts
│
└── __tests__/

The exact file structure may be simplified if that improves clarity.

Do not introduce one class/file per market code.

39. Test Strategy

Every evaluator family requires unit tests.

Prefer table-driven tests.

Test:

successful outcomes;
failed outcomes;
boundary values;
missing result data;
fixture-state behavior;
invalid parameters;
composite AND behavior;
composite OR behavior;
manual fallback conditions.

Common fixture-state behavior should be tested centrally instead of duplicated in every evaluator suite.

40. Match Result Tests
HOME_WIN
2-0 → GREEN
2-1 → GREEN
1-1 → RED
0-1 → RED
DRAW
0-0 → GREEN
1-1 → GREEN
2-2 → GREEN
2-1 → RED
AWAY_WIN
0-1 → GREEN
1-2 → GREEN
1-1 → RED
2-1 → RED
41. Total Goals Tests
Over 2.5
0-0 → RED
1-0 → RED
1-1 → RED
2-0 → RED
2-1 → GREEN
3-0 → GREEN
3-2 → GREEN
Under 2.5
0-0 → GREEN
1-0 → GREEN
1-1 → GREEN
2-0 → GREEN
2-1 → RED
3-0 → RED
42. Double Chance Tests
1X
2-0 → GREEN
1-1 → GREEN
0-1 → RED
X2
0-2 → GREEN
1-1 → GREEN
2-1 → RED
12
1-0 → GREEN
0-1 → GREEN
1-1 → RED
43. BTTS Tests
YES
0-0 → RED
1-0 → RED
0-2 → RED
1-1 → GREEN
2-1 → GREEN
NO
0-0 → GREEN
1-0 → GREEN
0-2 → GREEN
1-1 → RED
2-1 → RED
44. Total Corners Tests
Over 9.5
Home 5 + Away 5 = 10 → GREEN
Home 6 + Away 4 = 10 → GREEN
Home 5 + Away 4 = 9 → RED
Home 0 + Away 0 = 0 → RED
Under 9.5
Home 5 + Away 4 = 9 → GREEN
Home 4 + Away 4 = 8 → GREEN
Home 5 + Away 5 = 10 → RED

Missing corner data:

MANUAL
45. BTTS OR Over 2.5 Tests

Market:

BTTS_YES_OR_OVER_2_5

Cases:

1-1 → GREEN
2-1 → GREEN
3-0 → GREEN
4-0 → GREEN

1-0 → RED
0-0 → RED
0-1 → RED
46. Result AND Over 1.5 Tests

Example:

HOME_WIN_AND_OVER_1_5

Cases:

2-0 → GREEN
2-1 → GREEN
3-0 → GREEN

1-0 → RED
1-1 → RED
0-2 → RED

Equivalent variants must be tested for DRAW and AWAY.

47. Result AND Over 2.5 Tests

Example:

HOME_WIN_AND_OVER_2_5

Cases:

2-1 → GREEN
3-0 → GREEN
4-1 → GREEN

2-0 → RED
1-1 → RED
1-2 → RED

Equivalent variants must be tested for DRAW and AWAY.

48. Result AND Over 3.5 Tests

Example:

HOME_WIN_AND_OVER_3_5

Cases:

3-1 → GREEN
4-1 → GREEN
4-2 → GREEN

3-0 → RED
2-1 → RED
2-2 → RED

Equivalent variants must be tested for DRAW and AWAY.

49. BTTS AND Over 2.5 Tests

Market:

BTTS_YES_AND_OVER_2_5

Cases:

2-1 → GREEN
2-2 → GREEN
3-1 → GREEN

1-1 → RED
3-0 → RED
1-0 → RED
50. BTTS AND Over 3.5 Tests

Market:

BTTS_YES_AND_OVER_3_5

Cases:

2-2 → GREEN
3-1 → GREEN
3-2 → GREEN

2-1 → RED
1-2 → RED
4-0 → RED
1-1 → RED
51. Fixture Status Tests

Central behavior:

SCHEDULED → PENDING
LIVE → PENDING
POSTPONED → PENDING
CANCELLED → VOID
ABANDONED → MANUAL
UNKNOWN → MANUAL

FINISHED proceeds to evaluator execution.

52. Composite Short-Circuit Tests
AND
GREEN + GREEN → GREEN
GREEN + RED → RED
RED + MANUAL → RED
RED + PENDING → RED
GREEN + MANUAL → MANUAL
GREEN + PENDING → PENDING
OR
GREEN + RED → GREEN
GREEN + MANUAL → GREEN
GREEN + PENDING → GREEN
RED + RED → RED
RED + MANUAL → MANUAL
RED + PENDING → PENDING
53. Table-Driven Tests

Prefer:

it.each([
  [2, 1, 'GREEN'],
  [3, 0, 'GREEN'],
  [1, 1, 'RED'],
  [0, 0, 'RED']
])(
  'evaluates Over 2.5 correctly',
  (homeScore, awayScore, expected) => {
    // ...
  }
);

Use shared test factories only when they reduce duplication without hiding business rules.

Tests should remain easy to audit.

54. No API Dependency

Valid architecture:

Provider/Application layer
        ↓
structured fixture result
        ↓
Market Engine
        ↓
Settlement result

Forbidden architecture:

Market Engine
        ↓
HTTP request
        ↓
football provider
55. No Natural-Language Settlement

Never use:

LLMs;
AI classification;
fuzzy market-name parsing;
translated strings;
display labels

to determine settlement.

The engine uses only:

market code
evaluator key
validated parameters
structured fixture data

Example:

"Ambas marcam ou mais de 2.5"

is only a display label.

Business logic operates on:

BTTS_YES_OR_OVER_2_5
56. Initial Evaluator Count

Version 1 should require only:

MATCH_RESULT
DOUBLE_CHANCE
TOTAL_GOALS
BTTS
TOTAL_CORNERS
COMPOSITE

These six evaluator families must cover the complete initial market scope.

Do not introduce additional evaluator families unless a market cannot be expressed safely using these.

57. Initial Market Scope Summary

The initial Bet Studio market catalog must support:

1. Resultado Final

2. Total de Golos Mais/Menos

3. Hipótese Dupla

4. Ambas as Equipas Marcam

5. Cantos Mais/Menos

6. Ambas as Equipas Marcam
   OR
   Mais de 2.5 Golos

7. Resultado Final
   AND
   Mais de 1.5 Golos

8. Resultado Final
   AND
   Mais de 2.5 Golos

9. Resultado Final
   AND
   Mais de 3.5 Golos

10. Ambas as Equipas Marcam
    AND
    Mais de 2.5 Golos

11. Ambas as Equipas Marcam
    AND
    Mais de 3.5 Golos

The UI may display localized Portuguese labels.

The domain must use stable codes and evaluator parameters.

58. Future Extensions

Possible future markets:

Team total goals
Half-time result
Half-time totals
Cards
Corners by team
Asian handicap
Asian totals
Exact score
Player markets

Only implement a new automatic evaluator when:

Settlement rules are explicitly defined.
Required data exists.
Edge cases are understood.
Tests can verify behavior.
The new evaluator cannot be safely represented by existing evaluator families.
59. Acceptance Criteria

The Market Engine implementation is complete when:

All initial market families are supported.
Composite markets reuse existing evaluator logic.
Unsupported markets return MANUAL.
Missing corners return MANUAL for corner markets.
Pending fixtures remain PENDING.
Cancelled fixtures return VOID.
Abandoned/unknown fixtures do not produce guessed outcomes.
Manual overrides remain independent.
Market parameters are validated.
Every evaluator family has unit tests.
Composite AND/OR behavior has dedicated tests.
No evaluator performs I/O.
No evaluator depends on APIs, database or UI.
Historical evaluation can identify the evaluator version used.
All project quality gates pass.
60. Guiding Principle

The Market Engine should remain small despite supporting many visible market options.

Prefer:

few generic evaluators
+
validated parameters
+
composition

over:

many duplicated market-specific implementations

Correctness and determinism are more important than maximizing automatic settlement coverage.