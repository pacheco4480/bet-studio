import { eq } from 'drizzle-orm';
import type { Team, TeamAlias } from '../../../domain/core/types.js';
import type { TeamId } from '../../../domain/shared/ids.js';
import type { BetStudioDatabase } from '../connection.js';
import { teamAliases, teams } from '../schema.js';

export class DrizzleTeamRepository {
  constructor(private readonly db: BetStudioDatabase) {}

  save(team: Team): void {
    this.db
      .insert(teams)
      .values(team)
      .onConflictDoUpdate({
        target: teams.id,
        set: team,
      })
      .run();
  }

  addAlias(alias: TeamAlias): void {
    this.db.insert(teamAliases).values(alias).run();
  }

  findById(id: TeamId): Team | null {
    const record = this.db.select().from(teams).where(eq(teams.id, id)).get();

    return (record as Team | undefined) ?? null;
  }

  listAliases(teamId: TeamId): TeamAlias[] {
    return this.db
      .select()
      .from(teamAliases)
      .where(eq(teamAliases.teamId, teamId))
      .orderBy(teamAliases.value)
      .all() as TeamAlias[];
  }
}
