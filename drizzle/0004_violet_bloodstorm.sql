CREATE TABLE `reportInbox` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`scheduleId` int,
	`title` varchar(128) NOT NULL,
	`snapshot` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reportInbox_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reportSchedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(64) NOT NULL,
	`cadence` enum('daily','weekly') NOT NULL,
	`cronExpression` varchar(64) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`scheduleCronTaskUid` varchar(65),
	`lastRunAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reportSchedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `stressScenarios` ADD `shareToken` varchar(64);--> statement-breakpoint
ALTER TABLE `stressScenarios` ADD `shareEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `stressScenarios` ADD CONSTRAINT `stressScenarios_shareToken_unique` UNIQUE(`shareToken`);