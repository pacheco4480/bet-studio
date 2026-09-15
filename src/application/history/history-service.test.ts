import { describe, expect, it } from 'vitest';
import type { Fixture, FixtureResultDetails } from '../../domain/core/types.js';
import { nowUtc } from '../../domain/shared/time.js';
import { ValidationError } from '../../shared/errors.js';
import { HistoryService, type HistoryRepository } from './history-service.js';

describe('HistoryService', () => {
  it('parses simple filters and delegates history listing', () => {
    const calls: unknown[] = [];
    const service = new HistoryService({
      listBulletins: (filters) => {
        calls.push(filters);
        return [];
      },
      getBulletinDetail: () => null,
      getFixtureResult: () => null,
      updateFixtureResult: () => undefined,
    });

    expect(
      service.listBulletins({
        search: '0001',
        status: 'GREEN',
        type: 'SINGLE',
        mode: 'PRE_MATCH',
        limit: '25',
      }),
    ).toEqual({ items: [] });
    expect(calls).toEqual([
      {
        search: '0001',
        status: 'GREEN',
        type: 'SINGLE',
        mode: 'PRE_MATCH',
        limit: 25,
      },
    ]);
  });

  it('validates fixture result corrections before saving', () => {
    const now = nowUtc();
    const fixture: Fixture = {
      id: 'fixture-id' as Fixture['id'],
      competitionId: null,
      homeTeamId: 'home-id' as Fixture['homeTeamId'],
      awayTeamId: 'away-id' as Fixture['awayTeamId'],
      kickoffAt: now,
      status: 'SCHEDULED',
      homeScore: null,
      awayScore: null,
      liveMinute: null,
      sourceType: 'MANUAL',
      createdAt: now,
      updatedAt: now,
    };
    const saved: Array<{ fixture: Fixture; details: FixtureResultDetails }> =
      [];
    const repository: HistoryRepository = {
      listBulletins: () => [],
      getBulletinDetail: () => null,
      getFixtureResult: () => ({ fixture, details: null }),
      updateFixtureResult: (updatedFixture, details) => {
        saved.push({ fixture: updatedFixture, details });
      },
    };

    const service = new HistoryService(repository);
    expect(
      service.updateFixtureResult(fixture.id, {
        status: 'FINISHED',
        homeScore: 2,
        awayScore: 1,
        homeCorners: 6,
        awayCorners: 4,
      }),
    ).toMatchObject({
      status: 'FINISHED',
      homeScore: 2,
      awayScore: 1,
      homeCorners: 6,
      awayCorners: 4,
    });
    expect(saved[0]?.fixture).toMatchObject({
      status: 'FINISHED',
      homeScore: 2,
      awayScore: 1,
    });
    expect(saved[0]?.details).toMatchObject({
      homeCorners: 6,
      awayCorners: 4,
    });

    expect(() =>
      service.updateFixtureResult(fixture.id, {
        status: 'FINISHED',
        homeScore: -1,
      }),
    ).toThrow(ValidationError);
  });
});
