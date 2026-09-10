import { buildApiApp } from './app.js';
import { loadServerEnv } from '../../shared/config/server-env.js';

const env = loadServerEnv();
const app = buildApiApp();

const closeGracefully = async (signal: NodeJS.Signals): Promise<void> => {
  app.log.info({ signal }, 'Shutting down Bet Studio API');
  await app.close();
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
