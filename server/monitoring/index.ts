/**
 * Monitoring Module
 *
 * Provides comprehensive health monitoring for the application.
 *
 * Usage:
 *   import { monitoringRouter, startMonitoring } from './monitoring';
 *
 *   // Add routes to Express app
 *   app.use('/api/monitoring', monitoringRouter);
 *
 *   // Optionally start background monitoring
 *   startMonitoring({ enabled: true, emailRecipients: ['admin@example.com'] });
 */

export {
  runAllHealthChecks,
  runQuickHealthCheck,
  checkOpenAIHealth,
  checkCIMGenerationHealth,
  checkDatabaseHealth,
  checkStripeHealth,
  checkSendGridHealth,
  checkStorageHealth,
  checkPerplexityHealth,
  checkEnvironmentHealth,
  type HealthCheckResult,
  type SystemHealthReport,
} from './health-checks';

export {
  startMonitoring,
  stopMonitoring,
  getLatestReports,
  triggerHealthCheck,
} from './scheduler';

export { default as monitoringRouter } from './routes';
