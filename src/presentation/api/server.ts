import { buildApiApp } from './app.js';
import { loadServerEnv } from '../../shared/config/server-env.js';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { CatalogService } from '../../application/catalog/catalog-service.js';
import { SettlementService } from '../../application/settlement/settlement-service.js';
import { SynchronizationService } from '../../application/synchronization/synchronization-service.js';
import { openDatabase } from '../../infrastructure/database/connection.js';
import { DrizzleBulletinRepository } from '../../infrastructure/database/repositories/bulletin-repository.js';
import { DrizzleCatalogRepository } from '../../infrastructure/database/repositories/catalog-repository.js';
import { DrizzleFixtureRepository } from '../../infrastructure/database/repositories/fixture-repository.js';
import { DrizzleMarketRepository } from '../../infrastructure/database/repositories/market-repository.js';
import { DrizzleSyncRepository } from '../../infrastructure/database/repositories/sync-repository.js';
import { GoalApiProvider } from '../../infrastructure/providers/goal-api/goal-api-provider.js';
import { FetchJsonHttpClient } from '../../infrastructure/providers/http-client.js';

const env = loadServerEnv();
const database = openDatabase(env.BET_STUDIO_DB_PATH);
migrate(database.db, { migrationsFolder: './drizzle' });
const goalApiProvider = env.GOAL_API_KEY
  ? new GoalApiProvider(
      new FetchJsonHttpClient({
        apiKey: env.GOAL_API_KEY,
        baseUrl: env.GOAL_API_BASE_URL,
        timeoutMs: env.GOAL_API_TIMEOUT_MS,
      }),
    )
  : null;
const app = buildApiApp({
  catalogService: new CatalogService(new DrizzleCatalogRepository(database.db)),
  settlementService: new SettlementService(
    new DrizzleBulletinRepository(database.db),
    new DrizzleFixtureRepository(database.db),
    new DrizzleMarketRepository(database.db),
  ),
  synchronizationService: new SynchronizationService(
    new DrizzleSyncRepository(database.db),
    goalApiProvider,
  ),
});

const closeGracefully = async (signal: NodeJS.Signals): Promise<void> => {
  app.log.info({ signal }, 'Shutting down Bet Studio API');
  await app.close();
  database.close();
};

process.on('SIGINT', () => {
  void closeGracefully('SIGINT').then(() => process.exit(0));
});

process.on('SIGTERM', () => {
  void closeGracefully('SIGTERM').then(() => process.exit(0));
});

try {
  await app.listen({ host: env.API_HOST, port: env.API_PORT });
  app.log.info(
    `Bet Studio API listening on http://${env.API_HOST}:${env.API_PORT}`,
  );
} catch (error) {
  app.log.error(error, 'Failed to start Bet Studio API');
  process.exit(1);
}
