import { eq } from 'drizzle-orm';
import { assertSelectionCount } from '../../../domain/core/invariants.js';
import type {
  Bulletin,
  BulletinSelection,
  BulletinSelectionSnapshot,
  SelectionResultSnapshot,
  SettlementOverride,
} from '../../../domain/core/types.js';
import type {
  BulletinId,
  BulletinSelectionId,
} from '../../../domain/shared/ids.js';
import type { BetStudioDatabase } from '../connection.js';
import {
  bulletinCodeSequence,
  bulletinSelectionSnapshots,
  bulletinSelections,
  bulletins,
  selectionResultSnapshots,
  settlementOverrides,
} from '../schema.js';

export type BulletinAggregate = {
  bulletin: Bulletin;
  selections: Array<{
    selection: BulletinSelection;
    snapshot: BulletinSelectionSnapshot;
    resultSnapshot?: SelectionResultSnapshot;
    overrides?: SettlementOverride[];
  }>;
};

export class DrizzleBulletinRepository {
  constructor(private readonly db: BetStudioDatabase) {}

  allocatePublicCode(): string {
    return this.db.transaction((tx) => {
      const current = tx
        .select()
        .from(bulletinCodeSequence)
        .where(eq(bulletinCodeSequence.id, 1))
        .get();
      const nextValue = current?.nextValue ?? 1;

      if (current) {
        tx.update(bulletinCodeSequence)
          .set({ nextValue: nextValue + 1 })
          .where(eq(bulletinCodeSequence.id, 1))
          .run();
      } else {
        tx.insert(bulletinCodeSequence)
          .values({ id: 1, nextValue: nextValue + 1 })
          .run();
      }

      return `BET #${String(nextValue).padStart(4, '0')}`;
    });
  }

  saveAggregate(aggregate: BulletinAggregate): void {
    assertSelectionCount(aggregate.bulletin.type, aggregate.selections.length);

    this.db.transaction((tx) => {
      tx.insert(bulletins)
        .values(aggregate.bulletin)
        .onConflictDoUpdate({
          target: bulletins.id,
          set: aggregate.bulletin,
        })
        .run();

      for (const item of aggregate.selections) {
        tx.insert(bulletinSelections)
          .values(item.selection)
          .onConflictDoUpdate({
            target: bulletinSelections.id,
            set: item.selection,
          })
          .run();
        tx.insert(bulletinSelectionSnapshots)
          .values(item.snapshot)
          .onConflictDoUpdate({
            target: bulletinSelectionSnapshots.selectionId,
            set: item.snapshot,
          })
          .run();

        if (item.resultSnapshot) {
          tx.insert(selectionResultSnapshots)
            .values(item.resultSnapshot)
            .onConflictDoUpdate({
              target: selectionResultSnapshots.selectionId,
              set: item.resultSnapshot,
            })
            .run();
        }

        for (const override of item.overrides ?? []) {
          tx.insert(settlementOverrides)
            .values(override)
            .onConflictDoNothing()
            .run();
        }
      }
    });
  }

  findBySelectionId(id: BulletinSelectionId): BulletinAggregate | null {
    const selection = this.db
      .select()
      .from(bulletinSelections)
      .where(eq(bulletinSelections.id, id))
      .get();

    if (!selection) {
      return null;
    }

    return this.findById(selection.bulletinId as BulletinId);
  }

  findById(id: BulletinId): BulletinAggregate | null {
    const bulletin = this.db
      .select()
      .from(bulletins)
      .where(eq(bulletins.id, id))
      .get();

    if (!bulletin) {
      return null;
    }

    const selections = this.db
      .select()
      .from(bulletinSelections)
      .where(eq(bulletinSelections.bulletinId, id))
      .orderBy(bulletinSelections.position)
      .all();

    return {
      bulletin: bulletin as Bulletin,
      selections: selections.map((selection) => {
        const snapshot = this.db
          .select()
          .from(bulletinSelectionSnapshots)
          .where(eq(bulletinSelectionSnapshots.selectionId, selection.id))
          .get();
        const resultSnapshot = this.db
          .select()
          .from(selectionResultSnapshots)
          .where(eq(selectionResultSnapshots.selectionId, selection.id))
          .get();
        const overrides = this.db
          .select()
          .from(settlementOverrides)
          .where(eq(settlementOverrides.selectionId, selection.id))
          .all();

        if (!snapshot) {
          throw new Error('Bulletin selection snapshot is missing');
        }

        return {
          selection: selection as BulletinSelection,
          snapshot: snapshot as BulletinSelectionSnapshot,
          resultSnapshot:
            (resultSnapshot as SelectionResultSnapshot | undefined) ??
            undefined,
          overrides: overrides as SettlementOverride[],
        };
      }),
    };
  }
}
