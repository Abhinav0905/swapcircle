CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`resets_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `exchange_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`state` text NOT NULL,
	`credentials` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
