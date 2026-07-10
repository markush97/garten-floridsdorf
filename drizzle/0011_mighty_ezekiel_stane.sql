CREATE TABLE `document_folders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`parent_id` integer,
	`created_by_user_id` integer,
	`created_by_name` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `document_share_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_hash` text NOT NULL,
	`document_id` integer,
	`folder_id` integer,
	`label` text,
	`created_at` text NOT NULL,
	`expires_at` text,
	`revoked_at` text,
	`last_hit_at` text,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`folder_id`) REFERENCES `document_folders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_share_tokens_token_hash_unique` ON `document_share_tokens` (`token_hash`);--> statement-breakpoint
ALTER TABLE `documents` ADD `folder_id` integer REFERENCES document_folders(id);