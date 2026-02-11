import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const CURRENT_VERSION = 1;
const AAD_CONTEXTS = {
  OAUTH_TOKEN: 'OAUTH_TOKEN',
  HEALTH_DATA: 'HEALTH_DATA',
  API_KEY: 'API_KEY',
};

export type AADContext = keyof typeof AAD_CONTEXTS;

export interface TechnicalMetadata {
  provider?: string;
  userId?: string;
  integrationId?: string;
  [key: string]: string | number | undefined;
}

export interface EncryptedDataV1 {
  v: 1;
  encrypted: string;
  iv: string;
  authTag: string;
  createdAt: string;
  context?: AADContext;
  aadHash?: string;
  aadVersion?: string;
}

export type EncryptedData = EncryptedDataV1;

/**
 * Validate that metadata contains only technical/invariable fields
 */
export function validateTechnicalMetadata(metadata: TechnicalMetadata): {
  isValid: boolean;
  invalidKeys?: string[];
} {
  const allowedKeys = ['provider', 'userId', 'integrationId'];
  const invalidKeys = Object.keys(metadata).filter(
    key => !allowedKeys.includes(key)
  );

  return {
    isValid: invalidKeys.length === 0,
    invalidKeys: invalidKeys.length > 0 ? invalidKeys : undefined,
  };
}

/**
 * Encrypt data using AES-256-GCM
 */
export function encrypt(
  text: string,
  context?: AADContext,
  metadata?: TechnicalMetadata
): EncryptedDataV1 {
  if (!text) throw new Error('Text to encrypt cannot be empty');

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY environment variable not configured');
  }

  const iv = crypto.randomBytes(16);
  const key = Buffer.from(encryptionKey, 'hex');

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  if (context) {
    // Build AAD string
    let aadString = `${AAD_CONTEXTS[context]}::v${CURRENT_VERSION}`;

    // Add technical metadata if provided
    if (metadata) {
      const validation = validateTechnicalMetadata(metadata);
      if (!validation.isValid && validation.invalidKeys) {
        throw new Error(
          `Invalid metadata for AAD. Non-technical keys: ${validation.invalidKeys.join(', ')}`
        );
      }

      // Sort and serialize metadata
      const metadataEntries = Object.entries(metadata)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`);

      if (metadataEntries.length > 0) {
        const metadataStr = metadataEntries.join('|');
        aadString += `::${metadataStr}`;
      }
    }

    const aad = Buffer.from(aadString, 'utf8');

    // Calculate AAD hash for validation
    const aadHash = crypto
      .createHash('sha256')
      .update(aad)
      .digest('hex')
      .substring(0, 16);

    // Set AAD BEFORE any cipher operations
    cipher.setAAD(aad);

    // Store only base version for audit (without metadata)
    const aadVersion = `${AAD_CONTEXTS[context]}::v${CURRENT_VERSION}`;

    // Now perform encryption
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      v: CURRENT_VERSION,
      encrypted,
      iv: iv.toString('hex'),
      authTag: cipher.getAuthTag().toString('hex'),
      createdAt: new Date().toISOString(),
      context,
      aadHash,
      aadVersion,
    };
  }

  // Without context
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return {
    v: CURRENT_VERSION,
    encrypted,
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Decrypt data using AES-256-GCM
 */
export function decrypt(encryptedData: EncryptedData): string {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY environment variable not configured');
  }

  if (encryptedData.v !== CURRENT_VERSION) {
    throw new Error(
      `Unsupported encryption version: ${encryptedData.v}. Current version: ${CURRENT_VERSION}`
    );
  }

  const keyBuffer = Buffer.from(encryptionKey, 'hex');
  const ivBuffer = Buffer.from(encryptedData.iv, 'hex');
  const authTagBuffer = Buffer.from(encryptedData.authTag, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, ivBuffer);

  // Set AAD BEFORE auth tag
  if (encryptedData.context && encryptedData.aadVersion) {
    const aadString = encryptedData.aadVersion;
    decipher.setAAD(Buffer.from(aadString, 'utf8'));
  }

  decipher.setAuthTag(authTagBuffer);

  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Decrypt with specific key (for key rotation)
 */
export function decryptWithKey(
  encryptedData: EncryptedData,
  key: string
): string {
  if (encryptedData.v !== CURRENT_VERSION) {
    throw new Error(
      `Unsupported encryption version: ${encryptedData.v}. Current version: ${CURRENT_VERSION}`
    );
  }

  const keyBuffer = Buffer.from(key, 'hex');
  const ivBuffer = Buffer.from(encryptedData.iv, 'hex');
  const authTagBuffer = Buffer.from(encryptedData.authTag, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, ivBuffer);

  // Set AAD BEFORE auth tag
  if (encryptedData.context && encryptedData.aadVersion) {
    const aadString = encryptedData.aadVersion;
    decipher.setAAD(Buffer.from(aadString, 'utf8'));
  }

  decipher.setAuthTag(authTagBuffer);

  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generate a new encryption key (for key rotation)
 */
export function generateNewKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
