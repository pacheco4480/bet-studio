You are implementing Phase 09 of Bet Studio:

Tests + Security + Error Handling

This is a stabilization and hardening phase.

Do not add new product features unless a very small change is required to fix a correctness, security, reliability or testability issue.

Before making changes:

1. Read AGENTS.md.
2. Read docs/architecture.md.
3. Read docs/product-spec.md only where needed to verify expected behavior.
4. Read the relevant sections of:
   - docs/data-model.md
   - docs/market-engine.md
   - docs/api-integration.md
   - docs/rendering-engine.md
     only when auditing the corresponding implementation.
5. Inspect the complete implementation from Phases 01–08.
6. Inspect package scripts, TypeScript configuration, ESLint, Vitest, Playwright, Fastify error handling, Zod schemas, database migrations, CI and `.gitignore`.

The repository and documentation are the source of truth.

Do not introduce or reference any project identity other than Bet Studio.

---

# Goal

Harden Bet Studio before final UX/documentation polish.

At the end of this phase:

- important domain/application behavior is covered by meaningful tests;
- API errors use a consistent safe contract;
- external/provider failures are normalized safely;
- validation exists at trust boundaries;
- security-sensitive inputs are constrained;
- filesystem/render/export operations cannot escape controlled directories;
- secrets never reach client/logs/repository;
- database operations preserve integrity;
- deterministic rendering invariants remain tested;
- offline/local-first behavior remains valid;
- CI reliably runs the core quality gates;
- flaky, duplicate or meaningless tests are removed/fixed;
- no new unnecessary infrastructure is introduced.

---

# 1. Start With an Audit

Before editing, identify current gaps.

Audit at least:

- test coverage by architectural layer;
- duplicated/unreachable error handling;
- `any`, unsafe casts and unchecked external input;
- missing Zod/runtime validation;
- raw database errors exposed through API;
- provider error leakage;
- filesystem path handling;
- asset/upload/download validation;
- rendering network isolation;
- secrets/config handling;
- SQLite constraints/transactions;
- race/idempotency risks in public bulletin code allocation;
- historical immutability;
- manual override integrity;
- deterministic rendering assumptions;
- test dependence on real network/current time;
- CI vs local script mismatch.

Fix actual risks, not theoretical ones.

Do not create a giant security framework.

---

# 2. Testing Strategy

Maintain a clear testing pyramid.

Prefer:

Domain unit tests
→ many, fast, pure

Application tests
→ focused orchestration/invariants

Infrastructure integration tests
→ SQLite/repositories/provider adapters/render export

API tests
→ Fastify inject

UI tests
→ important component behavior

Playwright E2E
→ very small number of critical workflows

Do not use E2E tests for behavior that can be tested reliably at a lower layer.

---

# 3. Domain Test Coverage

Ensure meaningful coverage exists for current core domain behavior.

At minimum verify existing tests adequately cover:

- Market Engine evaluator families;
- fixture-state settlement policy;
- invalid/missing settlement data;
- composite AND/OR truth tables;
- nested-composite rejection;
- manual override resolution;
- bulletin aggregate status;
- SINGLE/MULTI selection limits;
- selection ordering invariants;
- decimal/total-odd calculations;
- deterministic render-model/fingerprint utilities where pure.

Do not duplicate dozens of equivalent cases merely to increase coverage percentage.

Use table-driven tests where appropriate.

---

# 4. Application Test Coverage

Ensure focused tests cover important workflows:

- bulletin creation;
- bulletin update;
- duplicate bulletin;
- stable selection identity where expected;
- snapshot creation;
- re-evaluation;
- manual override;
- reset to automatic;
- result correction;
- provider synchronization;
- sync idempotency;
- safe provider merge;
- current render;
- historical re-render;
- History queries.

Test invariants, not implementation details.

---

# 5. Database / Repository Tests

Use isolated temporary SQLite databases.

Verify:

- migrations work from an empty database;
- foreign-key behavior is intentional;
- important UNIQUE constraints work;
- transactions roll back partial aggregate writes;
- ProviderReference sync is idempotent;
- public bulletin code allocation cannot create duplicates in normal concurrent/retry scenarios;
- historical snapshot records are not accidentally mutated;
- deleting/deactivating current catalog data does not destroy historical records.

Do not use the developer's real local database in tests.

---

# 6. API Tests

Use Fastify injection where practical.

Cover representative:

2xx
400
404
409
controlled 5xx

behavior.

At minimum test:

- malformed IDs;
- invalid request bodies;
- invalid enum values;
- max selection limit;
- missing references;
- duplicate/conflict behavior;
- invalid manual status;
- invalid fixture facts;
- provider unavailable;
- render validation failure;
- missing render file.

Do not test every route with every possible malformed character.

Focus on trust boundaries and meaningful branches.

---

# 7. UI Tests

Keep UI tests focused on important behavior.

Verify high-value flows such as:

- Bulletin Builder validation;
- selection limit;
- selection reorder;
- total odd updates;
- display toggles;
- calculated/manual/effective status presentation;
- History filtering;
- override/reset interaction;
- render/export action states.

Do not create brittle snapshots for entire pages.

Prefer behavior assertions.

---

# 8. E2E Tests

Keep Playwright E2E intentionally small.

Maintain or add only a few critical workflows.

Recommended canonical flows:

A. Bulletin creation

- create MULTI;
- add selections;
- save;
- reopen;
- verify persisted values.

B. Result management

- evaluate;
- manual override;
- reset;
- verify effective status.

C. Render

- export FEED;
- verify successful RenderRecord/download metadata.

Use deterministic seeded local data.

No real GOAL API calls.

No dependency on current football schedules.

---

# 9. Deterministic Tests

Tests must not accidentally depend on:

- current date/time;
- current timezone;
- current locale;
- random UUID output where value itself is irrelevant;
- filesystem ordering;
- SQLite natural row order;
- network;
- system fonts;
- system Chrome.

Inject/fix clocks where behavior depends on time.

Use explicit ordering in queries/assertions.

Use pinned local fonts and Playwright Chromium for canonical rendering tests.

---

# 10. External Input Validation

Audit every external trust boundary.

Validate at runtime:

- HTTP request params;
- query filters;
- request bodies;
- environment configuration;
- GOAL API responses;
- persisted JSON configuration before execution/rendering;
- template configuration;
- Market parameters;
- asset metadata where required.

Prefer existing Zod conventions.

Do not use unsafe:

as SomeExternalType

as a substitute for validation.

---

# 11. Error Model

Standardize application/API errors.

Use a small explicit taxonomy consistent with existing code.

Conceptually:

ValidationError
NotFoundError
ConflictError

ProviderError
ProviderAuthenticationError
ProviderRateLimitError
ProviderUnavailableError

RenderValidationError
RenderAssetError
RenderTemplateError
RenderOverflowError
RenderExportError

Do not create dozens of subclasses.

Reuse existing error types where they already work.

---

# 12. API Error Contract

Return a stable safe JSON error shape.

Conceptually:

{
"error": {
"code": "BULLETIN_NOT_FOUND",
"message": "Bulletin not found"
}
}

Optional safe field:

details

only for structured validation information.

Do not expose:

- stack traces;
- SQL;
- absolute filesystem paths;
- provider raw bodies;
- API keys;
- internal implementation details.

Use current project naming conventions if an error envelope already exists.

---

# 13. HTTP Status Mapping

Use consistent semantics:

400
→ malformed/invalid request

404
→ resource not found

409
→ known conflict/duplicate/state conflict

429
→ only where appropriate for directly exposed rate-limit behavior

500
→ unexpected internal failure

502/503
→ provider/infrastructure unavailability if current API conventions benefit from distinguishing it

Do not return 200 with `{ success: false }` for normal API failures.

Do not expose every internal error as 500.

---

# 14. Unexpected Errors

Add/verify a Fastify-level unexpected-error boundary.

Unexpected failures should:

- be logged server-side;
- receive/carry a correlation/request identifier if existing logging supports it;
- return a generic safe error to the browser.

Do not swallow unexpected failures silently.

Do not return stack traces in production responses.

---

# 15. Logging

Audit logging for accidental sensitive data.

Never log:

- GOAL API keys;
- Authorization headers;
- `.env` contents;
- complete sensitive request URLs;
- arbitrary raw provider payloads by default;
- internal filesystem paths in user-facing messages.

Prefer structured concise logs.

Keep enough internal context for debugging:

- operation;
- resource ID;
- normalized error type;
- duration/counts where relevant.

---

# 16. Secrets

Verify:

- `.env` is ignored;
- `.env.example` contains placeholders only;
- provider key remains server-side;
- Vite-exposed environment variables contain no secrets;
- CI requires no real API key;
- test fixtures contain no credentials;
- README/docs contain no real secrets.

Search the repository for likely secret patterns before completion.

Do not commit credentials discovered locally.

---

# 17. CORS / Network Exposure

This is a local-first app.

If frontend/backend use Vite proxy locally, do not enable broad permissive CORS unnecessarily.

If CORS is required:

- configure narrowly;
- do not default to unrestricted origins without need.

Do not expose generic proxy/fetch endpoints.

---

# 18. SSRF

Audit provider/logo functionality.

The browser must never be able to supply an arbitrary URL causing the server to fetch:

- localhost;
- LAN/private addresses;
- file://;
- arbitrary internet resources.

Provider base URLs must be trusted server configuration.

Remote artwork fetching, if implemented, must follow Phase 04 restrictions.

Do not build a generic URL fetch service.

---

# 19. Filesystem Security

Audit:

- assets;
- render exports;
- render download;
- temporary files.

All paths must remain inside controlled application directories.

Reject path traversal.

Never trust client-provided:

../
absolute paths
file:// URLs

Render/download endpoints should resolve resources by internal ID, not arbitrary path.

---

# 20. Render Security

Verify Rendering Engine:

- performs no unexpected network requests;
- uses local fonts/assets;
- escapes normal React text;
- does not use arbitrary `dangerouslySetInnerHTML`;
- does not execute stored CSS/JS;
- validates TemplateVersion config;
- validates Asset refs;
- bounds text-fitting loops;
- bounds composite/layout structures;
- checks final dimensions.

Do not weaken determinism for convenience.

---

# 21. Asset Security

Where local/remote assets are accepted:

- validate MIME type;
- validate actual supported file format where possible;
- enforce size limits;
- enforce dimensions if appropriate;
- sanitize generated filenames;
- reject unsupported formats;
- reject arbitrary executable content.

If SVG ingestion is not already safely supported:

keep it unsupported.

Do not add an SVG sanitizer pipeline just for this phase.

---

# 22. Market Engine Safety

Verify no executable market configuration exists.

There must be no:

eval()
new Function()
dynamic JS
SQL expressions
arbitrary script execution

from Market.parameters.

Ensure runtime schemas protect evaluator parameters.

Malformed market configuration must not silently produce GREEN/RED.

---

# 23. Composite Bounds

Verify:

- nested COMPOSITE remains prohibited in v1;
- condition count is bounded according to docs;
- no recursive/cyclic execution path exists.

Add regression tests if needed.

---

# 24. Numeric Safety

Audit:

- odds;
- stake;
- total odd;
- scores;
- corners;
- market lines.

Ensure:

- no NaN;
- no Infinity;
- scores/corners are integer >= 0;
- canonical odds do not rely on JS float persistence;
- deterministic rounding policy remains consistent.

Do not introduce a second decimal strategy.

---

# 25. Database Input Safety

Use Drizzle/query bindings.

Do not construct SQL with user-controlled string interpolation.

Search for raw SQL usage.

Raw SQL is acceptable only where required and values are safely parameterized.

---

# 26. Database Integrity

Verify database foreign keys are enabled/configured correctly.

Ensure important operations use transactions:

- bulletin aggregate save;
- duplicate;
- sync merge where consistency requires;
- override current-state + audit write where required.

Do not hold DB transactions during:

- provider HTTP calls;
- Playwright rendering;
- remote asset downloads.

---

# 27. Historical Integrity

Add/retain regression tests proving current changes cannot mutate history.

At minimum:

Team rename
→ old selection snapshot unchanged

Market rename
→ old snapshot unchanged

fixture correction
→ previous result snapshot unchanged

manual override update/reset
→ previous audit entries unchanged

new render
→ previous RenderRecord unchanged

new template version
→ old RenderRecord still references old TemplateVersion

asset replacement/current reassignment
→ historical render still references immutable old asset

These are hard invariants.

---

# 28. Provider Resilience

Test GOAL API adapter with mocks/fixtures only.

Verify:

- timeout;
- authentication failure;
- malformed response;
- partial response;
- 429 where supported;
- transient 5xx retry policy;
- no retry on deterministic 4xx;
- unknown fixture status maps safely;
- missing corners remain null;
- provider failure preserves local data.

No live provider request in CI.

---

# 29. Offline Behavior

Add/retain a regression test proving Bet Studio remains usable without GOAL API configuration or connectivity.

At minimum:

- server starts;
- local CRUD works;
- bulletin creation works with local data;
- Market Engine works;
- History works;
- rendering works using local assets.

Provider-dependent refresh may report unavailable.

Core application must not fail.

---

# 30. Rendering Tests

Keep the Phase 07 strategy:

many structural tests;
few canonical golden images.

Ensure coverage for:

- exact 1080×1350 output;
- 1–10 selection density;
- market always visible;
- long names;
- missing logo fallback;
- status/result reserved geometry;
- same-input fingerprint stability;
- fingerprint changes when a visual input changes;
- network-disabled rendering;
- pinned-font/browser readiness.

Do not dramatically increase golden snapshot count.

---

# 31. Render Golden Stability

Do not "fix" flaky golden tests by using a huge screenshot tolerance.

Find the source first:

- font loading;
- browser version;
- animation;
- system locale;
- timezone;
- unstable IDs;
- timestamps;
- random values;
- async image loading.

Golden tests should run in the documented canonical environment.

---

# 32. Error States in UI

Audit high-value user-visible failures.

Users should receive actionable messages for:

- validation failure;
- resource not found;
- provider not configured;
- provider unavailable;
- failed result refresh;
- failed save;
- render content overflow;
- missing historical render file.

Do not show raw technical exceptions.

Preserve form state after failed saves where possible.

---

# 33. Error Boundaries

Do not blanket the application with many React error boundaries.

Use them only where they prevent a major page/application crash and provide useful recovery.

Normal request/form failures belong in ordinary component state.

---

# 34. Retry UX

Do not retry every failed action automatically.

Explicit Retry actions are appropriate for:

- provider refresh;
- render/export where transient;
- list/detail reload.

Do not retry validation/conflict failures.

---

# 35. Test Helpers

Refactor duplicated test setup only when it materially improves readability.

Useful helpers may include:

- isolated test DB factory;
- Fastify test app factory;
- deterministic fixture/team/market factories;
- provider mock factory;
- render test model factory.

Do not build a massive generic fixture DSL.

Keep test data explicit enough to understand.

---

# 36. Test Quality

Remove/fix tests that only assert:

expect(true).toBe(true)

or equivalent meaningless setup checks.

Avoid tests tightly coupled to private functions when public behavior is sufficient.

Tests should explain an invariant or regression.

---

# 37. Coverage

If coverage tooling already exists, use it to find obvious untested critical paths.

Do not optimize purely for 100% coverage.

Do not add tests for trivial getters/types simply to increase percentages.

Critical correctness matters more than numeric coverage targets.

If coverage tooling does not exist, do not necessarily add a new dependency solely for a percentage.

---

# 38. TypeScript Audit

Run strict typecheck and inspect suspicious escape hatches.

Search for:

any
unknown casts
non-null assertions
ts-ignore
ts-expect-error

Do not mechanically remove all of them.

Fix unsafe/unnecessary usages.

Keep `unknown` at genuine trust boundaries and validate/narrow it.

Every `ts-expect-error` should have a legitimate test/type reason.

---

# 39. Dependency Audit

Inspect current dependencies.

Remove clearly unused dependencies where safe.

Do not perform a risky broad dependency upgrade in this phase.

Do not add:

- generic security frameworks;
- retry frameworks;
- validation frameworks duplicating Zod;
- another HTTP client;
- another test runner.

Use existing stack.

---

# 40. Dependency Vulnerability Handling

If package-manager audit tooling is available, inspect relevant production dependency issues.

Do not blindly run automatic major-version fixes.

For any meaningful finding:

- determine whether the vulnerable code path affects Bet Studio;
- apply a safe compatible update when practical;
- document a remaining issue if it cannot safely be resolved now.

Do not destabilize the project merely to reach a zero-warning number.

---

# 41. CI

Ensure GitHub Actions reliably performs the repository's real quality gates.

At minimum:

- clean dependency install from lockfile;
- format check;
- lint;
- typecheck;
- tests;
- build.

If renderer tests require Chromium:

- install only required Playwright browser/dependencies;
- run bounded canonical rendering tests.

Do not require:

- GOAL API key;
- external provider;
- cloud services;
- local developer files.

---

# 42. CI Parity

Package scripts used by CI should also work locally.

Avoid embedding important test behavior only in GitHub Actions YAML.

Prefer scripts such as:

npm run format:check
npm run lint
npm run typecheck
npm test
npm run build

plus clearly named integration/render/e2e scripts where applicable.

Follow actual package manager/scripts already established.

---

# 43. Test Separation

If useful, distinguish:

test
test:integration
test:render
test:e2e

But keep normal developer workflow simple.

Do not create 15 granular scripts.

Document what the normal pre-commit/local verification command sequence is.

Do not implement Git hooks unless explicitly requested.

---

# 44. No Automatic Commits

Do not install commit hooks that automatically commit/push.

Do not commit or push changes unless explicitly requested.

---

# 45. Production Error Configuration

Ensure production behavior differs appropriately from development where necessary.

Development may log useful stack traces server-side.

Production responses remain sanitized.

Do not disable diagnostics entirely.

Do not leak them to client.

---

# 46. Security Headers

If Fastify already has or can trivially use appropriate security headers, configure sensible local-web defaults.

Do not add a complex CSP that breaks the renderer/application without need.

If adding a security-header dependency, justify it.

Prefer minimal explicit configuration appropriate to this local app.

---

# 47. Input Limits

Set reasonable bounds where user input exists.

Examples:

- team/competition/market names;
- aliases;
- override reason;
- bulletin selection count;
- search query length;
- date-range size;
- uploaded asset size;
- composite conditions.

Do not accept unbounded multi-megabyte text fields.

Keep bounds compatible with documented product behavior.

---

# 48. Request Body Limits

Verify Fastify request body limits are reasonable.

Do not leave arbitrary large request bodies enabled if the application only needs small JSON payloads.

Asset uploads, if implemented, may use a specific controlled limit.

Do not prevent legitimate current workflows.

---

# 49. Abuse / Rate Limiting

Do not add public-internet style application rate limiting unless the local-first deployment currently exposes a real need.

Provider-side rate limits must still be respected.

Do not add Redis merely for API rate limiting.

---

# 50. Data Exposure

Audit API DTOs.

Do not send unnecessary internal fields to frontend, especially:

- provider secrets;
- internal storage paths;
- raw error data;
- raw provider payload;
- database internals.

Internal entity IDs are acceptable where application navigation requires them.

Public bulletin code remains the primary user-facing identifier.

---

# 51. Error Codes

Use stable machine-readable codes where useful.

Examples:

VALIDATION_ERROR
RESOURCE_NOT_FOUND
CONFLICT
PROVIDER_NOT_CONFIGURED
PROVIDER_UNAVAILABLE
RENDER_OVERFLOW
RENDER_ASSET_MISSING

Use more specific existing codes where already established.

Do not encode UI-localized text as the machine identifier.

---

# 52. Validation Error Details

For field validation, structured safe details are useful.

Example conceptually:

{
"error": {
"code": "VALIDATION_ERROR",
"message": "Invalid request",
"details": {
"selections.1.odd": "Invalid odd"
}
}
}

Do not expose Zod internals unnecessarily.

Adapt to existing frontend form-error conventions.

---

# 53. Conflict Errors

Return 409 for meaningful conflicts such as:

- duplicate stable market code;
- duplicate provider mapping;
- public-code allocation conflict after safe retry;
- incompatible state update where applicable.

Do not expose SQLite constraint strings directly.

---

# 54. Not Found

Use one consistent not-found mapping.

Repository "not found" should become a controlled application/API error.

Do not let undefined/null propagate into unrelated crashes.

---

# 55. Rendering Failure Cleanup

Test/verify cleanup of:

- temporary render files;
- Playwright browser/page processes;
- partially written output.

A failed render must not leave a successful RenderRecord.

Do not leak orphan temp files indefinitely.

---

# 56. Provider Failure Cleanup

Provider sync failure must not leave partially inconsistent mappings when operation should be atomic.

HTTP occurs outside transaction.

Persist validated normalized data in short transactions.

Existing local data survives failure.

---

# 57. Manual Override Transaction

If current implementation updates:

BulletinSelection.manualStatus +
SettlementOverride audit

ensure the two writes are transactionally coherent.

Do not end up with a current override but no audit entry, or vice versa, due to partial failure.

---

# 58. Concurrency Scope

This remains local single-user v1.

Do not introduce distributed locks.

Still fix simple race-sensitive operations such as public code generation if current implementation is unsafe.

Use SQLite transactions/constraints appropriately.

---

# 59. Public Bulletin Code

Verify:

BET #0001

allocation is stable and UNIQUE.

Do not use an unsafe naïve:

SELECT MAX(...) + 1

without appropriate transactional protection.

Reuse the Phase 02 counter/strategy.

Add a regression test if missing.

---

# 60. Documentation

Update documentation only where hardening establishes an important actual contract.

Likely:

AGENTS.md
→ quality/security workflow only if needed

docs/architecture.md
→ only if boundaries changed

specialized docs
→ only where corrected behavior differs from current text

Do not rewrite all docs during this phase.

Do not duplicate security rules across every document.

---

# 61. AGENTS.md

If AGENTS.md is still overly long or duplicates detailed domain specs, this is a good phase to simplify it.

Keep only durable instructions such as:

- source-of-truth docs;
- workflow;
- architecture boundaries;
- no secrets;
- scope discipline;
- validation/security basics;
- required quality gates;
- no unrelated changes;
- no commit/push unless requested.

Link to specialized docs rather than reproducing their rules.

Do not weaken existing architectural constraints.

---

# 62. README

Update README only if actual test/setup/security commands changed.

Ensure documented commands are real.

Do not make unverifiable security claims such as:

"100% secure"

or:

"production-grade security"

This is a local-first application and documentation should remain precise.

---

# 63. No New Features

Do not implement in Phase 09:

- Story rendering;
- new football markets;
- second provider;
- analytics;
- ROI/P&L;
- auth;
- users;
- cloud sync;
- social publishing;
- Redis;
- queues;
- Docker unless already explicitly required;
- new template designer.

Fix only issues necessary for quality/hardening.

---

# 64. Verification

Before completion run the repository's actual commands.

At minimum:

- dependency install/check from lockfile;
- format check;
- lint;
- typecheck;
- unit tests;
- integration tests;
- build.

Also run when configured:

- renderer tests;
- Playwright E2E;
- migration-from-empty test.

Run dependency/security audit if available and review findings intelligently.

Do not claim a command passed unless it actually did.

---

# 65. Final Security Review

Before finishing explicitly inspect for:

- secrets;
- `.env`;
- API keys;
- raw Authorization logging;
- `eval`;
- `new Function`;
- `dangerouslySetInnerHTML`;
- arbitrary URL fetching;
- path traversal;
- arbitrary filesystem paths;
- uncontrolled remote assets/fonts;
- unsafe SQL string interpolation;
- unchecked external JSON;
- JS float misuse for canonical odds;
- unbounded composite recursion;
- unbounded uploads/request bodies;
- raw stack traces in API responses.

Not every occurrence is automatically a vulnerability.

Review context and fix real unsafe usage.

---

# 66. Final Diff Review

Inspect the full diff.

Verify:

- changes are stabilization-related;
- no unrelated feature entered scope;
- no database/export/test artifacts are tracked;
- no credentials were added;
- no architectural boundary was weakened;
- tests are meaningful;
- CI uses real scripts;
- documentation matches implementation;
- no previous/alternative project identity appears.

Remove unrelated edits.

---

# 67. Completion Report

At the end report concisely:

1. Main test gaps found and fixed.
2. Important security issues found and fixed.
3. Error contract/error handling changes.
4. Input/runtime validation improvements.
5. Filesystem/render/provider hardening.
6. Database/integrity fixes.
7. CI/test-suite changes.
8. Tests added or removed and why.
9. Exact verification commands executed and results.
10. Dependency audit findings that remain, if any.
11. Any known risk intentionally deferred.

Do not provide a long file-by-file narrative.

Do not report a vulnerability unless there is evidence it existed.

Do not claim the application is fully secure.

Do not commit or push unless explicitly requested.
