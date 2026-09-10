You are implementing Phase 07 of Bet Studio:

Deterministic Design / Rendering Engine

Before making changes:

1. Read AGENTS.md.
2. Read docs/architecture.md.
3. Read docs/rendering-engine.md in full.
4. Read docs/product-spec.md only for:
   - bulletin visual requirements;
   - optional display toggles;
   - SINGLE / MULTI;
   - PRE_MATCH / LIVE;
   - status/result presentation;
   - maximum selection count.
5. Read docs/data-model.md only for:
   - Bulletin
   - BulletinSelectionSnapshot
   - SelectionResultSnapshot
   - Asset
   - Template
   - TemplateVersion
   - RenderRecord
6. Read docs/market-engine.md only for effective settlement statuses and their semantics.
7. Inspect the implementation from Phases 01–06.
8. Inspect the existing Bulletin Builder preview and determine what can safely be reused without coupling the renderer to editor state.

Do not read api-integration.md unless an Asset implementation detail requires clarification.

The repository and documentation are the source of truth.

Do not introduce or reference any project identity other than Bet Studio.

---

# Goal

Implement the deterministic bulletin rendering system for Bet Studio.

At the end of this phase, the application must be able to:

- transform a persisted bulletin into a dedicated render model;
- render a deterministic 1080×1350 FEED composition;
- support SINGLE and MULTI bulletins;
- support PRE_MATCH and LIVE visual variants;
- support 1–10 selections;
- keep Market visible for every selection;
- fit long team/market names safely;
- reserve stable status/result geometry;
- use versioned templates;
- use immutable/version-safe local assets;
- use local pinned fonts;
- export PNG;
- record RenderRecord metadata;
- reproduce historical renders from saved immutable inputs;
- calculate and persist a deterministic render fingerprint;
- test geometry/layout behavior;
- test representative golden outputs in a pinned environment.

Do not implement Story export yet.

Do not implement social publishing.

Do not implement AI-generated typography or layout.

---

# 1. Rendering Architecture

The renderer must be isolated from:

- Bulletin Builder form state;
- provider APIs;
- Market Engine execution;
- direct database queries inside visual components;
- network requests;
- external remote assets.

Use a flow conceptually equivalent to:

Persisted Bulletin / Historical Snapshot
↓
Application render-model mapper
↓
Validated Render Model
↓
Versioned Template
↓
Deterministic React/CSS render surface
↓
Playwright / Chromium screenshot
↓
PNG bytes
↓
Export infrastructure + RenderRecord

The renderer consumes already-resolved facts.

It does not fetch or infer missing business data.

---

# 2. Recommended Rendering Technology

Use:

- React;
- HTML;
- CSS;
- fixed logical canvas;
- Playwright Chromium for screenshot/export.

Reuse Playwright already present in the project.

Do not add Puppeteer.

Do not build a custom Canvas drawing engine unless the current implementation already clearly requires it.

Do not build a large SVG layout engine.

HTML/CSS is preferred because:

- preview and export can share logical visual components;
- typography/layout are easier to maintain;
- Chromium provides mature text measurement;
- Playwright already exists in the stack.

---

# 3. Fixed Render Surface

Implement FEED format:

1080 × 1350 px

The logical render root must have exactly these dimensions.

Example conceptually:

width: 1080px;
height: 1350px;

Do not rely on responsive viewport behavior for final export.

The final render surface is fixed.

The management UI may still display it scaled responsively.

---

# 4. Story Format

Do NOT implement 1080×1920 Story rendering in this phase.

Design the format abstraction so another format can be introduced later without rewriting the engine.

But do not:

- create empty Story templates;
- duplicate template files;
- build unused Story layout logic.

FEED only for v1.

---

# 5. Dedicated Render Model

Do not render directly from raw persistence records.

Create a dedicated strongly typed render model.

Conceptually:

type BulletinRenderModel = {
publicCode: string;

type: "SINGLE" | "MULTI";
mode: "PRE_MATCH" | "LIVE";

overallStatus: SettlementStatus;

totalOdd: string;
stake?: string | null;

displayDate?: string | null;

display: {
showCompetition: boolean;
showDateTime: boolean;
showStake: boolean;
showResult: boolean;
showStatus: boolean;
showBulletinId: boolean;
};

selections: RenderSelection[];
};

type RenderSelection = {
position: number;

homeTeam: {
name: string;
shortName?: string | null;
logo?: RenderAssetRef | null;
};

awayTeam: {
name: string;
shortName?: string | null;
logo?: RenderAssetRef | null;
};

competition?: {
name: string;
shortName?: string | null;
logo?: RenderAssetRef | null;
} | null;

market: {
code: string;
label: string;
};

odd: string;

kickoffAt?: string | null;

status: SettlementStatus;

resultText?: string | null;

liveMinute?: number | null;
};

Adapt naming to current project conventions.

Do not include Drizzle types.

Do not include provider DTOs.

---

# 6. Render Model Source

Historical rendering must prefer snapshot data.

Do not rebuild an old bulletin render using current mutable:

- Team names;
- Market labels;
- Competition names;
- Asset paths.

Use the snapshot/versioned data associated with the historical bulletin/render.

For current editable bulletin preview, current aggregate data may be mapped normally.

For historical re-render:

historical snapshot +
TemplateVersion +
immutable assets

must be sufficient.

---

# 7. No Business Logic in Renderer

The renderer must not:

- evaluate markets;
- calculate GREEN / RED;
- resolve manual overrides;
- calculate bulletin aggregate status;
- synchronize fixtures;
- calculate odds from raw selections.

Those values must already be supplied in the render model.

The renderer displays them.

It does not decide them.

---

# 8. Template Architecture

Use one logical template family for FEED v1.

Preferred conceptual structure:

Template:
code = BETSTUDIO_FEED

TemplateVersion:
version = 1

Inside the versioned configuration, support conditional variants for:

- SINGLE + PRE_MATCH;
- MULTI + PRE_MATCH;
- SINGLE + LIVE;
- MULTI + LIVE.

Do not create four independent template identities unless they genuinely require separate lifecycle/versioning.

Avoid template proliferation.

---

# 9. Template Version Immutability

A TemplateVersion referenced by a RenderRecord must be historically immutable.

Normal editing must not mutate an already-used template version in place.

To change observable rendering behavior:

create a new TemplateVersion.

Example:

BETSTUDIO_FEED v1
BETSTUDIO_FEED v2

Historical RenderRecord remains linked to v1.

---

# 10. Renderer Version

Separate renderer implementation version from template version.

For example conceptually:

rendererVersion = 1

Template changes and renderer-engine behavior changes are different concerns.

If observable layout/fitting behavior changes even with the same template data, increment renderer version according to documented policy.

Do not rely solely on Git commit hash as renderer version.

---

# 11. Render Fingerprint

Generate a deterministic fingerprint for render inputs.

The fingerprint should cover all inputs that can affect visual output.

At minimum include:

- bulletin/snapshot data hash;
- template code;
- template version;
- renderer version;
- output format;
- canvas dimensions;
- render configuration;
- immutable asset identifiers/hashes;
- font identifiers/hashes;
- locale;
- timezone policy where relevant.

Use canonical serialization before hashing.

Do not hash ordinary JavaScript object serialization if key ordering is not explicitly controlled.

Use a stable canonical structure.

---

# 12. Fingerprint Purpose

The fingerprint is used to determine whether two render requests represent the same logical render inputs.

It is not a security authentication mechanism.

Do not use it as a secret.

Do not include machine-specific temporary file paths if those paths do not affect visual content.

Prefer asset content hashes/immutable IDs.

---

# 13. Determinism Contract

Define determinism accurately.

Bet Studio must guarantee:

same render model +
same TemplateVersion +
same renderer version +
same immutable assets +
same font files +
same Chromium/render environment +
same locale/timezone/config

→ same layout decisions and visual output.

Do not claim arbitrary cross-platform byte-identical PNG output.

Different operating systems/browser builds may rasterize fonts differently.

For golden tests and reproducible export, use a pinned controlled rendering environment.

---

# 14. Runtime Network Isolation

The rendering process must not require internet access.

During render:

- no provider calls;
- no remote image loading;
- no Google Fonts;
- no CDN CSS;
- no analytics;
- no arbitrary HTTP.

All assets and fonts must be available locally.

Where practical, fail if unexpected network requests occur during rendering tests.

---

# 15. Local Fonts

Use local project-managed fonts.

Do not depend on:

- Google Fonts network loading;
- operating-system-only fonts;
- browser fallback fonts as intentional typography.

Ensure selected font files are legally usable in the project.

Do not commit proprietary font files without appropriate licensing.

If the repository does not yet contain a suitable font, use a redistributable open-source font.

Document the font dependency.

---

# 16. Font Readiness

Before screenshot/export:

wait for fonts to be fully loaded.

Use browser behavior equivalent to:

await document.fonts.ready

Do not screenshot while fallback font rendering may still be active.

Ensure there are no late font swaps.

---

# 17. Animation Disablement

Final render must have no active animation/transitions.

Disable:

- CSS animations;
- transitions;
- blinking cursors;
- animated gradients;
- loaders.

The screenshot must capture a stable visual state.

---

# 18. Locale

Use an explicit locale for rendered text formatting.

Do not depend on host machine/browser default locale.

Follow product language policy.

If current product UI is Portuguese, use the configured explicit locale consistently.

Do not allow implicit locale differences to alter dates/numbers in historical renders.

---

# 19. Timezone

Use an explicit deterministic timezone policy.

Do not render a kickoff differently because the machine happens to run in another timezone.

Follow product-spec/rendering-engine.md.

If rendered fixture dates are intended for a configured local timezone, pass that timezone explicitly into rendering.

Do not use system timezone implicitly.

---

# 20. Render Date vs Creation Date

Do not display `createdAt` as the football/event date unless that is explicitly what the template calls for.

Use:

- explicit displayDate;
- fixture kickoff;
- or another documented field.

Keep creation metadata separate from user-visible sports date.

---

# 21. Asset References

Renderer input must use stable immutable asset references.

Conceptually:

type RenderAssetRef = {
assetId: string;
contentHash: string;
mimeType: string;
resolvedPath: string;
};

The exact implementation may vary.

The important invariant is:

the referenced visual bytes must not change silently later.

Do not use an arbitrary mutable path as historical identity.

---

# 22. Asset Resolution

Resolve Asset records outside the presentational visual component.

Example flow:

snapshot asset reference
→ infrastructure asset resolver
→ validated local render asset descriptor
→ renderer

React rendering components should not query SQLite directly.

---

# 23. Asset Validation

Before rendering an asset:

- ensure it exists;
- ensure supported MIME/format;
- verify expected hash where available;
- enforce safe local path resolution;
- reject directory traversal.

Do not render arbitrary filesystem paths supplied from client input.

---

# 24. Missing Assets

Missing logos must not crash the entire render unnecessarily.

Provide deterministic fallback behavior.

Examples:

- neutral team initials;
- generic placeholder;
- no logo within a reserved logo region.

Use the same fallback every time.

Do not fetch a remote replacement during rendering.

---

# 25. Visual Direction

Implement the established Bet Studio design direction:

- premium;
- modern;
- dark;
- football analytics/betting aesthetic;
- black/off-black base;
- strong white typography;
- restrained accent usage;
- controlled status color;
- clear hierarchy;
- minimal visual clutter.

Do not imitate a specific third-party brand.

Do not overdecorate the composition.

---

# 26. Design Tokens

Centralize rendering design tokens.

Examples:

- canvas dimensions;
- spacing;
- border radius;
- line widths;
- font families;
- font weights;
- size ranges;
- neutral colors;
- status semantic colors;
- accent color;
- panel/background values.

Do not scatter magic numeric values across many React components.

Keep token configuration version-aware where it affects rendering.

---

# 27. Brand Stability

Fixed brand/header/footer elements should remain stable across selection counts.

Do not allow:

1-selection bulletin

to radically reposition permanent branding compared with:

10-selection bulletin

unless the documented layout variant explicitly requires it.

Adaptive density should primarily affect selection content regions.

---

# 28. Primary Canvas Regions

Define clear fixed regions.

Conceptually:

- header / identity;
- metadata;
- selections area;
- totals/summary;
- status/result area;
- footer/decorative region.

Exact geometry belongs to the template version.

Avoid absolutely positioning every tiny text field independently without a layout system.

---

# 29. Layout Density Modes

Support deterministic density modes for 1–10 selections.

Use the documented grouping, for example:

1
→ HERO

2–3
→ LARGE

4–6
→ MEDIUM

7–8
→ COMPACT

9–10
→ ULTRA_COMPACT

Use exact current names/config from rendering-engine.md if different.

The number of selections deterministically chooses a density mode.

Do not dynamically choose random/heuristic templates.

---

# 30. Density Configuration

Each density mode should define controlled values such as:

- card height;
- card gap;
- team-name max font size;
- team-name min font size;
- market font size;
- odd font size;
- logo size;
- metadata spacing;
- vertical padding.

Keep the rules declarative where practical.

Do not branch hundreds of CSS values manually across components.

---

# 31. Layout Validation

Before export, validate that all required content fits inside its assigned regions.

No visual element may overflow the 1080×1350 canvas.

Do not silently clip critical content.

Critical fields include:

- team names;
- market;
- odd;
- bulletin code if enabled;
- total odd;
- status/result if enabled.

If a configuration cannot fit within defined minimum limits, fail with a controlled rendering error rather than creating broken output.

---

# 32. Text Fitting

Implement deterministic text fitting.

Preferred v1 algorithm:

1. define maximum font size;
2. measure text;
3. if it does not fit, reduce font size deterministically;
4. use binary search or another deterministic bounded search;
5. stop at defined minimum size;
6. if still too large, try explicit shortName/compactLabel if available;
7. if still impossible, return a controlled render validation error.

Do not resize text using random/approximate CSS hacks.

---

# 33. Avoid Overcomplicated Typography Fitting

Do not initially implement:

- arbitrary letter-spacing reduction loops;
- horizontal scale transforms;
- font-stretch distortion;
- dozens of fallback levels.

Start with:

font-size fitting
→ explicit short name
→ controlled failure.

Only add additional fitting behavior if a real test case requires it.

---

# 34. Independent Team Name Fitting

Fit home and away names independently.

A long home-team name must not unnecessarily shrink a short away-team name if the design permits independent regions.

Do not compute one global font size for all team names unless the template explicitly requires visual symmetry.

---

# 35. Market Always Visible

Market text must always be visible.

This applies for:

- 1 selection;
- 10 selections;
- PRE_MATCH;
- LIVE;
- long team names.

Do not remove Market from compact modes.

If necessary, reduce market font size within documented limits.

---

# 36. Long Market Names

Handle long market labels deterministically.

Preferred order:

1. maximum configured font size;
2. reduce to minimum configured size;
3. use explicit compactLabel if the Market snapshot provides one;
4. controlled failure if still impossible.

Do not automatically rewrite the market wording.

Do not use AI summarization.

---

# 37. No AI Layout Decisions

Do not call any AI model during rendering.

Do not use AI to:

- shorten names;
- choose typography;
- select colors;
- rearrange cards;
- create final text;
- decide layout density.

Rendering must be fully deterministic source-code/config driven.

---

# 38. Team Logo Regions

Use fixed/deterministic logo regions.

A missing logo must not shift team-name geometry unpredictably.

Reserve the same structural region or use deterministic alternate layout defined by template config.

Avoid layout jumping caused by asset presence.

---

# 39. Competition Display

When:

showCompetition = true

display competition context in the documented region.

When false:

hide the visual content according to template behavior.

Do not delete underlying render-model competition data.

Ensure optional visibility does not cause uncontrolled reflow.

---

# 40. Date / Time Display

When:

showDateTime = true

use explicitly formatted deterministic fixture/display date.

When false:

hide content.

Do not let locale/system defaults alter output.

---

# 41. Stake Display

When:

showStake = true

and stake exists:

display it.

When hidden:

do not alter underlying data.

Do not implement payout/profit calculations.

---

# 42. Bulletin ID Display

When:

showBulletinId = true

display the established public code, for example:

BET #0001

Use the exact persisted public code.

Do not regenerate it inside renderer.

---

# 43. Status Display

When:

showStatus = true

display effective status.

Supported statuses:

PENDING
GREEN
RED
VOID
MANUAL

Do not calculate effective status inside renderer.

---

# 44. Result Display

Treat:

showResult

independently from:

showStatus.

If result content exists and showResult is true, display it.

If hidden, remove/blank the content according to template design.

Do not merge these toggles.

---

# 45. Reserved Status/Result Geometry

The exact same status/result region must be reserved before and after settlement.

Example:

PENDING render
→ reserved status area

later:

GREEN render
→ same region and surrounding geometry

Changing status must not shift:

- selection cards;
- total odd;
- footer;
- branding.

This is a hard rendering invariant.

---

# 46. Hidden Status/Result Geometry

Even when:

showStatus = false
or
showResult = false

preserve the documented structural region if required to keep layout stable.

Hide the content without collapsing the rest of the design unexpectedly.

The renderer should not change card positions merely because status text is hidden.

---

# 47. Status Styling

Use semantic visual treatment.

Conceptually:

GREEN
→ positive success state

RED
→ negative state

VOID
→ neutral/grey state

PENDING
→ restrained pending state

MANUAL
→ neutral/review state

Do not use color as the only information channel.

Use explicit text and/or iconography.

Do not use uncontrolled bright colors that conflict with the premium design.

---

# 48. LIVE Variant

LIVE mode may visually emphasize:

- live state;
- score;
- minute where available.

Do not fabricate live minute.

Do not make LIVE a separate rendering engine.

Use a deterministic variant of the same template family.

---

# 49. PRE_MATCH Variant

PRE_MATCH focuses on:

- teams;
- fixture date/time where enabled;
- market;
- odd;
- bulletin summary.

Do not display fake live information.

---

# 50. SINGLE Layout

SINGLE should make stronger use of available vertical space.

It may use:

- larger team names;
- larger logos;
- more generous spacing;
- stronger market emphasis.

But it must remain part of the same template system.

Do not create an unrelated design language.

---

# 51. MULTI Layout

MULTI must support 2–10 selections.

As count increases:

- card density changes;
- fixed brand/header/footer regions remain stable;
- information hierarchy remains legible;
- market remains visible.

Do not simply scale the entire canvas down.

---

# 52. 10-Selection Requirement

10 selections must fit fully inside 1080×1350 without clipping.

This is a hard acceptance requirement.

Test with:

- long team names;
- long markets;
- missing logos;
- status/result visible;
- optional metadata enabled where product allows.

Do not design only for average short names.

---

# 53. Overflow Detection

Implement explicit geometry/content overflow checks where practical.

Examples:

- DOM bounding boxes remain inside assigned region;
- no element exceeds canvas bounds;
- no card overlaps adjacent card;
- critical text region does not overflow.

Do not rely solely on visual inspection.

Geometry tests are preferred.

---

# 54. Renderer Component Structure

Keep rendering components small and declarative.

Possible structure:

rendering/
model/
templates/
components/
layout/
typography/
assets/
export/
fingerprint/

Adapt to existing project conventions.

Do not create dozens of abstraction layers.

---

# 55. Shared Preview Components

Where safe, reuse presentational components between:

- Bulletin Builder preview;
- final renderer.

However, the final renderer must not depend on:

- form state;
- editor controls;
- responsive UI wrappers;
- network queries.

Extract pure visual primitives where useful.

Do not force reuse if it makes renderer determinism harder.

---

# 56. Renderer Isolation Page

Provide a dedicated internal render route/page usable by Playwright.

Conceptually:

/render/bulletins/:renderId

or an internal render harness.

This page must render only the fixed bulletin composition required for export.

Do not include:

- application navigation;
- editor controls;
- debug overlays;
- browser-dependent responsive wrappers.

Secure/limit access appropriately for local v1 architecture.

---

# 57. Render Input Delivery

Prefer deterministic local input delivery.

Options include:

- server-created render job/token resolving immutable local data;
- direct server render endpoint generating a dedicated render page;
- another simple approach consistent with architecture.

Do not serialize sensitive arbitrary data into query strings unnecessarily.

Do not allow the browser render route to accept arbitrary executable configuration.

---

# 58. Screenshot Export

Use Playwright Chromium.

Export exactly the render root.

Requirements:

- viewport configured appropriately;
- device scale factor explicitly controlled;
- fixed 1080×1350 element;
- fonts ready;
- images ready;
- animations disabled;
- no network dependence;
- no scrollbars;
- transparent/background behavior explicit;
- screenshot output PNG.

Do not screenshot the normal management UI.

---

# 59. Device Scale Factor

Set deviceScaleFactor explicitly.

Do not rely on host display scaling.

Choose one stable value appropriate for exact 1080×1350 output.

Verify the resulting PNG dimensions programmatically.

---

# 60. PNG Validation

After export verify:

width = 1080
height = 1350

If dimensions differ:

fail export.

Do not silently resize the resulting file afterward unless the rendering architecture explicitly requires it.

Prefer rendering at the target dimensions directly.

---

# 61. Output Bytes vs Output Path

The pure rendering/export service should conceptually return:

- PNG bytes/buffer;
- dimensions;
- fingerprint;
- render metadata.

Filesystem output path belongs to export/storage infrastructure.

Do not make a domain renderer fundamentally depend on:

"/tmp/foo.png"

as part of its identity.

---

# 62. Export Storage

Persist exported files in a controlled local application directory.

Use generated safe filenames.

Do not allow arbitrary client filesystem paths.

Example filename pattern:

BET-0001-feed-pending.png

Use the actual sanitized bulletin public code/status.

Do not include unsafe characters from arbitrary user input.

---

# 63. Historical Filename Stability

Filename is convenience metadata.

Do not use filename as the primary historical identity.

RenderRecord/internal ID/fingerprint remain authoritative.

A user may move/export a file later without changing what was rendered.

---

# 64. RenderRecord

After successful export, persist a RenderRecord.

Store enough information to identify the exact render.

Expected fields include:

- internal ID;
- bulletin ID;
- template ID/version;
- renderer version;
- format;
- dimensions;
- fingerprint;
- output storage reference/path;
- createdAt;
- status/effective status at render time where documented;
- render config reference/hash;
- asset/font fingerprint metadata where supported.

Follow current data-model.md.

---

# 65. Failed Render

Do not create a successful RenderRecord before PNG creation succeeds.

Preferred flow:

1. prepare immutable render input;
2. validate;
3. render;
4. validate PNG;
5. persist file safely;
6. persist successful RenderRecord.

If failure/audit records are useful and already modeled, record them separately.

Do not leave a successful database row pointing to a nonexistent output.

---

# 66. Atomic File Behavior

Write exported files safely.

Prefer:

temporary file
→ complete write
→ atomic rename

where supported.

Avoid exposing partially written PNG files.

Clean up temporary files after failure.

---

# 67. Re-render Existing Historical Record

Provide an application operation capable of re-rendering from historical immutable inputs.

It should use:

- preserved bulletin/selection snapshot;
- exact TemplateVersion;
- renderer version compatibility;
- exact immutable assets/font references;
- stored render configuration.

Do not substitute current Team/Market/Template data.

---

# 68. Renderer Version Compatibility

If historical RenderRecord references an older renderer version not implemented anymore:

do not silently render using the latest behavior and call it identical.

Either:

- keep old renderer implementation available;
- or report that exact historical re-render is unavailable.

For v1, rendererVersion 1 is sufficient.

Design the metadata correctly now without building a complex multi-version dispatcher prematurely.

---

# 69. Template Config Validation

Runtime validate TemplateVersion configuration before rendering.

Do not cast arbitrary stored JSON directly into trusted template config.

Use Zod or current validation approach.

Invalid template configuration must produce a controlled error.

---

# 70. Template Configuration Scope

Persist only configuration that meaningfully belongs to the template.

Examples:

- layout region dimensions;
- density values;
- typography tokens;
- spacing;
- static asset references;
- visual variant settings.

Do not store executable React component code or arbitrary CSS/JS in the database.

Template configuration is declarative.

---

# 71. No Arbitrary CSS Injection

Do not allow user-supplied template values to become unrestricted CSS.

Validate:

- numeric ranges;
- enum values;
- token values;
- asset refs.

Do not accept:

style: "position:fixed; ..."

from arbitrary persisted/user input.

---

# 72. Static Decorative Assets

Decorative visual assets must also be immutable/versioned.

Examples:

- background texture;
- brand mark;
- decorative lines/patterns.

If TemplateVersion references them, changing those bytes must require a new asset identity/version.

---

# 73. Content Hashes

Use a stable cryptographic content hash such as SHA-256 where content addressing/fingerprinting requires it.

Do not invent a custom checksum.

Hash actual bytes for:

- immutable assets;
- fonts;
- optionally final PNG metadata.

Do not use file modification time as content identity.

---

# 74. Asset Deduplication

If existing Asset infrastructure supports content-addressed storage, identical bytes may share the same immutable Asset/content hash.

Do not build a large deduplication subsystem solely for rendering if it does not already fit the model.

Historical integrity matters more than storage optimization.

---

# 75. Preview Mapping

Update the Bulletin Builder preview so it can use the same normalized render model or shared visual primitives where this simplifies consistency.

Do not make the builder preview perform export.

The builder preview may scale the fixed canvas with CSS:

transform: scale(...)

or equivalent visual containment.

Do not alter logical render dimensions.

---

# 76. Responsive Preview

The editor preview should fit smaller screens by scaling the fixed 1080×1350 logical composition.

Do not make the final render layout responsive based on browser width.

The render itself is fixed; only its on-screen preview wrapper is responsive.

---

# 77. Image Loading

Before screenshot ensure all local images have completed loading or deterministic fallback has been applied.

Do not rely on arbitrary sleep delays such as:

waitForTimeout(2000)

as the primary readiness mechanism.

Use explicit readiness signals.

---

# 78. Render Ready Signal

Create a deterministic render-ready condition.

Conceptually:

- render model validated;
- fonts ready;
- all image assets loaded/failed into fallback;
- layout measurement/fitting completed;
- no overflow;
- render root marked ready.

Playwright should wait for this condition.

Do not use fixed arbitrary sleeps.

---

# 79. Text Measurement

Use browser DOM measurement in a deterministic controlled render environment.

For example:

getBoundingClientRect()
scrollWidth
clientWidth

or a dedicated measurement element.

Do not estimate width solely from character count.

Different characters have different widths.

---

# 80. Text Fit Search

Use bounded deterministic iterations.

For example:

binary search between:
minFontSize
maxFontSize

with a fixed precision/integer pixel strategy.

Do not implement an unbounded loop.

The same input must take the same fitting path.

---

# 81. Font Size Precision

Prefer integer CSS pixel sizes for v1 unless fractional typography is demonstrably needed.

This makes layout easier to reason about and test.

Do not use excessive subpixel fitting complexity.

---

# 82. Line Count

Define allowed line count explicitly per field.

Examples:

team name:
1 or 2 lines depending on density

market:
1 or 2 lines

Do not allow uncontrolled wrapping that increases card height.

The card geometry must remain fixed for its density mode.

---

# 83. Ellipsis

Do not silently ellipsize critical fields unless rendering-engine.md explicitly allows it.

Prefer:

fit
→ shortName/compactLabel
→ controlled error.

A betting graphic with an ambiguous truncated market is unsafe.

If ellipsis is used for a non-critical decorative field, make that rule explicit.

---

# 84. Team Short Names

Use shortName only as an explicit fallback when the full name cannot fit.

Do not always prefer shortName.

The fitting result must be deterministic.

Do not automatically generate abbreviations.

---

# 85. Competition Short Names

The same principle applies to competition shortName if needed.

Use stored explicit shortName.

Do not derive initials heuristically during historical rendering unless the fallback algorithm itself is explicitly versioned and deterministic.

---

# 86. Fallback Initials

If missing logo fallback uses initials, the initials algorithm must be deterministic and versioned with renderer behavior.

Keep it simple.

Example:

first letter of first two normalized display-name tokens.

But only introduce this if needed.

A static generic placeholder may be even safer.

---

# 87. Result Text

Result text should come from already-resolved structured/application data.

Do not construct bookmaker-style human settlement explanations in renderer.

Keep it concise.

Examples may include:

2–1
11 corners
Final

only when the render model explicitly provides the intended display string.

---

# 88. Overall Status

Overall bulletin status is supplied upstream.

Renderer must not aggregate selection statuses itself.

This avoids visual layer/business rule divergence.

---

# 89. Visual Status Mapping

Renderer may map semantic status to:

- class/token;
- icon;
- label.

Example conceptually:

GREEN → success token

This mapping is visual only.

It must not change settlement semantics.

---

# 90. Theme Scope

Do not implement competition-specific visual themes in v1.

Do not dynamically recolor bulletin based on club crest/competition.

Use one consistent Bet Studio visual system.

Theme extension can be added later.

---

# 91. Background

Use a deterministic background.

Avoid procedural randomness.

If texture/noise is used:

- use a static immutable asset;
- or fixed deterministic CSS.

Do not generate random noise per render.

---

# 92. Effects

Keep effects controlled.

Allowed examples:

- subtle gradients;
- shadows;
- borders;
- glow/accent in moderation.

Do not rely on unstable filters/effects that vary significantly across rendering environments if avoidable.

Test exported results.

---

# 93. Accessibility in Preview

Final image itself is visual, but the HTML preview should retain reasonable semantic/accessibility behavior where practical.

Do not compromise deterministic rendering for unnecessary interactive semantics inside export route.

The builder/editor controls remain subject to full accessibility requirements.

---

# 94. Rendering Endpoint

Add a focused application/API operation for export.

Conceptually:

POST /api/bulletins/:id/render

Request may include:

{
"format": "FEED"
}

and permitted display/template selection if applicable.

Do not allow arbitrary:

width
height
HTML
CSS
filesystem path
remote URL

from the client.

---

# 95. Template Selection

For v1, default to the active/current:

BETSTUDIO_FEED

TemplateVersion.

If the product already allows choosing a template version, use that model.

Do not build a full template management UI unless already planned.

Historical re-render uses exact stored version.

---

# 96. Export Response

Return useful metadata.

Conceptually:

{
renderId,
bulletinId,
fingerprint,
format: "FEED",
width: 1080,
height: 1350,
fileName
}

Provide a controlled local file/download route or existing asset-serving mechanism.

Do not expose raw internal filesystem paths to the browser if avoidable.

---

# 97. Export Download Route

If a download endpoint is needed:

- resolve by RenderRecord/render ID;
- validate file reference;
- serve only controlled export files;
- set appropriate MIME/content-disposition.

Do not expose a generic file-read endpoint.

---

# 98. Re-render API

If implemented this phase, keep it explicit.

Conceptually:

POST /api/renders/:id/re-render

It must use historical immutable input.

Do not treat:

POST bulletin render

and:

historical re-render

as the same operation internally if the data-source semantics differ.

---

# 99. Builder Export Button

Add an Export action to the Bulletin Builder or relevant bulletin view.

The action should:

1. ensure current changes are saved;
2. request render;
3. show rendering state;
4. return downloadable/viewable PNG;
5. show controlled failure if render validation fails.

Do not silently render unsaved client-only state unless product-spec explicitly permits preview export.

Prefer persisted bulletin as source of export truth.

---

# 100. Save Before Render

If builder contains unsaved changes:

do not export stale persisted data without warning.

Preferred behavior:

- require/save successfully first;
- then render the persisted version.

Avoid hidden auto-save if manual save remains product policy.

---

# 101. Render Loading State

Show:

Rendering…

while export is in progress.

Prevent accidental duplicate submissions where practical.

Do not implement a job queue for this local small workload.

---

# 102. Render Errors

Show controlled actionable errors.

Examples:

- missing template;
- missing immutable asset;
- content does not fit;
- invalid render configuration;
- export process failed.

Do not expose Playwright stack traces directly in UI.

---

# 103. Export Concurrency

This is a local-first single-user v1 app.

A simple in-process render request is sufficient.

Do not introduce:

- Redis;
- BullMQ;
- worker services;
- distributed locks.

Optionally guard duplicate simultaneous renders for the same fingerprint if trivial.

Do not overengineer.

---

# 104. Render Cache

Do not build a sophisticated render cache.

If an existing successful RenderRecord has the same fingerprint and its output file still exists, reuse may be considered.

But only if this can be implemented simply and safely.

Correctness is more important than avoiding a small local render cost.

---

# 105. Golden Tests

Add a small set of representative golden/snapshot image tests.

Do not golden-test every possible combination.

Useful baseline cases:

1. SINGLE PRE_MATCH;
2. MULTI 3 selections;
3. MULTI 10 selections;
4. long names;
5. GREEN/result visible;
6. LIVE variant.

Pin test environment sufficiently to avoid meaningless churn.

---

# 106. Golden Test Environment

Run golden screenshot tests using:

- pinned Playwright Chromium version;
- pinned local fonts;
- controlled Linux CI environment where applicable;
- fixed timezone;
- fixed locale;
- animations disabled.

Do not expect snapshots from developer macOS/Windows to necessarily byte-match Linux CI unless environment is genuinely equivalent.

Document how golden files should be updated.

---

# 107. Golden Comparison Strategy

Use a reasonable visual-diff tolerance only if exact pixel matching proves unstable due to anti-aliasing.

Prefer exact matching in the pinned canonical environment where reliable.

Do not set a huge tolerance that would allow real layout regressions.

---

# 108. Geometry Tests

Geometry tests are more important than excessive golden snapshots.

Add tests verifying:

- root exactly 1080×1350;
- all selection cards inside selections region;
- no overlap;
- market visible;
- odd visible;
- status region fixed;
- 10 selections fit;
- long-name text stays inside bounds;
- fixed brand regions unchanged across statuses.

These can catch structural regressions more precisely.

---

# 109. Text Fitting Tests

Add representative fitting tests.

Examples:

- short team name uses max size;
- long team name reduces size;
- very long name uses stored shortName;
- impossible text triggers controlled failure;
- long market fits without disappearing;
- one long team does not shrink unrelated other team if layout supports independence.

---

# 110. Status Stability Test

Render the same bulletin data with:

PENDING
GREEN
RED
VOID
MANUAL

Verify that structural geometry outside the reserved status/result region remains unchanged.

This is a core acceptance test.

---

# 111. Visibility Toggle Tests

Test:

showCompetition
showDateTime
showStake
showResult
showStatus
showBulletinId

Ensure hiding content does not unexpectedly move unrelated structural regions.

Do not require pixel-identical text region when content itself is intentionally different.

---

# 112. Selection Count Matrix

At minimum run geometry/layout validation for:

1
2
3
4
6
8
10

selections.

This covers all density bands.

Do not test only 1 and 10.

---

# 113. Missing Logo Tests

Test:

- both logos present;
- one missing;
- both missing.

Layout must remain valid.

Fallback must be deterministic.

---

# 114. Historical Asset Test

Test conceptually:

1. render uses asset hash A;
2. create/update current Team to asset hash B;
3. historical re-render still resolves asset A;
4. fingerprint remains tied to A.

This proves historical asset integrity.

---

# 115. Template Version Test

Test:

1. render with BETSTUDIO_FEED v1;
2. create v2;
3. current new render may use v2;
4. historical record still references v1;
5. re-render historical record uses v1.

Do not mutate v1.

---

# 116. Fingerprint Tests

Verify:

same canonical input
→ same fingerprint

Changing:

- one odd;
- one team label;
- template version;
- renderer version;
- asset hash;
- display toggle;
- locale/timezone if included;

→ changes fingerprint.

Object property insertion order must not alter fingerprint.

---

# 117. PNG Dimension Test

Programmatically inspect exported PNG metadata.

Assert:

1080 × 1350

Do not trust screenshot configuration without checking output.

---

# 118. Offline Render Test

Disable network in a rendering test.

Rendering should still succeed with local assets/fonts.

If a request to the network occurs unexpectedly:

fail the test where practical.

---

# 119. Deterministic Repeat Test

Render the same fixture in the same pinned environment multiple times.

Verify:

- same fingerprint;
- same geometry;
- same textual content;
- same visual snapshot/hash where reliable.

Do not include render timestamp in visible output unless explicitly supplied as immutable render input.

---

# 120. No Current Time Dependency

Renderer must not call:

Date.now()
new Date()

to generate visible content or layout decisions.

If render timestamp is needed for metadata:

generate it outside the deterministic visual input.

Do not let it alter fingerprint unless it intentionally affects visible output.

---

# 121. No Randomness

Renderer must not call:

Math.random()

or random UUID generation for layout IDs that affect HTML/CSS output.

Stable React keys should derive from stable selection IDs/positions.

Random temporary infrastructure IDs must not influence visual result.

---

# 122. HTML IDs

If DOM IDs are needed:

derive them deterministically from stable render data.

Do not generate random IDs during render if those IDs can influence CSS, accessibility references or snapshots.

---

# 123. CSS Stability

Do not depend on:

- viewport-relative units for core fixed geometry;
- system font metrics;
- dynamic scrollbar sizes;
- user browser settings.

Prefer explicit px/rem values based on controlled root where appropriate.

Final render page should reset browser defaults predictably.

---

# 124. Browser Defaults

Apply a controlled reset for the render root/page.

Ensure:

- margin = 0;
- predictable box-sizing;
- no browser body padding;
- explicit background;
- explicit font.

Do not rely on browser default heading/margin styles.

---

# 125. Overflow Policy

Set:

overflow: hidden

only at the final canvas boundary after internal overflow validation exists.

Do not use clipping to conceal broken layout.

Critical child regions should be validated before screenshot.

---

# 126. Rendering Performance

A bulletin has at most 10 selections.

Optimize for correctness and maintainability.

A render taking a modest local fraction of a second or a few seconds is acceptable.

Do not implement:

- worker farms;
- parallel browser pools;
- GPU-specific pipelines;
- persistent Chromium cluster managers

unless current measurements show a real need.

---

# 127. Browser Lifecycle

Choose a simple rendering lifecycle.

Opening one Playwright Chromium instance per render may be acceptable initially.

If reuse of a browser process is simple and clearly improves local performance, it may be implemented.

Do not create a complex browser pool.

Ensure processes close cleanly.

---

# 128. Render Security

The render route/harness must not execute arbitrary user-supplied HTML/JS.

All visible text must be rendered as normal escaped React text.

Do not use:

dangerouslySetInnerHTML

for market/team/user-entered text.

Do not allow arbitrary CSS from stored Market/Team values.

---

# 129. Local File Security

When resolving:

assets
fonts
exports

ensure paths remain inside controlled application directories.

Reject:

../
absolute arbitrary paths
file:// supplied by user

Use canonical safe resolution.

---

# 130. Image Format Safety

Support only formats the rendering pipeline intentionally handles.

For v1 prefer:

PNG
JPEG
WebP

If SVG support has not been safely implemented/sanitized, do not introduce it here.

Do not render arbitrary remote SVG.

---

# 131. Render Record Integrity

If output file is deleted later, the RenderRecord may remain as historical metadata.

Handle missing file gracefully.

Do not silently regenerate with current template/data and serve it as the original.

Historical regeneration must use historical immutable inputs.

---

# 132. Existing Render Preview

Where useful, allow viewing an exported RenderRecord from the application.

Keep this small.

Full render-history management belongs to the later History phase.

---

# 133. Export Filename

Use a safe deterministic user-friendly filename.

Preferred shape:

BET-0001-feed-pending.png

Normalize public code for filesystem safety.

Use lowercase status/format if consistent with current conventions.

Do not use a previous/alternative brand prefix.

---

# 134. Status in Filename

Filename status represents status at render time.

A later re-render after settlement may produce:

BET-0001-feed-green.png

This must not overwrite the earlier pending render unless explicitly requested and historically safe.

Use unique storage identity if filename collisions are possible.

---

# 135. Output Collision

Do not rely solely on display filename as unique storage path.

Use:

render ID
or
fingerprint

in internal storage naming if needed.

Expose the clean user-facing filename on download.

---

# 136. Template Seed / Bootstrap

If BETSTUDIO_FEED v1 must be inserted into Template/TemplateVersion:

use a deterministic migration/seed/bootstrap mechanism consistent with current project architecture.

Do not duplicate it on every startup.

Do not create multiple v1 rows.

Ensure idempotency.

---

# 137. Template Code

Use:

BETSTUDIO_FEED

or the exact current documented code.

Do not introduce competing names such as:

DEFAULT_TEMPLATE
MAIN_FEED
SOCIAL_V1

unless docs already define them.

One stable logical template code is preferred.

---

# 138. Template Variant

Represent:

SINGLE/MULTI
PRE_MATCH/LIVE

as variant inputs/configuration.

Do not store four copies of identical global design tokens.

Deduplicate shared config while keeping versioned behavior explicit.

---

# 139. Versioned Layout Decisions

Anything that materially changes output should be version-bound.

Examples:

- density thresholds;
- font size ranges;
- text fitting fallback policy;
- card geometry;
- status placement;
- brand asset;
- visual tokens.

Do not silently change historical v1 behavior later.

---

# 140. Builder Integration

Replace or refactor Phase 06 preview only as much as needed to share the render model/components safely.

Do not destabilize bulletin editing.

Ensure:

- builder still saves;
- total odd still works;
- reorder still works;
- optional toggles still work.

Rendering implementation must not regress builder behavior.

---

# 141. No Provider Coupling

Do not add calls to GOAL API during render.

Even if a logo is missing:

do not fetch it.

Even if fixture score changed:

do not refresh it.

Renderer uses persisted input only.

---

# 142. No Market Engine Coupling

Do not invoke Market Engine directly from renderer.

If status is stale, that is an Application workflow concern.

Render exactly the effective status represented by the chosen persisted render input.

---

# 143. Rendering Current Bulletin

For ordinary current export:

Application may first load/derive current effective bulletin state.

Then create an immutable render input/snapshot.

Renderer consumes that frozen input.

Do not allow data to change halfway through render.

---

# 144. Render Snapshot Boundary

At render time, freeze the exact user-visible data required for reproducibility.

If existing BulletinSelectionSnapshot already fully provides this, reuse it.

If a separate RenderSnapshot is not necessary, do not invent one.

But RenderRecord must be able to identify the exact immutable input used.

Avoid dependence on mutable current aggregate rows.

---

# 145. Database Transaction Boundary

Do not hold a SQLite transaction open during Chromium rendering.

Preferred flow:

1. load/freeze required immutable input;
2. close/commit DB work;
3. render PNG;
4. persist output metadata in a short transaction.

If exact render snapshot creation requires a transaction, complete it before launching the browser.

---

# 146. Renderer Error Types

Use controlled application/infrastructure errors.

Useful categories may include:

RenderValidationError
RenderAssetError
RenderTemplateError
RenderOverflowError
RenderExportError

Follow existing project conventions.

Do not build a huge exception hierarchy.

---

# 147. Debugging Support

Provide developer-friendly diagnostics for failed fitting/layout validation.

Examples:

- selection index;
- field;
- measured width/height;
- allowed width/height;
- minimum font size reached.

Do not expose all internal diagnostics to ordinary end users.

Server logs/test output may contain them.

---

# 148. Optional Debug Overlay

A render debug overlay showing region bounds may be useful for development/tests.

If implemented:

- disabled by default;
- never part of production export;
- not included in fingerprint unless explicitly enabled as a render configuration.

Do not spend excessive time building tooling.

---

# 149. Testing Architecture

Separate:

- pure model/fingerprint tests;
- layout/DOM geometry tests;
- screenshot/golden tests;
- application/export integration tests.

Do not require Chromium for every tiny rendering utility test.

Keep most logic fast.

---

# 150. Application Integration Test

Add at least one full local integration test:

1. persisted bulletin exists;
2. map to immutable render model;
3. render with BETSTUDIO_FEED v1;
4. export PNG;
5. validate dimensions;
6. persist RenderRecord;
7. reload RenderRecord;
8. verify fingerprint/template/renderer metadata.

No provider/network calls.

---

# 151. Historical Re-render Integration Test

Add one test proving:

1. render bulletin;
2. persist RenderRecord;
3. modify current Team/Market/template current version;
4. historical re-render resolves original snapshot + original template version;
5. fingerprint/visual result remains the historical one in canonical environment.

This is a core product invariant.

---

# 152. Dependencies

Prefer current project dependencies.

Do not add:

- Puppeteer;
- Sharp purely for screenshot generation;
- Canvas;
- SVG rendering libraries;
- animation frameworks.

A small image metadata/hash dependency may be acceptable only if native/simple existing options are insufficient.

Explain any new significant dependency.

---

# 153. Build Integration

Ensure production build includes all local font/static/template assets required for rendering.

Do not rely on development-server-only paths.

Test rendering from the same built/runtime structure expected for local production use where practical.

---

# 154. CI

Update CI only as necessary.

Normal CI should continue:

- format check;
- lint;
- typecheck;
- unit/integration tests;
- build.

If canonical rendering/golden tests require Chromium:

- install the required Playwright Chromium/browser dependencies;
- run the bounded renderer test suite;
- avoid downloading unnecessary browsers.

Keep CI reasonable.

---

# 155. Playwright Browser Pinning

Use the browser version associated with the committed Playwright dependency/lockfile.

Do not use an arbitrary system-installed Chrome for canonical golden rendering.

Document the required:

playwright install chromium

or current project equivalent.

---

# 156. CI Golden Stability

If full golden comparison is unstable in all environments:

make one canonical environment authoritative.

Do not simply disable renderer regression testing.

Keep:

- geometry tests;
- fingerprint tests;
- PNG dimension tests

portable.

Run strict golden comparisons where environment is controlled.

---

# 157. README

Update README.md minimally.

Document:

- FEED export now available;
- 1080×1350;
- required Playwright Chromium setup if relevant;
- local deterministic rendering principle.

Do not place full rendering specification in README.

Do not reference any project identity other than Bet Studio.

---

# 158. Rendering Documentation

Update docs/rendering-engine.md to match actual implementation.

Ensure it clearly documents:

- React/HTML/CSS + Playwright choice;
- FEED-only v1;
- template family/version strategy;
- renderer version;
- determinism contract;
- fingerprint inputs;
- font/asset immutability;
- text fitting algorithm;
- density modes;
- status/result geometry;
- historical re-render behavior;
- canonical golden environment.

Do not duplicate implementation-level code unnecessarily.

---

# 159. Data Model Documentation

Update docs/data-model.md only where needed to reflect actual:

- RenderRecord fields;
- asset immutability semantics;
- TemplateVersion lifecycle;
- render fingerprint metadata.

Do not duplicate layout details there.

---

# 160. Security Review

Before completion verify:

- no arbitrary HTML execution;
- no arbitrary CSS execution;
- no arbitrary filesystem path input;
- no network requirement during render;
- no remote fonts;
- no remote images;
- text is safely escaped;
- asset paths constrained;
- historical assets immutable/version-safe;
- template config runtime validated;
- export filenames sanitized;
- no secrets in render metadata.

---

# 161. Manual Visual Verification

If environment permits, manually inspect representative renders.

At minimum:

1. SINGLE PRE_MATCH.
2. SINGLE LIVE.
3. MULTI with 3 selections.
4. MULTI with 6 selections.
5. MULTI with 10 selections.
6. Long home team name.
7. Long away team name.
8. Long market label.
9. Missing logos.
10. PENDING.
11. GREEN.
12. RED.
13. VOID.
14. MANUAL.
15. all optional display toggles enabled.
16. status/result toggled off.

Check:

- no clipping;
- no overlap;
- market visible;
- odds visible;
- hierarchy clear;
- branding stable;
- total odd clear;
- status region stable;
- 1080×1350 exact.

Do not claim visual verification if it was not performed.

---

# 162. Quality Gates

Before completion run the repository's actual relevant commands.

At minimum:

- format/check;
- lint;
- typecheck;
- unit tests;
- integration tests;
- renderer geometry tests;
- fingerprint tests;
- build.

Also run:

- Playwright renderer/golden suite where configured;
- PNG dimension validation.

Do not claim success unless the commands actually ran successfully.

---

# 163. Final Diff Review

Before completion inspect the final Git diff.

Verify:

- no provider code entered renderer;
- no Market Engine business logic entered renderer;
- no arbitrary network requests remain;
- no remote fonts;
- no mutable historical asset path assumptions;
- no Story implementation;
- no social publishing;
- no large unrelated UI redesign;
- no generated exports accidentally committed;
- no local DB files committed;
- no `.env` or secrets committed;
- no previous/alternative project identity appears.

Remove unrelated changes.

---

# 164. Completion Report

At the end report concisely:

1. Rendering technology chosen.
2. FEED 1080×1350 implementation.
3. Template/version strategy.
4. Renderer version strategy.
5. Render-model boundary.
6. Density modes implemented.
7. Text fitting behavior.
8. Status/result geometry behavior.
9. Asset/font immutability strategy.
10. Render fingerprint composition.
11. PNG export and storage behavior.
12. Historical re-render behavior.
13. Builder preview integration.
14. Tests/golden/geometry coverage.
15. Exact quality commands executed and results.
16. Any rendering limitation or deliberately deferred feature.

Do not provide a long file-by-file narrative.

Do not commit or push unless explicitly requested.
