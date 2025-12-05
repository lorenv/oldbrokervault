/**
 * Client-side error reporting utility
 * Sends error reports to the server which emails them to rob@cimshare.com
 */

interface ErrorReportOptions {
  error: Error | string;
  componentStack?: string;
  additionalInfo?: Record<string, any>;
}

let isReporting = false;

export async function reportError(options: ErrorReportOptions): Promise<void> {
  // Prevent recursive error reporting
  if (isReporting) return;
  isReporting = true;

  try {
    const errorMessage = options.error instanceof Error
      ? options.error.message
      : String(options.error);

    const errorStack = options.error instanceof Error
      ? options.error.stack
      : undefined;

    await fetch('/api/error-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        error: errorMessage,
        stack: errorStack,
        page: window.location.pathname + window.location.search,
        componentStack: options.componentStack,
        additionalInfo: options.additionalInfo,
      }),
    });
  } catch (e) {
    // Silently fail - don't want error reporting to cause more errors
    console.error('Failed to report error:', e);
  } finally {
    isReporting = false;
  }
}

// Global error handler for uncaught errors
export function setupGlobalErrorHandlers(): void {
  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    reportError({
      error: event.error || event.message,
      additionalInfo: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        type: 'uncaught_error',
      },
    });
  });

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason));

    reportError({
      error,
      additionalInfo: {
        type: 'unhandled_rejection',
      },
    });
  });
}
