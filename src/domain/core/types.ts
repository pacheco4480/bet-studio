import type { DecimalString } from '../shared/decimal.js';
import type {
  AssetId,
  BulletinId,
  BulletinSelectionId,
  CompetitionId,
  FixtureId,
  MarketId,
  ProviderId,
  ProviderReferenceId,
  RenderRecordId,
  SettlementOverrideId,
  SyncRecordId,
  TeamAliasId,
  TeamId,
  TemplateId,
  TemplateVersionId,
} from '../shared/ids.js';
import type { UtcDateString } from '../shared/time.js';

export type FixtureStatus =
  | 'SCHEDULED'
  | 'LIVE'
  | 'FINISHED'
  | 'POSTPONED'
  | 'CANCELLED'
  | 'ABANDONED'
  | 'UNKNOWN';

export type SelectionStatus = 'PENDING' | 'GREEN' | 'RED' | 'VOID' | 'MANUAL';
export type BulletinStatus = SelectionStatus;
export type BulletinType = 'SINGLE' | 'MULTI';
export type BulletinMode = 'PRE_MATCH' | 'LIVE';
export type AssetType =
  | 'TEAM_LOGO'
  | 'COMPETITION_LOGO'
  | 'BRAND'
  | 'TEMPLATE'
  | 'PLACEHOLDER'
  | 'OTHER';
export type AssetSource = 'LOCAL' | 'PROVIDER' | 'GENERATED';
export type ProviderEntityType = 'COMPETITION' | 'TEAM' | 'FIXTURE';
export type FixtureSourceType = 'MANUAL' | 'SYNCED';
export type RenderOutputFormat = 'FEED' | 'STORY';
export type SyncResourceType =
  'COMPETITIONS' | 'TEAMS' | 'FIXTURES' | 'RESULTS' | 'ASSETS';
export type SyncStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED';
export type ResultSource = 'FIXTURE' | 'MANUAL' | 'PROVIDER';
export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type Competition = {
  id: CompetitionId;
  name: string;
  shortName: string | null;
  countryCode: string | null;
  regionName: string | null;
  logoAssetId: AssetId | null;
  active: boolean;
  archivedAt: UtcDateString | null;
  createdAt: UtcDateString;
  updatedAt: UtcDateString;
};

export type Team = Omit<Competition, 'id' | 'regionName'> & {
  id: TeamId;
};

export type TeamAlias = {
  id: TeamAliasId;
  teamId: TeamId;
  value: string;
  normalizedValue: string;
  createdAt: UtcDateString;
};

export type CompetitionTeam = {
  competitionId: CompetitionId;
  teamId: TeamId;
  season: string | null;
  active: boolean;
};

export type Provider = {
  id: ProviderId;
  code: string;
  displayName: string;
  enabled: boolean;
  createdAt: UtcDateString;
  updatedAt: UtcDateString;
};

export type ProviderReference = {
  id: ProviderReferenceId;
  providerId: ProviderId;
  entityType: ProviderEntityType;
  localEntityId: string;
  externalId: string;
  createdAt: UtcDateString;
  updatedAt: UtcDateString;
};

export type Asset = {
  id: AssetId;
  type: AssetType;
  source: AssetSource;
  filePath: string;
  contentHash: string | null;
  mimeType: string | null;
  originalUrl: string | null;
  providerId: ProviderId | null;
  createdAt: UtcDateString;
  updatedAt: UtcDateString;
};

export type Fixture = {
  id: FixtureId;
  competitionId: CompetitionId | null;
  homeTeamId: TeamId;
  awayTeamId: TeamId;
  kickoffAt: UtcDateString | null;
  status: FixtureStatus;
  homeScore: number | null;
  awayScore: number | null;
  liveMinute: number | null;
  sourceType: FixtureSourceType;
  createdAt: UtcDateString;
  updatedAt: UtcDateString;
};

export type FixtureResultDetails = {
  fixtureId: FixtureId;
  halfTimeHomeScore: number | null;
  halfTimeAwayScore: number | null;
  homeCorners: number | null;
  awayCorners: number | null;
  extraData: JsonValue;
  updatedAt: UtcDateString;
};

export type Market = {
  id: MarketId;
  code: string;
  name: string;
  category: string | null;
  active: boolean;
  autoEvaluable: boolean;
  evaluatorKey: string | null;
  parameters: JsonValue;
  createdAt: UtcDateString;
  updatedAt: UtcDateString;
};

export type BulletinRenderConfig = {
  showCompetition: boolean;
  showDate: boolean;
  showTime: boolean;
  showStake: boolean;
  showTotalOdd: boolean;
  showResult: boolean;
  showBulletinCode: boolean;
};

export type Bulletin = {
  id: BulletinId;
  publicCode: string;
  type: BulletinType;
  mode: BulletinMode;
  status: BulletinStatus;
  stake: DecimalString | null;
  totalOdd: DecimalString | null;
  templateId: TemplateId;
  templateVersion: number;
  renderConfig: BulletinRenderConfig;
  createdAt: UtcDateString;
  updatedAt: UtcDateString;
};

export type BulletinSelection = {
  id: BulletinSelectionId;
  bulletinId: BulletinId;
  position: number;
  fixtureId: FixtureId | null;
  marketId: MarketId | null;
  odd: DecimalString;
  calculatedStatus: SelectionStatus;
  manualStatus: SelectionStatus | null;
  createdAt: UtcDateString;
  updatedAt: UtcDateString;
};

export type BulletinSelectionSnapshot = {
  selectionId: BulletinSelectionId;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamLogoAssetId: AssetId | null;
  awayTeamLogoAssetId: AssetId | null;
  competitionName: string | null;
  marketCode: string;
  marketName: string;
  kickoffAt: UtcDateString | null;
  createdAt: UtcDateString;
};

export type SelectionResultSnapshot = {
  selectionId: BulletinSelectionId;
  homeScore: number | null;
  awayScore: number | null;
  fixtureStatus: FixtureStatus | null;
  evaluatedAt: UtcDateString | null;
  evaluationVersion: string | null;
  resultSource: ResultSource | null;
  createdAt: UtcDateString;
  updatedAt: UtcDateString;
};

export type SettlementOverride = {
  id: SettlementOverrideId;
  selectionId: BulletinSelectionId;
  previousStatus: SelectionStatus | null;
  newStatus: SelectionStatus | null;
  reason: string | null;
  createdAt: UtcDateString;
};

export type Template = {
  id: TemplateId;
  code: string;
  name: string;
  bulletinType: BulletinType;
  mode: BulletinMode;
  active: boolean;
  currentVersion: number;
  createdAt: UtcDateString;
  updatedAt: UtcDateString;
};

export type TemplateVersion = {
  id: TemplateVersionId;
  templateId: TemplateId;
  version: number;
  format: RenderOutputFormat;
  config: JsonValue;
  createdAt: UtcDateString;
};

export type RenderRecord = {
  id: RenderRecordId;
  bulletinId: BulletinId;
  templateId: TemplateId;
  templateVersion: number;
  outputFormat: RenderOutputFormat;
  filePath: string;
  createdAt: UtcDateString;
};

export type SyncRecord = {
  id: SyncRecordId;
  providerId: ProviderId;
  resourceType: SyncResourceType;
  scopeKey: string | null;
  status: SyncStatus;
  startedAt: UtcDateString;
  completedAt: UtcDateString | null;
  recordsProcessed: number | null;
  errorCode: string | null;
  errorMessage: string | null;
};
