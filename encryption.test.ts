import { describe, expect, it, beforeAll } from 'vitest';
import {
  encrypt,
  decrypt,
  generateNewKey,
  validateTechnicalMetadata,
  type AADContext,
} from './encryption';

describe('Encryption Service', () => {
  beforeAll(() => {
    // Set a test encryption key
    process.env.ENCRYPTION_KEY =
      'a'.repeat(64); // 32 bytes in hex = 64 chars
  });

  describe('encrypt/decrypt', () => {
    it('encrypts and decrypts text without context', () => {
      const plaintext = 'secret data';

      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(encrypted.v).toBe(1);
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();
      expect(encrypted.createdAt).toBeDefined();
    });

    it('encrypts and decrypts with context', () => {
      const plaintext = JSON.stringify({
        access_token: 'token123',
        refresh_token: 'refresh123',
      });

      const encrypted = encrypt(plaintext, 'OAUTH_TOKEN');
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(encrypted.context).toBe('OAUTH_TOKEN');
      expect(encrypted.aadVersion).toBe('OAUTH_TOKEN::v1');
      expect(encrypted.aadHash).toBeDefined();
    });

    it('encrypts with metadata and stores AAD version', () => {
      const plaintext = 'token data';

      const encrypted = encrypt(plaintext, 'OAUTH_TOKEN', {
        provider: 'GARMIN',
        userId: '123',
        integrationId: 'int_456',
      });

      expect(encrypted.aadVersion).toBe('OAUTH_TOKEN::v1');
      expect(encrypted.aadHash).toBeDefined();
      expect(encrypted.context).toBe('OAUTH_TOKEN');
    });

    it('throws error for empty text', () => {
      expect(() => encrypt('')).toThrow('Text to encrypt cannot be empty');
    });

    it('throws error if encryption key not configured', () => {
      const originalKey = process.env.ENCRYPTION_KEY;
      delete process.env.ENCRYPTION_KEY;

      expect(() => encrypt('test')).toThrow(
        'ENCRYPTION_KEY environment variable not configured'
      );

      process.env.ENCRYPTION_KEY = originalKey;
    });

    it('throws error for unsupported encryption version', () => {
      const encrypted = encrypt('test');
      (encrypted as any).v = 999;

      expect(() => decrypt(encrypted)).toThrow(
        'Unsupported encryption version: 999'
      );
    });

    it('throws error if auth tag is tampered', () => {
      const encrypted = encrypt('test');
      encrypted.authTag = 'a'.repeat(32); // Invalid auth tag

      expect(() => decrypt(encrypted)).toThrow();
    });

    it('produces different ciphertexts for same plaintext (different IV)', () => {
      const plaintext = 'test data';

      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);

      // But both decrypt correctly
      expect(decrypt(encrypted1)).toBe(plaintext);
      expect(decrypt(encrypted2)).toBe(plaintext);
    });
  });

  describe('validateTechnicalMetadata', () => {
    it('validates allowed metadata keys', () => {
      const metadata = {
        provider: 'GARMIN',
        userId: '123',
        integrationId: 'int_456',
      };

      const result = validateTechnicalMetadata(metadata);

      expect(result.isValid).toBe(true);
      expect(result.invalidKeys).toBeUndefined();
    });

    it('rejects non-technical metadata keys', () => {
      const metadata = {
        provider: 'GARMIN',
        userEmail: 'user@example.com', // Invalid key
        customField: 'value', // Invalid key
      };

      const result = validateTechnicalMetadata(metadata);

      expect(result.isValid).toBe(false);
      expect(result.invalidKeys).toContain('userEmail');
      expect(result.invalidKeys).toContain('customField');
    });

    it('allows partial metadata', () => {
      const metadata = {
        provider: 'SAMSUNG',
      };

      const result = validateTechnicalMetadata(metadata);

      expect(result.isValid).toBe(true);
    });

    it('allows empty metadata', () => {
      const result = validateTechnicalMetadata({});

      expect(result.isValid).toBe(true);
    });
  });

  describe('generateNewKey', () => {
    it('generates valid hex key', () => {
      const key = generateNewKey();

      expect(key).toMatch(/^[0-9a-f]{64}$/); // 32 bytes = 64 hex chars
      expect(key.length).toBe(64);
    });

    it('generates different keys', () => {
      const key1 = generateNewKey();
      const key2 = generateNewKey();

      expect(key1).not.toBe(key2);
    });

    it('generated key can be used for encryption', () => {
      const newKey = generateNewKey();
      const originalKey = process.env.ENCRYPTION_KEY;

      process.env.ENCRYPTION_KEY = newKey;

      const plaintext = 'test with new key';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);

      process.env.ENCRYPTION_KEY = originalKey;
    });
  });

  describe('AAD Context', () => {
    it('supports all AAD contexts', () => {
      const contexts: AADContext[] = ['OAUTH_TOKEN', 'HEALTH_DATA', 'API_KEY'];

      for (const context of contexts) {
        const plaintext = `test for ${context}`;
        const encrypted = encrypt(plaintext, context);
        const decrypted = decrypt(encrypted);

        expect(decrypted).toBe(plaintext);
        expect(encrypted.context).toBe(context);
      }
    });

    it('includes context in AAD hash', () => {
      const plaintext = 'test';

      const encrypted1 = encrypt(plaintext, 'OAUTH_TOKEN');
      const encrypted2 = encrypt(plaintext, 'HEALTH_DATA');

      expect(encrypted1.aadHash).not.toBe(encrypted2.aadHash);
    });
  });
});
