You are implementing Phase 01 of Bet Studio: Foundation / Architecture.

Before making any changes:

1. Read AGENTS.md.
2. Read docs/architecture.md.
3. Read docs/product-spec.md only for the minimum product context needed for this foundation.
4. Inspect the existing repository, package configuration and source tree.
5. Treat the repository and its documentation as the source of truth.

Do not read the remaining technical documents unless something in this task specifically requires them.

If the repository already contains implementation, preserve valid existing work and adapt the smallest coherent change instead of recreating the project from scratch.

Do not introduce or reference any previous, alternative or external project/brand identity. The application and repository identity is Bet Studio.

---

## Goal

Create the initial production-quality foundation for Bet Studio.

At the end of this phase, the repository must:

- install successfully;
- run locally in development;
- expose a minimal React application;
- expose a minimal Fastify backend;
- establish the documented architectural boundaries;
- have TypeScript configured strictly;
- have formatting, linting, testing, typechecking and build scripts;
- contain a minimal automated test setup;
- contain a useful `.env.example`;
- ignore local secrets and generated/local runtime files;
- have a basic GitHub Actions CI workflow;
- remain intentionally small.

This phase is infrastructure/foundation only.

Do not implement product features yet.

---

## Required Stack

Use the documented stack:

- TypeScript
- React
- Vite
- Tailwind CSS
- Node.js
- Fastify
- SQLite
- Drizzle ORM
- Zod
- Vitest
- Playwright
- ESLint
- Prettier
- GitHub Actions

However, install/configure a dependency in this phase only if it is genuinely needed to establish the foundation.

Do not create fake usage merely to justify every planned dependency.

In particular, do not implement the database schema, repositories or migrations in this phase unless the existing repository already requires minimal database bootstrap work.

Do not implement provider integrations or rendering libraries.

---

## Package Manager

Inspect the repository first.

If a package manager and lockfile already exist, preserve them.

If the repository has no package manager decision yet, use npm and commit the generated lockfile.

Do not introduce multiple lockfiles.

---

## Runtime Version

Use a current supported Node.js LTS version compatible with the selected dependencies.

Pin or document the supported major version in an appropriate standard project file and package metadata where useful.

Do not choose an experimental/non-LTS runtime without a documented reason.

---

## Application Shape

Prefer a simple single-repository application.

Do not introduce a monorepo unless the existing repository already uses one or the documented architecture explicitly requires it.

Keep frontend and backend concerns clearly separated without creating unnecessary packages.

A reasonable source organization is conceptually:

src/
  domain/
  application/
  infrastructure/
  presentation/
  shared/

The exact structure may adapt to the existing repository.

Do not create dozens of empty placeholder files or directories.

Create architectural locations only when they have an immediate purpose or when a very small boundary marker materially improves clarity.

---

## Architecture

Respect the documented dependency direction:

Presentation
    ↓
Application
    ↓
Domain
    ↑
Infrastructure

The Domain layer must remain framework-independent.

Do not import into Domain:

- React
- Fastify
- Drizzle
- SQLite libraries
- HTTP clients
- provider SDKs
- rendering libraries

Application code must not depend directly on concrete database/provider implementations where an architectural boundary is required.

Infrastructure contains technical implementations.

Presentation contains the React/Fastify boundaries.

For this phase, prefer demonstrating the architecture with minimal real code rather than building speculative abstractions.

Do not create generic repository interfaces, provider interfaces, render interfaces or domain entities before they are needed by later phases.

---

## Frontend Foundation

Create a minimal React + Vite + TypeScript frontend.

Requirements:

- application starts successfully;
- Tailwind CSS is configured and working;
- use a minimal Bet Studio application shell;
- no production dashboard implementation yet;
- no bulletin builder;
- no fake statistics;
- no placeholder betting data;
- no large component library unless already documented and justified;
- no unnecessary state-management framework.

A simple page proving that React, TypeScript and Tailwind are correctly wired is sufficient.

Keep styling restrained and maintainable.

Do not spend this phase designing the final UI.

---

## Backend Foundation

Create a minimal Fastify + TypeScript backend.

Requirements:

- server can start locally;
- configuration is validated;
- provide a minimal health endpoint;
- errors during startup should be clear;
- shutdown should be graceful where practical.

Suggested health endpoint:

GET /api/health

A successful response may be structurally similar to:

{
  "status": "ok"
}

Do not expose environment values, machine details, secrets or unnecessary diagnostics through the health endpoint.

Do not implement business API routes yet.

---

## Frontend / Backend Development Integration

Configure a straightforward local development workflow.

The frontend must be able to reach the backend without hardcoding fragile production assumptions.

Prefer Vite development proxying for `/api` if appropriate to the chosen structure.

Avoid unnecessary CORS complexity when the development proxy solves the local use case cleanly.

Production serving topology does not need to be overengineered in Phase 01.

Document any meaningful assumption.

---

## Environment Configuration

Create:

.env.example

Do not create or commit real secrets.

Validate server-side environment configuration with Zod.

Only add environment variables currently required by the foundation.

Do not add speculative API credentials simply because future provider integrations may use them.

If a future variable is useful to document but not currently consumed, prefer leaving it for the phase that implements that integration.

Ensure:

.env

and appropriate local variants are ignored by Git.

Client-exposed variables must be deliberately separated from server-only configuration.

Never expose server secrets through Vite client environment variables.

---

## TypeScript

Use strict TypeScript configuration.

Enable appropriate strictness for a production-quality project.

Avoid `any` unless technically unavoidable and explicitly justified.

Keep frontend/backend TypeScript configuration understandable.

Do not create an unnecessarily complex tsconfig inheritance tree.

Path aliases may be introduced only if they clearly improve imports and work consistently across:

- TypeScript
- Vite
- Vitest
- Node/backend tooling

Otherwise prefer straightforward relative imports for now.

---

## ESLint

Configure ESLint for the actual project stack.

It must correctly handle:

- TypeScript;
- React;
- frontend source;
- backend source;
- tests.

Avoid obsolete/deprecated configuration patterns where the installed ESLint version provides a current approach.

Do not enable huge collections of stylistic rules already handled by Prettier.

---

## Prettier

Configure Prettier with a small conventional configuration.

Avoid excessive custom formatting preferences.

Ensure formatting checks can run non-interactively.

---

## Vitest

Configure Vitest.

Add only a small number of useful foundation tests.

At minimum, test something meaningful enough to prove the test environment works.

Where practical, include a test for the backend health behavior without opening a real external network port.

Do not create meaningless tests such as:

expect(true).toBe(true)

solely to make the suite green.

Do not build extensive product tests before product behavior exists.

---

## Playwright

Configure Playwright for future E2E testing.

Keep the initial setup minimal.

If a small smoke test can reliably verify that the application shell loads, add it.

Do not build a large E2E suite in this phase.

Avoid configuration that requires external services or external APIs.

If Playwright browser installation is intentionally not part of the normal dependency installation, document the required setup command.

---

## SQLite / Drizzle

Prepare only the minimum foundation necessary for later SQLite + Drizzle work.

Do not design the complete schema in this phase.

Do not implement:

- competitions;
- teams;
- fixtures;
- markets;
- bulletins;
- snapshots;
- provider mappings.

Those belong to later phases.

It is acceptable for Drizzle/database dependencies or configuration to remain unimplemented until Phase 02 if adding them now would create unused infrastructure.

Do not create an empty migration purely to claim database support.

---

## Scripts

Provide clear package scripts for the workflows that actually exist.

The final repository should have equivalents for:

- development;
- build;
- lint;
- typecheck;
- test;
- formatting;
- formatting check.

Add an E2E script if Playwright is configured.

Prefer simple commands.

Do not create chains of opaque shell scripts when package scripts are sufficient.

Make sure script names are reflected accurately in README.md.

---

## Build

The production build must succeed.

Ensure frontend and backend TypeScript/build concerns are handled appropriately.

Do not introduce Docker merely for building or running the application.

Docker is not required for Bet Studio v1.

---

## Local Runtime Files

Prepare the repository for local-first persistence without committing runtime data.

Ignore appropriate files such as:

- `.env`;
- SQLite database files;
- SQLite journal/WAL files;
- generated exports;
- temporary files;
- test output;
- Playwright output;
- coverage output;
- build artifacts where appropriate.

Do not ignore source assets or migrations that should eventually be version controlled.

---

## GitHub Actions

Create a small CI workflow for pushes and pull requests.

Use the repository's chosen Node/package-manager setup.

CI should run the relevant quality gates that are reliable in this phase, such as:

- install from lockfile;
- formatting check;
- lint;
- typecheck;
- unit/integration tests;
- build.

Do not require:

- external football APIs;
- API credentials;
- cloud services;
- Docker;
- a remote database.

Only run Playwright E2E in CI if the initial configuration is reliable and browser setup is explicitly included. Otherwise keep E2E as a documented local command for now.

Prefer one understandable workflow over premature CI optimization.

---

## README

Update README.md so that its development instructions reflect the repository after this phase.

Replace foundation placeholders with the actual:

- Node requirement;
- package manager;
- install command;
- development command;
- build command;
- lint command;
- typecheck command;
- test command;
- formatting commands;
- E2E command if configured.

Do not rewrite unrelated README sections.

Do not introduce any identity other than Bet Studio.

---

## Security

Apply basic foundation security practices:

- no committed secrets;
- no secret values in logs;
- server environment remains server-side;
- dependencies should be appropriate and maintained;
- do not disable TLS/security checks;
- do not expose unnecessary server information.

Do not add heavyweight security middleware without a concrete need.

---

## Do Not Implement Yet

Do not implement:

- authentication;
- users;
- permissions;
- cloud infrastructure;
- Docker requirements;
- Redis;
- queues;
- microservices;
- payments;
- social-media publishing;
- football provider adapters;
- provider synchronization;
- database domain schema;
- CRUD screens;
- market settlement;
- bulletin builder;
- rendering engine;
- template system;
- history/result workflows.

These belong to later phases.

---

## Quality Expectations

Prefer:

- small cohesive files;
- clear naming;
- minimal dependencies;
- current supported tooling;
- strict types;
- deterministic tests;
- understandable configuration.

Avoid:

- speculative abstractions;
- premature generic frameworks;
- unnecessary wrappers;
- empty architecture theater;
- excessive comments;
- duplicated configuration;
- unnecessary generated files.

---

## Verification

Before completing the task:

1. Install dependencies using the committed lockfile.
2. Run formatting/check.
3. Run lint.
4. Run TypeScript typechecking.
5. Run the automated test suite.
6. Run the production build.
7. Run the E2E smoke test if configured and available.
8. Inspect the final Git diff.
9. Check that no secret or local runtime file was accidentally added.
10. Confirm that README commands match the actual package scripts.

Fix failures caused by this implementation before finishing.

Do not claim a command passed unless it was actually executed successfully.

---

## Completion Report

At the end, provide a concise report containing:

- architecture/foundation created;
- important files/configuration added or changed;
- package manager and Node version selected;
- scripts available;
- tests added;
- exact verification commands executed and their result;
- any intentionally deferred foundation decision;
- any issue that remains unresolved.

Do not provide a long file-by-file narrative.

Do not commit or push changes unless explicitly requested.