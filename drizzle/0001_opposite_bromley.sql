CREATE TABLE `stressScenarios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerOpenId` varchar(64),
	`name` varchar(96) NOT NULL,
	`parameters` json NOT NULL,
	`snapshot` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stressScenarios_id` PRIMARY KEY(`id`)
);
