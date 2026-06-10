CREATE TABLE `event_actual_attendees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`user_id` integer,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `event_agenda_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`title` text NOT NULL,
	`notes` text,
	`status` text DEFAULT 'open' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `event_agenda_vote_options` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vote_id` integer NOT NULL,
	`label` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`vote_id`) REFERENCES `event_agenda_votes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `event_agenda_votes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`agenda_item_id` integer NOT NULL,
	`question` text NOT NULL,
	`vote_type` text NOT NULL,
	`counting_mode` text NOT NULL,
	`result_note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`agenda_item_id`) REFERENCES `event_agenda_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `event_attendee_votes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`vote_id` integer NOT NULL,
	`attendee_id` integer NOT NULL,
	`option_id` integer,
	`response` integer,
	FOREIGN KEY (`vote_id`) REFERENCES `event_agenda_votes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`attendee_id`) REFERENCES `event_actual_attendees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`option_id`) REFERENCES `event_agenda_vote_options`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_attendee_votes_unique` ON `event_attendee_votes` (`vote_id`,`attendee_id`);--> statement-breakpoint
CREATE TABLE `event_planned_attendees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`user_id` integer,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`poll_id` integer,
	`title` text NOT NULL,
	`scheduled_date` text NOT NULL,
	`scheduled_time` text,
	`location` text,
	`agenda` text,
	`transcription` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`poll_id`) REFERENCES `polls`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_slug_unique` ON `events` (`slug`);