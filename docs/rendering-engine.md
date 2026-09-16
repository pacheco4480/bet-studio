# Bet Studio — Rendering Engine

## 1. Purpose

The Rendering Engine generates deterministic social-media bulletin graphics from structured bulletin data.

Primary goals:

- Professional and consistent visual output.
- Deterministic rendering.
- Exact historical re-rendering.
- Dynamic support for 1 to 10 selections.
- Stable layout across PENDING, GREEN, RED, VOID and MANUAL states.
- Independent text fitting per selection.
- Reliable export at fixed social-media dimensions.
- No dependency on AI image generation.

The renderer must consume structured render data and a specific template version.

Detailed persistence rules belong to `data-model.md`.

Phase 07 implements the first production renderer as:

- `FEED` only, exactly `1080 × 1350`.
- Dedicated `BulletinRenderModel` mapped from persisted bulletin snapshots.
- Declarative `BETSTUDIO_FEED` template version `1`.
- Renderer version `1`.
- HTML/CSS fixed canvas exported through Playwright Chromium.
- Canonical SHA-256 fingerprint over render model, template, renderer version,
  format, canvas, locale and timezone.
- PNG files stored in the controlled local `exports/renders/` directory.
- Successful exports persisted as `RenderRecord` metadata.

Story export remains deferred.

---

## 2. Core Principles

The renderer must follow these rules:

1. Same render input + same template version = same output layout.
2. Rendering must not depend on external APIs.
3. Rendering must not depend on runtime internet access.
4. All required assets should be local or cached.
5. Dynamic text must never overflow its allocated region.
6. One long team name must not resize unrelated selections.
7. Status updates must not shift unrelated layout elements.
8. Fixed brand regions must remain stable.
9. Market text must always be displayed.
10. All selections must remain inside the main content container.
11. Maximum selection count is 10.
12. Rendering rules must be explicit and testable.
13. No AI/LLM/image-generation call may determine final layout geometry.

---

## 3. Initial Output Formats

### Instagram Feed

Initial required output:

```text
1080 × 1350 px
Aspect ratio: 4:5

Identifier:

FEED
Instagram Story

Future-compatible output:

1080 × 1920 px
Aspect ratio: 9:16

Identifier:

STORY

Version 1 must prioritize FEED.

Do not duplicate all rendering logic for STORY.

Shared components and layout rules should be reused where possible.

4. Rendering Boundary

Conceptual application port:

interface BulletinRenderer {
  render(input: RenderBulletinInput): Promise<RenderedAsset>;
}

The renderer must receive a dedicated render model.

It must not receive raw database rows.

Flow:

Domain bulletin
      ↓
Render mapper
      ↓
RenderBulletinModel
      ↓
Template version
      ↓
Layout engine
      ↓
Renderer
      ↓
PNG
5. Render Input

Conceptual model:

type RenderBulletinInput = {
  format: 'FEED' | 'STORY';

  bulletin: RenderBulletinModel;

  template: RenderTemplateVersion;

  outputPath?: string;
};

Conceptual bulletin model:

type RenderBulletinModel = {
  publicCode: string;

  type: 'SINGLE' | 'MULTI';
  mode: 'PRE_MATCH' | 'LIVE';

  overallStatus:
    | 'PENDING'
    | 'GREEN'
    | 'RED'
    | 'VOID'
    | 'MANUAL';

  stake: string | null;
  totalOdd: string | null;

  createdAt: string;

  selections: RenderSelectionModel[];

  display: {
    showCompetition: boolean;
    showDate: boolean;
    showTime: boolean;
    showStake: boolean;
    showTotalOdd: boolean;
    showResult: boolean;
    showBulletinCode: boolean;
    showOverallStatus?: boolean;
    showTeamLogos?: boolean;
    templateTheme?:
      | 'LIME'
      | 'ELECTRIC'
      | 'MONO'
      | 'CHAMPIONS'
      | 'EUROPA'
      | 'CONFERENCE';
    footerText?: string;
  };
};
6. Render Selection Model
type RenderSelectionModel = {
  position: number;

  homeTeamName: string;
  awayTeamName: string;

  homeTeamLogoPath: string | null;
  awayTeamLogoPath: string | null;

  competitionName: string | null;

  marketName: string;

  odd: string;

  kickoffDate: string | null;
  kickoffTime: string | null;

  status:
    | 'PENDING'
    | 'GREEN'
    | 'RED'
    | 'VOID'
    | 'MANUAL';

  result: {
    homeScore: number | null;
    awayScore: number | null;
  } | null;

  liveMinute?: number | null;
};

Render values should already be presentation-ready where practical.

The renderer should not contain football-domain settlement logic.

7. Template Model

Templates define visual rules.

Conceptual structure:

type RenderTemplateVersion = {
  templateCode: string;
  version: number;

  format: 'FEED' | 'STORY';

  canvas: CanvasConfig;

  regions: TemplateRegions;

  typography: TypographyConfig;

  colors: ColorTokens;

  spacing: SpacingTokens;

  assets: TemplateAssets;

  layoutModes: LayoutModeConfig[];
};

A template version must be immutable once referenced by a saved bulletin.

8. Template Variants

Do not create independent templates for every possible combination.

Initial master variants:

SINGLE
MULTI
LIVE_SINGLE
LIVE_MULTI

Competition-specific visuals should use optional theme accents instead of entirely separate layouts.

Examples:

Champions League
Europa League
Conference League
Domestic leagues
National teams

Theme accents may affect:

secondary accent color;
subtle background motif;
competition badge treatment;
decorative line/pattern.

They must not change core layout geometry unpredictably.

9. Initial Brand Direction

The initial OwlClub visual identity should use:

Black / near-black as dominant background.
White / off-white for primary information.
Lime as high-priority accent.
Purple as secondary brand accent.
Controlled use of gradients, glow or texture.
Premium football analytics / sports editorial aesthetic.
Avoid generic gaming/esports overload.

The current OwlClub identity should remain recognizable through:

Owl logo.
Lime accent.
Purple secondary accent.
Dark base.

Exact hexadecimal values may be defined later in the template config.

Do not hardcode colors inside components.

Use semantic tokens.

10. Semantic Color Tokens

Example:

type ColorTokens = {
  background: string;
  surface: string;
  surfaceElevated: string;

  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  accentPrimary: string;
  accentSecondary: string;

  statusPending: string;
  statusGreen: string;
  statusRed: string;
  statusVoid: string;
  statusManual: string;

  divider: string;
  border: string;
};

Components should reference semantic tokens, not raw colors.

11. Main Layout Regions

The FEED canvas should conceptually contain:

┌──────────────────────────────┐
│                              │
│          HEADER              │
│                              │
├──────────────────────────────┤
│                              │
│                              │
│     SELECTION CONTAINER      │
│                              │
│                              │
├──────────────────────────────┤
│                              │
│          SUMMARY             │
│                              │
├──────────────────────────────┤
│          FOOTER              │
└──────────────────────────────┘

Exact dimensions belong to template configuration.

12. Header Region

May contain:

OwlClub logo.
Bulletin type.
PRE_MATCH / LIVE indicator.
Bulletin public code.
Optional competition context.
Optional date.

Header elements must remain stable when selection results change.

Logo must never scale based on selection count.

13. Selection Container

The selection container is the primary dynamic region.

Requirements:

Contains all selections.
Supports 1 to 10 selections.
Must never exceed its bounding rectangle.
Uses deterministic density modes.
Internal card size may vary by mode.
Selection ordering follows position.
Cards must never reorder automatically.
14. Selection Card Anatomy

Each selection card should reserve consistent logical regions:

┌────────────────────────────────────────┐
│ Competition / time (optional)          │
│                                        │
│ [Logo] Team A    VS    Team B [Logo]   │
│                                        │
│ Market                         Odd     │
│                                        │
│ Result / Live info        [STATUS]     │
└────────────────────────────────────────┘

Exact visual arrangement may evolve, but the logical regions must remain explicit.

Mandatory content:

Home team.
Away team.
Market.
Odd.
Status region.

Optional content:

Competition.
Date.
Time.
Score/result.
Live minute.
15. Status Reservation

Every selection must reserve status space from the first render.

Initial state:

PENDING

Later:

GREEN
RED
VOID
MANUAL

must use the same reserved status region.

Changing status must not move:

team names;
logos;
market;
odd;
neighboring cards.

Status may be represented by:

icon;
badge;
symbol;
short label;
accent treatment.

But its bounding box must remain stable.

16. Overall Status Region

The bulletin may also display an overall status.

It must use a reserved region where enabled.

Examples:

PENDING
GREEN
RED
VOID
MANUAL

Changing overall status must not reflow the selection container.

17. Dynamic Layout Modes

The renderer should use density modes based on selection count.

Recommended initial mapping:

1       → HERO
2–3     → LARGE
4–6     → MEDIUM
7–8     → COMPACT
9–10    → ULTRA_COMPACT

These names are implementation concepts, not UI labels.

Exact card heights, padding and typography sizes belong to template configuration.

The renderer must not calculate arbitrary free-form layouts for each render.

It should select a predefined deterministic mode.

18. Layout Mode Configuration

Conceptual structure:

type LayoutModeConfig = {
  id:
    | 'HERO'
    | 'LARGE'
    | 'MEDIUM'
    | 'COMPACT'
    | 'ULTRA_COMPACT';

  minSelections: number;
  maxSelections: number;

  cardHeight: number;
  cardGap: number;

  teamFontSize: number;
  teamFontMinSize: number;

  marketFontSize: number;
  marketFontMinSize: number;

  metadataFontSize: number;

  logoSize: number;

  cardPaddingX: number;
  cardPaddingY: number;
};

Avoid magic numbers scattered across rendering components.

19. Vertical Layout Calculation

Conceptual calculation:

availableHeight =
  selectionContainerHeight
  - totalGaps

cardHeight =
  predefined mode value

The chosen layout mode must guarantee:

(cardHeight × selectionCount)
+
(gap × (selectionCount - 1))
<= selectionContainerHeight

If a template configuration violates this invariant, rendering should fail validation before export.

Do not silently clip selections.

20. Team Name Fitting

Team names must be fitted independently.

Priority:

1. Use preferred font size.
2. Reduce font size down to configured minimum.
3. Reduce letter spacing within configured limits if supported.
4. Apply approved fallback behavior.

A long name in one card must not alter font sizing in another card.

Example:

Borussia Mönchengladbach

may render smaller than:

Porto

within the same bulletin.

21. Team Name Overflow

Preferred initial policy:

single line

Do not truncate team names silently unless explicitly configured.

Preferred strategy:

fit full name
→ shrink font
→ reduce tracking
→ use approved shortName only if configured
→ fail/flag preview if impossible

Do not automatically invent abbreviations.

If a team has a stored shortName, the render configuration may explicitly allow fallback to it.

22. Text Fitting Algorithm

Text fitting must be deterministic.

Conceptual function:

fitText({
  text,
  fontFamily,
  fontWeight,
  maxWidth,
  preferredSize,
  minSize,
  maxTrackingReduction
})

Conceptual algorithm:

measure at preferred size
      ↓
fits?
 ┌────┴────┐
yes       no
 ↓          ↓
use      decrease size
            ↓
          fits?
            ↓
       continue until min
            ↓
      adjust tracking
            ↓
     approved fallback

Never use random scaling.

23. Market Text Fitting

Market text must always be visible.

Market fitting must be independent from team-name fitting.

Priority:

1. Full market label.
2. Reduce market font size.
3. Use configured compact market label if available.
4. Wrap only when template explicitly permits it.

Do not omit market text.

Examples of optional compact labels:

Ambas Marcam
Mais de 2.5
1 + Mais de 2.5

Compact labels should be explicitly stored/configured, not generated automatically by AI.

24. Odd Display

Each selection must display its odd.

Odd formatting should be prepared before rendering.

Examples:

1.55
2.10
12.50

The renderer should not perform domain arithmetic.

Odd region should use a fixed width where practical to avoid layout movement.

25. Total Odd

For MULTI bulletins, total odd may be displayed when enabled.

Example:

ODD TOTAL
8.47

The renderer receives the already calculated display value.

Changing total odd must not alter selection geometry.

26. Team Logos

Each team logo must be rendered inside a fixed container.

Requirements:

Preserve aspect ratio.
Never stretch.
Center inside container.
Use contain behavior.
Respect maximum width and height.
Use deterministic padding.

Conceptually:

object-fit: contain

If logo is missing:

use local fallback asset

Rendering must not fail solely because a team logo is unavailable.

27. Logo Normalization

Source logos may have very different dimensions.

Normalization container:

fixed width
fixed height
transparent background
center aligned
contain

Do not modify the original logo aspect ratio.

Do not dynamically enlarge unusually narrow logos beyond the configured container.

28. OwlClub Logo

The OwlClub logo is a fixed brand element.

Requirements:

Local asset.
Stable size and position.
Preserve aspect ratio.
Must not be loaded from the internet at render time.
Must not be regenerated by AI.
Template may define light/dark/compact variants if needed.
29. Competition Logos

Competition logos are optional.

If enabled:

use fixed container;
preserve aspect ratio;
use local cached asset;
fall back safely when unavailable.

Missing competition logo must not hide the competition name.

30. Live Mode

LIVE templates may display:

LIVE badge.
Current score.
Match minute.
Live-specific accent.

Example:

LIVE • 67'
2–1

LIVE information must use reserved regions.

Changes from:

65'

to:

90+4'

must not cause unrelated layout reflow.

31. Result Display

When enabled, result may be shown after settlement.

Example:

2–1

or another approved format.

The result region must exist even when PENDING if the template requires later historical re-rendering without layout change.

Pending state may render:

–

or remain visually empty inside the reserved region.

32. Optional Fields

Supported initial display toggles:

showCompetition
showDate
showTime
showStake
showTotalOdd
showResult
showBulletinCode
showOverallStatus
showTeamLogos
templateTheme
footerText

Hiding an optional field must follow template-defined behavior.

It must not trigger arbitrary full-layout reflow.

Two acceptable strategies:

Reserved

Hide visual content but preserve region.

Controlled collapse

Collapse only a specifically defined optional sub-region.

The template must explicitly define which behavior applies.

33. Stable Structural Regions

These elements should generally not move based on toggles:

main header;
selection container;
summary container;
footer;
status regions.

Optional content should adapt inside these fixed structural regions.

34. Typography Tokens

Typography must be centralized.

Conceptual model:

type TypographyConfig = {
  primaryFontFamily: string;
  fallbackFontFamilies: string[];

  weights: {
    regular: number;
    medium: number;
    semibold: number;
    bold: number;
  };

  roles: {
    title: TextStyle;
    team: TextStyle;
    market: TextStyle;
    odd: TextStyle;
    metadata: TextStyle;
    status: TextStyle;
    summary: TextStyle;
  };
};

Do not hardcode font styles inside individual cards.

35. Font Requirements

Fonts used by deterministic rendering must:

be locally available;
have known files/weights;
not depend on remote Google Fonts at render time;
have explicit fallbacks;
render consistently in the chosen renderer.

Font loading failure should fail clearly during development rather than silently substituting an unpredictable system font.

36. Spacing Tokens

Spacing must use a centralized scale.

Example:

type SpacingTokens = {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
};

Avoid arbitrary spacing values across components.

Layout modes may reference token values or explicit template values.

37. Decorative Assets

The design may use local decorative assets such as:

subtle textures;
gradients;
line patterns;
background shapes;
glow masks;
competition motifs.

These may originate from:

Illustrator;
Photoshop;
Figma;
manually prepared SVG/PNG assets.

They must remain separate from dynamic text/data.

Do not use one flattened image containing dynamic UI elements.

38. Background Strategy

A template background may include:

base color
+
gradient
+
texture
+
decorative vector shapes

But dynamic content must remain independently rendered.

A static background must not contain:

team names;
odds;
markets;
scores;
dates;
statuses.
39. SVG Preference

Prefer SVG for:

icons;
simple shapes;
status symbols;
lines;
decorative vectors;
geometric background elements.

Benefits:

resolution independence;
deterministic geometry;
small assets;
easy theming.

Use raster assets where SVG is impractical, such as textured artwork.

40. Status Visual Tokens

Each status should have a semantic visual treatment.

PENDING

Neutral.

GREEN

Success.

Should preferably reuse or harmonize with OwlClub lime.

RED

Failure.

Use a controlled premium red/coral rather than an excessively saturated alert style.

VOID

Neutral muted state.

MANUAL

Distinct but non-alarming state.

Exact colors belong to template tokens.

Do not hardcode status colors in selection components.

41. Status Icons

Status icons should be local deterministic assets or SVG paths.

Possible semantics:

PENDING → clock / neutral dot
GREEN   → check
RED     → cross
VOID    → minus / slash
MANUAL  → hand/edit/info indicator

Final iconography should remain visually consistent.

Icon bounding boxes must remain identical across states.

42. Competition Theme Accents

Optional competition themes may be represented by configuration:

type CompetitionTheme = {
  code: string;

  accentColor?: string;
  secondaryAccentColor?: string;

  backgroundAsset?: string;
  motifAsset?: string;
};

Themes must never contain competition-specific business logic.

If no theme is available:

use default OwlClub theme
43. Rendering Technology

Implementation must favor deterministic output.

Recommended strategies:

Preferred
SVG-based render tree
→ deterministic rasterization
→ PNG

or:

HTML/CSS render surface
→ controlled headless browser
→ screenshot/export

The final choice should prioritize:

reliable font measurement;
predictable layout;
local asset support;
testability;
exact pixel dimensions;
stable PNG export.

Do not select a rendering library solely because it is fashionable.

44. Renderer Selection Criteria

The implementation choice must be evaluated against:

Exact 1080×1350 output.
Stable typography.
Local font loading.
SVG support.
PNG export.
Deterministic measurements.
Fast local rendering.
Testability.
Cross-platform reliability.
Minimal unnecessary dependencies.

The chosen implementation should be documented after validation.

45. Avoid Canvas-Only Business Layout Logic

If Canvas is used, avoid scattering raw drawing coordinates throughout imperative code.

Prefer declarative components/layout primitives.

Bad:

ctx.fillText(...);
ctx.fillText(...);
ctx.drawImage(...);

repeated across large monolithic functions.

Prefer:

Template
→ layout model
→ reusable render components
→ renderer
46. Layout Primitives

Useful conceptual primitives:

Canvas
Region
Stack
Row
Column
Box
Text
Image
Divider
Badge
Icon

The implementation does not need to create an overengineered custom UI framework.

Use primitives only where they meaningfully reduce duplicated geometry.

47. Deterministic Measurement

Text and geometry must be measured before final drawing.

Do not:

draw first
then guess whether it overflowed

Prefer:

measure
→ choose size
→ validate bounds
→ draw
48. Layout Validation

Before export, validate:

all cards inside selection container
all mandatory text regions fit
no negative dimensions
no card overlap
no out-of-bounds logos
status regions valid
canvas dimensions exact

Rendering should fail with a structured RenderingError if a mandatory invariant is violated.

Do not export visibly clipped output silently.

49. Overflow Debug Mode

Development mode may optionally expose visual diagnostics:

region outlines;
bounding boxes;
text bounds;
overflow warnings;
layout mode identifier.

This must not appear in production exports.

A debug render mode can significantly simplify template tuning.

50. Render Determinism

Rendering must not depend on:

current timestamp unless explicitly part of render data;
random numbers;
network responses;
system locale defaults;
system timezone defaults;
remote font loading;
non-versioned templates.

Explicit input must determine output.

51. Date and Time Formatting

Date/time values must be formatted before or through explicit locale configuration.

Never depend on machine defaults.

Example configured locale:

pt-PT

Example date:

10 SET 2026

Example time:

20:45

Exact display format belongs to template configuration.

52. Number Formatting

Odds and stake must use explicit formatting.

Never depend on runtime locale implicitly.

Examples:

1.85
8.42
€10
€10,00

The chosen format should be consistent within a template.

53. Export

Initial export format:

PNG

Required:

exact dimensions
sRGB-compatible output where practical
no browser chrome
no transparent accidental margins

Suggested filename format:

BET-0001-feed-pending.png
BET-0001-feed-green.png

or equivalent deterministic naming.

Do not overwrite an existing historical export silently unless explicitly requested.

54. Preview vs Export

The application preview may be displayed at a scaled size.

Example:

540 × 675

while retaining the logical target:

1080 × 1350

Preview scaling must not alter actual render geometry.

Preferred architecture:

same render model
same layout
different display scale

Do not implement a separate approximation of the layout for preview.

55. Render Record

A successful export may store:

bulletin ID
template ID
template version
output format
file path
creation timestamp

Persistence details belong to data-model.md.

56. Historical Re-Rendering

A historical bulletin must render from:

bulletin data
+
selection snapshots
+
result snapshots
+
render config
+
template version
+
local assets

It must not fetch current:

team names;
competition names;
provider logos;
market labels;
API results

unless the user explicitly requests a refresh/update operation.

57. Template Versioning

Example:

owlclub-multi
v1

Later visual redesign:

owlclub-multi
v2

Existing bulletins using v1 remain associated with v1.

Do not mutate v1 destructively after it is used historically.

58. Template Validation

A template version should be validated when created/loaded.

Check:

required regions;
supported format;
valid dimensions;
non-overlapping structural regions where required;
valid layout mode ranges;
valid font settings;
required assets;
valid color tokens.

Invalid templates must fail early.

59. Layout Mode Coverage

Mode ranges must cover exactly:

1..10 selections

without gaps or overlaps.

Example valid configuration:

HERO          1
LARGE         2–3
MEDIUM        4–6
COMPACT       7–8
ULTRA_COMPACT 9–10

Invalid:

LARGE 2–4
MEDIUM 4–6

because selection count 4 is ambiguous.

60. SINGLE Bulletin

A SINGLE bulletin should use dedicated visual emphasis.

Typical goals:

Larger team logos.
Larger team names.
More breathing room.
More prominent odd.
Stronger focal hierarchy.

It may still reuse the same selection-card primitives.

Do not implement SINGLE as a completely unrelated rendering system.

61. MULTI Bulletin

MULTI prioritizes scanability.

Requirements:

Clear separation between selections.
Consistent card rhythm.
Visible market and odd.
Team identity remains legible.
Compact modes preserve hierarchy.

Maximum:

10 selections

No pagination in one feed bulletin.

62. LIVE SINGLE

LIVE SINGLE should emphasize:

LIVE state;
current score;
minute;
selected market;
odd.

It should retain the OwlClub core identity.

63. LIVE MULTI

LIVE MULTI should support current information for multiple matches without becoming visually noisy.

Each card may display:

LIVE badge
minute
score

inside reserved metadata/result regions.

Do not use excessive flashing or animated visual effects in static exports.

64. Visual Hierarchy

Suggested priority:

1. Match / teams
2. Market
3. Odd
4. Status
5. Competition / time metadata
6. Supporting branding

Branding should be recognizable without overpowering betting information.

65. Information Density

As selection count increases:

Reduce:

card padding;
logo size;
team font size;
metadata font size;
decorative whitespace.

Preserve:

hierarchy;
readability;
mandatory market;
mandatory odd;
status region;
team identity.

Do not solve density only by shrinking everything uniformly.

66. Accessibility and Legibility

Even though output is social-media artwork, basic accessibility principles still apply:

sufficient contrast;
avoid tiny critical text;
do not communicate GREEN/RED status only by color;
use icon/symbol plus color;
avoid excessively thin fonts;
avoid text over visually noisy texture without contrast support.
67. Minimum Text Sizes

Each template/layout mode must define explicit minimum text sizes.

If mandatory text cannot fit at the minimum:

render validation fails

or an approved fallback is used.

Never continue shrinking indefinitely.

68. Approved Fallbacks

Possible explicit fallbacks:

Team
fullName
→ shortName

only when shortName exists and template allows it.

Market
fullLabel
→ compactLabel

only when explicitly configured.

Metadata

Optional metadata may be hidden only if the render configuration/template explicitly permits it.

Mandatory information must never disappear automatically.

69. No AI Text Rewriting During Render

The renderer must not ask AI to shorten:

team names;
competitions;
markets;
labels.

All compact alternatives must already be defined in structured data/configuration.

This preserves reproducibility.

70. Asset Failure Behavior
Missing team logo
fallback team icon
Missing competition logo
omit image / use placeholder while preserving name
Missing decorative asset

If non-critical:

continue with defined fallback
Missing required brand asset
RenderingError
Missing required font
RenderingError

Do not silently substitute major brand assets.

71. Renderer Errors

Suggested structured errors:

INVALID_TEMPLATE
UNSUPPORTED_FORMAT
SELECTION_COUNT_OUT_OF_RANGE
TEXT_OVERFLOW
MISSING_REQUIRED_ASSET
FONT_LOAD_FAILED
LAYOUT_OVERFLOW
EXPORT_FAILED

Errors should contain useful development context without exposing unnecessary filesystem details in user-facing UI.

72. Render Performance

The application is local-first, so correctness matters more than premature micro-optimization.

Still:

load fonts once where practical;
cache reusable assets;
avoid decoding the same logo repeatedly;
avoid network dependencies;
avoid unnecessary full re-renders while editing.

Preview rendering may use debouncing.

73. Preview Update Strategy

During bulletin editing:

input change
   ↓
validate render model
   ↓
debounce when appropriate
   ↓
update preview

Do not export a PNG to disk on every keystroke.

Preview and final export may share the same layout engine while using different output paths.

74. Testing Strategy

Rendering requires more than ordinary unit tests.

Use:

Unit tests

For:

layout mode selection;
text fitting;
bounds calculations;
status region logic;
filename generation;
template validation.
Integration tests

For:

full render generation;
font loading;
local assets;
PNG dimensions;
template version loading.
Visual regression tests

Recommended for key reference cases.

75. Visual Regression Fixtures

Maintain a small curated fixture set.

Recommended reference renders:

1 selection
3 selections
6 selections
8 selections
10 selections

Include difficult text cases:

very long home team
very long away team
long market label
missing team logo
LIVE 90+4'
large odd value

Also test statuses:

PENDING
GREEN
RED
VOID
MANUAL
76. Golden Image Testing

If stable across the chosen renderer/environment, selected reference renders may use golden image comparisons.

Do not create golden screenshots for every possible combination.

Focus on high-value canonical cases.

Allow only documented intentional updates to reference images.

77. Geometry Tests

Examples:

10 selections fit inside container
cards never overlap
status bounds remain constant across statuses
team logo stays inside image box
team text remains inside max width
market remains visible
canvas equals target dimensions

These tests are often more robust than full pixel-diff tests.

78. Determinism Test

At minimum, test:

render(input, template v1)
render(input, template v1)

produces equivalent layout/output under the same controlled environment.

If byte-identical PNG output cannot be guaranteed due to renderer metadata, deterministic geometry and visual equivalence must still be validated.

79. Suggested Renderer Source Structure
src/renderer/
├── renderer.ts
├── render-model.ts
│
├── templates/
│   ├── template-registry.ts
│   ├── template-validator.ts
│   └── owlclub/
│
├── layout/
│   ├── layout-engine.ts
│   ├── layout-mode.ts
│   ├── bounds.ts
│   └── text-fit.ts
│
├── components/
│   ├── bulletin-header.ts
│   ├── selection-card.ts
│   ├── team-logo.ts
│   ├── status-badge.ts
│   ├── summary.ts
│   └── footer.ts
│
├── assets/
│   ├── asset-loader.ts
│   └── font-loader.ts
│
├── export/
│   └── png-exporter.ts
│
└── __tests__/

Exact structure may be simplified if the chosen rendering library makes another organization clearer.

Do not create unnecessary abstraction layers merely to match this tree exactly.

80. Initial Template Family

Recommended template codes:

OWLCLUB_SINGLE
OWLCLUB_MULTI
OWLCLUB_LIVE_SINGLE
OWLCLUB_LIVE_MULTI

Product name remains:

Bet Studio

OwlClub is the initial bulletin brand/theme, not the application name.

81. Initial Rendering Acceptance Criteria

The rendering implementation is complete when:

FEED exports exactly 1080×1350.
1 through 10 selections render without overflow.
Market always appears.
Odd always appears.
Team names adapt independently.
Team logos preserve aspect ratio.
Missing team logos use fallback.
Status space remains stable across all status changes.
PENDING → GREEN/RED/VOID does not shift unrelated content.
SINGLE and MULTI have appropriate density.
LIVE variants support score/minute regions.
Preview uses the same core layout logic as export.
Historical bulletin renders use saved template versions.
Renderer requires no external API.
Renderer requires no AI generation.
Template values are centralized rather than scattered magic numbers.
Text-fitting behavior is deterministic.
Required rendering tests pass.
Project quality gates pass.
82. Guiding Principle

The Rendering Engine should behave more like a deterministic publishing system than an AI image generator.

Prefer:

structured data
+
versioned template
+
explicit layout rules
+
local assets
+
deterministic text fitting

over:

prompt
+
generated image
+
manual correction

The visual result may be creative.

The rendering behavior must not be unpredictable.
```
