CREATE TABLE `ip_vote_counts` (
	`ip` text NOT NULL,
	`poll_id` integer NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`ip`, `poll_id`)
);
