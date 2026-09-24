import { ZodError, z } from 'zod';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { validateMarketConfiguration } from '../../domain/market/market-config.js';
import { normalizeTeamAlias } from '../../domain/team/alias.js';
import { createId, type AssetId } from '../../domain/shared/ids.js';
import { nowUtc } from '../../domain/shared/time.js';
import type {
  Competition,
  Market,
  Team,
  TeamAlias,
} from '../../domain/core/types.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors.js';
import type {
  CatalogRepository,
  ListQuery,
  ManagedLogoStore,
  TeamListQuery,
} from './catalog-types.js';

const optionalText = z
  .string()
  .trim()
  .max(120)
  .optional()
  .nullable()
  .transform((value) => value || null);
const nameSchema = z.string().trim().min(1).max(120);
const codeSchema = z.string().trim().min(1).max(80);
const activeFilterSchema = z.enum(['all', 'active', 'inactive']).default('all');
const logoInputSchema = z.object({
  dataUrl: z.string().max(3_000_000),
});

const competitionInputSchema = z.object({
  name: nameSchema,
  shortName: optionalText,
  countryCode: optionalText,
  regionName: optionalText,
  logoAssetId: optionalText,
});

const teamInputSchema = z.object({
  name: nameSchema,
  shortName: optionalText,
  countryCode: optionalText,
  logoAssetId: optionalText,
});

const marketInputSchema = z.object({
  code: codeSchema.regex(/^[A-Z0-9_]+$/),
  name: nameSchema,
  category: optionalText,
  active: z.boolean().optional(),
  autoEvaluable: z.boolean(),
  evaluatorKey: z.string().trim().max(80).nullable().optional(),
  parameters: z.unknown().nullable().optional(),
});

function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError(
        error.issues.map((issue) => issue.message).join('; '),
      );
    }
    throw error;
  }
}

function toAssetId(value: string | null): AssetId | null {
  return value as AssetId | null;
}

export class CatalogService {
  constructor(
    private readonly repository: CatalogRepository,
    private readonly assetRoot = 'assets',
    private readonly logoStore: ManagedLogoStore | null = null,
  ) {}

  listCompetitions(query: ListQuery) {
    const items = this.repository
      .listCompetitions(query)
      .map((competition) => this.withLogo(competition));
    return { items, total: items.length };
  }

  getCompetition(id: string) {
    return this.withLogo(this.requireCompetition(id));
  }

  createCompetition(input: unknown): Competition {
    const parsed = parseInput(competitionInputSchema, input);
    const now = nowUtc();
    const competition: Competition = {
      id: createId<'CompetitionId'>(),
      ...parsed,
      logoAssetId: toAssetId(parsed.logoAssetId),
      active: true,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.repository.saveCompetition(competition);
    return competition;
  }

  updateCompetition(id: string, input: unknown): Competition {
    const existing = this.requireCompetition(id);
    const parsed = parseInput(
      competitionInputSchema
        .partial()
        .extend({ active: z.boolean().optional() }),
      input,
    );
    const updated: Competition = {
      ...existing,
      ...parsed,
      logoAssetId:
        parsed.logoAssetId === undefined
          ? existing.logoAssetId
          : toAssetId(parsed.logoAssetId),
      archivedAt:
        parsed.active === false
          ? nowUtc()
          : parsed.active === true
            ? null
            : existing.archivedAt,
      updatedAt: nowUtc(),
    };
    this.repository.saveCompetition(updated);
    return updated;
  }

  listTeams(query: TeamListQuery) {
    const items = this.repository
      .listTeams(query)
      .map((team) => this.withLogo(team));
    return { items, total: items.length };
  }

  getTeam(id: string) {
    const team = this.repository.getTeam(id as never);
    if (!team) throw new NotFoundError('Team not found');
    return this.withLogo(team);
  }

  async readAsset(id: string): Promise<{ bytes: Buffer; mimeType: string }> {
    const asset = this.repository.getAsset(id as AssetId);
    if (!asset || !asset.mimeType?.startsWith('image/')) {
      throw new NotFoundError('Image asset not found');
    }
    const root = path.resolve(this.assetRoot);
    const filePath = path.resolve(asset.filePath);
    if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
      throw new NotFoundError('Image asset not found');
    }
    try {
      return { bytes: await readFile(filePath), mimeType: asset.mimeType };
    } catch {
      throw new NotFoundError('Image asset not found');
    }
  }

  async setCompetitionLogo(id: string, input: unknown) {
    const competition = this.requireCompetition(id);
    const assetId = await this.saveManagedLogo('competition', id, input);
    this.repository.saveCompetition({
      ...competition,
      logoAssetId: assetId,
      updatedAt: nowUtc(),
    });
    return this.getCompetition(id);
  }

  removeCompetitionLogo(id: string) {
    const competition = this.requireCompetition(id);
    this.repository.saveCompetition({
      ...competition,
      logoAssetId: null,
      updatedAt: nowUtc(),
    });
    return this.getCompetition(id);
  }

  async setTeamLogo(id: string, input: unknown) {
    const team = this.requireTeam(id);
    const assetId = await this.saveManagedLogo('team', id, input);
    this.repository.saveTeam({
      ...team,
      logoAssetId: assetId,
      updatedAt: nowUtc(),
    });
    return this.getTeam(id);
  }

  removeTeamLogo(id: string) {
    const team = this.requireTeam(id);
    this.repository.saveTeam({
      ...team,
      logoAssetId: null,
      updatedAt: nowUtc(),
    });
    return this.getTeam(id);
  }

  private withLogo<T extends { logoAssetId: AssetId | null }>(entity: T) {
    const asset = entity.logoAssetId
      ? this.repository.getAsset(entity.logoAssetId)
      : null;
    return {
      ...entity,
      logo: asset
        ? {
            assetId: asset.id,
            source: asset.source,
            providerCode: asset.providerCode,
            url: `/api/assets/${asset.id}`,
          }
        : null,
    };
  }

  private requireCompetition(id: string): Competition {
    const competition = this.repository.getCompetition(id as never);
    if (!competition) throw new NotFoundError('Competition not found');
    return competition;
  }

  private requireTeam(id: string): Team {
    const team = this.repository.getTeam(id as never);
    if (!team) throw new NotFoundError('Team not found');
    return team;
  }

  private async saveManagedLogo(
    entityType: 'competition' | 'team',
    entityId: string,
    input: unknown,
  ): Promise<AssetId> {
    if (!this.logoStore)
      throw new ValidationError('Logo uploads are unavailable');
    const parsed = parseInput(logoInputSchema, input);
    return this.logoStore.saveLogo({
      entityType,
      entityId,
      dataUrl: parsed.dataUrl,
    });
  }

  createTeam(input: unknown): Team {
    const parsed = parseInput(teamInputSchema, input);
    const now = nowUtc();
    const team: Team = {
      id: createId<'TeamId'>(),
      ...parsed,
      logoAssetId: toAssetId(parsed.logoAssetId),
      active: true,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.repository.saveTeam(team);
    return team;
  }

  updateTeam(id: string, input: unknown): Team {
    const existing = this.getTeam(id);
    const parsed = parseInput(
      teamInputSchema.partial().extend({ active: z.boolean().optional() }),
      input,
    );
    const updated: Team = {
      id: existing.id,
      name: parsed.name ?? existing.name,
      shortName: parsed.shortName ?? existing.shortName,
      countryCode: parsed.countryCode ?? existing.countryCode,
      logoAssetId:
        parsed.logoAssetId === undefined
          ? existing.logoAssetId
          : toAssetId(parsed.logoAssetId),
      active: parsed.active ?? existing.active,
      archivedAt:
        parsed.active === false
          ? nowUtc()
          : parsed.active === true
            ? null
            : existing.archivedAt,
      createdAt: existing.createdAt,
      updatedAt: nowUtc(),
    };
    this.repository.saveTeam(updated);
    return updated;
  }

  addTeamAlias(teamId: string, input: unknown): TeamAlias {
    this.getTeam(teamId);
    const { value } = parseInput(z.object({ value: nameSchema }), input);
    const alias: TeamAlias = {
      id: createId<'TeamAliasId'>(),
      teamId: teamId as never,
      value,
      normalizedValue: normalizeTeamAlias(value),
      createdAt: nowUtc(),
    };
    try {
      this.repository.addTeamAlias(alias);
      return alias;
    } catch {
      throw new ConflictError('Team alias already exists');
    }
  }

  removeTeamAlias(teamId: string, aliasId: string): void {
    this.getTeam(teamId);
    if (!this.repository.removeTeamAlias(aliasId as never))
      throw new NotFoundError('Team alias not found');
  }

  assignTeamToCompetition(teamId: string, competitionId: string): void {
    this.getTeam(teamId);
    this.getCompetition(competitionId);
    try {
      this.repository.assignTeamToCompetition(
        teamId as never,
        competitionId as never,
      );
    } catch {
      throw new ConflictError('Team is already assigned to this competition');
    }
  }

  removeTeamFromCompetition(teamId: string, competitionId: string): void {
    this.getTeam(teamId);
    this.getCompetition(competitionId);
    if (
      !this.repository.removeTeamFromCompetition(
        teamId as never,
        competitionId as never,
      )
    ) {
      throw new NotFoundError('Competition assignment not found');
    }
  }

  listMarkets(
    query: ListQuery & {
      autoEvaluable?: 'all' | 'auto' | 'manual';
      category?: string;
    },
  ) {
    const items = this.repository.listMarkets(query);
    return { items, total: items.length };
  }

  getMarket(id: string) {
    const market = this.repository.getMarket(id as never);
    if (!market) throw new NotFoundError('Market not found');
    return market;
  }

  createMarket(input: unknown): Market {
    const market = this.buildMarket(input);
    if (this.repository.findMarketByCode(market.code))
      throw new ConflictError('Market code already exists');
    this.repository.saveMarket(market);
    return market;
  }

  updateMarket(id: string, input: unknown): Market {
    const existing = this.getMarket(id);
    const parsed = parseInput(marketInputSchema.partial(), input);
    const code = parsed.code ?? existing.code;
    const duplicate = this.repository.findMarketByCode(code);
    if (duplicate && duplicate.id !== existing.id)
      throw new ConflictError('Market code already exists');
    const config = this.parseMarketConfiguration({
      autoEvaluable: parsed.autoEvaluable ?? existing.autoEvaluable,
      evaluatorKey: parsed.evaluatorKey ?? existing.evaluatorKey,
      parameters: parsed.parameters ?? existing.parameters,
    });
    const updated: Market = {
      ...existing,
      ...parsed,
      code,
      evaluatorKey: config.evaluatorKey,
      parameters: config.parameters,
      updatedAt: nowUtc(),
    };
    this.repository.saveMarket(updated);
    return updated;
  }

  private buildMarket(input: unknown): Market {
    const parsed = parseInput(marketInputSchema, input);
    const config = this.parseMarketConfiguration({
      ...parsed,
      parameters: parsed.parameters ?? null,
    });
    const now = nowUtc();
    return {
      id: createId<'MarketId'>(),
      code: parsed.code,
      name: parsed.name,
      category: parsed.category,
      active: parsed.active ?? true,
      autoEvaluable: parsed.autoEvaluable,
      evaluatorKey: config.evaluatorKey,
      parameters: config.parameters,
      createdAt: now,
      updatedAt: now,
    };
  }

  private parseMarketConfiguration(input: {
    autoEvaluable: boolean;
    evaluatorKey?: string | null | undefined;
    parameters?: unknown;
  }) {
    try {
      return validateMarketConfiguration({
        autoEvaluable: input.autoEvaluable,
        evaluatorKey: input.evaluatorKey ?? null,
        parameters: input.parameters,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationError(
          error.issues.map((issue) => issue.message).join('; '),
        );
      }
      throw error;
    }
  }
}

export const listQuerySchema = z.object({
  search: z.string().optional(),
  active: activeFilterSchema,
});
