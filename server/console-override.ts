/**
 * Console Override for Legacy Code Migration
 * Automatically redirects console.* calls to structured logger
 * This is a temporary solution while migrating to proper logging
 */

import { logger } from './logger';

// Store original console methods for fallback
const originalConsole = {
  log: console.log.bind(console),
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  info: console.info.bind(console),
  debug: console.debug.bind(console)
};

// Override console methods to use logger
export function overrideConsole() {
  console.log = (...args: any[]) => {
    const message = args[0] || 'Log message';
    const data = args.length > 1 ? { data: args.slice(1) } : undefined;
    
    // Use debug for certain patterns, info for others
    if (typeof message === 'string' && 
        (message.includes('===') || 
         message.includes('🔍') || 
         message.includes('📊') ||
         message.toLowerCase().includes('debug'))) {
      logger.debug(message, data);
    } else {
      logger.info(message, data);
    }
  };

  console.error = (...args: any[]) => {
    const message = args[0] || 'Error occurred';
    const data = args.length > 1 ? { error: args.slice(1) } : undefined;
    logger.error(message, data);
  };

  console.warn = (...args: any[]) => {
    const message = args[0] || 'Warning';
    const data = args.length > 1 ? { data: args.slice(1) } : undefined;
    logger.warn(message, data);
  };

  console.info = (...args: any[]) => {
    const message = args[0] || 'Info';
    const data = args.length > 1 ? { data: args.slice(1) } : undefined;
    logger.info(message, data);
  };

  console.debug = (...args: any[]) => {
    const message = args[0] || 'Debug';
    const data = args.length > 1 ? { data: args.slice(1) } : undefined;
    logger.debug(message, data);
  };
}

// Restore original console methods if needed
export function restoreConsole() {
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
  console.info = originalConsole.info;
  console.debug = originalConsole.debug;
}

// Auto-initialize on import if not in test environment
if (process.env.NODE_ENV !== 'test') {
  overrideConsole();
}