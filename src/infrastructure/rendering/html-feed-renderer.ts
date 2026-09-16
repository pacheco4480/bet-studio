import { chromium } from '@playwright/test';
import type { BulletinPngRenderer } from '../../application/rendering/rendering-service.js';
import { RenderingError } from '../../shared/errors.js';
import {
  FEED_HEIGHT,
  FEED_WIDTH,
  type BulletinRenderModel,
  type RenderExport,
  type RenderTemplateVersion,
} from '../../application/rendering/render-model.js';

export class HtmlFeedRenderer implements BulletinPngRenderer {
  async render(input: {
    model: BulletinRenderModel;
    template: RenderTemplateVersion;
    fingerprint: string;
    renderInputHash: string;
  }): Promise<RenderExport> {
    const browser = await launchChromium();
    try {
      const page = await browser.newPage({
        viewport: { width: FEED_WIDTH, height: FEED_HEIGHT },
        deviceScaleFactor: 1,
        locale: input.template.locale,
        timezoneId: input.template.timezone,
      });
      await page.route('**/*', (route) => route.abort());
      await page.setContent(renderHtml(input.model, input.template), {
        waitUntil: 'domcontentloaded',
      });
      await page.evaluate(
        "document.fonts.ready.then(() => { document.body.dataset.renderReady = 'true'; })",
      );
      await page.waitForFunction(
        "document.body.dataset.renderReady === 'true'",
      );
      const element = page.locator('[data-render-root]');
      const png = await element.screenshot({
        type: 'png',
        animations: 'disabled',
      });
      const dimensions = readPngDimensions(png);
      return {
        png,
        width: dimensions.width,
        height: dimensions.height,
        fingerprint: input.fingerprint,
        renderInputHash: input.renderInputHash,
      };
    } finally {
      await browser.close();
    }
  }
}

async function launchChromium() {
  try {
    return await chromium.launch();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes('Executable doesn') ||
      message.includes('playwright install')
    ) {
      throw new RenderingError(
        'Playwright Chromium is not installed. Run: npx playwright install chromium',
      );
    }
    throw new RenderingError('Failed to launch Playwright Chromium');
  }
}

function renderHtml(
  model: BulletinRenderModel,
  template: RenderTemplateVersion,
): string {
  const mode = template.layoutModes.find(
    (item) =>
      model.selections.length >= item.minSelections &&
      model.selections.length <= item.maxSelections,
  );
  if (!mode) throw new Error('Missing layout mode');
  const cards = model.selections
    .map((selection) => {
      const teamMaxWidth =
        mode.id === 'HERO' ? 245 : mode.id === 'ULTRA_COMPACT' ? 230 : 275;
      const marketMaxWidth = mode.id === 'ULTRA_COMPACT' ? 650 : 560;
      const homeFont = fitFont(
        selection.homeTeam.name,
        mode.teamFontSize,
        mode.teamFontMinSize,
        teamMaxWidth,
      );
      const awayFont = fitFont(
        selection.awayTeam.name,
        mode.teamFontSize,
        mode.teamFontMinSize,
        teamMaxWidth,
      );
      const marketFont = fitFont(
        selection.marketName,
        mode.marketFontSize,
        mode.marketFontMinSize,
        marketMaxWidth,
      );
      return `<section class="selection-card ${mode.id.toLowerCase()}">
        <div class="meta-row">
          <span>${escapeHtml(selection.competitionName ?? '')}</span>
          <span>${renderDateTime(model, selection)}</span>
        </div>
        <div class="teams-row">
          <div class="team ${model.display.showTeamLogos === false ? 'no-logo' : ''}">
            ${model.display.showTeamLogos === false ? '' : `<div class="logo">${initials(selection.homeTeam.name)}</div>`}
            <strong style="font-size:${homeFont}px;max-width:${teamMaxWidth}px">${escapeHtml(selection.homeTeam.name)}</strong>
          </div>
          <span class="versus">${model.mode === 'LIVE' ? renderScore(selection) : 'VS'}</span>
          <div class="team away ${model.display.showTeamLogos === false ? 'no-logo' : ''}">
            <strong style="font-size:${awayFont}px;max-width:${teamMaxWidth}px">${escapeHtml(selection.awayTeam.name)}</strong>
            ${model.display.showTeamLogos === false ? '' : `<div class="logo">${initials(selection.awayTeam.name)}</div>`}
          </div>
        </div>
        <div class="market-row">
          <span style="font-size:${marketFont}px">${escapeHtml(selection.marketName)}</span>
          <strong><span>ODD</span>${escapeHtml(selection.odd)}</strong>
        </div>
        <div class="result-row">
          <span>${renderResult(model, selection)}</span>
          <span class="status ${selection.status.toLowerCase()}">${model.display.showResult ? selection.status : ''}</span>
        </div>
      </section>`;
    })
    .join('');

  const potentialReturn = calculatePotentialReturn(model.stake, model.totalOdd);

  return `<!doctype html>
  <html lang="pt">
    <head>
      <meta charset="utf-8" />
      <style>${renderCss(model, template, mode.cardHeight, mode.cardGap)}</style>
    </head>
    <body>
      <main data-render-root class="canvas">
        <header class="header">
          <div>
            <p class="eyebrow">BET STUDIO</p>
            <h1>${model.type} ${model.mode === 'LIVE' ? 'LIVE' : 'PRE-MATCH'}</h1>
          </div>
          <div class="header-side">
            ${model.display.showBulletinCode ? `<span>${escapeHtml(model.publicCode)}</span>` : ''}
            ${model.display.showOverallStatus === false ? '' : `<strong class="overall ${model.overallStatus.toLowerCase()}">${model.overallStatus}</strong>`}
          </div>
        </header>
        <section class="selections">${cards}</section>
        <section class="summary">
          <div>${model.display.showStake ? `<span>STAKE</span><strong>${escapeHtml(model.stake ?? '-')}</strong>` : ''}</div>
          <div>${potentialReturn ? `<span>POTENTIAL RETURN</span><strong>${escapeHtml(potentialReturn)}</strong>` : ''}</div>
          <div>${model.display.showTotalOdd ? `<span>ODD TOTAL</span><strong>${escapeHtml(model.totalOdd ?? '-')}</strong>` : ''}</div>
        </section>
        <footer class="footer">Deterministic FEED 1080x1350</footer>
      </main>
    </body>
  </html>`;
}

function renderCss(
  model: BulletinRenderModel,
  template: RenderTemplateVersion,
  cardHeight: number,
  cardGap: number,
): string {
  const c = themedColors(template, model.display.templateTheme);
  return `*{box-sizing:border-box}html,body{margin:0;width:${FEED_WIDTH}px;height:${FEED_HEIGHT}px;overflow:hidden;background:${c.background};font-family:${template.typography.fontFamily};color:${c.textPrimary}}.canvas{position:relative;width:${FEED_WIDTH}px;height:${FEED_HEIGHT}px;overflow:hidden;background:${c.canvasBackground};padding:56px 64px}.header{height:170px;display:flex;align-items:flex-start;justify-content:space-between;border-bottom:1px solid ${c.border}}.eyebrow{margin:0 0 16px;color:${c.accent};font-size:28px;font-weight:800;letter-spacing:0}.header h1{margin:0;font-size:64px;line-height:1}.header-side{text-align:right;display:grid;gap:14px;font-size:28px}.overall,.status{display:inline-flex;align-items:center;justify-content:center;width:134px;height:38px;border:1px solid ${c.border};border-radius:8px;font-weight:800;font-size:18px}.overall{width:170px;height:48px}.selections{position:absolute;left:${template.regions.selections.x}px;top:${template.regions.selections.y}px;width:${template.regions.selections.width}px;height:${template.regions.selections.height}px;display:grid;grid-auto-rows:${cardHeight}px;gap:${cardGap}px}.selection-card{position:relative;height:${cardHeight}px;background:${c.cardBackground};border:1px solid ${c.border};border-radius:8px;padding:18px 26px;display:grid;grid-template-rows:22px minmax(0,1fr) 30px;gap:7px;overflow:hidden}.hero{padding:40px 44px;grid-template-rows:32px minmax(0,1fr) 70px 46px}.compact{padding:9px 18px;grid-template-rows:16px minmax(0,1fr) 20px;gap:3px}.ultra_compact{padding:7px 18px;grid-template-rows:14px minmax(0,1fr) 18px;gap:2px}.meta-row,.result-row,.market-row,.teams-row{display:flex;align-items:center;justify-content:space-between;gap:18px;min-width:0}.meta-row{min-height:0;color:${c.textMuted};font-size:14px;text-transform:uppercase}.compact .meta-row,.ultra_compact .meta-row{font-size:12px}.team{min-width:0;display:flex;align-items:center;gap:14px;flex:1 1 0;overflow:hidden}.team.no-logo{gap:0}.away{justify-content:flex-end;text-align:right}.team strong{display:block;white-space:nowrap;overflow:hidden;text-overflow:clip;line-height:1.05}.logo{width:54px;height:54px;flex:0 0 auto;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${c.background};border:1px solid ${c.border};color:${c.accent};font-weight:900;font-size:18px}.hero .teams-row{display:grid;grid-template-columns:minmax(0,1fr) 76px minmax(0,1fr);align-items:center;gap:20px}.hero .team{gap:16px;justify-content:flex-end;text-align:right}.hero .team.no-logo{gap:0}.hero .away{justify-content:flex-start;text-align:left}.hero .logo{width:118px;height:118px;font-size:34px}.compact .teams-row,.ultra_compact .teams-row{padding-right:112px}.compact .team:first-child,.ultra_compact .team:first-child{justify-content:flex-end;text-align:right}.compact .away,.ultra_compact .away{justify-content:flex-start;text-align:left}.compact .logo{width:32px;height:32px;font-size:13px}.ultra_compact .logo{width:28px;height:28px;font-size:11px}.versus{flex:0 0 92px;text-align:center;color:${c.textSecondary};font-size:28px;font-weight:900}.hero .versus{font-size:26px;min-width:0}.compact .versus,.ultra_compact .versus{flex-basis:58px;font-size:18px}.market-row{color:${c.textSecondary};min-height:0;overflow:hidden}.market-row span{display:block;white-space:nowrap;overflow:hidden;text-overflow:clip}.market-row strong{display:grid;gap:2px;font-size:inherit;color:${c.accent};font-weight:900;white-space:nowrap;text-align:right}.market-row strong span{color:${c.textMuted};font-size:12px;font-weight:800;letter-spacing:0}.hero .market-row strong span{font-size:16px}.compact .market-row,.ultra_compact .market-row{padding-right:116px}.compact .market-row strong,.ultra_compact .market-row strong{position:absolute;right:18px;bottom:34px;width:84px}.compact .market-row strong span,.ultra_compact .market-row strong span{display:none}.result-row{min-height:0;color:${c.textMuted};font-size:16px}.compact .result-row,.ultra_compact .result-row{position:absolute;right:18px;bottom:6px;width:84px}.compact .result-row>span:first-child,.ultra_compact .result-row>span:first-child{display:none}.compact .status,.ultra_compact .status{width:84px;height:22px;font-size:11px}.pending{color:${c.status.PENDING}}.green{color:${c.status.GREEN}}.red{color:${c.status.RED}}.void{color:${c.status.VOID}}.manual{color:${c.status.MANUAL}}.summary{position:absolute;left:${template.regions.summary.x}px;top:${template.regions.summary.y}px;width:${template.regions.summary.width}px;height:${template.regions.summary.height}px;border-top:1px solid ${c.border};display:grid;grid-template-columns:1fr 1fr 1fr;align-items:center}.summary div{display:grid;gap:6px}.summary div:nth-child(2){text-align:center}.summary div:nth-child(3){text-align:right}.summary span{font-size:18px;color:${c.textMuted}}.summary strong{font-size:42px;color:${c.textPrimary}}.footer{position:absolute;left:${template.regions.footer.x}px;top:${template.regions.footer.y}px;width:${template.regions.footer.width}px;color:${c.textMuted};font-size:18px;text-align:center}`;
}

function themedColors(template: RenderTemplateVersion, themeName: unknown) {
  const theme = template.colors;
  if (themeName === 'ELECTRIC') {
    return {
      ...theme,
      background: '#060712',
      panel: '#111326',
      panelStrong: '#1a1f3c',
      textPrimary: '#f8fbff',
      textSecondary: '#c7d2fe',
      textMuted: '#8da2d8',
      accent: '#67e8f9',
      accentSecondary: '#a78bfa',
      border: '#334155',
      canvasBackground:
        'radial-gradient(circle at 20% 10%,rgba(103,232,249,.17),transparent 30%),linear-gradient(145deg,#060712,#111827 58%,#050509)',
      cardBackground: 'linear-gradient(180deg,#1a1f3c,#111326)',
    };
  }
  if (themeName === 'MONO') {
    return {
      ...theme,
      background: '#08090b',
      panel: '#15171b',
      panelStrong: '#20242b',
      textPrimary: '#f8fafc',
      textSecondary: '#d4d4d8',
      textMuted: '#a1a1aa',
      accent: '#f8fafc',
      accentSecondary: '#a1a1aa',
      border: '#3f3f46',
      canvasBackground:
        'radial-gradient(circle at 18% 8%,rgba(255,255,255,.08),transparent 28%),linear-gradient(145deg,#08090b,#14161a 58%,#050506)',
      cardBackground: 'linear-gradient(180deg,#20242b,#15171b)',
    };
  }
  return {
    ...theme,
    canvasBackground:
      'radial-gradient(circle at 18% 8%,rgba(198,255,61,.16),transparent 28%),linear-gradient(145deg,#050608,#0b0f17 58%,#06070a)',
    cardBackground: `linear-gradient(180deg,${theme.panelStrong},${theme.panel})`,
  };
}

function calculatePotentialReturn(
  stake: string | null,
  totalOdd: string | null,
): string | null {
  const stakeValue = parseDisplayDecimal(stake);
  const oddValue = parseDisplayDecimal(totalOdd);
  if (stakeValue === null || oddValue === null) return null;
  return formatDisplayDecimal(stakeValue * oddValue);
}

function parseDisplayDecimal(value: string | null): number | null {
  if (!value) return null;
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatDisplayDecimal(value: number): string {
  return value.toLocaleString('pt-PT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function renderDateTime(
  model: BulletinRenderModel,
  selection: BulletinRenderModel['selections'][number],
): string {
  const values = [
    model.display.showDate ? selection.kickoffDate : null,
    model.display.showTime ? selection.kickoffTime : null,
    model.mode === 'LIVE' && selection.liveMinute
      ? `${selection.liveMinute}'`
      : null,
  ].filter(Boolean);
  return escapeHtml(values.join(' | '));
}

function renderResult(
  model: BulletinRenderModel,
  selection: BulletinRenderModel['selections'][number],
): string {
  if (!model.display.showResult) return '';
  return escapeHtml(selection.resultText ?? '-');
}

function renderScore(
  selection: BulletinRenderModel['selections'][number],
): string {
  return selection.resultText ? escapeHtml(selection.resultText) : 'LIVE';
}

function fitFont(
  text: string,
  preferredSize: number,
  minSize: number,
  maxWidth: number,
): number {
  const roughWidth = text.length * preferredSize * 0.55;
  if (roughWidth <= maxWidth) return preferredSize;
  return Math.max(
    minSize,
    Math.floor((maxWidth / Math.max(text.length, 1)) * 1.65),
  );
}

function initials(text: string): string {
  return escapeHtml(
    text
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'BS',
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function readPngDimensions(buffer: Buffer): { width: number; height: number } {
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}
