import type { FixtureStatus } from '../../domain/core/types.js';

export type ProviderCapabilities = {
  competitions: boolean;
  teams: boolean;
  fixtures: boolean;
  liveScores: boolean;
  finalScores: boolean;
  fixtureStatistics: boolean;
  corners: boolean;
  teamLogos: boolean;
  competitionLogos: boolean;
};

export type ExternalCompetition = {
  providerCode: string;
  externalId: string;
  name: string;
  shortName: string | null;
  countryCode: string | null;
  regionName: string | null;
  logoUrl: string | null;
};

export type ExternalTeam = {
  providerCode: string;
  externalId: string;
  competitionExternalId: string | null;
  name: string;
  shortName: string | null;
  countryCode: string | null;
  logoUrl: string | null;
};

export type ExternalFixture = {
  providerCode: string;
  externalId: string;
  competitionExternalId: string | null;
  homeTeamExternalId: string | null;
  awayTeamExternalId: string | null;
  homeTeamName: string;
  awayTeamName: string;
  kickoffAt: string | null;
  status: FixtureStatus;
  homeScore: number | null;
  awayScore: number | null;
  halfTimeHomeScore: number | null;
  halfTimeAwayScore: number | null;
  homeCorners: number | null;
  awayCorners: number | null;
};

export type FixturesQuery = {
  competitionExternalId?: string | null;
  date?: string | null;
  from?: string | null;
  to?: string | null;
};

export type TeamsQuery = {
  competitionExternalId: string;
};

export type CompetitionsQuery = {
  maxPages?: number;
};

export type FootballDataProvider = {
  readonly code: string;
  readonly displayName: string;
  readonly capabilities: ProviderCapabilities;
  listCompetitions(query?: CompetitionsQuery): Promise<ExternalCompetition[]>;
  listTeams(query: TeamsQuery): Promise<ExternalTeam[]>;
  listFixtures(query: FixturesQuery): Promise<ExternalFixture[]>;
  getFixture(externalFixtureId: string): Promise<ExternalFixture | null>;
};

export type ProviderStatus = {
  code: string;
  displayName: string;
  configured: boolean;
  capabilities: ProviderCapabilities;
  lastSuccessfulSyncAt: string | null;
};
