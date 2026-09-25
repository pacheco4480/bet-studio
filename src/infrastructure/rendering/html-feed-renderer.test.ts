// @vitest-environment node

import { chromium } from '@playwright/test';
import { afterEach, describe, expect, it } from 'vitest';
import { betStudioFeedTemplateV1 } from '../../application/rendering/feed-template.js';
import {
  FEED_HEIGHT,
  FEED_WIDTH,
  type BulletinRenderModel,
} from '../../application/rendering/render-model.js';
import { renderHtmlForTesting } from './html-feed-renderer.js';

let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

afterEach(async () => {
  await browser?.close();
  browser = null;
});

describe('HTML feed renderer layout', () => {
  it.each([1, 3, 6, 8, 10])(
    'keeps VS centered for %i selections',
    async (selectionCount) => {
      browser = await chromium.launch();
      const page = await browser.newPage({
        viewport: { width: FEED_WIDTH, height: FEED_HEIGHT },
      });
      await page.setContent(
        renderHtmlForTesting(
          createLargeModeModel(selectionCount),
          betStudioFeedTemplateV1,
        ),
        { waitUntil: 'domcontentloaded' },
      );

      const offsets = await page
        .locator('.selection-card')
        .evaluateAll((cards) =>
          cards.map((card) => {
            const versus = card.querySelector('.versus');
            if (!versus) throw new Error('Missing VS');
            const cardRect = card.getBoundingClientRect();
            const versusRect = versus.getBoundingClientRect();
            const cardCenter = cardRect.left + cardRect.width / 2;
            const versusCenter = versusRect.left + versusRect.width / 2;
            return Math.abs(cardCenter - versusCenter);
          }),
        );

      for (const offset of offsets) {
        expect(offset).toBeLessThanOrEqual(1);
      }
    },
  );

  it('keeps LARGE mode team rows and odds inside their reserved card regions', async () => {
    browser = await chromium.launch();
    const page = await browser.newPage({
      viewport: { width: FEED_WIDTH, height: FEED_HEIGHT },
    });
    await page.setContent(
      renderHtmlForTesting(createLargeModeModel(), betStudioFeedTemplateV1),
      { waitUntil: 'domcontentloaded' },
    );

    const boxes = await page
      .locator('.selection-card')
      .first()
      .evaluate((card) => {
        const read = (selector: string) => {
          const element = card.querySelector(selector);
          if (!element) throw new Error(`Missing ${selector}`);
          const rect = element.getBoundingClientRect();
          return {
            left: rect.left,
            right: rect.right,
            width: rect.width,
          };
        };

        const cardRect = card.getBoundingClientRect();
        return {
          card: {
            left: cardRect.left,
            right: cardRect.right,
          },
          home: read('.team:first-child strong'),
          versus: read('.versus'),
          away: read('.away strong'),
          odd: read('.market-row strong'),
        };
      });

    expect(boxes.home.right).toBeLessThanOrEqual(boxes.versus.left);
    expect(boxes.away.left).toBeGreaterThanOrEqual(boxes.versus.right);
    expect(boxes.odd.right).toBeLessThanOrEqual(boxes.card.right - 20);
    expect(boxes.odd.width).toBeGreaterThanOrEqual(70);
  });

  it('removes selection status badges when selection status display is disabled', async () => {
    browser = await chromium.launch();
    const page = await browser.newPage({
      viewport: { width: FEED_WIDTH, height: FEED_HEIGHT },
    });
    const model = createLargeModeModel();
    model.display.showResult = false;
    await page.setContent(
      renderHtmlForTesting(model, betStudioFeedTemplateV1),
      {
        waitUntil: 'domcontentloaded',
      },
    );

    expect(await page.locator('.status').count()).toBe(0);
  });
});

function createLargeModeModel(selectionCount = 3): BulletinRenderModel {
  return {
    publicCode: 'BET #0028',
    type: 'MULTI',
    mode: 'PRE_MATCH',
    overallStatus: 'PENDING',
    stake: '10',
    totalOdd: '11.78',
    createdAt: '2026-09-12T12:00:00.000Z',
    display: {
      showCompetition: true,
      showDate: true,
      showTime: true,
      showStake: true,
      showTotalOdd: true,
      showResult: true,
      showBulletinCode: true,
      showOverallStatus: true,
      showTeamLogos: true,
      teamLogoStyle: 'INITIALS',
      templateTheme: 'LIME',
      footerText: 'Deterministic FEED 1080x1350',
    },
    selections: Array.from({ length: selectionCount }, (_, index) =>
      selection(
        index + 1,
        ['Köln', 'Athletic Club', 'Auxerre'][index] ?? `Home Team ${index + 1}`,
        ['Werder Bremen', 'Elche', 'Brest'][index] ?? `Away Team ${index + 1}`,
        ['Ambas marcam ou mais de 2.5 golos', 'Vitoria casa', 'Empate'][
          index
        ] ?? 'Mercado teste',
        ['2', '1.9', '3.10'][index] ?? '1.50',
      ),
    ),
  };
}

function selection(
  position: number,
  homeName: string,
  awayName: string,
  marketName: string,
  odd: string,
): BulletinRenderModel['selections'][number] {
  return {
    position,
    homeTeam: { name: homeName, shortName: null, logo: null },
    awayTeam: { name: awayName, shortName: null, logo: null },
    competitionName: position === 1 ? 'Bundesliga' : 'La Liga',
    competitionCountryCode: position === 1 ? 'B' : 'LL',
    competitionLogo: null,
    marketCode: 'BTTS_OVER_2_5',
    marketName,
    odd,
    kickoffDate: '12/09',
    kickoffTime: '17:30',
    status: 'PENDING',
    resultText: '1-1',
    liveMinute: null,
  };
}
