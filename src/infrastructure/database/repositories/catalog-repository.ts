import { and, eq, like, or } from 'drizzle-orm';
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import type {
  Asset,
  Competition,
  Market,
  Team,
  TeamAlias,
} from '../../../domain/core/types.js';
import type {
  AssetId,
  CompetitionId,
  MarketId,
  TeamAliasId,
  TeamId,
} from '../../../domain/shared/ids.js';
import type {
  ActiveFilter,
  CatalogRepository,
  ListQuery,
  TeamListQuery,
  TeamWithDetails,
  AssetWithProvider,
} from '../../../application/catalog/catalog-types.js';
import type { BetStudioDatabase } from '../connection.js';
import {
  competitionTeams,
  competitions,
  assets,
  markets,
  teamAliases,
  teams,
  providers,
} from '../schema.js';

function activePredicate(column: AnySQLiteColumn, active?: ActiveFilter) {
  if (!active || active === 'all') return undefined;
  return eq(column, active === 'active');
}

function searchPattern(search?: string): string | null {
  const trimmed = search?.trim();
  return trimmed ? `%${trimmed}%` : null;
}

export class DrizzleCatalogRepository implements CatalogRepository {
  constructor(private readonly db: BetStudioDatabase) {}

  listCompetitions(query: ListQuery): Competition[] {
    const pattern = searchPattern(query.search);
    return this.db
      .select()
      .from(competitions)
      .where(
        and(
          activePredicate(competitions.active, query.active),
          pattern
            ? or(
                like(competitions.name, pattern),
                like(competitions.shortName, pattern),
              )
            : undefined,
        ),
      )
      .orderBy(competitions.name)
      .all() as Competition[];
  }

  getCompetition(id: CompetitionId): Competition | null {
    return (
      (this.db
        .select()
        .from(competitions)
        .where(eq(competitions.id, id))
        .get() as Competition | undefined) ?? null
    );
  }

  saveCompetition(competition: Competition): void {
    this.db
      .insert(competitions)
      .values(competition)
      .onConflictDoUpdate({ target: competitions.id, set: competition })
      .run();
  }

  getAsset(id: AssetId): AssetWithProvider | null {
    const row = this.db
      .select({ asset: assets, providerCode: providers.code })
      .from(assets)
      .leftJoin(providers, eq(providers.id, assets.providerId))
      .where(eq(assets.id, id))
      .get();
    return row
      ? {
          ...(row.asset as Asset),
          providerCode: row.providerCode ?? null,
        }
      : null;
  }

  listTeams(query: TeamListQuery): TeamWithDetails[] {
    const pattern = searchPattern(query.search);
    const rows = this.db
      .selectDistinct({ team: teams })
      .from(teams)
      .leftJoin(competitionTeams, eq(competitionTeams.teamId, teams.id))
      .where(
        and(
          activePredicate(teams.active, query.active),
          query.competitionId
            ? eq(competitionTeams.competitionId, query.competitionId)
            : undefined,
          pattern
            ? or(like(teams.name, pattern), like(teams.shortName, pattern))
            : undefined,
        ),
      )
      .orderBy(teams.name)
      .all();

    return rows.map((row) => this.withTeamDetails(row.team as Team));
  }

  getTeam(id: TeamId): TeamWithDetails | null {
    const team = this.db.select().from(teams).where(eq(teams.id, id)).get() as
      Team | undefined;
    return team ? this.withTeamDetails(team) : null;
  }

  saveTeam(team: Team): void {
    this.db
      .insert(teams)
      .values(team)
      .onConflictDoUpdate({ target: teams.id, set: team })
      .run();
  }

  addTeamAlias(alias: TeamAlias): void {
    this.db.insert(teamAliases).values(alias).run();
  }

  removeTeamAlias(aliasId: TeamAliasId): boolean {
    return (
      this.db.delete(teamAliases).where(eq(teamAliases.id, aliasId)).run()
        .changes > 0
    );
  }

  assignTeamToCompetition(teamId: TeamId, competitionId: CompetitionId): void {
    this.db
      .insert(competitionTeams)
      .values({ teamId, competitionId, season: '', active: true })
      .run();
  }

  removeTeamFromCompetition(
    teamId: TeamId,
    competitionId: CompetitionId,
  ): boolean {
    return (
      this.db
        .delete(competitionTeams)
        .where(
          and(
            eq(competitionTeams.teamId, teamId),
            eq(competitionTeams.competitionId, competitionId),
          ),
        )
        .run().changes > 0
    );
  }

  listMarkets(
    query: ListQuery & {
      autoEvaluable?: 'all' | 'auto' | 'manual';
      category?: string;
    },
  ): Market[] {
    const pattern = searchPattern(query.search);
    return this.db
      .select()
      .from(markets)
      .where(
        and(
          activePredicate(markets.active, query.active),
          query.autoEvaluable === 'auto'
            ? eq(markets.autoEvaluable, true)
            : undefined,
          query.autoEvaluable === 'manual'
            ? eq(markets.autoEvaluable, false)
            : undefined,
          query.category ? eq(markets.category, query.category) : undefined,
          pattern
            ? or(
                like(markets.name, pattern),
                like(markets.code, pattern),
                like(markets.category, pattern),
              )
            : undefined,
        ),
      )
      .orderBy(markets.category, markets.name)
      .all() as Market[];
  }

  getMarket(id: MarketId): Market | null {
    return (
      (this.db.select().from(markets).where(eq(markets.id, id)).get() as
        Market | undefined) ?? null
    );
  }

  findMarketByCode(code: string): Market | null {
    return (
      (this.db.select().from(markets).where(eq(markets.code, code)).get() as
        Market | undefined) ?? null
    );
  }

  saveMarket(market: Market): void {
    this.db
      .insert(markets)
      .values(market)
      .onConflictDoUpdate({ target: markets.id, set: market })
      .run();
  }

  private withTeamDetails(team: Team): TeamWithDetails {
    const aliases = this.db
      .select()
      .from(teamAliases)
      .where(eq(teamAliases.teamId, team.id))
      .orderBy(teamAliases.value)
      .all() as TeamAlias[];
    const competitionRows = this.db
      .select({ competition: competitions })
      .from(competitionTeams)
      .innerJoin(
        competitions,
        eq(competitions.id, competitionTeams.competitionId),
      )
      .where(eq(competitionTeams.teamId, team.id))
      .orderBy(competitions.name)
      .all();

    return {
      ...team,
      aliases,
      competitions: competitionRows.map(
        (row) => row.competition as Competition,
      ),
    };
  }
}
