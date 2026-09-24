import type {
  Asset,
  Competition,
  Market,
  Team,
  TeamAlias,
} from '../../domain/core/types.js';
import type {
  AssetId,
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

export type AssetWithProvider = Asset & {
  providerCode: string | null;
};

export type ManagedLogoStore = {
  saveLogo(input: {
    entityType: 'competition' | 'team';
    entityId: string;
    dataUrl: string;
  }): Promise<AssetId>;
};

export type CatalogRepository = {
  listCompetitions(query: ListQuery): Competition[];
  getCompetition(id: CompetitionId): Competition | null;
  saveCompetition(competition: Competition): void;
  getAsset(id: AssetId): AssetWithProvider | null;

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
