import { ZodError, z } from 'zod';
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
  constructor(private readonly repository: CatalogRepository) {}

  listCompetitions(query: ListQuery) {
    const items = this.repository.listCompetitions(query);
    return { items, total: items.length };
  }

  getCompetition(id: string) {
    const competition = this.repository.getCompetition(id as never);
    if (!competition) throw new NotFoundError('Competition not found');
    return competition;
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
    const existing = this.getCompetition(id);
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
    const items = this.repository.listTeams(query);
    return { items, total: items.length };
  }

  getTeam(id: string) {
    const team = this.repository.getTeam(id as never);
    if (!team) throw new NotFoundError('Team not found');
    return team;
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
