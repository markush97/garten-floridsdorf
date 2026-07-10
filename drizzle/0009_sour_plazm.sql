CREATE TABLE `event_share_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`label` text,
	`created_at` text NOT NULL,
	`expires_at` text,
	`revoked_at` text,
	`last_hit_at` text,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_share_tokens_token_hash_unique` ON `event_share_tokens` (`token_hash`);--> statement-breakpoint
CREATE TABLE `event_share_views` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_id` integer NOT NULL,
	`viewed_at` text NOT NULL,
	FOREIGN KEY (`token_id`) REFERENCES `event_share_tokens`(`id`) ON UPDATE no action ON DELETE cascade
);
