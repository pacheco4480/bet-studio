import { eq } from 'drizzle-orm';
import type { Market } from '../../../domain/core/types.js';
import type { MarketId } from '../../../domain/shared/ids.js';
import type { BetStudioDatabase } from '../connection.js';
import { markets } from '../schema.js';

export class DrizzleMarketRepository {
  constructor(private readonly db: BetStudioDatabase) {}

  save(market: Market): void {
    this.db
      .insert(markets)
      .values(market)
      .onConflictDoUpdate({
        target: markets.id,
        set: market,
      })
      .run();
  }

  findById(id: MarketId): Market | null {
    const record = this.db
      .select()
      .from(markets)
      .where(eq(markets.id, id))
      .get();

    return (record as Market | undefined) ?? null;
  }

  findByCode(code: string): Market | null {
    const record = this.db
      .select()
      .from(markets)
      .where(eq(markets.code, code))
      .get();

    return (record as Market | undefined) ?? null;
  }
}
