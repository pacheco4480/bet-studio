import Fastify from 'fastify';
import {
  CatalogService,
  listQuerySchema,
} from '../../application/catalog/catalog-service.js';
import type { SynchronizationService } from '../../application/synchronization/synchronization-service.js';
import {
  ConflictError,
  NotFoundError,
  ProviderError,
  ValidationError,
} from '../../shared/errors.js';

export function buildApiApp(options?: {
  catalogService?: CatalogService;
  synchronizationService?: SynchronizationService;
}) {
  const app = Fastify({
    logger: true,
  });

  app.get('/api/health', () => {
    return { status: 'ok' };
  });

  if (options?.catalogService) {
    const catalog = options.catalogService;

    app.get('/api/competitions', (request) =>
      catalog.listCompetitions(listQuerySchema.parse(request.query)),
    );
    app.post('/api/competitions', (request, reply) =>
      reply.code(201).send(catalog.createCompetition(request.body)),
    );
    app.get('/api/competitions/:id', (request) =>
      catalog.getCompetition((request.params as { id: string }).id),
    );
    app.patch('/api/competitions/:id', (request) =>
      catalog.updateCompetition(
        (request.params as { id: string }).id,
        request.body,
      ),
    );

    app.get('/api/teams', (request) =>
      catalog.listTeams({
        ...listQuerySchema.parse(request.query),
        competitionId: (request.query as { competitionId?: string })
          .competitionId as never,
      }),
    );
    app.post('/api/teams', (request, reply) =>
      reply.code(201).send(catalog.createTeam(request.body)),
    );
    app.get('/api/teams/:id', (request) =>
      catalog.getTeam((request.params as { id: string }).id),
    );
    app.patch('/api/teams/:id', (request) =>
      catalog.updateTeam((request.params as { id: string }).id, request.body),
    );
    app.post('/api/teams/:id/aliases', (request, reply) =>
      reply
        .code(201)
        .send(
          catalog.addTeamAlias(
            (request.params as { id: string }).id,
            request.body,
          ),
        ),
    );
    app.delete('/api/teams/:id/aliases/:aliasId', (request, reply) => {
      const params = request.params as { id: string; aliasId: string };
      catalog.removeTeamAlias(params.id, params.aliasId);
      return reply.code(204).send();
    });
    app.post('/api/teams/:id/competitions/:competitionId', (request, reply) => {
      const params = request.params as { id: string; competitionId: string };
      catalog.assignTeamToCompetition(params.id, params.competitionId);
      return reply.code(204).send();
    });
    app.delete(
      '/api/teams/:id/competitions/:competitionId',
      (request, reply) => {
        const params = request.params as { id: string; competitionId: string };
        catalog.removeTeamFromCompetition(params.id, params.competitionId);
        return reply.code(204).send();
      },
    );

    app.get('/api/markets', (request) => {
      const query = request.query as {
        search?: string;
        active?: 'all' | 'active' | 'inactive';
        autoEvaluable?: 'all' | 'auto' | 'manual';
        category?: string;
      };
      return catalog.listMarkets({
        ...listQuerySchema.parse(query),
        autoEvaluable: query.autoEvaluable ?? 'all',
        category: query.category,
      });
    });
    app.post('/api/markets', (request, reply) =>
      reply.code(201).send(catalog.createMarket(request.body)),
    );
    app.get('/api/markets/:id', (request) =>
      catalog.getMarket((request.params as { id: string }).id),
    );
    app.patch('/api/markets/:id', (request) =>
      catalog.updateMarket((request.params as { id: string }).id, request.body),
    );
  }

  if (options?.synchronizationService) {
    const synchronization = options.synchronizationService;

    app.get('/api/providers', () => ({
      items: synchronization.getProviderStatuses(),
    }));
    app.get(
      '/api/providers/goal/status',
      () => synchronization.getProviderStatuses()[0] ?? null,
    );
    app.post('/api/sync/competitions', async (request) => {
      const body = (request.body ?? {}) as { maxPages?: number };
      return synchronization.syncCompetitions(body);
    });
    app.post('/api/sync/competitions/:competitionId/teams', async (request) =>
      synchronization.syncTeams(
        (request.params as { competitionId: string }).competitionId,
      ),
    );
    app.post('/api/sync/teams', async () => synchronization.syncAllTeams());
    app.post('/api/sync/fixtures', async (request) => {
      const body = (request.body ?? {}) as {
        date?: string;
        competitionExternalId?: string;
        from?: string;
        to?: string;
      };
      return synchronization.syncFixtures(body);
    });
    app.post('/api/sync/fixtures/:fixtureId/result', async (request) =>
      synchronization.syncFixtureResult(
        (request.params as { fixtureId: string }).fixtureId,
      ),
    );
  }

  app.setErrorHandler((error, request, reply) => {
    request.log.error(
      { error: error instanceof Error ? error.message : error },
      'API request failed',
    );
    if (error instanceof ValidationError)
      return reply
        .code(400)
        .send({ error: error.code, message: error.message });
    if (error instanceof NotFoundError)
      return reply
        .code(404)
        .send({ error: error.code, message: error.message });
    if (error instanceof ConflictError)
      return reply
        .code(409)
        .send({ error: error.code, message: error.message });
    if (error instanceof ProviderError) {
      return reply
        .code(503)
        .send({ error: error.code, message: error.message });
    }
    if (typeof error === 'object' && error !== null && 'issues' in error) {
      return reply
        .code(400)
        .send({ error: 'VALIDATION_ERROR', message: 'Invalid request' });
    }
    return reply
      .code(500)
      .send({ error: 'INTERNAL_ERROR', message: 'Unexpected server error' });
  });

  return app;
}
