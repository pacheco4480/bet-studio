import type { Team } from '../../domain/core/types.js';
import type { TeamId } from '../../domain/shared/ids.js';
import { createId } from '../../domain/shared/ids.js';
import { nowUtc } from '../../domain/shared/time.js';
import { normalizeTeamAlias } from '../../domain/team/alias.js';
import type { TeamArtworkProvider } from '../providers/team-artwork-provider.js';
import type {
  ProviderAssetCache,
  SyncRepository,
} from './synchronization-types.js';

const providerTeamNameAliases = new Map<string, string[]>([
  ['aek athens', ['aek athens fc']],
  ['afc bournemouth', ['bournemouth']],
  ['arsenal fc', ['arsenal']],
  ['atletico de madrid', ['atletico madrid']],
  ['augsburg', ['fc augsburg']],
  ['borussia m gladbach', ['borussia monchengladbach']],
  ['bosnia herzegovina', ['bosnia & herzergovina', 'bosnia & herzegovina']],
  ['brest', ['stade brestois 29']],
  ['brighton hove albion', ['brighton']],
  ['celta de vigo', ['celta vigo']],
  ['club brugge', ['club brugge kv']],
  ['crvena zvezda', ['fk crvena zvezda']],
  ['freiburg', ['sc freiburg']],
  ['hoffenheim', ['1899 hoffenheim']],
  ['internazionale', ['inter']],
  ['juventus fc', ['juventus']],
  ['koln', ['1 fc koln', 'fc koln']],
  ['kobenhavn', ['fc copenhagen']],
  ['mainz 05', ['fsv mainz 05']],
  ['newcastle united', ['newcastle']],
  ['north macedonia', ['macedonia fyr']],
  ['olympique lyonnais', ['lyon']],
  ['olympique marseille', ['marseille']],
  ['psg', ['paris saint germain']],
  ['psv', ['psv eindhoven']],
  ['republic of ireland', ['rep of ireland']],
  ['salzburg', ['red bull salzburg']],
  ['schalke 04', ['fc schalke 04']],
  ['sporting braga', ['sc braga']],
  ['stuttgart', ['vfb stuttgart']],
  ['tottenham hotspur', ['tottenham']],
  ['vitoria guimaraes', ['guimaraes']],
]);

export type TeamLogoSyncResult = {
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  competitionsProcessed: number;
  providerTeams: number;
  cached: number;
  competitionFlagsCached: number;
  alreadyPresent: number;
  unresolved: number;
  unsupportedCompetitions: string[];
  message: string | null;
};

export type TeamLogoProviderStatus = {
  code: string;
  displayName: string;
  configured: boolean;
  capability: 'TEAM_LOGOS';
};

export class TeamLogoSyncService {
  constructor(
    private readonly repository: SyncRepository,
    private readonly provider: TeamArtworkProvider | null,
    private readonly assetCache: ProviderAssetCache,
    private readonly maxSearchRequests = 75,
  ) {}

  getProviderStatus(): TeamLogoProviderStatus {
    return {
      code: this.provider?.code ?? 'API_FOOTBALL',
      displayName: this.provider?.displayName ?? 'API-Football',
      configured: this.provider !== null,
      capability: 'TEAM_LOGOS',
    };
  }

  async syncAll(): Promise<TeamLogoSyncResult> {
    if (!this.provider) {
      return failedResult('API_FOOTBALL_API_KEY is not configured');
    }

    const unsupportedCompetitions: string[] = [];
    let competitionsProcessed = 0;
    let providerTeams = 0;
    let cached = 0;
    let competitionFlagsCached = 0;
    let alreadyPresent = 0;
    let unresolved = 0;
    let searchRequests = 0;
    const handledTeamIds = new Set<TeamId>();

    try {
      const providerRecord = this.repository.ensureProvider({
        code: this.provider.code,
        displayName: this.provider.displayName,
        enabled: true,
      });
      const competitions = this.repository.listActiveCompetitions();
      competitionFlagsCached = await this.syncCompetitionFlags(
        providerRecord.id,
        competitions,
      );

      for (const competition of competitions) {
        if (!this.provider.supportsCompetition(competition)) {
          unsupportedCompetitions.push(competition.name);
          continue;
        }

        const localTeams = this.repository.listTeamsForCompetition(
          competition.id,
        );
        const localTeamIds = new Set(localTeams.map((team) => team.id));
        const artwork = await this.provider.listTeamArtwork(competition);
        competitionsProcessed += 1;
        providerTeams += artwork.length;

        for (const externalTeam of artwork) {
          const team = this.resolveTeam(
            externalTeam.name,
            localTeams,
            localTeamIds,
          );
          if (!team) {
            continue;
          }
          handledTeamIds.add(team.id);
          if (team.logoAssetId) {
            alreadyPresent += 1;
            this.saveReference(
              providerRecord.id,
              team.id,
              externalTeam.externalId,
            );
            continue;
          }

          const logoAssetId = await this.assetCache.cacheTeamLogo({
            providerId: providerRecord.id,
            teamId: team.id,
            url: externalTeam.logoUrl,
          });
          if (!logoAssetId) {
            unresolved += 1;
            continue;
          }

          this.repository.saveTeam({
            ...team,
            logoAssetId,
            updatedAt: nowUtc(),
          });
          this.saveReference(
            providerRecord.id,
            team.id,
            externalTeam.externalId,
          );
          cached += 1;
        }

        for (const team of localTeams) {
          if (team.logoAssetId || handledTeamIds.has(team.id)) continue;
          if (searchRequests >= this.maxSearchRequests) {
            unresolved += 1;
            continue;
          }
          searchRequests += 1;
          const candidates = await this.provider.searchTeamArtwork(team.name);
          const externalTeam = this.resolveSearchCandidate(team, candidates);
          if (!externalTeam) {
            unresolved += 1;
            continue;
          }
          const logoAssetId = await this.assetCache.cacheTeamLogo({
            providerId: providerRecord.id,
            teamId: team.id,
            url: externalTeam.logoUrl,
          });
          if (!logoAssetId) {
            unresolved += 1;
            continue;
          }
          this.repository.saveTeam({
            ...team,
            logoAssetId,
            updatedAt: nowUtc(),
          });
          this.saveReference(
            providerRecord.id,
            team.id,
            externalTeam.externalId,
          );
          handledTeamIds.add(team.id);
          cached += 1;
        }
      }
    } catch (error) {
      return {
        status: 'FAILED',
        competitionsProcessed,
        providerTeams,
        cached,
        competitionFlagsCached,
        alreadyPresent,
        unresolved,
        unsupportedCompetitions,
        message:
          error instanceof Error
            ? error.message
            : 'Logo synchronization failed',
      };
    }

    return {
      status:
        unresolved > 0 || unsupportedCompetitions.length > 0
          ? 'PARTIAL'
          : 'SUCCESS',
      competitionsProcessed,
      providerTeams,
      cached,
      competitionFlagsCached,
      alreadyPresent,
      unresolved,
      unsupportedCompetitions,
      message: null,
    };
  }

  private resolveTeam(
    externalName: string,
    competitionTeams: Team[],
    competitionTeamIds: Set<TeamId>,
  ): Team | null {
    const normalized = normalizeTeamAlias(externalName);
    const exact = competitionTeams.filter((team) =>
      teamNamesMatch(team.name, externalName, normalized),
    );
    if (exact.length === 1) return exact[0];

    const aliases = this.repository
      .findTeamByNormalizedAlias(externalName)
      .filter((team) => competitionTeamIds.has(team.id));
    return aliases.length === 1 ? aliases[0] : null;
  }

  private resolveSearchCandidate(
    team: Team,
    candidates: Awaited<ReturnType<TeamArtworkProvider['searchTeamArtwork']>>,
  ) {
    const normalized = normalizeTeamAlias(team.name);
    const exact = candidates.filter((candidate) =>
      teamNamesMatch(team.name, candidate.name, normalized),
    );
    if (exact.length === 1) return exact[0];
    return candidates.length === 1 ? candidates[0] : null;
  }

  private saveReference(
    providerId: Parameters<SyncRepository['findProviderReference']>[0],
    teamId: TeamId,
    externalId: string,
  ): void {
    const now = nowUtc();
    const existing = this.repository.findProviderReference(
      providerId,
      'TEAM',
      externalId,
    );
    this.repository.saveProviderReference({
      id: existing?.id ?? createId<'ProviderReferenceId'>(),
      providerId,
      entityType: 'TEAM',
      localEntityId: teamId,
      externalId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
  }

  private async syncCompetitionFlags(
    providerId: Parameters<SyncRepository['findProviderReference']>[0],
    competitions: ReturnType<SyncRepository['listActiveCompetitions']>,
  ): Promise<number> {
    const countries = await this.provider!.listCountryArtwork();
    const countriesByCode = new Map(
      countries.map((country) => [country.code.toUpperCase(), country]),
    );
    const countriesByName = new Map(
      countries.map((country) => [normalizeCountryName(country.name), country]),
    );
    let cached = 0;

    for (const competition of competitions) {
      if (competition.logoAssetId) continue;
      const country =
        countryByCompetition(competition, countriesByCode, countriesByName) ??
        null;
      if (!country) continue;

      const logoAssetId = await this.assetCache.cacheCompetitionLogo({
        providerId,
        competitionId: competition.id,
        url: country.flagUrl,
      });
      if (!logoAssetId) continue;

      this.repository.saveCompetition({
        ...competition,
        logoAssetId,
        updatedAt: nowUtc(),
      });
      cached += 1;
    }

    return cached;
  }
}

function teamNamesMatch(
  localName: string,
  externalName: string,
  normalizedExternalName = normalizeTeamAlias(externalName),
): boolean {
  if (normalizeTeamAlias(localName) === normalizedExternalName) return true;
  const localComparable = comparableTeamName(localName);
  const externalComparable = comparableTeamName(externalName);
  if (localComparable === externalComparable) return true;
  return (
    providerTeamNameAliases
      .get(localComparable)
      ?.includes(externalComparable) ?? false
  );
}

function comparableTeamName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function countryByCompetition(
  competition: ReturnType<SyncRepository['listActiveCompetitions']>[number],
  countriesByCode: Map<
    string,
    Awaited<ReturnType<TeamArtworkProvider['listCountryArtwork']>>[number]
  >,
  countriesByName: Map<
    string,
    Awaited<ReturnType<TeamArtworkProvider['listCountryArtwork']>>[number]
  >,
) {
  const code = competition.countryCode?.toUpperCase();
  if (code) {
    const byCode =
      countriesByCode.get(code) ??
      countriesByCode.get(countryCodeAliases.get(code) ?? '');
    if (byCode) return byCode;
  }

  for (const candidate of [
    competition.regionName,
    countryNameAliases.get(normalizeCountryName(competition.regionName ?? '')),
  ]) {
    if (!candidate) continue;
    const byName = countriesByName.get(normalizeCountryName(candidate));
    if (byName) return byName;
  }

  return null;
}

const countryCodeAliases = new Map<string, string>([
  ['GB', 'GB-ENG'],
  ['UK', 'GB-ENG'],
]);

const countryNameAliases = new Map<string, string>([
  ['europe', 'World'],
  ['eurocups', 'World'],
  ['england', 'England'],
  ['germany', 'Germany'],
  ['spain', 'Spain'],
  ['france', 'France'],
  ['italy', 'Italy'],
  ['portugal', 'Portugal'],
]);

function normalizeCountryName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function failedResult(message: string): TeamLogoSyncResult {
  return {
    status: 'FAILED',
    competitionsProcessed: 0,
    providerTeams: 0,
    cached: 0,
    competitionFlagsCached: 0,
    alreadyPresent: 0,
    unresolved: 0,
    unsupportedCompetitions: [],
    message,
  };
}
