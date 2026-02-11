/**
 * Error codes for different failure scenarios
 */
export const ERROR_CODES = {
  // Network/Retry errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  CONNECTION_REFUSED: 'CONNECTION_REFUSED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

  // Rate limiting
  RATE_LIMITED: 'RATE_LIMITED',
  THROTTLED: 'THROTTLED',

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',

  // Authentication/Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_TOKEN: 'INVALID_TOKEN',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',

  // Encryption errors
  ENCRYPTION_ERROR: 'ENCRYPTION_ERROR',
  DECRYPTION_ERROR: 'DECRYPTION_ERROR',

  // Provider errors
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',

  // Sync errors
  SYNC_ERROR: 'SYNC_ERROR',
  SYNC_FAILED: 'SYNC_FAILED',

  // Unknown
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Custom application error with metadata
 */
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public metadata: {
      isRetryable: boolean;
      statusCode?: number;
      context?: Record<string, unknown>;
    } = { isRetryable: false }
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Rate limit error - not retryable immediately
 */
export class RateLimitError extends AppError {
  constructor(
    message: string = 'Rate limit exceeded',
    public retryAfter?: number
  ) {
    super(ERROR_CODES.RATE_LIMITED, message, {
      isRetryable: false,
      statusCode: 429,
    });
    this.name = 'RateLimitError';
  }
}

/**
 * Determine if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.metadata.isRetryable;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  // Network errors
  if (
    message.includes('timeout') ||
    message.includes('network') ||
    message.includes('connection') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('temporarily') ||
    message.includes('busy')
  ) {
    return true;
  }

  // Rate limiting
  if (
    message.includes('rate limit') ||
    message.includes('throttl') ||
    message.includes('too many requests')
  ) {
    return true;
  }

  // Service availability
  if (
    message.includes('service unavailable') ||
    message.includes('bad gateway') ||
    message.includes('gateway timeout')
  ) {
    return true;
  }

  // Error codes
  if (
    name.includes('econnrefused') ||
    name.includes('etimedout') ||
    name.includes('enotfound')
  ) {
    return true;
  }

  return false;
}

/**
 * Extract safe error information for logging/storage
 */
export function extractSafeErrorInfo(error: unknown): {
  message: string;
  code: ErrorCode;
  retryable: boolean;
  timestamp: string;
} {
  const timestamp = new Date().toISOString();

  if (error instanceof AppError) {
    return {
      message: error.message.substring(0, 500),
      code: error.code,
      retryable: error.metadata.isRetryable,
      timestamp,
    };
  }

  if (error instanceof Error) {
    const message = error.message || 'Unknown error';
    const code = (error as any).code || ERROR_CODES.UNKNOWN_ERROR;

    return {
      message: message.substring(0, 500),
      code: code as ErrorCode,
      retryable: isRetryableError(error),
      timestamp,
    };
  }

  return {
    message: 'Unknown error',
    code: ERROR_CODES.UNKNOWN_ERROR,
    retryable: false,
    timestamp,
  };
}

/**
 * Create an AppError with proper metadata
 */
export function createError(
  code: ErrorCode,
  message: string,
  isRetryable: boolean = false,
  context?: Record<string, unknown>
): AppError {
  return new AppError(code, message, {
    isRetryable,
    context,
  });
}
