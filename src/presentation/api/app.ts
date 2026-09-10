import Fastify from 'fastify';

export function buildApiApp() {
  const app = Fastify({
    logger: false,
  });

  app.get('/api/health', () => {
    return { status: 'ok' };
  });

  return app;
}
