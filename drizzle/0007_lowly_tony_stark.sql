CREATE TABLE `event_decisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`agenda_item_id` integer,
	`resolution_number` text NOT NULL,
	`wording` text NOT NULL,
	`proposer_user_id` integer,
	`proposer_name` text,
	`seconder_user_id` integer,
	`seconder_name` text,
	`vote_id` integer,
	`result_note` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agenda_item_id`) REFERENCES `event_agenda_items`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`proposer_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`seconder_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`vote_id`) REFERENCES `event_agenda_votes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_decisions_resolution_number_unique` ON `event_decisions` (`resolution_number`);