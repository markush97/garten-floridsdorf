CREATE TABLE `poll_share_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`poll_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`label` text,
	`created_at` text NOT NULL,
	`expires_at` text,
	`revoked_at` text,
	`last_hit_at` text,
	FOREIGN KEY (`poll_id`) REFERENCES `polls`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `poll_share_tokens_token_hash_unique` ON `poll_share_tokens` (`token_hash`);--> statement-breakpoint
CREATE TABLE `poll_share_views` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_id` integer NOT NULL,
	`viewed_at` text NOT NULL,
	FOREIGN KEY (`token_id`) REFERENCES `poll_share_tokens`(`id`) ON UPDATE no action ON DELETE cascade
);
