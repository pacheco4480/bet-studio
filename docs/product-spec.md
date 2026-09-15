# Bet Studio — Product Specification

## 1. Purpose

Bet Studio is a local-first application for creating, managing, evaluating and exporting football betting bulletins for social media.

The application must remain usable without any external API. External football-data providers are optional synchronization sources, not runtime dependencies.

Primary goals:

- Fast bulletin creation.
- Consistent professional visual output.
- Deterministic rendering.
- Manual and API-assisted football data management.
- Automatic settlement of supported betting markets.
- Exact re-rendering of historical bulletins.
- Modular architecture suitable for extension and portfolio review.

Out of scope for the initial version:

- User accounts.
- Cloud deployment.
- Multi-user support.
- Payments.
- Public betting tips platform.
- Automatic bet placement.
- Social network publishing.
- Mobile native applications.

---

## 2. Core Concepts

### Bulletin

A publishable betting graphic.

Types:

- SINGLE
- MULTI

Modes:

- PRE_MATCH
- LIVE

A bulletin contains one or more selections.

Maximum selections per bulletin:

- 10

### Selection

One football match and its associated betting market.

Required:

- Home team
- Away team
- Market
- Odd

Optional:

- Competition
- Match date
- Match time
- Fixture reference
- Score
- Stake
- Live minute
- Additional result information

### Status

Supported selection states:

- PENDING
- GREEN
- RED
- VOID
- MANUAL

Meaning:

- PENDING: result not yet evaluated.
- GREEN: selection won.
- RED: selection lost.
- VOID: selection cancelled/void.
- MANUAL: automatic evaluation is unavailable or insufficient.

Bulletin status is derived from its selections where possible.

---

## 3. Bulletin Workflow

Primary flow:

1. Create bulletin.
2. Choose SINGLE or MULTI.
3. Choose PRE_MATCH or LIVE.
4. Add one or more selections.
5. Select or enter competition.
6. Select or enter teams.
7. Select market.
8. Enter odd.
9. Configure optional display fields.
10. Preview bulletin.
11. Save bulletin.
12. Export image.
13. Later enter or synchronize match results.
14. Evaluate selections.
15. Confirm or override result if necessary.
16. Re-render using the exact same template and layout configuration.

Saved bulletins must remain editable.

Historical bulletins must support:

- Open
- Edit
- Duplicate
- Evaluate
- Re-render
- Export

Duplicating creates a new bulletin with a new ID.

---

## 4. Competition Management

The application must provide local CRUD for competitions.

Competition fields:

- ID
- Name
- Short name
- Country/region
- Active state
- Optional external provider IDs
- Optional logo
- Created timestamp
- Updated timestamp

Capabilities:

- Create
- Edit
- Activate/deactivate
- Delete/archive where safe
- View associated teams
- Synchronize from supported providers
- Override synchronized data manually

Manual data always remains supported.

---

## 5. Team Management

The application must provide local CRUD for teams.

Team fields:

- ID
- Name
- Short name
- Country
- Logo
- Active state
- Aliases
- Competition associations
- Optional provider IDs
- Created timestamp
- Updated timestamp

Requirements:

- One team may belong to multiple competitions.
- Team logos must support local files.
- External logos may be cached locally.
- Manual logo override must be possible.
- External provider IDs must never replace internal IDs.

---

## 6. Market Management

The application must provide a local market catalog.

Market fields:

- ID
- Name
- Code
- Category
- Active state
- Auto-evaluable flag
- Evaluation strategy identifier

The market must always be visible in rendered bulletins.

Supported markets will be added incrementally.

Unsupported or insufficiently defined markets must resolve to MANUAL rather than guessing.

The user must be able to manually override any settlement result.

---

## 7. Market Evaluation

The system contains a Market Engine responsible for settlement.

Input may include:

- Market code
- Home score
- Away score
- Match status
- Additional structured result data when required

Output:

- GREEN
- RED
- VOID
- MANUAL

Rules:

- Cancelled/void fixtures may resolve to VOID.
- Unsupported markets resolve to MANUAL.
- Automatic evaluation must be deterministic.
- Market rules must not depend on UI state.
- All supported rules require automated tests.
- Manual override must be stored separately from the calculated result.

For MULTI bulletins:

- Any RED selection makes the bulletin RED.
- If all non-void selections are GREEN, the bulletin is GREEN.
- VOID selections do not count as losing selections.
- If final status cannot be determined automatically, the bulletin remains PENDING or MANUAL as applicable.

Exact financial settlement rules are not required unless explicitly implemented later.

---

## 8. Football Data

Bet Studio is local-first.

Primary operational source:

- Local database

Optional external sources may provide:

- Competitions
- Teams
- Fixtures
- Scores
- Results
- Logos

Initial provider candidates:

- GOAL API
- football-data.org
- OpenFootball
- TheSportsDB

Provider usage must be optional.

The user must be able to operate entirely with manually created local data.

Synchronization requirements:

- Manual refresh controls.
- Last synchronization timestamp.
- Cached provider data.
- Provider failures must not block local features.
- Existing local records must not be silently destroyed.
- Manual overrides take precedence where configured.

LIVE data should not poll continuously by default.

Initial LIVE behavior:

- Manual refresh.
- Optional controlled auto-refresh.
- Auto-refresh active only when needed.
- Avoid unnecessary requests.

---

## 9. Rendering

Bulletins must be generated by a deterministic rendering system.

Target initial format:

- 1080 × 1350 px

Future format:

- 1080 × 1920 px

The renderer must not depend on AI image generation.

The same:

- Bulletin data
- Template version
- Render configuration

must produce the same layout.

The visual system must support:

- OwlClub logo
- Team logos
- Team names
- Market
- Match odd
- Total odd
- Optional competition
- Optional date/time
- Optional stake
- Optional result
- Selection status
- Overall bulletin status
- Bulletin identifier

Status positions must exist from the initial PENDING render so that later GREEN, RED or VOID renders do not move unrelated content.

---

## 10. Adaptive Layout

All selections must remain within the defined content container.

Maximum:

- 10 selections

Layout density adapts according to selection count.

Suggested modes:

- LARGE: few selections
- MEDIUM: medium number of selections
- COMPACT: many selections
- ULTRA_COMPACT: near maximum

Exact thresholds belong to the rendering specification.

Text fitting requirements:

- Team-name font sizing may adapt per selection.
- Long team names must not change font sizes of unrelated selections.
- Market text may adapt independently.
- Prefer one line where possible.
- Never overflow the allocated container.
- Fixed brand elements must not move unpredictably.

---

## 11. Visual States

Required states:

### PENDING

Neutral visual state.

### GREEN

Clear successful state.

### RED

Clear unsuccessful state.

### VOID

Neutral/cancelled state distinct from RED.

### MANUAL

Indicates manual settlement is required.

GREEN, RED and VOID indicators must use reserved layout areas.

Visual treatment is defined in the rendering/design specification.

---

## 12. History

The application must maintain bulletin history.

Required data:

- Bulletin ID
- Creation date
- Type
- Mode
- Number of selections
- Total odd
- Status
- Template version

Capabilities:

- Search
- Filter
- Open
- Edit
- Duplicate
- Re-render
- Export

Result management in history must show calculated, manual and effective
selection statuses. Users can correct fixture result fields, re-evaluate a
selection or the whole bulletin, apply or reset manual settlement overrides and
inspect the resulting audit timeline. Synced fixtures may expose an explicit
provider result refresh before re-evaluation when the provider supports it.

Render history must preserve previous render records and exported artifacts.
Rendering from the current saved bulletin state creates a new render record and
must not overwrite older records.

Deleting historical records should require explicit confirmation.

---

## 13. Analytics

The application may expose local analytics derived from saved bulletins,
selections and settlement state.

Initial analytics should include:

- Bulletin and selection totals.
- Status breakdowns.
- Win rates for settled GREEN/RED records.
- Basic realized stake/return/profit where saved stake and final status are
  available.
- Breakdown by market and competition.

Analytics must not infer or predict future results. Pending and manual records
must remain visibly separate from realized performance.

---

## 14. Settings

Initial settings areas:

- Competitions
- Teams
- Markets
- Data providers
- Templates
- Rendering/export settings

Provider configuration may include:

- Enabled state
- API key status
- Last synchronization
- Rate-limit information when available

Secrets must never be displayed in full after storage.

---

## 15. Error Handling

The application must fail safely.

Examples:

- API unavailable → use local data.
- Missing team logo → use fallback asset.
- Unsupported market → MANUAL.
- Missing score → PENDING.
- Rate limit reached → show informative state and preserve cached data.
- Rendering failure → preserve bulletin data.
- Invalid form data → block submission and display validation errors.

The system must never invent football results or settlement outcomes.

---

## 16. Local-First Constraints

Initial deployment model:

- Single local user
- Local application
- Local SQLite database
- Local asset storage

No authentication is required initially.

Architecture must not unnecessarily optimize for future cloud deployment.

Future migration must remain possible without rewriting domain logic.

---

## 17. Quality Requirements

Required:

- Type safety
- Input validation
- Automated tests
- Deterministic business logic
- Deterministic rendering
- Modular code
- Clear error handling
- No hardcoded secrets
- Reproducible setup
- Linting
- Type checking
- Production build validation

Core business rules must be testable without UI or network access.

---

## 18. Product Principles

Priority order:

1. Correctness
2. Determinism
3. Usability
4. Visual consistency
5. Maintainability
6. Performance
7. Extensibility

Avoid complexity that does not serve the current local-first product.

When uncertain, prefer explicit, testable behavior over implicit automation.
