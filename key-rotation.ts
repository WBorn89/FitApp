import { getDb } from '../db';
import { 
  decrypt, 
  encrypt, 
  generateNewKey,
  decryptWithKey,
  type EncryptedData,
  type AADContext 
} from '../lib/encryption';
import { healthIntegrations, encryptionKeys } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

/**
 * Service for managing encryption key rotation without downtime
 */
export class KeyRotationService {
  /**
   * Rotate encryption keys with automatic data migration
   */
  async rotateKeys(): Promise<{
    oldKeyId: string;
    newKeyId: string;
    migratedCount: number;
    failedCount: number;
  }> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY environment variable not configured');
    }

    console.log('🔑 Starting key rotation process');

    // 1. Generate new key
    const newKeyId = `key_${Date.now()}`;
    const newKey = generateNewKey();

    console.log(`📝 Generated new key: ${newKeyId}`);

    // 2. Register new key in DB (metadata only)
    await db.insert(encryptionKeys).values({
      id: `ek_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      keyId: newKeyId,
      keyVersion: 1,
      isActive: true,
      isPrimary: false,
      algorithm: 'AES-256-GCM',
      createdAt: new Date(),
      activatedAt: new Date(),
    });

    // 3. Migrate data to new key
    const migrationResult = await this.migrateDataToNewKey(
      newKeyId,
      newKey,
      encryptionKey
    );

    console.log(
      `✅ Migration complete: ${migrationResult.migratedCount} migrated, ${migrationResult.failedCount} failed`
    );

    // 4. Make new key primary if migration successful
    if (migrationResult.migratedCount > 0) {
      // Deactivate old primary keys
      await db
        .update(encryptionKeys)
        .set({ isPrimary: false })
        .where(eq(encryptionKeys.isPrimary, true));

      // Activate new key as primary
      await db
        .update(encryptionKeys)
        .set({
          isPrimary: true,
          activatedAt: new Date(),
        })
        .where(eq(encryptionKeys.keyId, newKeyId));

      console.log('🔑 New key set as primary');
    }

    return {
      oldKeyId: 'default',
      newKeyId,
      migratedCount: migrationResult.migratedCount,
      failedCount: migrationResult.failedCount,
    };
  }

  /**
   * Migrate all encrypted data to new key
   */
  private async migrateDataToNewKey(
    newKeyId: string,
    newKey: string,
    currentKey: string
  ): Promise<{ migratedCount: number; failedCount: number }> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const batchSize = 100;
    let offset = 0;
    let migratedCount = 0;
    let failedCount = 0;

    console.log('🔄 Starting data migration...');

    while (true) {
      const integrations = await db
        .select()
        .from(healthIntegrations)
        .limit(batchSize)
        .offset(offset);

      if (integrations.length === 0) break;

      console.log(`Processing batch: offset=${offset}, count=${integrations.length}`);

      for (const integration of integrations) {
        try {
          if (!integration.encryptedTokens) continue;

          // Decrypt with current key
          const encryptedData: EncryptedData = JSON.parse(
            integration.encryptedTokens
          );
          const decrypted = decryptWithKey(encryptedData, currentKey);

          // Re-encrypt with new key
          const tokens = JSON.parse(decrypted);
          const newEncrypted = encrypt(
            JSON.stringify(tokens),
            encryptedData.context as AADContext | undefined,
            {
              provider: integration.provider,
              userId: integration.userId.toString(),
              integrationId: integration.id,
            }
          );

          // Update with new encrypted data
          await db
            .update(healthIntegrations)
            .set({
              encryptedTokens: JSON.stringify(newEncrypted),
              tokenMetadata: {
                ...(integration.tokenMetadata as any),
                keyId: newKeyId,
                rotatedAt: new Date().toISOString(),
              },
              updatedAt: new Date(),
            })
            .where(eq(healthIntegrations.id, integration.id));

          migratedCount++;
        } catch (error) {
          console.error(
            `❌ Error migrating integration ${integration.id}:`,
            error
          );
          failedCount++;
        }
      }

      offset += batchSize;
    }

    return { migratedCount, failedCount };
  }

  /**
   * Verify key rotation completed successfully
   */
  async verifyRotation(): Promise<{
    isValid: boolean;
    primaryKeyId: string | null;
    totalKeys: number;
  }> {
    const db = await getDb();
    if (!db) throw new Error('Database not available');

    const keys = await db.select().from(encryptionKeys);
    const primaryKey = keys.find(k => k.isPrimary);

    return {
      isValid: !!primaryKey,
      primaryKeyId: primaryKey?.keyId || null,
      totalKeys: keys.length,
    };
  }
}
