# Bet Studio — AGENTS.md

## Purpose

This file defines the operating rules for AI coding agents working in the Bet Studio repository.

It does not replace the project documentation.

Before making changes, read this file and only the documentation relevant to the current task.

---

## 1. Project Identity

Product:

```text
Bet Studio

Initial bulletin/content brand:

OwlClub

Do not rename the application to OwlClub.

OwlClub is a bulletin brand/template family inside Bet Studio.

2. Source of Truth

Persistent project decisions live in:

README.md
AGENTS.md

docs/
  architecture.md
  product-spec.md
  data-model.md
  market-engine.md
  rendering-engine.md
  api-integration.md

Use the smallest relevant documentation set for the current task.

Do not reread unrelated documents unless necessary.

3. Documentation Responsibility

Use documents according to their responsibility.

product-spec.md

Defines:

what the product does
user-visible behavior
functional requirements
product constraints
architecture.md

Defines:

system structure
layer boundaries
dependency direction
technical principles
repository/provider/renderer boundaries
data-model.md

Defines:

persistent entities
relationships
historical snapshots
database invariants
market-engine.md

Defines:

market evaluation
settlement statuses
market parameters
composite market behavior
evaluation tests
rendering-engine.md

Defines:

deterministic rendering
layout behavior
text fitting
template rules
asset behavior
render tests
api-integration.md

Defines:

football provider architecture
normalization
synchronization
provider capabilities
quota/failure behavior

Do not duplicate specifications between documents unless necessary for clarity.

4. Priority When Instructions Conflict

Resolve conflicts using this priority:

1. Explicit current task requirements
2. Existing documented product specification
3. Domain correctness
4. Existing architecture
5. Simplicity
6. Testability
7. Maintainability
8. Performance
9. Future extensibility

Do not silently choose a conflicting interpretation.

If a meaningful unresolved conflict exists, report it before making a speculative architectural change.

5. Inspect Before Editing

Before changing code:

Read AGENTS.md.
Read only the relevant documentation.
Inspect the existing implementation.
Inspect nearby tests.
Inspect existing project conventions.
Determine the smallest coherent change.

Do not assume a documented feature is already implemented.

Do not replace working architecture merely because another approach is possible.

6. Change Scope

Make the smallest coherent change required by the task.

Do not:

refactor unrelated code;
rename unrelated files;
change formatting across the repository;
introduce unrelated features;
rewrite working modules without need;
change public behavior outside the requested scope.

If unrelated defects are discovered, report them separately unless they directly block the requested work.

7. Architecture Boundaries

The intended dependency direction is:

Presentation
    ↓
Application
    ↓
Domain
    ↑
Infrastructure

Domain code must not depend directly on:

React;
Fastify;
Drizzle;
SQLite;
HTTP clients;
provider SDKs;
rendering libraries.

Infrastructure implements technical adapters.

Application coordinates use cases.

Presentation handles UI/API boundaries.

8. Domain Rules

Business rules belong in the Domain layer.

Do not put domain behavior in:

React components;
route handlers;
ORM models;
provider adapters;
renderer components.

Examples:

market settlement → Domain
bulletin status aggregation → Domain
selection-count invariants → Domain

UI validation may duplicate basic checks for usability, but domain invariants must still be enforced independently.

9. Repository Boundaries

Application/domain code should depend on repository interfaces.

SQLite/Drizzle implementations belong to infrastructure.

Do not leak Drizzle-specific records or database implementation details outside infrastructure.

Map persistence models to domain/application models explicitly where needed.

10. Provider Boundaries

External provider-specific types must remain inside provider adapters.

Correct:

provider response
→ provider adapter
→ normalized external model
→ synchronization service
→ local model

Incorrect:

provider response
→ React

or:

provider response
→ Market Engine

Do not use external provider IDs as Bet Studio primary keys.

11. Local-First Requirement

Bet Studio must remain fully usable without external APIs.

Core functionality must support local/manual operation.

Do not make remote providers mandatory for:

CRUD;
bulletin creation;
manual fixtures;
manual results;
market settlement;
history;
rendering;
export.

External APIs are optional synchronization providers.

12. Market Engine Rules

When working on markets, read:

docs/market-engine.md

Do not scatter market logic through conditional statements across the application.

Use evaluator families and validated parameters.

Initial evaluator families are:

MATCH_RESULT
TOTAL_GOALS
DOUBLE_CHANCE
BTTS
TOTAL_CORNERS
COMPOSITE

Unsupported or unsafe automatic settlement must resolve to:

MANUAL

Never infer settlement from natural-language market names.

Do not use AI/LLMs to settle markets.

13. Rendering Rules

When working on rendering, read:

docs/rendering-engine.md

Rendering must be deterministic.

Do not introduce runtime AI image generation for production bulletin output.

Do not render dynamic data directly into one large static background asset.

Use structured data, versioned templates and local assets.

Market text must always remain visible.

Rendering must support:

1..10 selections

without clipping or uncontrolled layout reflow.

14. Historical Integrity

Historical bulletin meaning and appearance must not silently change because current catalog data changes.

Respect:

selection snapshots;
result snapshots;
template versions;
stable internal IDs;
saved render configuration.

Do not replace historical snapshot data with current team/provider data during ordinary reads or renders.

15. External Data Safety

Treat all provider responses as untrusted input.

Validate them before persistence.

Provider failures must not delete valid local data.

An empty, partial or failed provider response is not evidence that local records should be removed.

Manual overrides must remain possible.

16. Validation

Use Zod or equivalent boundary validation where appropriate for:

API input;
environment variables;
provider response normalization;
persisted configurable structures;
form/shared request schemas.

Do not confuse boundary validation with domain rules.

Domain invariants must remain enforced in domain/application logic.

17. Error Handling

Prefer typed or categorized errors.

Existing intended categories include:

ValidationError
NotFoundError
ConflictError
ProviderError
RateLimitError
RenderingError
PersistenceError

Do not expose raw database, filesystem or provider errors directly to the UI.

Preserve useful technical context for logs/tests without exposing secrets.

18. Secrets and Security

Never commit:

.env
API keys
tokens
credentials
private secrets

Use:

.env.example

for documented configuration names.

API credentials must remain server-side.

Never expose them through frontend bundles, logs, screenshots or generated assets.

Never disable TLS verification for remote APIs.

19. Dependencies

Before adding a dependency, use this order:

1. Platform/native capability
2. Existing dependency
3. Small mature dependency
4. Larger dependency only with clear justification

Avoid overlapping libraries that solve the same problem.

Do not add abstractions or frameworks for hypothetical future requirements.

20. Local-First Complexity Limits

Do not introduce the following unless a later documented requirement explicitly needs them:

authentication
multi-user architecture
cloud database
Redis
queues
microservices
Kubernetes
distributed locks
payments
public publishing platform

Containers must not be required for normal local application runtime unless this decision is explicitly changed.

21. Database Changes

Use migrations for schema changes.

Do not use destructive automatic schema synchronization.

Do not modify old shared migrations after they have become part of project history.

For new schema requirements:

create a new migration

Preserve existing local user data where practical.

22. Numeric Correctness

Do not rely on accidental JavaScript floating-point behavior for business-critical decimal calculations.

Odds and stake handling must follow documented decimal-safe rules.

Scores and corners must use validated non-negative integers.

23. Time Handling

Use UTC internally.

Normalize provider timestamps at adapter boundaries.

Do not depend on machine timezone or locale defaults for canonical data.

Presentation controls formatting.

24. Code Style

Prefer:

small cohesive modules;
explicit naming;
readable control flow;
pure functions for domain rules;
composition over unnecessary inheritance;
straightforward TypeScript;
narrow interfaces;
explicit return types where useful.

Avoid:

clever abstractions;
premature generic frameworks;
deeply nested conditionals;
hidden side effects;
large monolithic service classes;
duplicated business logic.
25. Comments

Comments should explain:

why
invariants
non-obvious constraints
provider quirks
historical compatibility requirements

Do not add comments that merely restate obvious code.

26. Tests

Every behavior change must add or update appropriate automated tests.

Use the lowest-cost test level that reliably validates the behavior.

Prefer:

unit
→ integration
→ E2E only when needed

Do not replace domain unit tests with expensive E2E tests.

27. Market Tests

Every auto-evaluable market family requires deterministic unit tests.

Tests should cover:

GREEN;
RED;
relevant VOID behavior;
PENDING;
MANUAL fallback;
boundaries;
invalid/missing inputs;
composite AND/OR behavior.

Prefer table-driven tests where they keep rules easy to audit.

28. Rendering Tests

Rendering changes should test relevant:

layout mode selection;
geometry bounds;
text fitting;
status-region stability;
missing-asset fallback;
exact canvas dimensions;
deterministic behavior.

Use visual regression/golden images only for a small curated set of valuable cases.

Do not create excessive screenshot tests.

29. Provider Tests

Do not call real football APIs from normal automated tests or CI.

Use minimal stored fixtures/mocks for provider adapters.

Test:

normalization;
status mapping;
score mapping;
statistics mapping;
malformed data;
timeout/error handling;
rate-limit handling.

Live API integration checks may exist as explicit local-only tests.

30. Quality Gates

Before completing a coding task, run the relevant project quality gates.

Expected baseline:

format/check
lint
typecheck
tests
build

Run only commands that exist in the repository.

Do not invent scripts.

If a quality gate fails because of your change:

fix it before completion

If an existing unrelated failure prevents completion, report it clearly.

31. Test Failures

Never:

delete failing tests merely to make CI green;
weaken assertions without justification;
skip tests hiding a regression;
replace deterministic tests with snapshots solely to avoid fixing behavior.

Update tests when the documented intended behavior legitimately changes.

32. Build Integrity

Do not finish a task with known TypeScript/build failures caused by the change.

Warnings should be evaluated rather than ignored automatically.

33. Formatting

Use the repository's configured formatter.

Do not manually reformat unrelated files.

Avoid commits dominated by formatting noise.

34. Generated Files

Do not manually edit generated artifacts unless the project's documented workflow requires it.

Modify the source definition and regenerate where appropriate.

Do not commit temporary exports, debug files or local caches unless explicitly required.

35. Files and Assets

Respect existing asset organization.

Conceptually:

assets/
  branding/
  teams/
  competitions/
  templates/
  placeholders/

Do not overwrite historical assets in-place if doing so would break deterministic historical rendering.

Prefer immutable/versioned or safely referenced assets for historically significant content.

36. Documentation Updates

Update documentation when a change alters:

documented product behavior;
architecture;
persistence model;
settlement rules;
rendering contract;
provider integration contract.

Do not update documentation for trivial internal implementation details that do not affect the documented contract.

Keep documentation concise and avoid duplicating the same rule across multiple files.

37. Specification Changes

Do not silently modify a documented requirement because implementation is inconvenient.

If implementation reveals a specification problem:

identify the conflict;
explain the technical consequence;
propose the smallest reasonable specification change;
wait for explicit approval when the change is material.

Minor implementation details that remain within the documented contract do not require approval.

38. Existing Behavior

Before refactoring existing behavior:

identify its tests;
understand why it exists;
preserve externally observable behavior unless change is required;
keep backward compatibility where historical data depends on it.
39. Git Scope

Do not include unrelated repository changes in the task.

Inspect the diff before completion.

The final diff should be understandable as one coherent change.

Do not rewrite Git history unless explicitly requested.

40. Commit Messages

When asked to commit, use concise conventional-style messages.

Examples:

feat: add competition management
feat: implement market evaluation engine
feat: add bulletin renderer
fix: preserve manual settlement overrides
test: add composite market coverage
docs: refine provider synchronization rules

Do not create a commit unless explicitly requested.

41. No Silent Architectural Drift

Do not introduce a new architecture pattern without need.

Examples requiring justification:

event buses;
CQRS;
generic plugin systems;
dependency-injection frameworks;
microservices;
repository abstractions around trivial local-only helpers.

The existing architecture should remain simple unless concrete requirements justify evolution.

42. Performance

Optimize obvious waste, but do not sacrifice clarity for premature optimization.

Priority:

correctness
determinism
clarity
then performance

For rendering and provider synchronization, cache expensive reusable work where clearly beneficial.

43. UI Changes

When implementing UI:

preserve existing design language;
keep forms understandable;
expose errors clearly;
avoid blocking manual workflows because an API is unavailable;
do not place business rules solely in components.

Use UI state for presentation behavior, not domain truth.

44. Accessibility

For interactive UI changes:

use semantic controls;
provide labels;
preserve keyboard usability;
preserve visible focus;
use sufficient contrast.

For rendered bulletins:

do not communicate GREEN/RED state only through color;
preserve critical text legibility.
45. Unsupported Requirements

If a requested implementation depends on functionality not currently specified:

Do not invent complex behavior.

Prefer:

small safe implementation

or surface the missing decision.

Examples:

unknown bookmaker settlement rule;
unsupported Asian line;
ambiguous provider mapping;
unavailable match statistic.

Use MANUAL/fallback behavior where already documented.

46. Completion Report

At the end of a coding task, report concisely:

What changed
Tests/quality gates run
Relevant results
Any unresolved issue or follow-up

Do not provide a long narrative of every edit unless requested.

47. Do Not Claim Success Without Verification

Never state:

all tests pass
build succeeds
feature works

unless the corresponding command/check was actually run successfully.

If a check was not run, say so.

48. Recommended Task Workflow

For each implementation task:

Read relevant docs
↓
Inspect existing implementation
↓
Plan smallest coherent change
↓
Implement
↓
Add/update tests
↓
Run quality gates
↓
Inspect diff
↓
Report result
49. Token-Efficient Agent Behavior

Persistent documentation already contains durable context.

Do not repeatedly restate entire specifications in implementation notes.

For a task:

read only relevant docs;
inspect only relevant modules first;
expand scope only when necessary;
avoid verbose generated planning files;
avoid duplicating documentation into source comments.

The repository itself is the long-term memory.

50. Final Principle

Build Bet Studio as a small, reliable, deterministic local-first product.

Prefer:

clear domain rules
+
small cohesive modules
+
explicit contracts
+
tests
+
safe fallbacks

over:

clever abstractions
+
speculative infrastructure
+
hidden behavior

When uncertain, preserve correctness, historical integrity and simplicity.