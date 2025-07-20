/**
 * Exponential backoff with jitter for retry operations
 * @param fn - Function to execute with retries
 * @param maxRetries - Maximum number of retry attempts
 * @param retryDelay - Base delay between attempts in milliseconds
 * @returns Result of the function execution
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  retryDelay = 1000
): Promise<T> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      attempt++;

      // Skip retries for fatal errors
      if (isFatalError(error)) {
        break;
      }

      // Exponential backoff with jitter
      const delay = retryDelay * Math.pow(2, attempt) * (0.5 + Math.random());
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Checks if an error is fatal (should not be retried)
 * @param error - Error object
 */
function isFatalError(error: unknown): boolean {
  // Check if error has statusCode property
  if (typeof error === 'object' && error !== null && 'statusCode' in error) {
    const statusCode = (error as { statusCode?: number }).statusCode;

    // Fatal errors: 4xx (except 429), validation errors
    return (
      statusCode !== undefined &&
      statusCode >= 400 &&
      statusCode < 500 &&
      statusCode !== 429
    );
  }

  return false;
}
