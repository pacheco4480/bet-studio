import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { and, eq } from 'drizzle-orm';
import type { Asset } from '../../domain/core/types.js';
import type {
  AssetId,
  CompetitionId,
  ProviderId,
  TeamId,
} from '../../domain/shared/ids.js';
import { createId } from '../../domain/shared/ids.js';
import { nowUtc } from '../../domain/shared/time.js';
import type { ProviderAssetCache } from '../../application/synchronization/synchronization-types.js';
import type { BetStudioDatabase } from '../database/connection.js';
import { assets } from '../database/schema.js';

const maxAssetBytes = 750_000;
const allowedTypes = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
  ['image/svg+xml', 'svg'],
]);

export class LocalProviderAssetCache implements ProviderAssetCache {
  constructor(
    private readonly db: BetStudioDatabase,
    private readonly assetDirectory = 'assets/provider/team-logos',
  ) {}

  async cacheTeamLogo(input: {
    providerId: ProviderId;
    url: string;
    teamId: TeamId;
  }): Promise<AssetId | null> {
    return this.cacheLogo({
      providerId: input.providerId,
      url: input.url,
      entityId: input.teamId,
      assetType: 'TEAM_LOGO',
      directory: this.assetDirectory,
    });
  }

  async cacheCompetitionLogo(input: {
    providerId: ProviderId;
    url: string;
    competitionId: CompetitionId;
  }): Promise<AssetId | null> {
    return this.cacheLogo({
      providerId: input.providerId,
      url: input.url,
      entityId: input.competitionId,
      assetType: 'COMPETITION_LOGO',
      directory: 'assets/provider/competition-logos',
    });
  }

  private async cacheLogo(input: {
    providerId: ProviderId;
    url: string;
    entityId: string;
    assetType: 'TEAM_LOGO' | 'COMPETITION_LOGO';
    directory: string;
  }): Promise<AssetId | null> {
    const url = safeUrl(input.url);
    if (!url) return null;

    const existing = this.db
      .select()
      .from(assets)
      .where(
        and(
          eq(assets.providerId, input.providerId),
          eq(assets.originalUrl, url.href),
          eq(assets.type, input.assetType),
        ),
      )
      .get() as Asset | undefined;
    if (existing) return existing.id;

    const response = await fetch(url).catch(() => null);
    if (!response?.ok) return null;

    const contentType = response.headers
      .get('content-type')
      ?.split(';')[0]
      ?.trim()
      .toLowerCase();
    const extension = contentType ? allowedTypes.get(contentType) : null;
    if (!contentType || !extension) return null;

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > maxAssetBytes) return null;

    const contentHash = createHash('sha256').update(bytes).digest('hex');
    const fileName = `${input.entityId}-${contentHash.slice(0, 16)}.${extension}`;
    const filePath = path.join(input.directory, fileName);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, bytes, { flag: 'wx' }).catch((error: unknown) => {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'EEXIST'
      ) {
        return;
      }
      throw error;
    });

    const now = nowUtc();
    const asset: Asset = {
      id: createId<'AssetId'>(),
      type: input.assetType,
      source: 'PROVIDER',
      filePath,
      contentHash,
      mimeType: contentType,
      originalUrl: url.href,
      providerId: input.providerId,
      createdAt: now,
      updatedAt: now,
    };
    this.db.insert(assets).values(asset).run();
    return asset.id;
  }
}

function safeUrl(input: string): URL | null {
  try {
    const url = new URL(input);
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}
