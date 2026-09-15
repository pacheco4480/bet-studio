CREATE TABLE `selection_result_snapshot_events` (
  `id` text PRIMARY KEY NOT NULL,
  `selection_id` text NOT NULL,
  `home_score` integer,
  `away_score` integer,
  `fixture_status` text,
  `calculated_status` text,
  `evaluated_at` text,
  `evaluation_version` text,
  `result_source` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`selection_id`) REFERENCES `bulletin_selections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `selection_result_events_selection_id_idx` ON `selection_result_snapshot_events` (`selection_id`);
--> statement-breakpoint
CREATE INDEX `selection_result_events_created_at_idx` ON `selection_result_snapshot_events` (`created_at`);
