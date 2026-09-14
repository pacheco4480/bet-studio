import path from 'node:path';
import type {
  BulletinAggregateDto,
  BulletinRepository,
} from '../bulletins/bulletin-service.js';
import type {
  RenderOutputFormat,
  RenderRecord,
} from '../../domain/core/types.js';
import { createId } from '../../domain/shared/ids.js';
import type { BulletinId, RenderRecordId } from '../../domain/shared/ids.js';
import { nowUtc } from '../../domain/shared/time.js';
import { NotFoundError, ValidationError } from '../../shared/errors.js';
import { betStudioFeedTemplateV1 } from './feed-template.js';
import { stableHash } from './fingerprint.js';
import { createRenderPlan, validateRenderPlan } from './layout.js';
import {
  FEED_HEIGHT,
  FEED_WIDTH,
  RENDERER_VERSION,
  type BulletinRenderModel,
  type RenderExport,
  type RenderFormat,
  type RenderResult,
  type RenderTemplateVersion,
} from './render-model.js';

export type RenderRecordRepository = {
  saveRenderRecord(record: RenderRecord): void;
  getRenderRecord(id: RenderRecordId): RenderRecord | null;
};

export type BulletinPngRenderer = {
  render(input: {
    model: BulletinRenderModel;
    template: RenderTemplateVersion;
    fingerprint: string;
    renderInputHash: string;
  }): Promise<RenderExport>;
};

export class RenderingService {
  constructor(
    private readonly bulletins: BulletinRepository,
    private readonly records: RenderRecordRepository,
    private readonly renderer: BulletinPngRenderer,
    private readonly outputDirectory: string,
  ) {}

  async renderBulletin(
    bulletinId: string,
    input: { format?: RenderOutputFormat } = {},
  ): Promise<RenderResult> {
    const format = input.format ?? 'FEED';
    if (format !== 'FEED')
      throw new ValidationError('Unsupported render format');
    const aggregate = this.bulletins.findById(bulletinId as BulletinId);
    if (!aggregate) throw new NotFoundError('Bulletin not found');

    const template = this.getTemplate(aggregate.bulletin.templateVersion);
    const model = mapBulletinToRenderModel(aggregate, template);
    const plan = createRenderPlan(model, template);
    validateRenderPlan(plan);
    const renderInputHash = stableHash({ model, template });
    const fingerprint = stableHash({
      model,
      template,
      rendererVersion: RENDERER_VERSION,
      format,
      canvas: template.canvas,
      locale: template.locale,
      timezone: template.timezone,
    });
    const exportResult = await this.renderer.render({
      model,
      template,
      fingerprint,
      renderInputHash,
    });
    if (
      exportResult.width !== FEED_WIDTH ||
      exportResult.height !== FEED_HEIGHT
    ) {
      throw new ValidationError('Rendered PNG dimensions are invalid');
    }

    const renderId = createId<'RenderRecordId'>();
    const fileName = createRenderFileName({
      renderId,
      publicCode: aggregate.bulletin.publicCode,
      format,
      status: aggregate.bulletin.status,
    });
    const filePath = path.join(this.outputDirectory, fileName);
    await this.rendererWriteFile(filePath, exportResult.png);

    const record: RenderRecord = {
      id: renderId,
      bulletinId: aggregate.bulletin.id,
      templateId: aggregate.bulletin.templateId,
      templateVersion: template.version,
      outputFormat: format,
      filePath,
      fileName,
      width: exportResult.width,
      height: exportResult.height,
      rendererVersion: RENDERER_VERSION,
      fingerprint,
      renderInputHash,
      createdAt: nowUtc(),
    };
    this.records.saveRenderRecord(record);

    return {
      renderId,
      bulletinId,
      fingerprint,
      format,
      width: exportResult.width,
      height: exportResult.height,
      fileName,
      downloadUrl: `/api/renders/${renderId}/download`,
    };
  }

  getRenderRecord(id: string): RenderRecord {
    const record = this.records.getRenderRecord(id as RenderRecordId);
    if (!record) throw new NotFoundError('Render record not found');
    return record;
  }

  private getTemplate(version: number): RenderTemplateVersion {
    if (version !== betStudioFeedTemplateV1.version) {
      throw new ValidationError('Unsupported template version');
    }
    return betStudioFeedTemplateV1;
  }

  private async rendererWriteFile(
    filePath: string,
    png: Buffer,
  ): Promise<void> {
    const { mkdir, rename, writeFile, rm } = await import('node:fs/promises');
    await mkdir(path.dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.tmp`;
    try {
      await writeFile(tempPath, png);
      await rename(tempPath, filePath);
    } catch (error) {
      await rm(tempPath, { force: true });
      throw error;
    }
  }
}

function mapBulletinToRenderModel(
  aggregate: BulletinAggregateDto,
  template: RenderTemplateVersion,
): BulletinRenderModel {
  return {
    publicCode: aggregate.bulletin.publicCode,
    type: aggregate.bulletin.type,
    mode: aggregate.bulletin.mode,
    overallStatus: aggregate.bulletin.status,
    stake: aggregate.bulletin.stake,
    totalOdd: aggregate.bulletin.totalOdd,
    createdAt: aggregate.bulletin.createdAt,
    display: aggregate.bulletin.renderConfig,
    selections: aggregate.selections.map((item) => {
      const kickoff = splitKickoff(item.snapshot.kickoffAt, template);
      const fixture = item.fixture?.fixture ?? null;
      const resultText =
        fixture?.homeScore !== null && fixture?.awayScore !== null && fixture
          ? `${fixture.homeScore}-${fixture.awayScore}`
          : null;
      return {
        position: item.selection.position,
        homeTeam: {
          name: item.snapshot.homeTeamName,
          shortName: null,
          logo: null,
        },
        awayTeam: {
          name: item.snapshot.awayTeamName,
          shortName: null,
          logo: null,
        },
        competitionName: item.snapshot.competitionName,
        marketCode: item.snapshot.marketCode,
        marketName: item.snapshot.marketName,
        odd: item.selection.odd,
        kickoffDate: kickoff.date,
        kickoffTime: kickoff.time,
        status: item.effectiveStatus,
        resultText,
        liveMinute: fixture?.liveMinute ?? null,
      };
    }),
  };
}

function splitKickoff(
  value: string | null,
  template: RenderTemplateVersion,
): { date: string | null; time: string | null } {
  if (!value) return { date: null, time: null };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: null, time: null };
  return {
    date: new Intl.DateTimeFormat(template.locale, {
      day: '2-digit',
      month: 'short',
      timeZone: template.timezone,
    })
      .format(date)
      .toUpperCase(),
    time: new Intl.DateTimeFormat(template.locale, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: template.timezone,
    }).format(date),
  };
}

function createRenderFileName(input: {
  renderId: string;
  publicCode: string;
  format: RenderFormat;
  status: string;
}): string {
  const code = input.publicCode
    .replace('#', '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `${code}-${input.format.toLowerCase()}-${input.status.toLowerCase()}-${input.renderId.slice(0, 8)}.png`;
}
