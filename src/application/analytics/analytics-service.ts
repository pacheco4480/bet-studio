import type {
  BulletinMode,
  BulletinStatus,
  BulletinType,
  SelectionStatus,
} from '../../domain/core/types.js';

export type AnalyticsBulletinRow = {
  id: string;
  type: BulletinType;
  mode: BulletinMode;
  status: BulletinStatus;
  stake: string | null;
  totalOdd: string | null;
  createdAt: string;
};

export type AnalyticsSelectionRow = {
  bulletinId: string;
  effectiveStatus: SelectionStatus;
  odd: string;
  marketName: string;
  marketCategory: string | null;
  competitionName: string | null;
};

export type AnalyticsRepository = {
  listBulletins(): AnalyticsBulletinRow[];
  listSelections(): AnalyticsSelectionRow[];
};

export type AnalyticsBreakdownItem = {
  label: string;
  total: number;
  green: number;
  red: number;
  pending: number;
  manual: number;
  void: number;
  winRate: string;
};

export type AnalyticsSummary = {
  totals: {
    bulletins: number;
    selections: number;
    settledBulletins: number;
    pendingBulletins: number;
    greenBulletins: number;
    redBulletins: number;
    voidBulletins: number;
    manualBulletins: number;
  };
  performance: {
    bulletinWinRate: string;
    selectionWinRate: string;
    totalStake: string;
    realizedReturn: string;
    realizedProfit: string;
    averageOdd: string;
  };
  byStatus: Array<{ status: BulletinStatus; count: number }>;
  byType: Array<{ type: BulletinType; count: number }>;
  byMode: Array<{ mode: BulletinMode; count: number }>;
  byMarket: AnalyticsBreakdownItem[];
  byCompetition: AnalyticsBreakdownItem[];
};

const bulletinStatuses: BulletinStatus[] = [
  'PENDING',
  'GREEN',
  'RED',
  'VOID',
  'MANUAL',
];

const bulletinTypes: BulletinType[] = ['SINGLE', 'MULTI'];
const bulletinModes: BulletinMode[] = ['PRE_MATCH', 'LIVE'];

export class AnalyticsService {
  constructor(private readonly repository: AnalyticsRepository) {}

  getSummary(): AnalyticsSummary {
    const bulletins = this.repository.listBulletins();
    const selections = this.repository.listSelections();
    const settledBulletins = bulletins.filter((item) =>
      ['GREEN', 'RED', 'VOID'].includes(item.status),
    );
    const greenBulletins = bulletins.filter(
      (item) => item.status === 'GREEN',
    ).length;
    const redBulletins = bulletins.filter(
      (item) => item.status === 'RED',
    ).length;
    const voidBulletins = bulletins.filter(
      (item) => item.status === 'VOID',
    ).length;
    const manualBulletins = bulletins.filter(
      (item) => item.status === 'MANUAL',
    ).length;
    const pendingBulletins = bulletins.filter(
      (item) => item.status === 'PENDING',
    ).length;

    return {
      totals: {
        bulletins: bulletins.length,
        selections: selections.length,
        settledBulletins: settledBulletins.length,
        pendingBulletins,
        greenBulletins,
        redBulletins,
        voidBulletins,
        manualBulletins,
      },
      performance: {
        bulletinWinRate: winRate(greenBulletins, greenBulletins + redBulletins),
        selectionWinRate: selectionWinRate(selections),
        ...financialSummary(bulletins),
        averageOdd: averageOdd(selections),
      },
      byStatus: bulletinStatuses.map((status) => ({
        status,
        count: bulletins.filter((item) => item.status === status).length,
      })),
      byType: bulletinTypes.map((type) => ({
        type,
        count: bulletins.filter((item) => item.type === type).length,
      })),
      byMode: bulletinModes.map((mode) => ({
        mode,
        count: bulletins.filter((item) => item.mode === mode).length,
      })),
      byMarket: breakdownBy(selections, (item) => item.marketName),
      byCompetition: breakdownBy(
        selections,
        (item) => item.competitionName ?? 'No competition',
      ),
    };
  }
}

function selectionWinRate(selections: AnalyticsSelectionRow[]): string {
  const green = selections.filter((item) => item.effectiveStatus === 'GREEN');
  const red = selections.filter((item) => item.effectiveStatus === 'RED');
  return winRate(green.length, green.length + red.length);
}

function winRate(green: number, settled: number): string {
  if (settled === 0) return '0.0%';
  return `${((green / settled) * 100).toFixed(1)}%`;
}

function financialSummary(bulletins: AnalyticsBulletinRow[]) {
  let totalStake = 0;
  let realizedReturn = 0;

  for (const bulletin of bulletins) {
    const stake = numeric(bulletin.stake);
    if (stake === null) continue;

    if (bulletin.status === 'GREEN') {
      const totalOdd = numeric(bulletin.totalOdd);
      if (totalOdd === null) continue;
      totalStake += stake;
      realizedReturn += stake * totalOdd;
      continue;
    }

    if (bulletin.status === 'RED') {
      totalStake += stake;
      continue;
    }

    if (bulletin.status === 'VOID') {
      totalStake += stake;
      realizedReturn += stake;
    }
  }

  return {
    totalStake: money(totalStake),
    realizedReturn: money(realizedReturn),
    realizedProfit: money(realizedReturn - totalStake),
  };
}

function averageOdd(selections: AnalyticsSelectionRow[]): string {
  const odds = selections
    .map((item) => numeric(item.odd))
    .filter((value): value is number => value !== null);
  if (odds.length === 0) return '-';
  return (odds.reduce((sum, value) => sum + value, 0) / odds.length).toFixed(2);
}

function breakdownBy(
  selections: AnalyticsSelectionRow[],
  labelFor: (item: AnalyticsSelectionRow) => string,
): AnalyticsBreakdownItem[] {
  const groups = new Map<string, AnalyticsSelectionRow[]>();
  for (const selection of selections) {
    const label = labelFor(selection).trim() || 'Unknown';
    groups.set(label, [...(groups.get(label) ?? []), selection]);
  }

  return [...groups.entries()]
    .map(([label, items]) => {
      const green = countStatus(items, 'GREEN');
      const red = countStatus(items, 'RED');
      return {
        label,
        total: items.length,
        green,
        red,
        pending: countStatus(items, 'PENDING'),
        manual: countStatus(items, 'MANUAL'),
        void: countStatus(items, 'VOID'),
        winRate: winRate(green, green + red),
      };
    })
    .sort(
      (left, right) =>
        right.total - left.total || left.label.localeCompare(right.label),
    )
    .slice(0, 8);
}

function countStatus(
  selections: AnalyticsSelectionRow[],
  status: SelectionStatus,
): number {
  return selections.filter((item) => item.effectiveStatus === status).length;
}

function numeric(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function money(value: number): string {
  return value.toFixed(2);
}
