import { randomUUID } from 'node:crypto';

type Brand<K, T> = K & { readonly __brand: T };

export type CompetitionId = Brand<string, 'CompetitionId'>;
export type TeamId = Brand<string, 'TeamId'>;
export type TeamAliasId = Brand<string, 'TeamAliasId'>;
export type ProviderId = Brand<string, 'ProviderId'>;
export type ProviderReferenceId = Brand<string, 'ProviderReferenceId'>;
export type AssetId = Brand<string, 'AssetId'>;
export type FixtureId = Brand<string, 'FixtureId'>;
export type MarketId = Brand<string, 'MarketId'>;
export type BulletinId = Brand<string, 'BulletinId'>;
export type BulletinSelectionId = Brand<string, 'BulletinSelectionId'>;
export type SettlementOverrideId = Brand<string, 'SettlementOverrideId'>;
export type TemplateId = Brand<string, 'TemplateId'>;
export type TemplateVersionId = Brand<string, 'TemplateVersionId'>;
export type RenderRecordId = Brand<string, 'RenderRecordId'>;
export type SyncRecordId = Brand<string, 'SyncRecordId'>;

export function createId<T extends string>(): Brand<string, T> {
  return randomUUID() as Brand<string, T>;
}
