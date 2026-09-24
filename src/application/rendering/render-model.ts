import type {
  BulletinMode,
  BulletinRenderConfig,
  BulletinStatus,
  BulletinType,
  RenderOutputFormat,
  SelectionStatus,
} from '../../domain/core/types.js';

export const RENDERER_VERSION = '1';
export const FEED_WIDTH = 1080;
export const FEED_HEIGHT = 1350;

export type RenderFormat = Extract<RenderOutputFormat, 'FEED'>;

export type RenderAssetRef = {
  assetId: string;
  contentHash: string;
  mimeType: string;
  resolvedPath: string;
};

export type RenderTeamModel = {
  name: string;
  shortName: string | null;
  logo: RenderAssetRef | null;
};

export type RenderSelectionModel = {
  position: number;
  homeTeam: RenderTeamModel;
  awayTeam: RenderTeamModel;
  competitionName: string | null;
  competitionCountryCode: string | null;
  competitionLogo: RenderAssetRef | null;
  marketCode: string;
  marketName: string;
  odd: string;
  kickoffDate: string | null;
  kickoffTime: string | null;
  status: SelectionStatus;
  resultText: string | null;
  liveMinute: number | null;
};

export type BulletinRenderModel = {
  publicCode: string;
  type: BulletinType;
  mode: BulletinMode;
  overallStatus: BulletinStatus;
  stake: string | null;
  totalOdd: string | null;
  createdAt: string;
  display: BulletinRenderConfig;
  selections: RenderSelectionModel[];
};

export type RenderTemplateVersion = {
  templateCode: 'BETSTUDIO_FEED';
  version: 1;
  format: RenderFormat;
  canvas: { width: typeof FEED_WIDTH; height: typeof FEED_HEIGHT };
  locale: 'pt-PT';
  timezone: 'Europe/Lisbon';
  colors: {
    background: string;
    panel: string;
    panelStrong: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    accent: string;
    accentSecondary: string;
    border: string;
    status: Record<SelectionStatus, string>;
  };
  typography: {
    fontFamily: string;
  };
  regions: {
    header: Box;
    selections: Box;
    summary: Box;
    footer: Box;
  };
  layoutModes: LayoutModeConfig[];
};

export type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LayoutModeId =
  'HERO' | 'LARGE' | 'MEDIUM' | 'COMPACT' | 'ULTRA_COMPACT';

export type LayoutModeConfig = {
  id: LayoutModeId;
  minSelections: number;
  maxSelections: number;
  cardHeight: number;
  cardGap: number;
  cardPaddingX: number;
  cardPaddingY: number;
  teamFontSize: number;
  teamFontMinSize: number;
  marketFontSize: number;
  marketFontMinSize: number;
  metadataFontSize: number;
  oddFontSize: number;
  logoSize: number;
};

export type RenderPlan = {
  format: RenderFormat;
  width: number;
  height: number;
  layoutMode: LayoutModeId;
  cards: Array<Box & { position: number }>;
  statusBoxes: Array<Box & { position: number }>;
};

export type RenderExport = {
  png: Buffer;
  width: number;
  height: number;
  fingerprint: string;
  renderInputHash: string;
};

export type RenderResult = {
  renderId: string;
  bulletinId: string;
  fingerprint: string;
  format: RenderFormat;
  width: number;
  height: number;
  fileName: string;
  downloadUrl: string;
};
