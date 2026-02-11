import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { getDb } from '../db';
import { healthIntegrations, healthMetrics, syncLogs } from '../../drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';
import { SyncOrchestrator } from '../services/sync-orchestrator';

export const healthRouter = router({
  /**
   * Get all integrations for current user
   */
  getIntegrations: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const integrations = await db
      .select()
      .from(healthIntegrations)
      .where(eq(healthIntegrations.userId, ctx.user.id));

    return integrations.map(integration => ({
      ...integration,
      encryptedTokens: undefined,
    }));
  }),

  /**
   * Get integration details
   */
  getIntegration: protectedProcedure
    .input(z.object({ integrationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const integration = await db
        .select()
        .from(healthIntegrations)
        .where(
          and(
            eq(healthIntegrations.id, input.integrationId),
            eq(healthIntegrations.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!integration.length) {
        throw new Error('Integration not found');
      }

      return {
        ...integration[0],
        encryptedTokens: undefined,
      };
    }),

  /**
   * Update sync frequency for an integration
   */
  updateSyncFrequency: protectedProcedure
    .input(
      z.object({
        integrationId: z.string(),
        frequency: z.enum(['HOURLY', 'DAILY', 'WEEKLY', 'MANUAL']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const integration = await db
        .select()
        .from(healthIntegrations)
        .where(
          and(
            eq(healthIntegrations.id, input.integrationId),
            eq(healthIntegrations.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!integration.length) {
        throw new Error('Integration not found');
      }

      await db
        .update(healthIntegrations)
        .set({
          syncFrequency: input.frequency,
          updatedAt: new Date(),
        })
        .where(eq(healthIntegrations.id, input.integrationId));

      return { success: true };
    }),

  /**
   * Toggle sync enabled/disabled
   */
  toggleSync: protectedProcedure
    .input(
      z.object({
        integrationId: z.string(),
        enabled: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const integration = await db
        .select()
        .from(healthIntegrations)
        .where(
          and(
            eq(healthIntegrations.id, input.integrationId),
            eq(healthIntegrations.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!integration.length) {
        throw new Error('Integration not found');
      }

      await db
        .update(healthIntegrations)
        .set({
          syncEnabled: input.enabled,
          updatedAt: new Date(),
        })
        .where(eq(healthIntegrations.id, input.integrationId));

      return { success: true };
    }),

  /**
   * Manually trigger sync for an integration
   */
  triggerSync: protectedProcedure
    .input(z.object({ integrationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const integration = await db
        .select()
        .from(healthIntegrations)
        .where(
          and(
            eq(healthIntegrations.id, input.integrationId),
            eq(healthIntegrations.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!integration.length) {
        throw new Error('Integration not found');
      }

      const orchestrator = new SyncOrchestrator();
      const result = await orchestrator.syncWithRetry(
        input.integrationId,
        integration[0].provider
      );

      return result;
    }),

  /**
   * Get sync history for an integration
   */
  getSyncHistory: protectedProcedure
    .input(
      z.object({
        integrationId: z.string(),
        limit: z.number().default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const integration = await db
        .select()
        .from(healthIntegrations)
        .where(
          and(
            eq(healthIntegrations.id, input.integrationId),
            eq(healthIntegrations.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!integration.length) {
        throw new Error('Integration not found');
      }

      const logs = await db
        .select()
        .from(syncLogs)
        .where(eq(syncLogs.integrationId, input.integrationId))
        .orderBy(desc(syncLogs.startedAt))
        .limit(input.limit);

      return logs;
    }),

  /**
   * Get health metrics for current user
   */
  getMetrics: protectedProcedure
    .input(
      z.object({
        category: z.string().optional(),
        limit: z.number().default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const conditions = [eq(healthMetrics.userId, ctx.user.id)];
      if (input.category) {
        conditions.push(eq(healthMetrics.category, input.category));
      }

      const metrics = await db
        .select()
        .from(healthMetrics)
        .where(and(...conditions))
        .orderBy(desc(healthMetrics.recordedAt))
        .limit(input.limit);

      return metrics;
    }),

  /**
   * Get metrics summary by category
   */
  getMetricsSummary: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const metrics = await db
      .select()
      .from(healthMetrics)
      .where(eq(healthMetrics.userId, ctx.user.id));

    const summary: Record<string, any> = {};

    for (const metric of metrics) {
      if (!summary[metric.category]) {
        summary[metric.category] = {
          count: 0,
          latest: null,
          types: new Set<string>(),
        };
      }

      summary[metric.category].count++;
      summary[metric.category].types.add(metric.type);

      if (
        !summary[metric.category].latest ||
        new Date(metric.recordedAt) >
          new Date(summary[metric.category].latest.recordedAt)
      ) {
        summary[metric.category].latest = metric;
      }
    }

    const result: Record<string, any> = {};
    for (const [category, data] of Object.entries(summary)) {
      result[category] = {
        count: data.count,
        latest: data.latest,
        types: Array.from(data.types),
      };
    }

    return result;
  }),

  /**
   * Delete an integration
   */
  deleteIntegration: protectedProcedure
    .input(z.object({ integrationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      const integration = await db
        .select()
        .from(healthIntegrations)
        .where(
          and(
            eq(healthIntegrations.id, input.integrationId),
            eq(healthIntegrations.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!integration.length) {
        throw new Error('Integration not found');
      }

      await db
        .delete(healthMetrics)
        .where(eq(healthMetrics.integrationId, input.integrationId));

      await db
        .delete(syncLogs)
        .where(eq(syncLogs.integrationId, input.integrationId));

      await db
        .delete(healthIntegrations)
        .where(eq(healthIntegrations.id, input.integrationId));

      return { success: true };
    }),
});
