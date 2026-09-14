import { eq } from 'drizzle-orm';
import type { RenderRecord } from '../../../domain/core/types.js';
import type { RenderRecordId } from '../../../domain/shared/ids.js';
import type { BetStudioDatabase } from '../connection.js';
import { renderRecords } from '../schema.js';
import type { RenderRecordRepository } from '../../../application/rendering/rendering-service.js';

export class DrizzleRenderRecordRepository implements RenderRecordRepository {
  constructor(private readonly db: BetStudioDatabase) {}

  saveRenderRecord(record: RenderRecord): void {
    this.db.insert(renderRecords).values(record).run();
  }

  getRenderRecord(id: RenderRecordId): RenderRecord | null {
    return (
      (this.db
        .select()
        .from(renderRecords)
        .where(eq(renderRecords.id, id))
        .get() as RenderRecord | undefined) ?? null
    );
  }
}
