import { 
  int, 
  mysqlEnum, 
  mysqlTable, 
  text, 
  timestamp, 
  varchar,
  json,
  boolean,
  float,
  bigint
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  timezone: varchar("timezone", { length: 64 }).default("UTC"),
  locale: varchar("locale", { length: 10 }).default("en-US"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Health Integration - OAuth tokens and provider connections
export const healthIntegrations = mysqlTable("health_integrations", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("userId").notNull(),
  provider: varchar("provider", { length: 32 }).notNull(), // GARMIN, SAMSUNG, APPLE_HEALTH, GOOGLE_FIT
  providerUserId: varchar("providerUserId", { length: 256 }),
  encryptedTokens: text("encryptedTokens").notNull(), // JSON encrypted with AES-256-GCM
  tokenMetadata: json("tokenMetadata"),
  isActive: boolean("isActive").default(true),
  lastSyncAt: timestamp("lastSyncAt"),
  lastSuccessSyncAt: timestamp("lastSuccessSyncAt"),
  syncError: text("syncError"),
  syncErrorCount: int("syncErrorCount").default(0),
  syncFrequency: varchar("syncFrequency", { length: 32 }).default("DAILY"), // HOURLY, DAILY, WEEKLY, MANUAL
  syncEnabled: boolean("syncEnabled").default(true),
  autoImport: boolean("autoImport").default(true),
  connectedAt: timestamp("connectedAt").defaultNow(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type HealthIntegration = typeof healthIntegrations.$inferSelect;
export type InsertHealthIntegration = typeof healthIntegrations.$inferInsert;

// Health Metrics - Aggregated health data from providers
export const healthMetrics = mysqlTable("health_metrics", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("userId").notNull(),
  integrationId: varchar("integrationId", { length: 36 }),
  provider: varchar("provider", { length: 32 }).notNull(),
  category: varchar("category", { length: 32 }).notNull(), // WEIGHT, HEART_RATE, SLEEP, ACTIVITY, BODY_COMPOSITION
  type: varchar("type", { length: 64 }).notNull(), // WEIGHT_KG, HEART_RATE_RESTING, SLEEP_DURATION, etc
  value: float("value").notNull(),
  unit: varchar("unit", { length: 16 }).notNull(), // kg, %, bpm, hours, kcal, steps
  recordedAt: timestamp("recordedAt").notNull(),
  sourceId: varchar("sourceId", { length: 256 }),
  device: varchar("device", { length: 128 }),
  isManual: boolean("isManual").default(false),
  confidence: float("confidence"), // 0.0 to 1.0
  tags: json("tags"), // Array of tags
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type HealthMetric = typeof healthMetrics.$inferSelect;
export type InsertHealthMetric = typeof healthMetrics.$inferInsert;

// Sync Logs - Audit trail of synchronization attempts
export const syncLogs = mysqlTable("sync_logs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  integrationId: varchar("integrationId", { length: 36 }).notNull(),
  status: varchar("status", { length: 32 }).notNull(), // SUCCESS, PARTIAL, FAILED, SKIPPED
  startedAt: timestamp("startedAt").defaultNow(),
  completedAt: timestamp("completedAt"),
  durationMs: int("durationMs"),
  metricsAdded: int("metricsAdded").default(0),
  metricsUpdated: int("metricsUpdated").default(0),
  metricsSkipped: int("metricsSkipped").default(0),
  metricsFailed: int("metricsFailed").default(0),
  errorCode: varchar("errorCode", { length: 64 }),
  errorMessage: text("errorMessage"),
  errorDetails: json("errorDetails"),
  syncTrigger: varchar("syncTrigger", { length: 32 }).notNull(), // MANUAL, SCHEDULED, WEBHOOK, RETRY
  apiCalls: int("apiCalls").default(0),
  dataSizeBytes: int("dataSizeBytes"),
});

export type SyncLog = typeof syncLogs.$inferSelect;
export type InsertSyncLog = typeof syncLogs.$inferInsert;

// Audit Logs - Compliance and security audit trail
export const auditLogs = mysqlTable("audit_logs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  action: varchar("action", { length: 32 }).notNull(), // CREATE, UPDATE, DELETE, SYNC, LOGIN, LOGOUT, TOKEN_ACCESS
  entityType: varchar("entityType", { length: 32 }).notNull(), // USER, INTEGRATION, METRIC, SYNC_LOG
  entityId: varchar("entityId", { length: 36 }),
  actorId: int("actorId"),
  actorType: varchar("actorType", { length: 32 }), // USER, SYSTEM, API_KEY
  oldData: json("oldData"),
  newData: json("newData"),
  changes: json("changes"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  requestId: varchar("requestId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// Encryption Keys - Key rotation management
export const encryptionKeys = mysqlTable("encryption_keys", {
  id: varchar("id", { length: 36 }).primaryKey(),
  keyId: varchar("keyId", { length: 64 }).notNull().unique(),
  keyVersion: int("keyVersion").default(1),
  isActive: boolean("isActive").default(true),
  isPrimary: boolean("isPrimary").default(false),
  algorithm: varchar("algorithm", { length: 32 }).default("AES-256-GCM"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  activatedAt: timestamp("activatedAt").defaultNow(),
  rotatedAt: timestamp("rotatedAt"),
  expiresAt: timestamp("expiresAt"),
  usageCount: bigint("usageCount", { mode: "number" }).default(0),
  lastUsedAt: timestamp("lastUsedAt"),
});

export type EncryptionKey = typeof encryptionKeys.$inferSelect;
export type InsertEncryptionKey = typeof encryptionKeys.$inferInsert;