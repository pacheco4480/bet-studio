import { eq } from 'drizzle-orm';
import type {
  Fixture,
  FixtureResultDetails,
} from '../../../domain/core/types.js';
import type { FixtureId } from '../../../domain/shared/ids.js';
import type { BetStudioDatabase } from '../connection.js';
import { fixtureResultDetails, fixtures } from '../schema.js';

export class DrizzleFixtureRepository {
  constructor(private readonly db: BetStudioDatabase) {}

  save(fixture: Fixture, details?: FixtureResultDetails): void {
    this.db.transaction((tx) => {
      tx.insert(fixtures)
        .values(fixture)
        .onConflictDoUpdate({
          target: fixtures.id,
          set: fixture,
        })
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

  findById(id: FixtureId): {
    fixture: Fixture;
    details: FixtureResultDetails | null;
  } | null {
    const fixture = this.db
      .select()
      .from(fixtures)
      .where(eq(fixtures.id, id))
      .get();

    if (!fixture) {
      return null;
    }

    const details = this.db
      .select()
      .from(fixtureResultDetails)
      .where(eq(fixtureResultDetails.fixtureId, id))
      .get();

    return {
      fixture: fixture as Fixture,
      details: (details as FixtureResultDetails | undefined) ?? null,
    };
  }
}
