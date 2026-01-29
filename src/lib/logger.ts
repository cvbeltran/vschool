/**
 * Centralized logging utility
 * - No-ops in production (or uses console.error only for errors)
 * - Can be extended to integrate with error tracking services (Sentry, etc.)
 */

const isDevelopment = process.env.NODE_ENV === "development";

/**
 * Log an error (always logged, even in production)
 */
export function logError(message: string, error?: unknown, context?: Record<string, unknown>): void {
  if (error instanceof Error) {
    console.error(`[ERROR] ${message}`, {
      error: error.message,
      stack: error.stack,
      ...context,
    });
  } else if (error && typeof error === "object") {
    // Handle Supabase/PostgREST errors and other error-like objects
    const errorObj = error as Record<string, unknown>;
    console.error(`[ERROR] ${message}`, {
      error: errorObj.message || errorObj.error || error,
      code: errorObj.code,
      details: errorObj.details,
      hint: errorObj.hint,
      ...context,
    });
  } else {
    console.error(`[ERROR] ${message}`, { error, ...context });
  }
}

/**
 * Log a warning (only in development)
 */
export function logWarning(message: string, context?: Record<string, unknown>): void {
  if (isDevelopment) {
    console.warn(`[WARN] ${message}`, context);
  }
}

/**
 * Log debug information (only in development)
 */
export function logDebug(message: string, context?: Record<string, unknown>): void {
  if (isDevelopment) {
    console.log(`[DEBUG] ${message}`, context);
  }
}

/**
 * Log info (only in development)
 */
export function logInfo(message: string, context?: Record<string, unknown>): void {
  if (isDevelopment) {
    console.log(`[INFO] ${message}`, context);
  }
}
