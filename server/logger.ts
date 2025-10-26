/**
 * Structured Logging System
 * Replaces console.log statements with proper logging levels and sanitization
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: any;
  userId?: number;
  requestId?: string;
}

class Logger {
  private logLevel: LogLevel;
  private isDevelopment: boolean;
  private originalConsole: {
    log: typeof console.log;
    error: typeof console.error;
    warn: typeof console.warn;
  };

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.logLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.INFO;
    
    // Store original console methods to prevent recursion
    this.originalConsole = {
      log: console.log.bind(console),
      error: console.error.bind(console),
      warn: console.warn.bind(console)
    };
  }

  private sanitizeData(data: any): any {
    if (!data) return data;

    // Handle circular references and Error objects
    const seen = new WeakSet();

    const sanitizeObject = (obj: any): any => {
      if (obj === null || typeof obj !== 'object') return obj;

      // Handle Error objects specially
      if (obj instanceof Error) {
        return {
          message: obj.message,
          name: obj.name,
          stack: obj.stack
        };
      }

      // Detect circular references
      if (seen.has(obj)) {
        return '[Circular]';
      }
      seen.add(obj);

      // Handle arrays
      if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
      }

      // Handle objects
      const result: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (this.isSensitiveField(key)) {
            result[key] = '[REDACTED]';
          } else {
            try {
              result[key] = sanitizeObject(obj[key]);
            } catch (e) {
              result[key] = '[Error sanitizing]';
            }
          }
        }
      }

      return result;
    };

    return sanitizeObject(data);
  }

  private isSensitiveField(key: string): boolean {
    const sensitiveFields = [
      'password', 'token', 'secret', 'key', 'auth', 'session',
      'stripeCustomerId', 'subscriptionId', 'googleTokens',
      'apiKey', 'privateKey', 'accessToken', 'refreshToken'
    ];
    
    return sensitiveFields.some(field => 
      key.toLowerCase().includes(field.toLowerCase())
    );
  }

  private log(level: LogLevel, message: string, data?: any, userId?: number, requestId?: string): void {
    if (level > this.logLevel) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message,
      ...(data && { data: this.sanitizeData(data) }),
      ...(userId && { userId }),
      ...(requestId && { requestId })
    };

    if (this.isDevelopment) {
      // Development: Pretty formatted output
      const levelColors = {
        [LogLevel.ERROR]: '\x1b[31m', // Red
        [LogLevel.WARN]: '\x1b[33m',  // Yellow
        [LogLevel.INFO]: '\x1b[36m',  // Cyan
        [LogLevel.DEBUG]: '\x1b[37m'  // White
      };
      
      const reset = '\x1b[0m';
      const color = levelColors[level];
      
      this.originalConsole.log(`${color}[${entry.level}]${reset} ${entry.timestamp} ${message}`);
      if (data) {
        this.originalConsole.log(`${color}Data:${reset}`, this.sanitizeData(data));
      }
    } else {
      // Production: JSON structured logging - use safe stringify to prevent memory overflow
      try {
        const jsonString = JSON.stringify(entry);
        if (jsonString.length > 100000) { // 100KB limit
          // Truncate large entries to prevent memory issues
          const truncatedEntry = {
            ...entry,
            data: '[TRUNCATED - Too large for logging]'
          };
          this.originalConsole.log(JSON.stringify(truncatedEntry));
        } else {
          this.originalConsole.log(jsonString);
        }
      } catch (error) {
        // Fallback for JSON stringify errors
        this.originalConsole.log(`[LOG ERROR] ${entry.timestamp} ${entry.level}: ${message}`);
      }
    }
  }

  error(message: string, data?: any, userId?: number, requestId?: string): void {
    this.log(LogLevel.ERROR, message, data, userId, requestId);
  }

  warn(message: string, data?: any, userId?: number, requestId?: string): void {
    this.log(LogLevel.WARN, message, data, userId, requestId);
  }

  info(message: string, data?: any, userId?: number, requestId?: string): void {
    this.log(LogLevel.INFO, message, data, userId, requestId);
  }

  debug(message: string, data?: any, userId?: number, requestId?: string): void {
    this.log(LogLevel.DEBUG, message, data, userId, requestId);
  }

  // Convenience methods for common use cases
  apiRequest(method: string, path: string, userId?: number, requestId?: string): void {
    this.info(`API ${method} ${path}`, { method, path }, userId, requestId);
  }

  userAction(action: string, userId: number, data?: any, requestId?: string): void {
    this.info(`User action: ${action}`, data, userId, requestId);
  }

  databaseQuery(query: string, duration?: number, requestId?: string): void {
    this.debug(`Database query completed`, { 
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      duration 
    }, undefined, requestId);
  }

  stripe(action: string, data?: any, userId?: number, requestId?: string): void {
    this.info(`Stripe: ${action}`, this.sanitizeData(data), userId, requestId);
  }

  security(event: string, data?: any, userId?: number, requestId?: string): void {
    this.warn(`Security event: ${event}`, data, userId, requestId);
  }
}

// Export singleton instance
export const logger = new Logger();

// Utility function to generate request IDs
export function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}