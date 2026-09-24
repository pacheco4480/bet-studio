import { and, eq, isNull } from 'drizzle-orm';
import type {
  Competition,
  Fixture,
  FixtureResultDetails,
  Provider,
  ProviderEntityType,
  ProviderReference,
  SyncRecord,
  Team,
} from '../../../domain/core/types.js';
import type {
  CompetitionId,
  FixtureId,
  ProviderId,
  TeamId,
} from '../../../domain/shared/ids.js';
import { createId } from '../../../domain/shared/ids.js';
import { nowUtc } from '../../../domain/shared/time.js';
import { normalizeTeamAlias } from '../../../domain/team/alias.js';
import type {
  SyncRepository,
  SyncResource,
} from '../../../application/synchronization/synchronization-types.js';
import type { BetStudioDatabase } from '../connection.js';
import {
  competitionTeams,
  competitions,
  fixtureResultDetails,
  fixtures,
  providerReferences,
  providers,
  syncRecords,
  teamAliases,
  teams,
} from '../schema.js';

export class DrizzleSyncRepository implements SyncRepository {
  constructor(private readonly db: BetStudioDatabase) {}

  ensureProvider(
    input: Pick<Provider, 'code' | 'displayName' | 'enabled'>,
  ): Provider {
    const existing = this.findProviderByCode(input.code);
    const now = nowUtc();
    const provider: Provider = existing
      ? {
          ...existing,
          displayName: input.displayName,
          enabled: input.enabled,
          updatedAt: now,
        }
      : {
          id: createId<'ProviderId'>(),
          ...input,
          createdAt: now,
          updatedAt: now,
        };

    this.db
      .insert(providers)
      .values(provider)
      .onConflictDoUpdate({ target: providers.code, set: provider })
      .run();
    return provider;
  }

  findProviderByCode(code: string): Provider | null {
    return (
      (this.db
        .select()
        .from(providers)
        .where(eq(providers.code, code))
        .get() as Provider | undefined) ?? null
    );
  }

  findProviderReference(
    providerId: ProviderId,
    entityType: ProviderEntityType,
    externalId: string,
  ): ProviderReference | null {
    return (
      (this.db
        .select()
        .from(providerReferences)
        .where(
          and(
            eq(providerReferences.providerId, providerId),
            eq(providerReferences.entityType, entityType),
            eq(providerReferences.externalId, externalId),
          ),
        )
        .get() as ProviderReference | undefined) ?? null
    );
  }

  findProviderReferenceByLocal(
    providerId: ProviderId,
    entityType: ProviderEntityType,
    localEntityId: string,
  ): ProviderReference | null {
    return (
      (this.db
        .select()
        .from(providerReferences)
        .where(
          and(
            eq(providerReferences.providerId, providerId),
            eq(providerReferences.entityType, entityType),
            eq(providerReferences.localEntityId, localEntityId),
          ),
        )
        .get() as ProviderReference | undefined) ?? null
    );
  }

  findCompetitionByNameAndRegion(
    name: string,
    regionName: string | null,
  ): Competition | null {
    const record = this.db
      .select()
      .from(competitions)
      .where(
        and(
          eq(competitions.name, name),
          regionName === null
            ? isNull(competitions.regionName)
            : eq(competitions.regionName, regionName),
        ),
      )
      .get();

    return (record as Competition | undefined) ?? null;
  }

  saveProviderReference(reference: ProviderReference): void {
    this.db
      .insert(providerReferences)
      .values(reference)
      .onConflictDoUpdate({
        target: providerReferences.id,
        set: reference,
      })
      .run();
  }

  findCompetition(id: CompetitionId): Competition | null {
    return (
      (this.db
        .select()
        .from(competitions)
        .where(eq(competitions.id, id))
        .get() as Competition | undefined) ?? null
    );
  }

  listActiveCompetitions(): Competition[] {
    return this.db
      .select()
      .from(competitions)
      .where(eq(competitions.active, true))
      .all() as Competition[];
  }

  findTeam(id: TeamId): Team | null {
    return (
      (this.db.select().from(teams).where(eq(teams.id, id)).get() as
        Team | undefined) ?? null
    );
  }

  listTeamsForCompetition(competitionId: CompetitionId): Team[] {
    return this.db
      .select({ team: teams })
      .from(competitionTeams)
      .innerJoin(teams, eq(teams.id, competitionTeams.teamId))
      .where(
        and(
          eq(competitionTeams.competitionId, competitionId),
          eq(competitionTeams.active, true),
          eq(teams.active, true),
        ),
      )
      .all()
      .map((row) => row.team as Team);
  }

  findFixture(
    id: FixtureId,
  ): { fixture: Fixture; details: FixtureResultDetails | null } | null {
    const fixture = this.db
      .select()
      .from(fixtures)
      .where(eq(fixtures.id, id))
      .get() as Fixture | undefined;
    if (!fixture) return null;
    const details = this.db
      .select()
      .from(fixtureResultDetails)
      .where(eq(fixtureResultDetails.fixtureId, id))
      .get() as FixtureResultDetails | undefined;
    return { fixture, details: details ?? null };
  }

  findTeamByNormalizedAlias(value: string): Team[] {
    return this.db
      .select({ team: teams })
      .from(teamAliases)
      .innerJoin(teams, eq(teams.id, teamAliases.teamId))
      .where(eq(teamAliases.normalizedValue, normalizeTeamAlias(value)))
      .all()
      .map((row) => row.team as Team);
  }

  findFixtureByTeamsAndKickoff(input: {
    competitionId: CompetitionId | null;
    homeTeamId: TeamId;
    awayTeamId: TeamId;
    kickoffAt: string | null;
  }): Fixture | null {
    if (!input.kickoffAt) return null;
    return (
      (this.db
        .select()
        .from(fixtures)
        .where(
          and(
            input.competitionId
              ? eq(fixtures.competitionId, input.competitionId)
              : undefined,
            eq(fixtures.homeTeamId, input.homeTeamId),
            eq(fixtures.awayTeamId, input.awayTeamId),
            eq(fixtures.kickoffAt, input.kickoffAt),
          ),
        )
        .get() as Fixture | undefined) ?? null
    );
  }

  saveCompetition(competition: Competition): void {
    this.db
      .insert(competitions)
      .values(competition)
      .onConflictDoUpdate({ target: competitions.id, set: competition })
      .run();
  }

  saveTeam(team: Team): void {
    this.db
      .insert(teams)
      .values(team)
      .onConflictDoUpdate({ target: teams.id, set: team })
      .run();
  }

  assignTeamToCompetition(teamId: TeamId, competitionId: CompetitionId): void {
    this.db
      .insert(competitionTeams)
      .values({ teamId, competitionId, season: '', active: true })
      .onConflictDoNothing()
      .run();
  }

  saveFixture(fixture: Fixture, details?: FixtureResultDetails): void {
    this.db.transaction((tx) => {
      tx.insert(fixtures)
        .values(fixture)
        .onConflictDoUpdate({ target: fixtures.id, set: fixture })
        .run();
      if (details) {
        tx.insert(fixtureResultDetails)
          .values(details)
          .onConflictDoUpdate({
            target: fixtureResultDetails.fixtureId,
            set: details,
          })
          .run();
      }
    });
  }

  saveSyncRecord(record: SyncRecord): void {
    this.db.insert(syncRecords).values(record).run();
  }

  lastSuccessfulSyncAt(
    providerId: ProviderId,
    resourceType?: SyncResource,
  ): string | null {
    const rows = this.db
      .select()
      .from(syncRecords)
      .where(
        and(
          eq(syncRecords.providerId, providerId),
          eq(syncRecords.status, 'SUCCESS'),
          resourceType ? eq(syncRecords.resourceType, resourceType) : undefined,
        ),
      )
      .orderBy(syncRecords.completedAt)
      .all() as SyncRecord[];

    return rows.at(-1)?.completedAt ?? null;
  }
}
