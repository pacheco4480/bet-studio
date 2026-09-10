import { eq } from 'drizzle-orm';
import type { Competition } from '../../../domain/core/types.js';
import type { CompetitionId } from '../../../domain/shared/ids.js';
import type { BetStudioDatabase } from '../connection.js';
import { competitions } from '../schema.js';

export class DrizzleCompetitionRepository {
  constructor(private readonly db: BetStudioDatabase) {}

  save(competition: Competition): void {
    this.db
      .insert(competitions)
      .values(competition)
      .onConflictDoUpdate({
        target: competitions.id,
        set: competition,
      })
      .run();
  }

  findById(id: CompetitionId): Competition | null {
    const record = this.db
      .select()
      .from(competitions)
      .where(eq(competitions.id, id))
      .get();

    return (record as Competition | undefined) ?? null;
  }

  list(): Competition[] {
    return this.db
      .select()
      .from(competitions)
      .orderBy(competitions.name)
      .all() as Competition[];
  }
}
