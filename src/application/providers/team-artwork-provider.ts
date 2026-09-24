export type ExternalTeamArtwork = {
  externalId: string;
  name: string;
  country: string | null;
  logoUrl: string;
};

export type ExternalCountryArtwork = {
  code: string;
  name: string;
  flagUrl: string;
};

export type TeamArtworkCompetition = {
  name: string;
  regionName: string | null;
};

export type TeamArtworkProvider = {
  readonly code: string;
  readonly displayName: string;
  supportsCompetition(competition: TeamArtworkCompetition): boolean;
  listCountryArtwork(): Promise<ExternalCountryArtwork[]>;
  listTeamArtwork(
    competition: TeamArtworkCompetition,
  ): Promise<ExternalTeamArtwork[]>;
  searchTeamArtwork(name: string): Promise<ExternalTeamArtwork[]>;
};
