# Bet Studio — Architecture

## 1. Architecture Goals

Bet Studio must be:

- Local-first
- Type-safe
- Modular
- Deterministic
- Testable
- Provider-independent
- Easy to run locally
- Easy to understand during code review

Avoid unnecessary distributed-system or enterprise complexity.

Core business logic must not depend directly on:

- React
- HTTP
- SQLite
- External APIs
- Rendering libraries

---

## 2. Initial Technology Stack

### Language

TypeScript

### Frontend

React

### Frontend tooling

Vite

### Styling

Tailwind CSS

### Backend

Node.js

### HTTP server

Fastify

### Database

SQLite

### ORM

Drizzle ORM

### Validation

Zod

### Unit/integration tests

Vitest

### End-to-end tests

Playwright

### Linting

ESLint

### Formatting

Prettier

### CI

GitHub Actions

Rendering implementation is defined separately in `rendering-engine.md`.

---

## 3. Architectural Layers

Use four primary layers:

```text
Presentation
     ↓
Application
     ↓
Domain
     ↑
Infrastructure

Dependencies must point toward the Domain/Application layers.

Domain

Contains pure business concepts and rules.

Examples:

Bulletin
Selection
Competition
Team
Market
Market settlement
Status calculation

Must not import:

React
Fastify
Drizzle
HTTP clients
provider SDKs
Application

Coordinates use cases.

Examples:

Create bulletin
Update bulletin
Duplicate bulletin
Settle selection
Synchronize teams
Synchronize fixtures
Export bulletin

Depends on domain abstractions and ports.

Infrastructure

Implements external concerns.

Examples:

SQLite repositories
Football API providers
File storage
HTTP clients
Image cache
Renderer adapters
Presentation

User-facing interface.

Includes:

React pages
Components
Forms
UI state
API routes/controllers where appropriate

Presentation must not contain business settlement rules.

4. Suggested Source Structure
src/
├── domain/
│   ├── bulletin/
│   ├── competition/
│   ├── fixture/
│   ├── market/
│   └── team/
│
├── application/
│   ├── bulletins/
│   ├── competitions/
│   ├── fixtures/
│   ├── markets/
│   ├── synchronization/
│   └── rendering/
│
├── infrastructure/
│   ├── database/
│   ├── providers/
│   ├── storage/
│   └── rendering/
│
├── presentation/
│   ├── api/
│   └── web/
│
└── shared/
    ├── errors/
    ├── types/
    └── validation/

Tests may live beside modules or in dedicated test directories.

Prefer consistency over arbitrary separation.

5. Domain Model Ownership

Internal IDs are authoritative.

External provider identifiers must be stored only as mappings.

Example:

type ProviderReference = {
  provider: string;
  externalId: string;
};

Never use external API IDs as Bet Studio primary keys.

Benefits:

Provider replacement
Multiple providers
Manual records
Stable historical data
6. Repository Pattern

Application logic must interact with repository interfaces.

Example:

interface TeamRepository {
  findById(id: TeamId): Promise<Team | null>;
  list(filters?: TeamFilters): Promise<Team[]>;
  save(team: Team): Promise<void>;
}

Infrastructure implements these interfaces using SQLite/Drizzle.

Do not expose ORM-specific models outside infrastructure.

7. Football Provider Abstraction

External football sources implement a common provider contract.

Example:

interface FootballDataProvider {
  readonly id: string;

  getCompetitions(): Promise<ExternalCompetition[]>;
  getTeams(input: TeamsQuery): Promise<ExternalTeam[]>;
  getFixtures(input: FixturesQuery): Promise<ExternalFixture[]>;
  getFixture(id: string): Promise<ExternalFixture | null>;
}

Provider adapters must normalize external responses before returning them.

Application code must not contain provider-specific response parsing.

Initial adapters may include:

providers/
├── goal-api/
├── football-data/
├── openfootball/
└── thesportsdb/

Do not implement unused providers before they are required.

8. Synchronization Architecture

Synchronization imports provider data into the local database.

Flow:

Provider
   ↓
Provider adapter
   ↓
Normalized external model
   ↓
Synchronization service
   ↓
Matching / mapping
   ↓
Local domain model
   ↓
Repository

External data must not overwrite manual changes blindly.

Synchronization must track:

Provider
Resource type
Timestamp
Success/failure
Optional request metadata

Cache data where useful.

Network access must never be required to display previously synchronized records.

9. Provider Failure Strategy

External providers are unreliable by definition.

Expected failures:

Network errors
Authentication errors
Rate limits
Invalid responses
Missing competition coverage
Partial data

Required behavior:

provider fails
      ↓
return controlled application error
      ↓
preserve cached/local data
      ↓
inform UI

Never delete valid local data because a provider returns an empty or failed response.

10. Market Engine

The Market Engine belongs to the Domain layer.

Conceptual interface:

type SettlementStatus =
  | 'GREEN'
  | 'RED'
  | 'VOID'
  | 'MANUAL';

interface MarketEvaluator {
  evaluate(input: MarketEvaluationInput): SettlementStatus;
}

Market evaluators must be:

Pure where practical
Deterministic
Independently testable
Registered by market code

Avoid large switch statements distributed across the application.

Prefer:

market code
    ↓
evaluator registry
    ↓
specific evaluator

Exact rules belong in market-engine.md.

11. Bulletin Status

Bulletin aggregate logic belongs to Domain.

Do not calculate bulletin status in UI components.

Example conceptual flow:

Selection statuses
       ↓
Bulletin aggregate
       ↓
Overall status

Manual overrides must be distinguishable from calculated values.

12. Rendering Boundary

Rendering is an application capability with infrastructure implementation.

Conceptual port:

interface BulletinRenderer {
  render(input: RenderBulletinInput): Promise<RenderedAsset>;
}

The renderer consumes structured render data, not database entities directly.

Flow:

Bulletin
   ↓
Render mapper
   ↓
Render model
   ↓
Template
   ↓
Renderer
   ↓
PNG

Rendering must remain deterministic.

UI components must not be reused as hidden business logic for image rendering unless explicitly designed for deterministic export.

Details belong in rendering-engine.md.

13. Persistence

SQLite is the source of truth for application state.

Initial persistence categories:

Competitions
Teams
Competition/team associations
Provider references
Markets
Fixtures
Bulletins
Bulletin selections
Template versions
Synchronization metadata

Schema details belong in data-model.md.

Use migrations from the beginning.

Never rely on automatic destructive schema synchronization.

14. Assets

Local assets may include:

assets/
├── branding/
├── teams/
├── competitions/
├── templates/
└── placeholders/

External images should be cached locally when permitted.

Rendering must define fallbacks for unavailable assets.

No renderer should fail only because a logo is missing.

15. Validation

Validate data at system boundaries.

Use Zod for:

API requests
Form submissions where shared schemas are useful
Environment variables
External provider payload normalization where appropriate

Domain rules remain domain rules and must not exist only in validation schemas.

16. Error Model

Prefer typed application/domain errors.

Example categories:

ValidationError
NotFoundError
ConflictError
ProviderError
RateLimitError
RenderingError
PersistenceError

Infrastructure errors must not leak raw provider/database implementation details into the UI.

Do not catch errors only to silently ignore them.

17. Configuration and Secrets

Use environment variables for secrets.

Required pattern:

.env
.env.example

.env must be ignored by Git.

Never:

Commit API keys
Log complete API keys
Send server secrets to the frontend
Hardcode credentials

Environment variables must be validated at startup.

18. API Request Strategy

Avoid unnecessary external requests.

Prefer:

local data
    ↓
cache validity check
    ↓
manual/required synchronization
    ↓
provider request

Initial refresh strategy should favor explicit user-triggered synchronization.

Auto-refresh may be implemented only where justified.

LIVE polling must stop when no longer required.

Provider quotas should be tracked when response metadata makes this possible.

19. Testing Strategy
Unit tests

Required for:

Market evaluation
Bulletin status aggregation
Domain rules
Text/layout calculations where deterministic
Provider normalization where relevant
Integration tests

Required for:

Repositories
Database migrations
Synchronization services
Application use cases
End-to-end tests

Use only for high-value user flows.

Examples:

Create bulletin
Edit bulletin
Set result
Export bulletin

Avoid testing every UI detail through E2E.

Use the lowest-cost test level capable of validating the behavior.

20. Quality Gates

Before completing an implementation task, the project should pass:

lint
typecheck
test
build

Relevant E2E tests should also run when applicable.

GitHub CI must eventually execute the same quality gates.

21. Performance

Optimize only meaningful paths.

Priorities:

Avoid repeated API requests.
Cache external data and assets.
Avoid unnecessary React re-renders.
Keep rendering deterministic.
Use database indexes for actual query patterns.

Do not add distributed caches, queues or background infrastructure to the initial local application.

22. Dependency Policy

Prefer:

Platform/browser/Node capability
Existing project dependency
Small mature dependency
New complex dependency only when justified

Before adding a dependency, determine whether it materially reduces complexity.

Avoid overlapping libraries that solve the same problem.

23. Code Principles

Required:

TypeScript strict mode
Small cohesive modules
Explicit interfaces at architectural boundaries
Named domain concepts
No duplicated business rules
No hidden network calls
No business logic inside presentation components
No provider-specific types outside adapters
No ORM-specific models outside infrastructure

Prefer readable code over clever abstractions.

Do not introduce abstraction until there is a clear architectural reason.

24. Local-First Principle

Initial architecture must remain intentionally simple.

Do not add:

Authentication
Authorization
Redis
Message queues
Containers as a runtime requirement
Kubernetes
Microservices
Cloud databases

unless the product requirements change.

A future online version may replace infrastructure adapters while preserving Domain and Application logic.

25. Decision Priority

When implementation decisions conflict, use this order:

Product correctness
Existing documented specification
Domain integrity
Simplicity
Testability
Maintainability
Performance
Future extensibility

Do not optimize for hypothetical future requirements at the cost of current simplicity.
```
