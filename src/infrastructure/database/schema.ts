import { relations, sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

const timestamps = {
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
};

const id = text('id').primaryKey();

export const assets = sqliteTable(
  'assets',
  {
    id,
    type: text('type').notNull(),
    source: text('source').notNull(),
    filePath: text('file_path').notNull(),
    contentHash: text('content_hash'),
    mimeType: text('mime_type'),
    originalUrl: text('original_url'),
    providerId: text('provider_id').references(() => providers.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (table) => ({
    contentHashIdx: index('assets_content_hash_idx').on(table.contentHash),
  }),
);

export const competitions = sqliteTable(
  'competitions',
  {
    id,
    name: text('name').notNull(),
    shortName: text('short_name'),
    countryCode: text('country_code'),
    regionName: text('region_name'),
    logoAssetId: text('logo_asset_id').references(() => assets.id, {
      onDelete: 'set null',
    }),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    archivedAt: text('archived_at'),
    ...timestamps,
  },
  (table) => ({
    activeIdx: index('competitions_active_idx').on(table.active),
  }),
);

export const teams = sqliteTable(
  'teams',
  {
    id,
    name: text('name').notNull(),
    shortName: text('short_name'),
    countryCode: text('country_code'),
    logoAssetId: text('logo_asset_id').references(() => assets.id, {
      onDelete: 'set null',
    }),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    archivedAt: text('archived_at'),
    ...timestamps,
  },
  (table) => ({
    activeIdx: index('teams_active_idx').on(table.active),
  }),
);

export const teamAliases = sqliteTable(
  'team_aliases',
  {
    id,
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    value: text('value').notNull(),
    normalizedValue: text('normalized_value').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    normalizedIdx: index('team_aliases_normalized_value_idx').on(
      table.normalizedValue,
    ),
    teamAliasUnique: uniqueIndex('team_aliases_team_normalized_unique').on(
      table.teamId,
      table.normalizedValue,
    ),
  }),
);

export const competitionTeams = sqliteTable(
  'competition_teams',
  {
    competitionId: text('competition_id')
      .notNull()
      .references(() => competitions.id, { onDelete: 'restrict' }),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'restrict' }),
    season: text('season').notNull().default(''),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
  },
  (table) => ({
    pk: uniqueIndex('competition_teams_unique').on(
      table.competitionId,
      table.teamId,
      table.season,
    ),
    competitionIdx: index('competition_teams_competition_id_idx').on(
      table.competitionId,
    ),
    teamIdx: index('competition_teams_team_id_idx').on(table.teamId),
  }),
);

export const providers = sqliteTable(
  'providers',
  {
    id,
    code: text('code').notNull(),
    displayName: text('display_name').notNull(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
    ...timestamps,
  },
  (table) => ({
    codeUnique: uniqueIndex('providers_code_unique').on(table.code),
  }),
);

export const providerReferences = sqliteTable(
  'provider_references',
  {
    id,
    providerId: text('provider_id')
      .notNull()
      .references(() => providers.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(),
    localEntityId: text('local_entity_id').notNull(),
    externalId: text('external_id').notNull(),
    ...timestamps,
  },
  (table) => ({
    externalUnique: uniqueIndex('provider_references_external_unique').on(
      table.providerId,
      table.entityType,
      table.externalId,
    ),
    localUnique: uniqueIndex('provider_references_local_unique').on(
      table.providerId,
      table.entityType,
      table.localEntityId,
    ),
    providerIdx: index('provider_references_provider_id_idx').on(
      table.providerId,
    ),
  }),
);

export const providerRateLimits = sqliteTable('provider_rate_limits', {
  providerId: text('provider_id')
    .primaryKey()
    .references(() => providers.id, { onDelete: 'cascade' }),
  limit: integer('limit'),
  remaining: integer('remaining'),
  resetsAt: text('resets_at'),
  updatedAt: text('updated_at').notNull(),
});

export const fixtures = sqliteTable(
  'fixtures',
  {
    id,
    competitionId: text('competition_id').references(() => competitions.id, {
      onDelete: 'set null',
    }),
    homeTeamId: text('home_team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'restrict' }),
    awayTeamId: text('away_team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'restrict' }),
    kickoffAt: text('kickoff_at'),
    status: text('status').notNull(),
    homeScore: integer('home_score'),
    awayScore: integer('away_score'),
    liveMinute: integer('live_minute'),
    sourceType: text('source_type').notNull(),
    ...timestamps,
  },
  (table) => ({
    kickoffIdx: index('fixtures_kickoff_at_idx').on(table.kickoffAt),
    competitionIdx: index('fixtures_competition_id_idx').on(
      table.competitionId,
    ),
    homeTeamIdx: index('fixtures_home_team_id_idx').on(table.homeTeamId),
    awayTeamIdx: index('fixtures_away_team_id_idx').on(table.awayTeamId),
    statusIdx: index('fixtures_status_idx').on(table.status),
    differentTeams: check(
      'fixtures_different_teams_check',
      sql`${table.homeTeamId} <> ${table.awayTeamId}`,
    ),
    homeScoreCheck: check(
      'fixtures_home_score_non_negative_check',
      sql`${table.homeScore} is null or ${table.homeScore} >= 0`,
    ),
    awayScoreCheck: check(
      'fixtures_away_score_non_negative_check',
      sql`${table.awayScore} is null or ${table.awayScore} >= 0`,
    ),
  }),
);

export const fixtureResultDetails = sqliteTable('fixture_result_details', {
  fixtureId: text('fixture_id')
    .primaryKey()
    .references(() => fixtures.id, { onDelete: 'cascade' }),
  halfTimeHomeScore: integer('half_time_home_score'),
  halfTimeAwayScore: integer('half_time_away_score'),
  homeCorners: integer('home_corners'),
  awayCorners: integer('away_corners'),
  extraData: text('extra_data', { mode: 'json' }),
  updatedAt: text('updated_at').notNull(),
});

export const markets = sqliteTable(
  'markets',
  {
    id,
    code: text('code').notNull(),
    name: text('name').notNull(),
    category: text('category'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    autoEvaluable: integer('auto_evaluable', { mode: 'boolean' })
      .notNull()
      .default(false),
    evaluatorKey: text('evaluator_key'),
    parameters: text('parameters', { mode: 'json' }),
    ...timestamps,
  },
  (table) => ({
    codeUnique: uniqueIndex('markets_code_unique').on(table.code),
  }),
);

export const templates = sqliteTable(
  'templates',
  {
    id,
    code: text('code').notNull(),
    name: text('name').notNull(),
    bulletinType: text('bulletin_type').notNull(),
    mode: text('mode').notNull(),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    currentVersion: integer('current_version').notNull(),
    ...timestamps,
  },
  (table) => ({
    codeUnique: uniqueIndex('templates_code_unique').on(table.code),
    versionCheck: check(
      'templates_current_version_check',
      sql`${table.currentVersion} >= 1`,
    ),
  }),
);

export const templateVersions = sqliteTable(
  'template_versions',
  {
    id,
    templateId: text('template_id')
      .notNull()
      .references(() => templates.id, { onDelete: 'restrict' }),
    version: integer('version').notNull(),
    format: text('format').notNull(),
    config: text('config', { mode: 'json' }).notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    templateVersionUnique: uniqueIndex(
      'template_versions_template_version_unique',
    ).on(table.templateId, table.version),
  }),
);

export const bulletins = sqliteTable(
  'bulletins',
  {
    id,
    publicCode: text('public_code').notNull(),
    type: text('type').notNull(),
    mode: text('mode').notNull(),
    status: text('status').notNull(),
    stake: text('stake'),
    totalOdd: text('total_odd'),
    templateId: text('template_id')
      .notNull()
      .references(() => templates.id, { onDelete: 'restrict' }),
    templateVersion: integer('template_version').notNull(),
    renderConfig: text('render_config', { mode: 'json' }).notNull(),
    ...timestamps,
  },
  (table) => ({
    publicCodeUnique: uniqueIndex('bulletins_public_code_unique').on(
      table.publicCode,
    ),
    createdAtIdx: index('bulletins_created_at_idx').on(table.createdAt),
    statusIdx: index('bulletins_status_idx').on(table.status),
  }),
);

export const bulletinCodeSequence = sqliteTable('bulletin_code_sequence', {
  id: integer('id').primaryKey(),
  nextValue: integer('next_value').notNull(),
});

export const bulletinSelections = sqliteTable(
  'bulletin_selections',
  {
    id,
    bulletinId: text('bulletin_id')
      .notNull()
      .references(() => bulletins.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    fixtureId: text('fixture_id').references(() => fixtures.id, {
      onDelete: 'set null',
    }),
    marketId: text('market_id').references(() => markets.id, {
      onDelete: 'set null',
    }),
    odd: text('odd').notNull(),
    calculatedStatus: text('calculated_status').notNull(),
    manualStatus: text('manual_status'),
    ...timestamps,
  },
  (table) => ({
    bulletinPositionUnique: uniqueIndex(
      'bulletin_selections_bulletin_position_unique',
    ).on(table.bulletinId, table.position),
    bulletinIdx: index('bulletin_selections_bulletin_id_idx').on(
      table.bulletinId,
    ),
    fixtureIdx: index('bulletin_selections_fixture_id_idx').on(table.fixtureId),
    positionCheck: check(
      'bulletin_selections_position_check',
      sql`${table.position} between 1 and 10`,
    ),
  }),
);

export const bulletinSelectionSnapshots = sqliteTable(
  'bulletin_selection_snapshots',
  {
    selectionId: text('selection_id')
      .primaryKey()
      .references(() => bulletinSelections.id, { onDelete: 'cascade' }),
    homeTeamName: text('home_team_name').notNull(),
    awayTeamName: text('away_team_name').notNull(),
    homeTeamLogoAssetId: text('home_team_logo_asset_id').references(
      () => assets.id,
      {
        onDelete: 'set null',
      },
    ),
    awayTeamLogoAssetId: text('away_team_logo_asset_id').references(
      () => assets.id,
      {
        onDelete: 'set null',
      },
    ),
    competitionName: text('competition_name'),
    marketCode: text('market_code').notNull(),
    marketName: text('market_name').notNull(),
    kickoffAt: text('kickoff_at'),
    createdAt: text('created_at').notNull(),
  },
);

export const selectionResultSnapshots = sqliteTable(
  'selection_result_snapshots',
  {
    selectionId: text('selection_id')
      .primaryKey()
      .references(() => bulletinSelections.id, { onDelete: 'cascade' }),
    homeScore: integer('home_score'),
    awayScore: integer('away_score'),
    fixtureStatus: text('fixture_status'),
    evaluatedAt: text('evaluated_at'),
    evaluationVersion: text('evaluation_version'),
    resultSource: text('result_source'),
    ...timestamps,
  },
);

export const settlementOverrides = sqliteTable(
  'settlement_overrides',
  {
    id,
    selectionId: text('selection_id')
      .notNull()
      .references(() => bulletinSelections.id, { onDelete: 'cascade' }),
    previousStatus: text('previous_status'),
    newStatus: text('new_status'),
    reason: text('reason'),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    selectionIdx: index('settlement_overrides_selection_id_idx').on(
      table.selectionId,
    ),
  }),
);

export const renderRecords = sqliteTable(
  'render_records',
  {
    id,
    bulletinId: text('bulletin_id')
      .notNull()
      .references(() => bulletins.id, { onDelete: 'cascade' }),
    templateId: text('template_id')
      .notNull()
      .references(() => templates.id, { onDelete: 'restrict' }),
    templateVersion: integer('template_version').notNull(),
    outputFormat: text('output_format').notNull(),
    filePath: text('file_path').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => ({
    bulletinIdx: index('render_records_bulletin_id_idx').on(table.bulletinId),
  }),
);

export const syncRecords = sqliteTable(
  'sync_records',
  {
    id,
    providerId: text('provider_id')
      .notNull()
      .references(() => providers.id, { onDelete: 'cascade' }),
    resourceType: text('resource_type').notNull(),
    scopeKey: text('scope_key'),
    status: text('status').notNull(),
    startedAt: text('started_at').notNull(),
    completedAt: text('completed_at'),
    recordsProcessed: integer('records_processed'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
  },
  (table) => ({
    providerIdx: index('sync_records_provider_id_idx').on(table.providerId),
    startedAtIdx: index('sync_records_started_at_idx').on(table.startedAt),
  }),
);

export const bulletinRelations = relations(bulletins, ({ many }) => ({
  selections: many(bulletinSelections),
  renderRecords: many(renderRecords),
}));

export const bulletinSelectionRelations = relations(
  bulletinSelections,
  ({ one, many }) => ({
    bulletin: one(bulletins, {
      fields: [bulletinSelections.bulletinId],
      references: [bulletins.id],
    }),
    snapshot: one(bulletinSelectionSnapshots),
    resultSnapshot: one(selectionResultSnapshots),
    overrides: many(settlementOverrides),
  }),
);
