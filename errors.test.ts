import { describe, expect, it } from 'vitest';
import {
  isRetryableError,
  extractSafeErrorInfo,
  ERROR_CODES,
  createError,
  RateLimitError,
  AppError,
} from './errors';

describe('Error Utilities', () => {
  describe('isRetryableError', () => {
    it('returns true for network errors', () => {
      const networkError = new Error('Network timeout');
      expect(isRetryableError(networkError)).toBe(true);

      const connectionError = new Error('Connection refused');
      expect(isRetryableError(connectionError)).toBe(true);

      const econnError = new Error('ECONNREFUSED');
      expect(isRetryableError(econnError)).toBe(true);
    });

    it('returns true for rate limiting', () => {
      const rateLimitError = new Error('Rate limit exceeded');
      expect(isRetryableError(rateLimitError)).toBe(true);

      const throttlingError = new Error('ThrottlingException');
      expect(isRetryableError(throttlingError)).toBe(true);
    });

    it('returns false for validation errors', () => {
      const validationError = new Error('Invalid input');
      expect(isRetryableError(validationError)).toBe(false);

      const authError = new Error('Unauthorized');
      expect(isRetryableError(authError)).toBe(false);

      const notFoundError = new Error('Resource not found');
      expect(isRetryableError(notFoundError)).toBe(false);
    });

    it('uses metadata from AppError', () => {
      const retryableError = createError(
        ERROR_CODES.SERVICE_UNAVAILABLE,
        'Service down',
        true
      );
      expect(isRetryableError(retryableError)).toBe(true);

      const nonRetryableError = createError(
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid data',
        false
      );
      expect(isRetryableError(nonRetryableError)).toBe(false);
    });

    it('returns false for unknown errors', () => {
      const unknownError = new Error('Something went wrong');
      expect(isRetryableError(unknownError)).toBe(false);
    });
  });

  describe('extractSafeErrorInfo', () => {
    it('extracts safe information from standard Error', () => {
      const error = new Error('Test message');
      (error as any).code = 'TEST_ERROR';

      const info = extractSafeErrorInfo(error);

      expect(info.message).toBe('Test message');
      expect(info.code).toBe('TEST_ERROR');
      expect(info.retryable).toBe(false);
      expect(info.timestamp).toBeDefined();
    });

    it('limits message length to 500 characters', () => {
      const longMessage = 'a'.repeat(600);
      const error = new Error(longMessage);

      const info = extractSafeErrorInfo(error);

      expect(info.message.length).toBe(500);
    });

    it('handles errors without message or code', () => {
      const error = { unexpected: 'object' };

      const info = extractSafeErrorInfo(error);

      expect(info.message).toBe('Unknown error');
      expect(info.code).toBe('UNKNOWN_ERROR');
    });

    it('identifies RateLimitError correctly', () => {
      const rateLimitError = new RateLimitError();

      const info = extractSafeErrorInfo(rateLimitError);

      expect(info.code).toBe(ERROR_CODES.RATE_LIMITED);
      expect(info.retryable).toBe(false);
    });

    it('extracts info from AppError', () => {
      const appError = new AppError(
        ERROR_CODES.SYNC_ERROR,
        'Sync failed',
        {
          isRetryable: true,
          statusCode: 500,
        }
      );

      const info = extractSafeErrorInfo(appError);

      expect(info.code).toBe(ERROR_CODES.SYNC_ERROR);
      expect(info.message).toBe('Sync failed');
      expect(info.retryable).toBe(true);
    });
  });

  describe('createError', () => {
    it('creates AppError with correct metadata', () => {
      const error = createError(
        ERROR_CODES.PROVIDER_ERROR,
        'Provider unavailable',
        true,
        { provider: 'GARMIN' }
      );

      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe(ERROR_CODES.PROVIDER_ERROR);
      expect(error.message).toBe('Provider unavailable');
      expect(error.metadata.isRetryable).toBe(true);
      expect(error.metadata.context).toEqual({ provider: 'GARMIN' });
    });
  });

  describe('RateLimitError', () => {
    it('creates RateLimitError with retry info', () => {
      const error = new RateLimitError('Too many requests', 60);

      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe(ERROR_CODES.RATE_LIMITED);
      expect(error.retryAfter).toBe(60);
      expect(error.metadata.isRetryable).toBe(false);
    });
  });
});
