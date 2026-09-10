CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`source` text NOT NULL,
	`file_path` text NOT NULL,
	`content_hash` text,
	`mime_type` text,
	`original_url` text,
	`provider_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `assets_content_hash_idx` ON `assets` (`content_hash`);--> statement-breakpoint
CREATE TABLE `bulletin_code_sequence` (
	`id` integer PRIMARY KEY NOT NULL,
	`next_value` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bulletin_selection_snapshots` (
	`selection_id` text PRIMARY KEY NOT NULL,
	`home_team_name` text NOT NULL,
	`away_team_name` text NOT NULL,
	`home_team_logo_asset_id` text,
	`away_team_logo_asset_id` text,
	`competition_name` text,
	`market_code` text NOT NULL,
	`market_name` text NOT NULL,
	`kickoff_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`selection_id`) REFERENCES `bulletin_selections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`home_team_logo_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`away_team_logo_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `bulletin_selections` (
	`id` text PRIMARY KEY NOT NULL,
	`bulletin_id` text NOT NULL,
	`position` integer NOT NULL,
	`fixture_id` text,
	`market_id` text,
	`odd` text NOT NULL,
	`calculated_status` text NOT NULL,
	`manual_status` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`bulletin_id`) REFERENCES `bulletins`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`fixture_id`) REFERENCES `fixtures`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`market_id`) REFERENCES `markets`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "bulletin_selections_position_check" CHECK("bulletin_selections"."position" between 1 and 10)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bulletin_selections_bulletin_position_unique` ON `bulletin_selections` (`bulletin_id`,`position`);--> statement-breakpoint
CREATE INDEX `bulletin_selections_bulletin_id_idx` ON `bulletin_selections` (`bulletin_id`);--> statement-breakpoint
CREATE INDEX `bulletin_selections_fixture_id_idx` ON `bulletin_selections` (`fixture_id`);--> statement-breakpoint
CREATE TABLE `bulletins` (
	`id` text PRIMARY KEY NOT NULL,
	`public_code` text NOT NULL,
	`type` text NOT NULL,
	`mode` text NOT NULL,
	`status` text NOT NULL,
	`stake` text,
	`total_odd` text,
	`template_id` text NOT NULL,
	`template_version` integer NOT NULL,
	`render_config` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bulletins_public_code_unique` ON `bulletins` (`public_code`);--> statement-breakpoint
CREATE INDEX `bulletins_created_at_idx` ON `bulletins` (`created_at`);--> statement-breakpoint
CREATE INDEX `bulletins_status_idx` ON `bulletins` (`status`);--> statement-breakpoint
CREATE TABLE `competition_teams` (
	`competition_id` text NOT NULL,
	`team_id` text NOT NULL,
	`season` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `competition_teams_unique` ON `competition_teams` (`competition_id`,`team_id`,`season`);--> statement-breakpoint
CREATE INDEX `competition_teams_competition_id_idx` ON `competition_teams` (`competition_id`);--> statement-breakpoint
CREATE INDEX `competition_teams_team_id_idx` ON `competition_teams` (`team_id`);--> statement-breakpoint
CREATE TABLE `competitions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`short_name` text,
	`country_code` text,
	`region_name` text,
	`logo_asset_id` text,
	`active` integer DEFAULT true NOT NULL,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`logo_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `competitions_active_idx` ON `competitions` (`active`);--> statement-breakpoint
CREATE TABLE `fixture_result_details` (
	`fixture_id` text PRIMARY KEY NOT NULL,
	`half_time_home_score` integer,
	`half_time_away_score` integer,
	`home_corners` integer,
	`away_corners` integer,
	`extra_data` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`fixture_id`) REFERENCES `fixtures`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `fixtures` (
	`id` text PRIMARY KEY NOT NULL,
	`competition_id` text,
	`home_team_id` text NOT NULL,
	`away_team_id` text NOT NULL,
	`kickoff_at` text,
	`status` text NOT NULL,
	`home_score` integer,
	`away_score` integer,
	`live_minute` integer,
	`source_type` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`home_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`away_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "fixtures_different_teams_check" CHECK("fixtures"."home_team_id" <> "fixtures"."away_team_id"),
	CONSTRAINT "fixtures_home_score_non_negative_check" CHECK("fixtures"."home_score" is null or "fixtures"."home_score" >= 0),
	CONSTRAINT "fixtures_away_score_non_negative_check" CHECK("fixtures"."away_score" is null or "fixtures"."away_score" >= 0)
);
--> statement-breakpoint
CREATE INDEX `fixtures_kickoff_at_idx` ON `fixtures` (`kickoff_at`);--> statement-breakpoint
CREATE INDEX `fixtures_competition_id_idx` ON `fixtures` (`competition_id`);--> statement-breakpoint
CREATE INDEX `fixtures_home_team_id_idx` ON `fixtures` (`home_team_id`);--> statement-breakpoint
CREATE INDEX `fixtures_away_team_id_idx` ON `fixtures` (`away_team_id`);--> statement-breakpoint
CREATE INDEX `fixtures_status_idx` ON `fixtures` (`status`);--> statement-breakpoint
CREATE TABLE `markets` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`active` integer DEFAULT true NOT NULL,
	`auto_evaluable` integer DEFAULT false NOT NULL,
	`evaluator_key` text,
	`parameters` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `markets_code_unique` ON `markets` (`code`);--> statement-breakpoint
CREATE TABLE `provider_rate_limits` (
	`provider_id` text PRIMARY KEY NOT NULL,
	`limit` integer,
	`remaining` integer,
	`resets_at` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `provider_references` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`local_entity_id` text NOT NULL,
	`external_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_references_external_unique` ON `provider_references` (`provider_id`,`entity_type`,`external_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `provider_references_local_unique` ON `provider_references` (`provider_id`,`entity_type`,`local_entity_id`);--> statement-breakpoint
CREATE INDEX `provider_references_provider_id_idx` ON `provider_references` (`provider_id`);--> statement-breakpoint
CREATE TABLE `providers` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`display_name` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `providers_code_unique` ON `providers` (`code`);--> statement-breakpoint
CREATE TABLE `render_records` (
	`id` text PRIMARY KEY NOT NULL,
	`bulletin_id` text NOT NULL,
	`template_id` text NOT NULL,
	`template_version` integer NOT NULL,
	`output_format` text NOT NULL,
	`file_path` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`bulletin_id`) REFERENCES `bulletins`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `render_records_bulletin_id_idx` ON `render_records` (`bulletin_id`);--> statement-breakpoint
CREATE TABLE `selection_result_snapshots` (
	`selection_id` text PRIMARY KEY NOT NULL,
	`home_score` integer,
	`away_score` integer,
	`fixture_status` text,
	`evaluated_at` text,
	`evaluation_version` text,
	`result_source` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`selection_id`) REFERENCES `bulletin_selections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `settlement_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`selection_id` text NOT NULL,
	`previous_status` text,
	`new_status` text,
	`reason` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`selection_id`) REFERENCES `bulletin_selections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `settlement_overrides_selection_id_idx` ON `settlement_overrides` (`selection_id`);--> statement-breakpoint
CREATE TABLE `sync_records` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`resource_type` text NOT NULL,
	`scope_key` text,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`records_processed` integer,
	`error_code` text,
	`error_message` text,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sync_records_provider_id_idx` ON `sync_records` (`provider_id`);--> statement-breakpoint
CREATE INDEX `sync_records_started_at_idx` ON `sync_records` (`started_at`);--> statement-breakpoint
CREATE TABLE `team_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`value` text NOT NULL,
	`normalized_value` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `team_aliases_normalized_value_idx` ON `team_aliases` (`normalized_value`);--> statement-breakpoint
CREATE UNIQUE INDEX `team_aliases_team_normalized_unique` ON `team_aliases` (`team_id`,`normalized_value`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`short_name` text,
	`country_code` text,
	`logo_asset_id` text,
	`active` integer DEFAULT true NOT NULL,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`logo_asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `teams_active_idx` ON `teams` (`active`);--> statement-breakpoint
CREATE TABLE `template_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`version` integer NOT NULL,
	`format` text NOT NULL,
	`config` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `template_versions_template_version_unique` ON `template_versions` (`template_id`,`version`);--> statement-breakpoint
CREATE TABLE `templates` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`bulletin_type` text NOT NULL,
	`mode` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`current_version` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "templates_current_version_check" CHECK("templates"."current_version" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `templates_code_unique` ON `templates` (`code`);