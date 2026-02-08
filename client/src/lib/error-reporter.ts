/**
 * Client-side error reporting utility
 * Sends error reports to the server which emails them to rob@brokervault.ai
 */

interface ErrorReportOptions {
  error: Error | string;
  componentStack?: string;
  additionalInfo?: Record<string, any>;
}

let isReporting = false;

// Patterns for third-party errors we want to ignore
const IGNORED_ERROR_PATTERNS = [
  'chrome-extension://',
  'moz-extension://',
  'safari-extension://',
  'licdn.com',
  'linkedin',
  'facebook.net',
  'google-analytics.com',
  'googletagmanager.com',
  'doubleclick.net',
  'hotjar.com',
  'Object Not Found Matching Id',  // SignalR errors from external embeds/widgets
  'ResizeObserver loop',  // Benign browser warning, not actionable
];

function shouldIgnoreError(error: Error | string, filename?: string): boolean {
  const errorString = error instanceof Error
    ? `${error.message} ${error.stack || ''}`
    : String(error);

  const combined = `${errorString} ${filename || ''}`.toLowerCase();

  return IGNORED_ERROR_PATTERNS.some(pattern =>
    combined.includes(pattern.toLowerCase())
  );
}

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
  } finally {
    isReporting = false;
  }
}

// Global error handler for uncaught errors
export function setupGlobalErrorHandlers(): void {
  // Suppress ResizeObserver errors globally (benign browser warning)
  // These can come through in various formats, so check early
  const resizeObserverErr = window.ResizeObserver;
  if (resizeObserverErr) {
    const originalResizeObserver = window.ResizeObserver;
    window.ResizeObserver = class extends originalResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        super((entries, observer) => {
          // Wrap callback to prevent "loop completed" errors from propagating
          window.requestAnimationFrame(() => {
            callback(entries, observer);
          });
        });
      }
    };
  }

  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    // Early check for ResizeObserver errors (they come in various formats)
    const messageStr = String(event.message || '');
    if (messageStr.includes('ResizeObserver')) return;

    const error = event.error || event.message;
    if (shouldIgnoreError(error, event.filename)) return;

    reportError({
      error,
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

    if (shouldIgnoreError(error)) return;

    reportError({
      error,
      additionalInfo: {
        type: 'unhandled_rejection',
      },
    });
  });
}
