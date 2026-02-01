/**
 * Utility for making HTTP requests with explicit timeouts
 *
 * PERF-013: External API calls should have explicit timeouts to prevent
 * hanging requests from blocking request handlers indefinitely.
 */

// Default timeout values for different types of external API calls
export const API_TIMEOUTS = {
  /** Fast operations like health checks, simple API calls */
  FAST: 10000, // 10 seconds
  /** Standard API operations */
  STANDARD: 30000, // 30 seconds
  /** AI/LLM API calls which may take longer */
  AI_API: 60000, // 60 seconds
  /** File downloads, large data transfers */
  DOWNLOAD: 120000, // 2 minutes
  /** Very long operations like complex AI generation */
  LONG: 180000, // 3 minutes
} as const;

/**
 * Error class for timeout-specific errors
 */
export class FetchTimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    super(`Request to ${url} timed out after ${timeoutMs}ms`);
    this.name = 'FetchTimeoutError';
  }
}

/**
 * Fetch with explicit timeout using AbortController
 *
 * @param url - The URL to fetch
 * @param options - Standard fetch options
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns Promise<Response>
 * @throws FetchTimeoutError if the request times out
 *
 * @example
 * ```typescript
 * // Basic usage with default timeout
 * const response = await fetchWithTimeout('https://api.example.com/data');
 *
 * // With custom timeout for AI APIs
 * const response = await fetchWithTimeout(
 *   'https://api.openai.com/v1/chat/completions',
 *   { method: 'POST', body: JSON.stringify(data) },
 *   API_TIMEOUTS.AI_API
 * );
 * ```
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = API_TIMEOUTS.STANDARD
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new FetchTimeoutError(url, timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Wrapper that handles timeout errors gracefully and provides a fallback
 *
 * @param url - The URL to fetch
 * @param options - Standard fetch options
 * @param timeoutMs - Timeout in milliseconds
 * @param fallbackValue - Value to return on timeout (optional)
 * @returns Promise with the response or fallback value
 */
export async function fetchWithTimeoutOrFallback<T>(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = API_TIMEOUTS.STANDARD,
  fallbackValue?: T
): Promise<Response | T> {
  try {
    return await fetchWithTimeout(url, options, timeoutMs);
  } catch (error) {
    if (error instanceof FetchTimeoutError && fallbackValue !== undefined) {
      console.warn(`[TIMEOUT] ${error.message}, using fallback value`);
      return fallbackValue;
    }
    throw error;
  }
}
