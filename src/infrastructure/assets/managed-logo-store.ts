import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import type { Asset } from '../../domain/core/types.js';
import type { AssetId } from '../../domain/shared/ids.js';
import { createId } from '../../domain/shared/ids.js';
import { nowUtc } from '../../domain/shared/time.js';
import { ValidationError } from '../../shared/errors.js';
import type { ManagedLogoStore } from '../../application/catalog/catalog-types.js';
import type { BetStudioDatabase } from '../database/connection.js';
import { assets } from '../database/schema.js';

const allowedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
const maxInputBytes = 2_000_000;

export class LocalManagedLogoStore implements ManagedLogoStore {
  constructor(
    private readonly db: BetStudioDatabase,
    private readonly directory = 'assets/local/logos',
  ) {}

  async saveLogo(input: {
    entityType: 'competition' | 'team';
    entityId: string;
    dataUrl: string;
  }): Promise<AssetId> {
    const match =
      /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(
        input.dataUrl,
      );
    if (!match || !allowedMimeTypes.has(match[1])) {
      throw new ValidationError('Use a PNG, JPEG or WebP image');
    }
    const original = Buffer.from(match[2], 'base64');
    if (original.length === 0 || original.length > maxInputBytes) {
      throw new ValidationError('Logo image must be smaller than 2 MB');
    }

    let bytes: Buffer;
    try {
      bytes = await sharp(original)
        .rotate()
        .resize(256, 256, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
          withoutEnlargement: true,
        })
        .png({ compressionLevel: 9 })
        .toBuffer();
    } catch {
      throw new ValidationError('Logo image could not be processed');
    }

    const contentHash = createHash('sha256').update(bytes).digest('hex');
    const fileName = `${input.entityType}-${input.entityId}-${contentHash.slice(0, 16)}.png`;
    const filePath = path.join(this.directory, fileName);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, bytes, { flag: 'wx' }).catch((error: unknown) => {
      if (
        typeof error === 'object' &&
        error &&
        'code' in error &&
        error.code === 'EEXIST'
      )
        return;
      throw error;
    });

    const now = nowUtc();
    const asset: Asset = {
      id: createId<'AssetId'>(),
      type: input.entityType === 'team' ? 'TEAM_LOGO' : 'COMPETITION_LOGO',
      source: 'LOCAL',
      filePath,
      contentHash,
      mimeType: 'image/png',
      originalUrl: null,
      providerId: null,
      createdAt: now,
      updatedAt: now,
    };
    this.db.insert(assets).values(asset).run();
    return asset.id;
  }
}
