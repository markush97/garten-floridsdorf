ALTER TABLE `polls` ADD `slug` text NOT NULL DEFAULT '';--> statement-breakpoint
CREATE UNIQUE INDEX `polls_slug_unique` ON `polls` (`slug`);