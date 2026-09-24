import { BulletinService } from '../../application/bulletins/bulletin-service.js';
import { AnalyticsService } from '../../application/analytics/analytics-service.js';
import { HistoryService } from '../../application/history/history-service.js';
import { buildApiApp } from './app.js';
import { loadServerEnv } from '../../shared/config/server-env.js';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { CatalogService } from '../../application/catalog/catalog-service.js';
import { SettlementService } from '../../application/settlement/settlement-service.js';
import { SynchronizationService } from '../../application/synchronization/synchronization-service.js';
import { TeamLogoSyncService } from '../../application/synchronization/team-logo-sync-service.js';
import { openDatabase } from '../../infrastructure/database/connection.js';
import { DrizzleBulletinRepository } from '../../infrastructure/database/repositories/bulletin-repository.js';
import { DrizzleBulletinBuilderRepository } from '../../infrastructure/database/repositories/bulletin-builder-repository.js';
import { DrizzleAnalyticsRepository } from '../../infrastructure/database/repositories/analytics-repository.js';
import { DrizzleCatalogRepository } from '../../infrastructure/database/repositories/catalog-repository.js';
import { DrizzleFixtureRepository } from '../../infrastructure/database/repositories/fixture-repository.js';
import { DrizzleHistoryRepository } from '../../infrastructure/database/repositories/history-repository.js';
import { DrizzleMarketRepository } from '../../infrastructure/database/repositories/market-repository.js';
import { DrizzleRenderRecordRepository } from '../../infrastructure/database/repositories/render-record-repository.js';
import { DrizzleSyncRepository } from '../../infrastructure/database/repositories/sync-repository.js';
import { LocalProviderAssetCache } from '../../infrastructure/assets/provider-asset-cache.js';
import { LocalManagedLogoStore } from '../../infrastructure/assets/managed-logo-store.js';
import { HtmlFeedRenderer } from '../../infrastructure/rendering/html-feed-renderer.js';
import { GoalApiProvider } from '../../infrastructure/providers/goal-api/goal-api-provider.js';
import { ApiFootballArtworkProvider } from '../../infrastructure/providers/api-football/api-football-artwork-provider.js';
import { FetchJsonHttpClient } from '../../infrastructure/providers/http-client.js';
import { RenderingService } from '../../application/rendering/rendering-service.js';

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
const apiFootballArtworkProvider = env.API_FOOTBALL_API_KEY
  ? new ApiFootballArtworkProvider({
      apiKey: env.API_FOOTBALL_API_KEY,
      baseUrl: env.API_FOOTBALL_BASE_URL,
      timeoutMs: env.API_FOOTBALL_TIMEOUT_MS,
      season: env.API_FOOTBALL_SEASON,
      minRequestIntervalMs: env.API_FOOTBALL_REQUEST_INTERVAL_MS,
    })
  : null;
const bulletinRepository = new DrizzleBulletinBuilderRepository(database.db);
const syncRepository = new DrizzleSyncRepository(database.db);
const providerAssetCache = new LocalProviderAssetCache(database.db);
const app = buildApiApp({
  analyticsService: new AnalyticsService(
    new DrizzleAnalyticsRepository(database.db),
  ),
  bulletinService: new BulletinService(bulletinRepository),
  historyService: new HistoryService(new DrizzleHistoryRepository(database.db)),
  renderingService: new RenderingService(
    bulletinRepository,
    new DrizzleRenderRecordRepository(database.db),
    new HtmlFeedRenderer(),
    'exports/renders',
  ),
  catalogService: new CatalogService(
    new DrizzleCatalogRepository(database.db),
    'assets',
    new LocalManagedLogoStore(database.db),
  ),
  settlementService: new SettlementService(
    new DrizzleBulletinRepository(database.db),
    new DrizzleFixtureRepository(database.db),
    new DrizzleMarketRepository(database.db),
  ),
  synchronizationService: new SynchronizationService(
    syncRepository,
    goalApiProvider,
    providerAssetCache,
  ),
  teamLogoSyncService: new TeamLogoSyncService(
    syncRepository,
    apiFootballArtworkProvider,
    providerAssetCache,
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
