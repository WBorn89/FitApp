CREATE TABLE `audit_logs` (
	`id` varchar(36) NOT NULL,
	`action` varchar(32) NOT NULL,
	`entityType` varchar(32) NOT NULL,
	`entityId` varchar(36),
	`actorId` int,
	`actorType` varchar(32),
	`oldData` json,
	`newData` json,
	`changes` json,
	`ipAddress` varchar(45),
	`userAgent` text,
	`requestId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `encryption_keys` (
	`id` varchar(36) NOT NULL,
	`keyId` varchar(64) NOT NULL,
	`keyVersion` int DEFAULT 1,
	`isActive` boolean DEFAULT true,
	`isPrimary` boolean DEFAULT false,
	`algorithm` varchar(32) DEFAULT 'AES-256-GCM',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`activatedAt` timestamp DEFAULT (now()),
	`rotatedAt` timestamp,
	`expiresAt` timestamp,
	`usageCount` bigint DEFAULT 0,
	`lastUsedAt` timestamp,
	CONSTRAINT `encryption_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `encryption_keys_keyId_unique` UNIQUE(`keyId`)
);
--> statement-breakpoint
CREATE TABLE `health_integrations` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`provider` varchar(32) NOT NULL,
	`providerUserId` varchar(256),
	`encryptedTokens` text NOT NULL,
	`tokenMetadata` json,
	`isActive` boolean DEFAULT true,
	`lastSyncAt` timestamp,
	`lastSuccessSyncAt` timestamp,
	`syncError` text,
	`syncErrorCount` int DEFAULT 0,
	`syncFrequency` varchar(32) DEFAULT 'DAILY',
	`syncEnabled` boolean DEFAULT true,
	`autoImport` boolean DEFAULT true,
	`connectedAt` timestamp DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `health_integrations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `health_metrics` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`integrationId` varchar(36),
	`provider` varchar(32) NOT NULL,
	`category` varchar(32) NOT NULL,
	`type` varchar(64) NOT NULL,
	`value` float NOT NULL,
	`unit` varchar(16) NOT NULL,
	`recordedAt` timestamp NOT NULL,
	`sourceId` varchar(256),
	`device` varchar(128),
	`isManual` boolean DEFAULT false,
	`confidence` float,
	`tags` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `health_metrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sync_logs` (
	`id` varchar(36) NOT NULL,
	`integrationId` varchar(36) NOT NULL,
	`status` varchar(32) NOT NULL,
	`startedAt` timestamp DEFAULT (now()),
	`completedAt` timestamp,
	`durationMs` int,
	`metricsAdded` int DEFAULT 0,
	`metricsUpdated` int DEFAULT 0,
	`metricsSkipped` int DEFAULT 0,
	`metricsFailed` int DEFAULT 0,
	`errorCode` varchar(64),
	`errorMessage` text,
	`errorDetails` json,
	`syncTrigger` varchar(32) NOT NULL,
	`apiCalls` int DEFAULT 0,
	`dataSizeBytes` int,
	CONSTRAINT `sync_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `timezone` varchar(64) DEFAULT 'UTC';--> statement-breakpoint
ALTER TABLE `users` ADD `locale` varchar(10) DEFAULT 'en-US';