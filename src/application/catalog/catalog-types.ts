import type {
  Competition,
  Market,
  Team,
  TeamAlias,
} from '../../domain/core/types.js';
import type {
  CompetitionId,
  MarketId,
  TeamAliasId,
  TeamId,
} from '../../domain/shared/ids.js';

export type ActiveFilter = 'all' | 'active' | 'inactive';

export type ListQuery = {
  search?: string;
  active?: ActiveFilter;
};

export type TeamListQuery = ListQuery & {
  competitionId?: CompetitionId;
};

export type TeamWithDetails = Team & {
  aliases: TeamAlias[];
  competitions: Competition[];
};

export type CatalogRepository = {
  listCompetitions(query: ListQuery): Competition[];
  getCompetition(id: CompetitionId): Competition | null;
  saveCompetition(competition: Competition): void;

  listTeams(query: TeamListQuery): TeamWithDetails[];
  getTeam(id: TeamId): TeamWithDetails | null;
  saveTeam(team: Team): void;
  addTeamAlias(alias: TeamAlias): void;
  removeTeamAlias(aliasId: TeamAliasId): boolean;
  assignTeamToCompetition(teamId: TeamId, competitionId: CompetitionId): void;
  removeTeamFromCompetition(
    teamId: TeamId,
    competitionId: CompetitionId,
  ): boolean;

  listMarkets(
    query: ListQuery & {
      autoEvaluable?: 'all' | 'auto' | 'manual';
      category?: string;
    },
  ): Market[];
  getMarket(id: MarketId): Market | null;
  findMarketByCode(code: string): Market | null;
  saveMarket(market: Market): void;
};
