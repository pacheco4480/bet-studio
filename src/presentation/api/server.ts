import { buildApiApp } from './app.js';
import { loadServerEnv } from '../../shared/config/server-env.js';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { CatalogService } from '../../application/catalog/catalog-service.js';
import { openDatabase } from '../../infrastructure/database/connection.js';
import { DrizzleCatalogRepository } from '../../infrastructure/database/repositories/catalog-repository.js';

const env = loadServerEnv();
const database = openDatabase(env.BET_STUDIO_DB_PATH);
migrate(database.db, { migrationsFolder: './drizzle' });
const app = buildApiApp({
  catalogService: new CatalogService(new DrizzleCatalogRepository(database.db)),
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
