import Fastify from 'fastify';
import type { AnalyticsService } from '../../application/analytics/analytics-service.js';
import { BulletinService } from '../../application/bulletins/bulletin-service.js';
import type { HistoryService } from '../../application/history/history-service.js';
import type { RenderingService } from '../../application/rendering/rendering-service.js';
import {
  CatalogService,
  listQuerySchema,
} from '../../application/catalog/catalog-service.js';
import type { SettlementService } from '../../application/settlement/settlement-service.js';
import type { SynchronizationService } from '../../application/synchronization/synchronization-service.js';
import type { TeamLogoSyncService } from '../../application/synchronization/team-logo-sync-service.js';
import {
  ConflictError,
  NotFoundError,
  ProviderError,
  RenderingError,
  ValidationError,
} from '../../shared/errors.js';

export function buildApiApp(options?: {
  analyticsService?: AnalyticsService;
  bulletinService?: BulletinService;
  catalogService?: CatalogService;
  historyService?: HistoryService;
  renderingService?: RenderingService;
  settlementService?: SettlementService;
  synchronizationService?: SynchronizationService;
  teamLogoSyncService?: TeamLogoSyncService;
}) {
  const app = Fastify({
    logger: true,
    bodyLimit: 256 * 1024,
  });

  app.get('/api/health', () => {
    return { status: 'ok' };
  });

  if (options?.analyticsService) {
    const analytics = options.analyticsService;

    app.get('/api/analytics/summary', () => analytics.getSummary());
  }

  if (options?.bulletinService) {
    const bulletins = options.bulletinService;

    app.get('/api/bulletins', () => bulletins.listBulletins());
    app.post('/api/bulletins', (request, reply) =>
      reply
        .code(201)
        .send(
          decorateBulletinAggregate(
            bulletins.createBulletin(request.body),
            options.catalogService,
          ),
        ),
    );
    app.get('/api/bulletins/:id', (request) =>
      decorateBulletinAggregate(
        bulletins.getBulletin((request.params as { id: string }).id),
        options.catalogService,
      ),
    );
    app.patch('/api/bulletins/:id', (request) =>
      decorateBulletinAggregate(
        bulletins.updateBulletin(
          (request.params as { id: string }).id,
          request.body,
        ),
        options.catalogService,
      ),
    );
    app.post('/api/bulletins/:id/duplicate', (request, reply) =>
      reply
        .code(201)
        .send(
          decorateBulletinAggregate(
            bulletins.duplicateBulletin((request.params as { id: string }).id),
            options.catalogService,
          ),
        ),
    );
    app.get('/api/builder/fixtures', (request) => {
      const query = request.query as {
        search?: string;
        limit?: string;
        upcomingOnly?: string;
        includeArchived?: string;
      };
      const result = bulletins.listFixtures({
        search: query.search,
        limit: query.limit ? Number(query.limit) : undefined,
        upcomingOnly: query.upcomingOnly !== 'false',
        includeArchived: query.includeArchived === 'true',
      });
      return options.catalogService
        ? {
            ...result,
            items: result.items.map((item) =>
              decorateFixtureOption(item, options.catalogService!),
            ),
          }
        : result;
    });
    app.post('/api/builder/fixtures', (request, reply) =>
      reply
        .code(201)
        .send(
          options.catalogService
            ? decorateFixtureOption(
                bulletins.createFixture(request.body),
                options.catalogService,
              )
            : bulletins.createFixture(request.body),
        ),
    );
    app.patch('/api/fixtures/:id/archive', (request) => {
      const body = (request.body ?? {}) as { archived?: boolean };
      const result = bulletins.setFixtureArchived(
        (request.params as { id: string }).id,
        body.archived === true,
      );
      return options.catalogService
        ? decorateFixtureOption(result, options.catalogService)
        : result;
    });
    app.get('/api/builder/markets', (request) => {
      const query = request.query as {
        search?: string;
        activeOnly?: string;
        limit?: string;
      };
      return bulletins.listMarkets({
        search: query.search,
        activeOnly: query.activeOnly !== 'false',
        limit: query.limit ? Number(query.limit) : undefined,
      });
    });
  }

  if (options?.renderingService) {
    const rendering = options.renderingService;

    app.post('/api/bulletins/:id/render', async (request, reply) => {
      const body = (request.body ?? {}) as { format?: 'FEED' | 'STORY' };
      return reply
        .code(201)
        .send(
          await rendering.renderBulletin(
            (request.params as { id: string }).id,
            body,
          ),
        );
    });
    app.get('/api/renders/:id/download', async (request, reply) => {
      const render = await rendering.readRenderPng(
        (request.params as { id: string }).id,
      );
      return reply
        .header('content-type', 'image/png')
        .header(
          'content-disposition',
          `attachment; filename="${render.fileName}"`,
        )
        .send(render.png);
    });
  }

  if (options?.historyService) {
    const history = options.historyService;

    app.get('/api/history/bulletins', (request) =>
      history.listBulletins(request.query),
    );
    app.get('/api/history/bulletins/:id', (request) =>
      history.getBulletin((request.params as { id: string }).id),
    );
    app.patch('/api/fixtures/:id/result', (request) =>
      history.updateFixtureResult(
        (request.params as { id: string }).id,
        request.body,
      ),
    );
  }

  if (options?.catalogService) {
    const catalog = options.catalogService;

    app.get('/api/assets/:id', async (request, reply) => {
      const asset = await catalog.readAsset(
        (request.params as { id: string }).id,
      );
      return reply
        .header('content-type', asset.mimeType)
        .header('cache-control', 'private, max-age=86400')
        .send(asset.bytes);
    });

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
    app.post(
      '/api/competitions/:id/logo',
      { bodyLimit: 3 * 1024 * 1024 },
      (request) =>
        catalog.setCompetitionLogo(
          (request.params as { id: string }).id,
          request.body,
        ),
    );
    app.delete('/api/competitions/:id/logo', (request) =>
      catalog.removeCompetitionLogo((request.params as { id: string }).id),
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
    app.post('/api/teams/:id/logo', { bodyLimit: 3 * 1024 * 1024 }, (request) =>
      catalog.setTeamLogo((request.params as { id: string }).id, request.body),
    );
    app.delete('/api/teams/:id/logo', (request) =>
      catalog.removeTeamLogo((request.params as { id: string }).id),
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

  if (options?.teamLogoSyncService) {
    const teamLogos = options.teamLogoSyncService;
    app.get('/api/providers/api-football/status', () =>
      teamLogos.getProviderStatus(),
    );
    app.post('/api/sync/team-logos', async () => teamLogos.syncAll());
  }

  if (options?.settlementService) {
    const settlement = options.settlementService;

    app.post('/api/selections/:id/evaluate', (request) =>
      settlement.reEvaluateSelection((request.params as { id: string }).id),
    );
    app.post('/api/bulletins/:id/evaluate', (request) =>
      settlement.reEvaluateBulletin((request.params as { id: string }).id),
    );
    app.patch('/api/selections/:id/settlement-override', (request) =>
      settlement.setManualOverride(
        (request.params as { id: string }).id,
        request.body,
      ),
    );
    app.delete('/api/selections/:id/settlement-override', (request) =>
      settlement.resetManualOverride((request.params as { id: string }).id),
    );
  }

  app.setErrorHandler((error, request, reply) => {
    request.log.error(
      { error: error instanceof Error ? error.message : error },
      'API request failed',
    );
    if (error instanceof ValidationError)
      return sendError(reply, 400, error.code, error.message);
    if (error instanceof NotFoundError)
      return sendError(reply, 404, error.code, error.message);
    if (error instanceof ConflictError)
      return sendError(reply, 409, error.code, error.message);
    if (error instanceof ProviderError) {
      return sendError(reply, 503, error.code, error.message);
    }
    if (error instanceof RenderingError) {
      return sendError(reply, 503, error.code, error.message);
    }
    if (typeof error === 'object' && error !== null && 'issues' in error) {
      return sendError(reply, 400, 'VALIDATION_ERROR', 'Invalid request');
    }
    if (
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      error.statusCode === 413
    ) {
      return sendError(
        reply,
        413,
        'REQUEST_BODY_TOO_LARGE',
        'Request body is too large',
      );
    }
    return sendError(reply, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  });

  return app;
}

function decorateFixtureOption(
  item: ReturnType<BulletinService['listFixtures']>['items'][number],
  catalog: CatalogService,
) {
  return {
    ...item,
    homeTeam: safeDecoratedTeam(item.homeTeam.id, item.homeTeam, catalog),
    awayTeam: safeDecoratedTeam(item.awayTeam.id, item.awayTeam, catalog),
    competition: item.competition
      ? safeDecoratedCompetition(item.competition.id, item.competition, catalog)
      : null,
  };
}

function decorateBulletinAggregate(
  aggregate: ReturnType<BulletinService['getBulletin']>,
  catalog: CatalogService | undefined,
) {
  if (!catalog) return aggregate;
  return {
    ...aggregate,
    selections: aggregate.selections.map((selection) => ({
      ...selection,
      fixture: selection.fixture
        ? decorateFixtureOption(selection.fixture, catalog)
        : null,
    })),
  };
}

function safeDecoratedTeam(
  id: string,
  fallback: ReturnType<
    BulletinService['listFixtures']
  >['items'][number]['homeTeam'],
  catalog: CatalogService,
) {
  try {
    return catalog.getTeam(id);
  } catch {
    return { ...fallback, logo: null };
  }
}

function safeDecoratedCompetition(
  id: string,
  fallback: NonNullable<
    ReturnType<BulletinService['listFixtures']>['items'][number]['competition']
  >,
  catalog: CatalogService,
) {
  try {
    return catalog.getCompetition(id);
  } catch {
    return { ...fallback, logo: null };
  }
}

function sendError(
  reply: {
    code: (statusCode: number) => {
      send: (payload: unknown) => unknown;
    };
  },
  statusCode: number,
  code: string,
  message: string,
) {
  return reply.code(statusCode).send({ error: { code, message } });
}
