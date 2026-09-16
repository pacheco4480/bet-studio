import { z, ZodError } from 'zod';
import { assertSelectionCount } from '../../domain/core/invariants.js';
import type {
  Bulletin,
  BulletinMode,
  BulletinRenderConfig,
  BulletinSelection,
  BulletinSelectionSnapshot,
  BulletinStatus,
  BulletinType,
  Competition,
  Fixture,
  Market,
  SelectionResultSnapshot,
  Team,
} from '../../domain/core/types.js';
import {
  aggregateBulletinStatus,
  resolveEffectiveStatus,
} from '../../domain/market/market-engine.js';
import {
  parseDecimalString,
  type DecimalString,
} from '../../domain/shared/decimal.js';
import { createId } from '../../domain/shared/ids.js';
import type {
  BulletinId,
  FixtureId,
  MarketId,
  TemplateId,
} from '../../domain/shared/ids.js';
import { nowUtc, type UtcDateString } from '../../domain/shared/time.js';
import { NotFoundError, ValidationError } from '../../shared/errors.js';

export type FixtureOption = {
  fixture: Fixture;
  homeTeam: Team;
  awayTeam: Team;
  competition: Competition | null;
};

export type BulletinAggregateDto = {
  bulletin: Bulletin;
  selections: Array<{
    selection: BulletinSelection;
    snapshot: BulletinSelectionSnapshot;
    fixture: FixtureOption | null;
    market: Market | null;
    resultSnapshot?: SelectionResultSnapshot;
    effectiveStatus: BulletinStatus;
  }>;
};

export type BulletinListItem = {
  id: BulletinId;
  publicCode: string;
  type: BulletinType;
  mode: BulletinMode;
  status: BulletinStatus;
  totalOdd: string | null;
  selectionCount: number;
  createdAt: UtcDateString;
  updatedAt: UtcDateString;
};

export type BulletinRepository = {
  allocatePublicCode(): string;
  ensureDefaultTemplate(input: { type: BulletinType; mode: BulletinMode }): {
    templateId: TemplateId;
    version: number;
  };
  findById(id: BulletinId): BulletinAggregateDto | null;
  list(): BulletinListItem[];
  saveReplacingAggregate(aggregate: BulletinAggregateDto): void;
  getFixtureContext(id: FixtureId): FixtureOption | null;
  getMarket(id: MarketId): Market | null;
  listFixtures(input: {
    search?: string;
    limit: number;
    upcomingOnly?: boolean;
  }): FixtureOption[];
  listMarkets(input: {
    search?: string;
    activeOnly: boolean;
    limit: number;
  }): Market[];
  saveFixture(fixture: Fixture): void;
};

const displayOptionsSchema = z
  .object({
    showCompetition: z.boolean(),
    showDate: z.boolean(),
    showTime: z.boolean(),
    showStake: z.boolean(),
    showTotalOdd: z.boolean(),
    showResult: z.boolean(),
    showBulletinCode: z.boolean(),
    showOverallStatus: z.boolean(),
    showTeamLogos: z.boolean(),
    templateTheme: z.enum([
      'LIME',
      'ELECTRIC',
      'MONO',
      'CHAMPIONS',
      'EUROPA',
      'CONFERENCE',
    ]),
    footerText: z.string().trim().max(80),
  })
  .partial();

const selectionInputSchema = z.object({
  id: z.string().uuid().optional(),
  fixtureId: z.string().uuid('Fixture is required'),
  marketId: z.string().uuid('Market is required'),
  odd: z.string().trim().min(1, 'Odd is required'),
});

const bulletinInputSchema = z.object({
  type: z.enum(['SINGLE', 'MULTI']),
  mode: z.enum(['PRE_MATCH', 'LIVE']),
  stake: z.string().trim().optional().nullable(),
  renderConfig: displayOptionsSchema.optional(),
  selections: z.array(selectionInputSchema).max(10),
});

const fixtureInputSchema = z.object({
  competitionId: z.string().uuid().nullable().optional(),
  homeTeamId: z.string().uuid(),
  awayTeamId: z.string().uuid(),
  kickoffAt: z.string().trim().nullable().optional(),
  status: z
    .enum([
      'SCHEDULED',
      'LIVE',
      'FINISHED',
      'POSTPONED',
      'CANCELLED',
      'ABANDONED',
      'UNKNOWN',
    ])
    .default('SCHEDULED'),
});

const defaultRenderConfig: BulletinRenderConfig = {
  showCompetition: true,
  showDate: true,
  showTime: true,
  showStake: true,
  showTotalOdd: true,
  showResult: true,
  showBulletinCode: true,
  showOverallStatus: true,
  showTeamLogos: true,
  templateTheme: 'LIME',
  footerText: 'Deterministic FEED 1080x1350',
};

export class BulletinService {
  constructor(private readonly repository: BulletinRepository) {}

  listBulletins(): { items: BulletinListItem[] } {
    return { items: this.repository.list() };
  }

  getBulletin(id: string): BulletinAggregateDto {
    const aggregate = this.repository.findById(id as BulletinId);
    if (!aggregate) throw new NotFoundError('Bulletin not found');
    return aggregate;
  }

  listFixtures(query: {
    search?: string;
    limit?: number;
    upcomingOnly?: boolean;
  }) {
    return {
      items: this.repository.listFixtures({
        search: query.search,
        limit: query.limit ?? 50,
        upcomingOnly: query.upcomingOnly ?? true,
      }),
    };
  }

  listMarkets(query: {
    search?: string;
    activeOnly?: boolean;
    limit?: number;
  }) {
    return {
      items: this.repository.listMarkets({
        search: query.search,
        activeOnly: query.activeOnly ?? true,
        limit: query.limit ?? 100,
      }),
    };
  }

  createFixture(input: unknown): FixtureOption {
    const parsed = parseFixtureInput(input);
    if (parsed.homeTeamId === parsed.awayTeamId) {
      throw new ValidationError('Fixture teams must be different');
    }
    const now = nowUtc();
    const fixture: Fixture = {
      id: createId<'FixtureId'>(),
      competitionId: (parsed.competitionId as Fixture['competitionId']) ?? null,
      homeTeamId: parsed.homeTeamId as Fixture['homeTeamId'],
      awayTeamId: parsed.awayTeamId as Fixture['awayTeamId'],
      kickoffAt: (parsed.kickoffAt as UtcDateString | null | undefined) ?? null,
      status: parsed.status,
      homeScore: null,
      awayScore: null,
      liveMinute: null,
      sourceType: 'MANUAL',
      createdAt: now,
      updatedAt: now,
    };
    this.repository.saveFixture(fixture);
    const context = this.repository.getFixtureContext(fixture.id);
    if (!context) throw new NotFoundError('Fixture not found');
    return context;
  }

  createBulletin(input: unknown): BulletinAggregateDto {
    const parsed = parseInput(input);
    const now = nowUtc();
    const template = this.repository.ensureDefaultTemplate({
      type: parsed.type,
      mode: parsed.mode,
    });
    const aggregate = this.buildAggregate({
      id: createId<'BulletinId'>(),
      publicCode: this.repository.allocatePublicCode(),
      createdAt: now,
      existing: null,
      input: parsed,
      template,
    });
    this.repository.saveReplacingAggregate(aggregate);
    return aggregate;
  }

  updateBulletin(id: string, input: unknown): BulletinAggregateDto {
    const existing = this.getBulletin(id);
    const parsed = parseInput(input);
    const template =
      existing.bulletin.type === parsed.type &&
      existing.bulletin.mode === parsed.mode
        ? {
            templateId: existing.bulletin.templateId,
            version: existing.bulletin.templateVersion,
          }
        : this.repository.ensureDefaultTemplate({
            type: parsed.type,
            mode: parsed.mode,
          });
    const aggregate = this.buildAggregate({
      id: existing.bulletin.id,
      publicCode: existing.bulletin.publicCode,
      createdAt: existing.bulletin.createdAt,
      existing,
      input: parsed,
      template,
    });
    this.repository.saveReplacingAggregate(aggregate);
    return aggregate;
  }

  duplicateBulletin(id: string): BulletinAggregateDto {
    const existing = this.getBulletin(id);
    return this.createBulletin({
      type: existing.bulletin.type,
      mode: existing.bulletin.mode,
      stake: existing.bulletin.stake,
      renderConfig: existing.bulletin.renderConfig,
      selections: existing.selections.map((item) => ({
        fixtureId: item.selection.fixtureId,
        marketId: item.selection.marketId,
        odd: item.selection.odd,
      })),
    });
  }

  private buildAggregate(input: {
    id: BulletinId;
    publicCode: string;
    createdAt: UtcDateString;
    existing: BulletinAggregateDto | null;
    input: z.infer<typeof bulletinInputSchema>;
    template: { templateId: TemplateId; version: number };
  }): BulletinAggregateDto {
    validateSelectionCount(input.input.type, input.input.selections.length);
    validateUniqueFixtures(input.input.selections);
    const now = nowUtc();
    const selections = input.input.selections.map((selection, index) =>
      this.buildSelection(input.id, selection, index + 1, now, input.existing),
    );
    const status = aggregateBulletinStatus(
      selections.map((item) =>
        resolveEffectiveStatus(
          item.selection.calculatedStatus,
          item.selection.manualStatus,
        ),
      ),
    );
    const bulletin: Bulletin = {
      id: input.id,
      publicCode: input.publicCode,
      type: input.input.type,
      mode: input.input.mode,
      status,
      stake: normalizeOptionalDecimal(input.input.stake),
      totalOdd: calculateTotalOdd(
        input.input.type,
        selections.map((item) => item.selection.odd),
      ),
      templateId: input.template.templateId,
      templateVersion: input.template.version,
      renderConfig: {
        ...defaultRenderConfig,
        ...input.input.renderConfig,
      },
      createdAt: input.createdAt,
      updatedAt: now,
    };
    assertSelectionCount(bulletin.type, selections.length);
    return { bulletin, selections };
  }

  private buildSelection(
    bulletinId: BulletinId,
    input: z.infer<typeof selectionInputSchema>,
    position: number,
    now: UtcDateString,
    existing: BulletinAggregateDto | null,
  ): BulletinAggregateDto['selections'][number] {
    const fixture = this.repository.getFixtureContext(
      input.fixtureId as FixtureId,
    );
    if (!fixture) throw new NotFoundError('Fixture not found');
    const market = this.repository.getMarket(input.marketId as MarketId);
    if (!market) throw new NotFoundError('Market not found');

    const existingItem = existing?.selections.find(
      (item) => item.selection.id === input.id,
    );
    const changedDefinition =
      existingItem &&
      (existingItem.selection.fixtureId !== input.fixtureId ||
        existingItem.selection.marketId !== input.marketId);
    const selection: BulletinSelection = {
      id: existingItem?.selection.id ?? createId<'BulletinSelectionId'>(),
      bulletinId,
      position,
      fixtureId: fixture.fixture.id,
      marketId: market.id,
      odd: parseDecimalInput(input.odd),
      calculatedStatus: changedDefinition
        ? 'PENDING'
        : (existingItem?.selection.calculatedStatus ?? 'PENDING'),
      manualStatus: changedDefinition
        ? null
        : (existingItem?.selection.manualStatus ?? null),
      createdAt: existingItem?.selection.createdAt ?? now,
      updatedAt: now,
    };
    const snapshot: BulletinSelectionSnapshot = {
      selectionId: selection.id,
      homeTeamName: fixture.homeTeam.name,
      awayTeamName: fixture.awayTeam.name,
      homeTeamLogoAssetId: fixture.homeTeam.logoAssetId,
      awayTeamLogoAssetId: fixture.awayTeam.logoAssetId,
      competitionName: fixture.competition?.name ?? null,
      marketCode: market.code,
      marketName: market.name,
      kickoffAt: fixture.fixture.kickoffAt,
      createdAt: existingItem?.snapshot.createdAt ?? now,
    };
    return {
      selection,
      snapshot,
      fixture,
      market,
      effectiveStatus: resolveEffectiveStatus(
        selection.calculatedStatus,
        selection.manualStatus,
      ),
    };
  }
}

function parseInput(input: unknown): z.infer<typeof bulletinInputSchema> {
  try {
    return bulletinInputSchema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError(
        error.issues.map((issue) => issue.message).join('; '),
      );
    }
    throw error;
  }
}

function validateUniqueFixtures(
  selections: Array<z.infer<typeof selectionInputSchema>>,
): void {
  const seen = new Set<string>();
  for (const selection of selections) {
    if (seen.has(selection.fixtureId)) {
      throw new ValidationError(
        'Each fixture can only be used once in the same bulletin',
      );
    }
    seen.add(selection.fixtureId);
  }
}

function parseFixtureInput(input: unknown): z.infer<typeof fixtureInputSchema> {
  try {
    return fixtureInputSchema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError(
        error.issues.map((issue) => issue.message).join('; '),
      );
    }
    throw error;
  }
}

function validateSelectionCount(type: BulletinType, count: number): void {
  if (type === 'SINGLE' && count !== 1) {
    throw new ValidationError(
      'SINGLE bulletins must contain exactly one selection',
    );
  }
  if (type === 'MULTI' && (count < 2 || count > 10)) {
    throw new ValidationError(
      'MULTI bulletins must contain between 2 and 10 selections',
    );
  }
}

function normalizeOptionalDecimal(
  value: string | null | undefined,
): DecimalString | null {
  if (!value) return null;
  return parseDecimalInput(value);
}

function parseDecimalInput(value: string): DecimalString {
  const normalized = value.trim().replace(',', '.');
  return parseDecimalString(normalized);
}

function calculateTotalOdd(
  type: BulletinType,
  odds: DecimalString[],
): DecimalString {
  if (type === 'SINGLE') return parseDecimalInput(odds[0] ?? '0');
  const scale = 10_000n;
  let product = 1n;
  let denominator = 1n;
  for (const odd of odds) {
    product *= toScaledInteger(parseDecimalInput(odd));
    denominator *= scale;
  }
  const cents = roundHalfUp(product * 100n, denominator);
  return parseDecimalString(
    `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`,
  );
}

function toScaledInteger(decimal: string): bigint {
  const [whole, fraction = ''] = decimal.split('.');
  return BigInt(whole) * 10_000n + BigInt(fraction.padEnd(4, '0'));
}

function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  return (numerator * 2n + denominator) / (denominator * 2n);
}
