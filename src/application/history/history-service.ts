import { z, ZodError } from 'zod';
import type {
  Bulletin,
  BulletinMode,
  BulletinSelection,
  BulletinSelectionSnapshot,
  BulletinStatus,
  BulletinType,
  Fixture,
  FixtureResultDetails,
  FixtureStatus,
  Market,
  RenderRecord,
  SelectionResultSnapshot,
  SelectionStatus,
} from '../../domain/core/types.js';
import { nowUtc, type UtcDateString } from '../../domain/shared/time.js';
import { NotFoundError, ValidationError } from '../../shared/errors.js';

export type HistoryFilters = {
  search?: string;
  status?: BulletinStatus | 'all';
  type?: BulletinType | 'all';
  mode?: BulletinMode | 'all';
  limit?: number;
};

export type BulletinHistoryItem = {
  id: string;
  publicCode: string;
  type: BulletinType;
  mode: BulletinMode;
  status: BulletinStatus;
  totalOdd: string | null;
  selectionCount: number;
  createdAt: UtcDateString;
  updatedAt: UtcDateString;
  latestRender: RenderSummary | null;
};

export type BulletinHistoryDetail = {
  bulletin: Bulletin;
  selections: HistorySelectionDetail[];
  renders: RenderSummary[];
};

export type HistorySelectionDetail = {
  selection: BulletinSelection;
  snapshot: BulletinSelectionSnapshot;
  market: Market | null;
  fixture: {
    fixture: Fixture;
    details: FixtureResultDetails | null;
  } | null;
  calculatedStatus: SelectionStatus;
  manualStatus: SelectionStatus | null;
  effectiveStatus: SelectionStatus;
  currentResult: SelectionResultSnapshot | null;
  timeline: ResultTimelineEvent[];
};

export type ResultTimelineEvent =
  | {
      type: 'CALCULATED';
      selectionId: string;
      status: SelectionStatus | null;
      fixtureStatus: FixtureStatus | null;
      score: string | null;
      evaluationVersion: string | null;
      resultSource: string | null;
      createdAt: UtcDateString;
    }
  | {
      type: 'OVERRIDE';
      selectionId: string;
      previousStatus: SelectionStatus | null;
      newStatus: SelectionStatus | null;
      reason: string | null;
      createdAt: UtcDateString;
    };

export type RenderSummary = {
  id: string;
  fileName: string | null;
  format: string;
  templateVersion: number;
  rendererVersion: string | null;
  dimensions: string | null;
  fingerprint: string | null;
  createdAt: UtcDateString;
  downloadUrl: string;
};

export type FixtureResultUpdate = {
  status: FixtureStatus;
  homeScore: number | null;
  awayScore: number | null;
  liveMinute: number | null;
  homeCorners: number | null;
  awayCorners: number | null;
};

export type HistoryRepository = {
  listBulletins(filters: Required<HistoryFilters>): BulletinHistoryItem[];
  getBulletinDetail(id: string): BulletinHistoryDetail | null;
  updateFixtureResult(fixture: Fixture, details: FixtureResultDetails): void;
  getFixtureResult(fixtureId: string): {
    fixture: Fixture;
    details: FixtureResultDetails | null;
  } | null;
};

const filtersSchema = z.object({
  search: z.string().trim().optional().default(''),
  status: z
    .enum(['all', 'PENDING', 'GREEN', 'RED', 'VOID', 'MANUAL'])
    .optional()
    .default('all'),
  type: z.enum(['all', 'SINGLE', 'MULTI']).optional().default('all'),
  mode: z.enum(['all', 'PRE_MATCH', 'LIVE']).optional().default('all'),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

const fixtureResultSchema = z.object({
  status: z.enum([
    'SCHEDULED',
    'LIVE',
    'FINISHED',
    'POSTPONED',
    'CANCELLED',
    'ABANDONED',
    'UNKNOWN',
  ]),
  homeScore: z.number().int().min(0).nullable().optional(),
  awayScore: z.number().int().min(0).nullable().optional(),
  liveMinute: z.number().int().min(0).nullable().optional(),
  homeCorners: z.number().int().min(0).nullable().optional(),
  awayCorners: z.number().int().min(0).nullable().optional(),
});

export class HistoryService {
  constructor(private readonly repository: HistoryRepository) {}

  listBulletins(input: unknown): { items: BulletinHistoryItem[] } {
    const filters = parseFilters(input);
    return { items: this.repository.listBulletins(filters) };
  }

  getBulletin(id: string): BulletinHistoryDetail {
    const detail = this.repository.getBulletinDetail(id);
    if (!detail) throw new NotFoundError('Bulletin not found');
    return detail;
  }

  updateFixtureResult(fixtureId: string, input: unknown): FixtureResultUpdate {
    const parsed = parseFixtureResult(input);
    const current = this.repository.getFixtureResult(fixtureId);
    if (!current) throw new NotFoundError('Fixture not found');
    const updatedAt = nowUtc();
    this.repository.updateFixtureResult(
      {
        ...current.fixture,
        status: parsed.status,
        homeScore: parsed.homeScore ?? null,
        awayScore: parsed.awayScore ?? null,
        liveMinute: parsed.liveMinute ?? null,
        updatedAt,
      },
      {
        fixtureId: current.fixture.id,
        halfTimeHomeScore: current.details?.halfTimeHomeScore ?? null,
        halfTimeAwayScore: current.details?.halfTimeAwayScore ?? null,
        homeCorners: parsed.homeCorners ?? null,
        awayCorners: parsed.awayCorners ?? null,
        extraData: current.details?.extraData ?? {},
        updatedAt,
      },
    );
    return {
      status: parsed.status,
      homeScore: parsed.homeScore ?? null,
      awayScore: parsed.awayScore ?? null,
      liveMinute: parsed.liveMinute ?? null,
      homeCorners: parsed.homeCorners ?? null,
      awayCorners: parsed.awayCorners ?? null,
    };
  }
}

function parseFilters(input: unknown): Required<HistoryFilters> {
  try {
    return filtersSchema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError('Invalid history filters');
    }
    throw error;
  }
}

function parseFixtureResult(input: unknown): FixtureResultUpdate {
  try {
    const parsed = fixtureResultSchema.parse(input);
    return {
      status: parsed.status,
      homeScore: parsed.homeScore ?? null,
      awayScore: parsed.awayScore ?? null,
      liveMinute: parsed.liveMinute ?? null,
      homeCorners: parsed.homeCorners ?? null,
      awayCorners: parsed.awayCorners ?? null,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError('Invalid fixture result');
    }
    throw error;
  }
}

export function mapRenderRecord(record: RenderRecord): RenderSummary {
  return {
    id: record.id,
    fileName: record.fileName,
    format: record.outputFormat,
    templateVersion: record.templateVersion,
    rendererVersion: record.rendererVersion,
    dimensions:
      record.width && record.height ? `${record.width}x${record.height}` : null,
    fingerprint: record.fingerprint ? record.fingerprint.slice(0, 12) : null,
    createdAt: record.createdAt,
    downloadUrl: `/api/renders/${record.id}/download`,
  };
}
