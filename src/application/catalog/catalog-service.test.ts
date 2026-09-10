import { describe, expect, it } from 'vitest';
import { CatalogService } from './catalog-service.js';
import { DrizzleCatalogRepository } from '../../infrastructure/database/repositories/catalog-repository.js';
import { createMigratedTestDatabase } from '../../infrastructure/database/test-utils.js';

function createService() {
  const database = createMigratedTestDatabase();
  return {
    service: new CatalogService(new DrizzleCatalogRepository(database.db)),
    cleanup: database.cleanup,
  };
}

describe('CatalogService', () => {
  it('filters active competitions and archives inactive records', () => {
    const { service, cleanup } = createService();
    try {
      const competition = service.createCompetition({
        name: 'Liga Portugal',
        countryCode: 'PT',
      });
      service.createCompetition({ name: 'Premier League', countryCode: 'GB' });
      service.updateCompetition(competition.id, { active: false });

      expect(service.listCompetitions({ active: 'active' }).items).toHaveLength(
        1,
      );
      expect(
        service.listCompetitions({ active: 'inactive' }).items[0]?.archivedAt,
      ).toEqual(expect.any(String));
    } finally {
      cleanup();
    }
  });

  it('normalizes team aliases before enforcing uniqueness', () => {
    const { service, cleanup } = createService();
    try {
      const team = service.createTeam({ name: 'Sporting CP' });
      service.addTeamAlias(team.id, { value: ' Sporting   Clube ' });

      expect(() =>
        service.addTeamAlias(team.id, { value: 'sporting clube' }),
      ).toThrow('Team alias already exists');
    } finally {
      cleanup();
    }
  });

  it('assigns and removes teams from competitions', () => {
    const { service, cleanup } = createService();
    try {
      const competition = service.createCompetition({ name: 'Liga Portugal' });
      const team = service.createTeam({ name: 'Benfica' });

      service.assignTeamToCompetition(team.id, competition.id);
      expect(service.getTeam(team.id).competitions).toHaveLength(1);

      service.removeTeamFromCompetition(team.id, competition.id);
      expect(service.getTeam(team.id).competitions).toHaveLength(0);
    } finally {
      cleanup();
    }
  });
});
