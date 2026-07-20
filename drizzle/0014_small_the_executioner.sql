CREATE TABLE `bank_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`entry_date` text NOT NULL,
	`description` text,
	`member_user_id` integer,
	`member_name` text,
	`recorded_by_user_id` integer,
	`recorded_by_name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`member_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`recorded_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `expense_shares` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`expense_id` integer NOT NULL,
	`user_id` integer,
	`member_name` text NOT NULL,
	`share_cents` integer NOT NULL,
	FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `expense_shares_unique` ON `expense_shares` (`expense_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`description` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`expense_date` text NOT NULL,
	`type` text NOT NULL,
	`category` text NOT NULL,
	`cadence` text NOT NULL,
	`project_name` text,
	`paid_from` text NOT NULL,
	`paid_by_user_id` integer,
	`paid_by_name` text,
	`settlement` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`receipt_r2_key` text,
	`receipt_filename` text,
	`receipt_content_type` text,
	`receipt_size` integer,
	`submitted_by_user_id` integer,
	`submitted_by_name` text NOT NULL,
	`reviewed_by_user_id` integer,
	`reviewed_by_name` text,
	`reviewed_at` text,
	`review_note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`paid_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`submitted_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `expenses_receipt_r2_key_unique` ON `expenses` (`receipt_r2_key`);--> statement-breakpoint
ALTER TABLE `users` ADD `is_kassier` integer DEFAULT false NOT NULL;