You are implementing Phase 10 of Bet Studio:

UX Polish + README + CI + Final Audit

This is the final stabilization/polish phase.

Do not add new product capabilities unless a very small change is required to resolve a clear usability, documentation, CI or consistency defect.

Before making changes:

1. Read AGENTS.md.
2. Read README.md.
3. Read docs/architecture.md.
4. Read docs/product-spec.md.
5. Read docs/data-model.md only where needed to verify implementation claims.
6. Read docs/market-engine.md only where needed to verify implemented settlement behavior.
7. Read docs/api-integration.md only where needed to verify provider/setup claims.
8. Read docs/rendering-engine.md only where needed to verify rendering/setup claims.
9. Inspect the complete implementation from Phases 01–09.
10. Inspect:

- package scripts;
- GitHub Actions;
- `.gitignore`;
- `.env.example`;
- application navigation;
- loading/error/empty states;
- Builder;
- History;
- provider sync UI;
- render/export UX;
- tests.

The repository and implementation are the source of truth.

Documentation must describe what actually exists.

Do not introduce or reference any product identity other than Bet Studio.

---

# Goal

Finish Bet Studio as a coherent portfolio-quality local-first application.

At the end of this phase:

- primary workflows feel consistent and understandable;
- navigation is clear;
- common UI states are polished;
- accessibility basics are covered;
- visual hierarchy is consistent;
- README accurately presents the project;
- setup instructions are reproducible;
- CI reflects the real quality workflow;
- docs and implementation no longer contradict each other;
- dead code/placeholders/obvious technical leftovers are removed;
- no unnecessary architecture or feature expansion is introduced;
- final quality gates pass.

This is not a redesign.

This is not a feature-development phase.

---

# 1. Start With a Final Audit

Before editing, inspect the application as a complete product.

Audit:

- navigation consistency;
- page hierarchy;
- naming consistency;
- empty states;
- loading states;
- error states;
- form validation;
- destructive/consequential action confirmations;
- responsive layout;
- keyboard/focus behavior;
- status presentation;
- Builder usability;
- History usability;
- provider configuration/sync feedback;
- render/export flow;
- duplicate/edit workflows;
- visual consistency;
- README accuracy;
- documentation drift;
- CI accuracy;
- stale TODOs/placeholders;
- unused code/dependencies;
- accidental debug UI/logging.

Create a small internal list of concrete issues.

Fix real issues only.

Do not refactor working architecture for stylistic preference.

---

# 2. UX Priorities

Prioritize the workflows users actually perform:

1. manage local football data;
2. create/edit bulletin;
3. evaluate/manage result;
4. render/export;
5. inspect History;
6. refresh external football data when configured.

Do not spend disproportionate effort polishing rarely used internal/debug screens.

---

# 3. Navigation

Ensure main navigation clearly exposes the current product areas.

Use existing information architecture where possible.

Likely areas include concepts equivalent to:

- Bulletins / Builder;
- History;
- Competitions;
- Teams;
- Markets;
- Data / Sync or Provider settings where implemented.

Do not create duplicate navigation destinations for the same resource.

Do not add a dashboard solely because many applications have one.

---

# 4. Naming Consistency

Use the same terminology everywhere.

Examples:

Bulletin
Selection
Fixture
Competition
Team
Market
History
Render / Export
Calculated status
Manual override
Effective status

Do not alternate unnecessarily between competing labels such as:

Bet
Ticket
Slip
Bulletin

unless product-spec explicitly defines them.

Use Bet Studio consistently.

---

# 5. Public Bulletin Identity

Use the established public code consistently.

Example:

BET #0001

Use it in:

- Builder;
- History;
- render metadata;
- user-facing references.

Do not show internal UUIDs where the public code is sufficient.

---

# 6. Shared Status Presentation

Use a single shared status component/token system for:

PENDING
GREEN
RED
VOID
MANUAL

Apply consistently in:

- Builder;
- History;
- result management;
- render-related UI where applicable.

Do not create slightly different colors/labels per page.

Color must not be the only indicator.

---

# 7. Loading States

Audit all meaningful async operations.

Provide clear local loading feedback for:

- list loading;
- bulletin save;
- duplicate;
- result refresh;
- re-evaluation;
- provider sync;
- render/export;
- History detail loading.

Prefer local action-level loading over blocking the whole application.

Do not use fake delays.

---

# 8. Empty States

Every important empty collection should be understandable.

Examples:

No bulletins
→ guide user to create one.

No fixtures
→ guide user toward local creation or explicit provider refresh.

No markets
→ guide user to Market management.

No renders
→ explain that no image has been exported yet.

No History filter results
→ allow clearing filters.

Do not leave empty tables without context.

---

# 9. Error States

Make errors actionable and concise.

Examples:

Provider unavailable
→ explain that local workflows still work.

Missing render file
→ explain historical metadata still exists.

Invalid bulletin
→ identify the fields/selections needing correction.

Render overflow
→ identify problematic content where safe.

Do not show:

- raw SQL;
- stack traces;
- absolute paths;
- provider response dumps.

Reuse Phase 09 error contract.

---

# 10. Form UX

Audit important forms.

Ensure:

- labels are clear;
- required fields are identifiable;
- validation appears near the relevant input;
- invalid save does not erase user input;
- buttons have clear action names;
- disabled actions explain why where useful;
- keyboard navigation works.

Do not redesign all forms with a new form library.

---

# 11. Builder Polish

Focus specifically on Bulletin Builder usability.

Verify:

- SINGLE/MULTI distinction is obvious;
- PRE_MATCH/LIVE mode is obvious;
- Add Selection action is discoverable;
- selection count/max is visible;
- fixture selection is understandable;
- market selection is understandable;
- odd entry is quick;
- total odd is prominent;
- reorder controls are usable;
- remove action is clear;
- display toggles are grouped logically;
- Save state is clear;
- preview remains useful;
- Export flow is understandable.

Do not expand Builder scope.

---

# 12. Builder With 10 Selections

Manually inspect the editing experience with 10 selections.

The management UI should remain usable.

Do not confuse final render density requirements with editor density.

The editor may scroll normally.

Ensure selection cards remain identifiable and actions accessible.

---

# 13. Builder Long Content

Test representative long:

- team names;
- competition names;
- market labels.

The editor and preview must remain usable.

Do not truncate inputs in a way that makes selections ambiguous.

Final deterministic fitting remains renderer responsibility.

---

# 14. Dirty State

If unsaved-change indication exists, ensure it is clear and reliable.

If navigation protection was implemented, ensure it does not fire unnecessarily after successful save.

Do not add autosave in this phase.

---

# 15. Duplicate UX

Duplicate action should clearly produce a new bulletin.

After duplication:

- navigate/open new bulletin where appropriate;
- show new public code;
- avoid implying the original was modified.

Do not duplicate historical render/override UI state.

---

# 16. Result Management Polish

Ensure calculated/manual/effective states are understandable without reading documentation.

Prefer a clear hierarchy such as:

Effective status — primary

Calculated status — secondary detail

Manual override — visibly identified when active

Do not make manual overrides look like automatic calculation results.

---

# 17. Override Actions

Review override UI for accidental mistakes.

A consequential override such as:

calculated GREEN
→ manual RED

may warrant a concise confirmation.

Reset to automatic should be explicit.

Do not add excessive confirmations for routine harmless actions.

---

# 18. History Polish

Ensure History supports quick understanding.

Each item should expose enough information to identify it without opening:

- public code;
- date;
- type/mode;
- selection count;
- total odd;
- effective status.

Keep filters compact.

Do not turn History into an analytics dashboard.

---

# 19. History Detail

Ensure result information and render history are visually separated but related.

A user should be able to understand:

- current bulletin state;
- selection results;
- manual overrides;
- previous renders.

Do not overwhelm the primary view with technical fingerprint/evaluator metadata.

Technical details may be secondary/expandable.

---

# 20. Provider UX

When GOAL API is configured:

show useful sync actions/status.

When not configured:

show a clear disabled/unavailable state.

Explain that local/manual workflows remain available.

Do not present missing provider credentials as an application failure.

Do not expose keys.

---

# 21. Sync Feedback

Provider synchronization feedback should clearly distinguish:

SUCCESS
PARTIAL
FAILED

Show useful counts where available.

Example:

20 processed
3 created
16 updated
1 unresolved

Do not display huge raw sync logs in ordinary UI.

---

# 22. Render / Export UX

Ensure render/export flow is simple.

Expected flow:

Save bulletin
→ Export
→ Rendering…
→ Success
→ preview/download/open result

If unsaved changes exist:

do not accidentally export stale data without warning.

Follow the Phase 07 persisted-source policy.

---

# 23. Render Errors

Handle rendering failures clearly.

Examples:

- content does not fit;
- missing local asset;
- invalid template;
- export process failed.

Offer a sensible Retry where appropriate.

Do not expose Playwright internals.

---

# 24. Visual Consistency

Keep one coherent Bet Studio UI language.

Audit:

- spacing;
- radius;
- typography;
- cards;
- buttons;
- inputs;
- status pills;
- section headings;
- dark surfaces;
- accent usage.

Consolidate obvious duplicated styles into existing shared primitives/tokens where useful.

Do not introduce a new design system framework.

---

# 25. Restraint

The application should feel polished, not decorative.

Avoid unnecessary:

- gradients everywhere;
- glow effects;
- animated backgrounds;
- glassmorphism;
- excessive icons;
- microanimations.

Prioritize clarity and hierarchy.

---

# 26. Responsive UX

Verify the main application at representative widths.

At minimum:

- common desktop width;
- narrower laptop/tablet-like width;
- mobile/narrow layout where current product supports it.

Important workflows must not become unusable.

Do not spend this phase building an entirely separate mobile application.

---

# 27. Accessibility Audit

Check basic accessibility:

- semantic buttons;
- input labels;
- keyboard interaction;
- focus visibility;
- logical tab order;
- dialog focus handling where applicable;
- accessible names for icon-only controls;
- status not color-only;
- reasonable text contrast;
- error association where practical.

Fix concrete issues.

Do not attempt a formal certification process.

---

# 28. Keyboard Reordering

If selection reordering supports drag-and-drop, ensure there is still a keyboard-accessible alternative.

Move Up / Move Down controls are acceptable.

Do not rely exclusively on pointer drag gestures.

---

# 29. Focus Management

After important operations, ensure focus behavior is sensible.

Examples:

- modal closes;
- newly added selection can be reached;
- validation error does not trap focus;
- confirmation dialog restores focus.

Do not build a custom focus framework.

---

# 30. Performance Audit

Look for obvious UX performance problems.

Examples:

- unnecessary repeated list requests;
- accidental provider refresh on page load;
- excessive rerenders in 10-selection Builder;
- repeatedly launching renders during preview;
- fetching all fixtures when a bounded query would suffice.

Fix measurable/obvious issues.

Do not perform speculative micro-optimization.

---

# 31. Remove Debug Artifacts

Remove production-visible:

- debug buttons;
- placeholder text;
- console logs;
- temporary test routes;
- development banners;
- unfinished TODO UI.

Keep deliberate developer diagnostics that are gated appropriately.

Do not remove useful server-side structured logging.

---

# 32. Dead Code

Identify clearly unused:

- components;
- helpers;
- routes;
- types;
- dependencies;
- old feature experiments.

Remove them only when confident they are unused.

Do not perform a large speculative cleanup that risks regressions.

---

# 33. README Goal

Rewrite/refine README.md into a strong portfolio README that accurately represents the finished project.

It should be informative without becoming another full specification.

Target a concise, scannable structure.

Do not copy every rule from docs/.

---

# 34. README Suggested Structure

Prefer sections equivalent to:

# Bet Studio

Short product description.

## Overview

What problem it solves and the local-first/deterministic approach.

## Features

Concise current capabilities.

## Screenshots

Placeholders or actual repository images only if available.

## Tech Stack

Actual dependencies/technology.

## Architecture

Short explanation + link to docs/architecture.md.

## Getting Started

Prerequisites
Install
Environment
Database
Run

## Football Data Provider

Optional GOAL API configuration and local fallback.

## Rendering

1080×1350 FEED
deterministic/versioned rendering
Playwright Chromium requirement.

## Testing

Actual commands.

## Project Structure

Only current major directories.

## Documentation

Links to docs/.

## Roadmap / Future

Only genuinely deferred features.

## Security / Data

Short local-first/secrets statement.

## Disclaimer

Appropriate betting/sports-data disclaimer if already desired.

## License

Use actual current state.

Do not include sections with no useful content merely to follow this exact list.

---

# 35. README Opening

The first paragraphs should communicate quickly:

Bet Studio is a local-first application for creating, managing, evaluating and rendering professional football betting bulletins for social media.

Highlight:

- structured football data;
- deterministic market settlement;
- versioned rendering;
- local persistence;
- optional external synchronization.

Avoid marketing exaggeration.

Do not call unfinished/planned features implemented.

---

# 36. README Features

List only features that actually work after Phase 10.

Possible implemented features may include:

- Competition/Team/Market management;
- optional GOAL API sync;
- Bulletin Builder;
- SINGLE/MULTI;
- PRE_MATCH/LIVE;
- deterministic Market Engine;
- manual overrides;
- History;
- deterministic FEED rendering;
- historical renders;
- local-first operation.

Verify each before documenting it.

---

# 37. README Screenshots

If useful screenshots already exist in the repository, reference them correctly.

Do not invent screenshot paths.

Do not add fake/mock screenshots solely for README unless explicitly requested.

If none exist, a concise placeholder section may be omitted.

---

# 38. README Tech Stack

List actual stack only.

Likely:

- TypeScript;
- React;
- Vite;
- Tailwind CSS;
- Node.js;
- Fastify;
- SQLite;
- Drizzle ORM;
- Zod;
- Vitest;
- Playwright;
- ESLint;
- Prettier;
- GitHub Actions.

Remove anything not actually used.

Do not list technologies merely planned earlier.

---

# 39. README Architecture

Keep architecture explanation concise.

Example concept:

Presentation
↓
Application
↓
Domain
↑
Infrastructure

Explain that:

- Domain remains framework-independent;
- provider adapters live in Infrastructure;
- Application coordinates use cases;
- local SQLite is operational source of truth;
- renderer consumes frozen render data.

Link to docs/architecture.md for detail.

---

# 40. README Setup Accuracy

Test every setup command you document.

Do not document commands that do not exist.

Include exact package manager already used by repository.

If npm:

npm install
npm run dev

or actual scripts.

Do not assume npm if repository uses another manager.

---

# 41. Node Version

Document the Node version/range actually supported by repository configuration.

If `.nvmrc`, `engines`, Volta or similar exists, ensure README agrees.

Do not say "latest Node" vaguely.

---

# 42. Environment Setup

Document only actual environment variables.

Use `.env.example` as reference.

Explain GOAL API configuration is optional.

Do not place real secrets in README.

If no provider key is configured, document expected local-only behavior.

---

# 43. Database Setup

Document actual migration/bootstrap command.

Examples conceptually:

npm run db:migrate

Only use the real script.

Explain where local SQLite data is stored only at a safe conceptual level.

Do not document machine-specific absolute paths.

---

# 44. Provider Documentation

README should explain GOAL API briefly.

Include only verified implemented behavior.

Do not claim:

- coverage;
- quotas;
- live latency;
- statistics/corners availability

unless implementation/docs verified those claims.

Link to docs/api-integration.md for detail.

---

# 45. Rendering Documentation

README should explain:

- FEED = 1080×1350;
- final rendering uses local deterministic assets/fonts;
- Playwright Chromium is used for export;
- Story format remains future if still not implemented.

Do not claim arbitrary cross-platform byte-identical images.

Use precise determinism wording.

---

# 46. Testing Documentation

List actual commands for:

- unit/integration tests;
- render tests if separate;
- E2E if separate;
- lint;
- typecheck;
- format check;
- build.

Keep normal workflow easy to understand.

Do not require real GOAL API for ordinary tests.

---

# 47. Project Structure

Only describe directories that actually exist.

Do not preserve an old aspirational tree that drifted from implementation.

Keep it high level.

---

# 48. Roadmap

Keep Roadmap small.

Possible future items only if still genuinely deferred:

- Story 1080×1920;
- additional football providers;
- additional market families;
- richer statistics;
- optional analytics;
- additional templates.

Do not commit to dates.

Do not include features intentionally ruled out as if guaranteed.

---

# 49. Disclaimer

If README contains a betting-related disclaimer, keep it concise and professional.

Bet Studio is a content/workflow tool.

Do not imply guaranteed betting outcomes or financial performance.

---

# 50. README Length

Prefer a polished README that a recruiter/developer can scan quickly.

Do not make it a 1000-line duplicate of docs/.

Move deep technical detail into existing docs.

---

# 51. Documentation Audit

Compare implementation against all persistent docs.

Identify contradictions in:

- naming;
- status rules;
- fields;
- routes;
- evaluator families;
- provider capabilities;
- template/version strategy;
- render format;
- override semantics;
- snapshot semantics;
- public bulletin code;
- Story scope.

Fix documentation drift.

Do not silently change working implementation merely to match an obsolete doc if the implementation reflects an explicitly approved later decision.

Prefer aligning docs to the final approved architecture.

---

# 52. Brand Audit

Search repository text for obsolete/alternative product identities.

The project must use Bet Studio consistently.

Remove accidental stale branding from:

- README;
- docs;
- UI;
- tests;
- fixtures;
- comments;
- filenames where practical and safe.

Do not rename technical history/migrations destructively solely for aesthetics if it risks breaking the app.

Report any unavoidable legacy technical identifier if one exists.

---

# 53. Public Code Audit

Verify user-facing examples consistently use:

BET #0001

and safe export form such as:

BET-0001-feed-pending.png

Do not introduce another public prefix.

---

# 54. Terminology Audit

Search for inconsistent terms.

Standardize current product wording.

Do not rename domain concepts casually if migrations/API compatibility would be disrupted.

Prefer UI/docs alignment over destructive internal renaming.

---

# 55. TODO Audit

Review TODO/FIXME comments.

For each:

- fix if small and relevant;
- convert to documented future scope if legitimate;
- remove stale completed comments.

Do not attempt every long-term TODO.

Do not leave misleading TODOs about already completed features.

---

# 56. CI Goal

Ensure GitHub Actions represents the final supported development workflow.

CI must be:

- deterministic;
- independent of external football APIs;
- independent of secrets;
- based on committed lockfile;
- reasonably fast;
- strict enough to catch regressions.

---

# 57. CI Core Gates

At minimum CI should run the actual equivalents of:

- install from lockfile;
- format check;
- lint;
- typecheck;
- unit/integration tests;
- build.

Add renderer tests where they are part of the canonical test suite.

Add E2E only if stable and worth the runtime.

Do not call GOAL API.

---

# 58. CI Playwright

If rendering/E2E requires Playwright:

install only the browser required.

Prefer Chromium.

Use the Playwright version from the lockfile.

Do not use arbitrary system Chrome.

Cache only where straightforward and reliable.

Do not overcomplicate CI optimization.

---

# 59. CI Rendering Environment

For canonical rendering tests, ensure:

- locale fixed;
- timezone fixed;
- local fonts available;
- Chromium version controlled;
- animations disabled by renderer;
- no network dependency.

Keep strict golden comparisons only in the environment intended to be canonical.

---

# 60. CI Workflow Duplication

Avoid multiple GitHub Actions workflows running the same expensive commands unnecessarily.

Consolidate where simple.

Do not redesign CI into reusable workflow abstractions for a small repository without need.

---

# 61. CI Permissions

Use minimal GitHub Actions permissions appropriate to read/test/build.

Do not grant unnecessary repository write permissions.

CI should not commit/push generated artifacts.

---

# 62. CI Artifacts

Do not upload every build/test file by default.

Upload useful diagnostics only where they materially help, for example failed Playwright artifacts if current setup supports it.

Do not persist secret/local DB files.

---

# 63. Lockfile

Ensure exactly the intended package-manager lockfile is committed.

CI must use frozen/clean install behavior appropriate to package manager.

Do not maintain multiple competing lockfiles.

---

# 64. Dependency Audit

Perform one final dependency review.

Check:

- unused packages;
- duplicate libraries solving same problem;
- major unnecessary frontend frameworks;
- test-only packages in production dependencies;
- production packages in devDependencies where runtime requires them.

Fix safe clear issues.

Do not perform broad major upgrades solely because newer versions exist.

---

# 65. Bundle / Build Warnings

Review production build warnings.

Fix meaningful issues such as:

- broken imports;
- missing assets;
- accidental huge dependency caused by clear mistake.

Do not chase every harmless bundler warning with risky refactoring.

---

# 66. Console Warnings

Run primary UI workflows and inspect console where practical.

Fix meaningful:

- React key warnings;
- uncontrolled/controlled input warnings;
- failed asset requests;
- unhandled promise rejections.

Do not suppress warnings without fixing their cause.

---

# 67. API Route Audit

Check for:

- unused temporary endpoints;
- duplicate routes;
- inconsistent response/error envelopes;
- debug-only routes exposed accidentally.

Remove only clearly obsolete routes.

Do not redesign the API.

---

# 68. Database Audit

Run migrations from a fresh empty database.

Confirm current application boots and core seed/bootstrap behavior is idempotent.

Do not modify old migrations casually.

If migration history is already valid, preserve it.

Fix forward with a new migration where necessary.

---

# 69. Historical Integrity Audit

Re-run critical invariants from earlier phases.

Verify:

- Team/Market edits do not mutate saved snapshots;
- result correction does not rewrite old result snapshots;
- override changes do not rewrite audit history;
- new render does not replace old RenderRecord;
- historical render keeps old TemplateVersion;
- historical assets remain immutable/version-safe.

Do not regress these during cleanup.

---

# 70. Local-First Audit

Verify the finished application can operate with GOAL API disabled.

At minimum:

- starts;
- local CRUD works;
- fixtures/local data work;
- Builder works;
- Market Engine works;
- History works;
- rendering/export works.

Provider sync may be unavailable gracefully.

This is a core product requirement.

---

# 71. Determinism Audit

Re-run rendering determinism checks.

Verify:

- no remote assets/fonts;
- explicit locale/timezone;
- fonts ready;
- animations disabled;
- bounded text fitting;
- stable fingerprint;
- 1080×1350;
- same canonical input produces same canonical output behavior.

Do not weaken these invariants for UX convenience.

---

# 72. Security Audit

Re-run Phase 09 security checks after all final changes.

Inspect:

- secrets;
- `.env`;
- API key exposure;
- unsafe HTML;
- unsafe CSS;
- arbitrary URL fetching;
- path traversal;
- arbitrary file access;
- raw SQL interpolation;
- unchecked provider JSON;
- unsafe market execution;
- unbounded request/input sizes;
- raw error leakage.

Fix any regressions introduced during polish.

---

# 73. Error Contract Audit

Confirm all major APIs use the final common error contract.

Frontend should not need special parsing for each subsystem.

Provider and renderer errors may have different machine codes, but envelope/handling should remain consistent.

---

# 74. Test Audit

Review final test suite for:

- flaky tests;
- redundant expensive tests;
- skipped tests;
- `.only`;
- meaningless assertions;
- network dependency;
- current-time dependency.

No committed:

.only

No accidental skipped critical tests.

Document intentionally skipped environment-specific tests if any.

---

# 75. Test Runtime

If test suite became unnecessarily slow, identify obvious duplication.

Prefer moving behavior from E2E to integration/unit rather than removing meaningful coverage.

Do not optimize test runtime at the expense of critical invariants.

---

# 76. README Verification

Before finishing, follow README setup instructions as though cloning the project fresh.

Where practical:

1. clean install;
2. copy/configure environment;
3. migrate/bootstrap DB;
4. start development;
5. run tests;
6. build.

Fix README if any command is wrong.

Do not claim fresh-clone verification if not actually performed.

---

# 77. Portfolio Quality

Review repository as a recruiter/developer would.

The repository should communicate:

- clear purpose;
- intentional architecture;
- sensible scope;
- meaningful tests;
- clean setup;
- reproducibility;
- engineering tradeoffs.

Do not artificially increase complexity to look "enterprise".

Simple, coherent decisions are preferable.

---

# 78. No Architecture Theatre

Do not add final-minute:

- microservices;
- event buses;
- dependency injection container frameworks;
- Redis;
- queues;
- Kubernetes;
- Docker solely for appearance;
- CQRS;
- event sourcing;
- generic plugin framework.

The existing local-first modular architecture is sufficient.

---

# 79. No New Product Features

Do not implement:

- Story 1080×1920;
- second football provider;
- new Market Engine families;
- analytics dashboard;
- ROI/P&L;
- bankroll;
- auth;
- multi-user;
- cloud sync;
- social publishing;
- template designer.

Document future ideas rather than implementing them now.

---

# 80. Final Quality Gates

Run the repository's real full verification sequence.

At minimum:

- clean/frozen dependency install where practical;
- format check;
- lint;
- typecheck;
- unit tests;
- integration tests;
- render tests;
- build.

Run stable Playwright E2E if part of supported suite.

Run fresh database migration/bootstrap verification.

Run dependency/security audit where available and review findings.

Do not claim a gate passed unless it actually ran successfully.

---

# 81. Final Manual Workflow

If environment permits, manually verify one complete local workflow:

1. start Bet Studio without GOAL API credentials;
2. use/create local football data;
3. create a MULTI bulletin;
4. save;
5. reopen;
6. evaluate/update result;
7. apply and reset a manual override;
8. export 1080×1350 PNG;
9. open History;
10. inspect render/result history;
11. duplicate bulletin.

Then, if valid GOAL API configuration is available:

12. perform one small explicit sync;
13. verify local data updates without breaking manual workflows.

Avoid unnecessary provider requests.

Do not claim steps that were not actually performed.

---

# 82. Final Git Status / Diff Audit

Inspect:

git status
git diff

and relevant untracked files.

Ensure no accidental:

- `.env`;
- SQLite DB;
- WAL/SHM;
- exported PNGs;
- Playwright artifacts;
- coverage output;
- temp files;
- secrets;
- generated debug data

are intended for commit unless explicitly appropriate.

Review every source/doc/config change for scope.

---

# 83. Final Repository Search

Search for obvious problematic leftovers:

TODO
FIXME
HACK
console.log
debugger
localhost hardcodes
API keys
obsolete product names
temporary routes
`.only`
unexpected `.skip`

Review results contextually.

Do not mechanically remove legitimate comments/config.

---

# 84. Documentation Consistency Check

Before completion ensure these documents agree:

README.md
AGENTS.md
docs/architecture.md
docs/product-spec.md
docs/data-model.md
docs/market-engine.md
docs/api-integration.md
docs/rendering-engine.md

Key shared facts must be consistent:

- product = Bet Studio;
- local-first;
- FEED 1080×1350;
- Story future;
- max 10 selections;
- SINGLE/MULTI;
- PRE_MATCH/LIVE;
- Market always visible;
- statuses;
- public code format;
- manual override semantics;
- provider optional;
- historical immutability;
- deterministic rendering contract.

Do not duplicate every rule across every file.

---

# 85. AGENTS.md Final Check

Keep AGENTS.md lean.

It should provide durable Codex instructions, not reproduce all product specifications.

Ensure it contains:

- source-of-truth hierarchy;
- task workflow;
- architecture boundaries;
- scope discipline;
- security basics;
- quality gates;
- no unrelated edits;
- no commit/push unless explicitly requested.

If it remains excessively long, reduce duplication carefully.

Do not remove important architectural constraints.

---

# 86. Completion Criteria

Phase 10 is complete when:

- UX polish issues identified in the audit are resolved;
- primary workflows are coherent;
- README is accurate and portfolio-ready;
- docs are aligned;
- CI matches local quality commands;
- fresh migrations work;
- local-first workflow works;
- deterministic render tests remain valid;
- security/error handling has not regressed;
- full quality gates pass;
- repository contains no obvious debug/secret/generated-file mistakes.

Do not keep changing code merely to make it "cleaner" after these criteria are met.

---

# 87. Completion Report

At the end report concisely:

1. UX issues found and fixed.
2. Accessibility improvements.
3. README changes.
4. Documentation inconsistencies fixed.
5. CI changes.
6. Dead/debug code removed.
7. Dependency/config cleanup performed.
8. Local-first verification result.
9. Rendering/determinism verification result.
10. Security/error-contract final audit result.
11. Exact quality commands executed and results.
12. Fresh migration/setup verification result.
13. Manual end-to-end workflow actually tested.
14. Any known issue intentionally deferred.
15. Any README/documented step that could not be verified.

Do not give a long file-by-file summary.

Do not claim "production ready", "fully secure" or similar absolute guarantees.

Do not commit or push unless explicitly requested.
