/**
 * Monitoring API Routes
 *
 * Provides HTTP endpoints for health checks and monitoring data.
 */

import { Router, Request, Response } from 'express';
import {
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
} from './health-checks';
import {
  startMonitoring,
  stopMonitoring,
  getLatestReports,
  triggerHealthCheck,
} from './scheduler';

const router = Router();

// Simple auth middleware for monitoring endpoints
function checkMonitoringAuth(req: Request, res: Response, next: Function): void {
  const token = req.headers['x-monitoring-token'] || req.query.token;
  const expectedToken = process.env.MONITORING_TOKEN;

  // If no token is configured, only allow from localhost
  if (!expectedToken) {
    const ip = req.ip || req.socket.remoteAddress;
    if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
      return next();
    }
    res.status(403).json({ error: 'Monitoring token required' });
    return;
  }

  if (token !== expectedToken) {
    res.status(401).json({ error: 'Invalid monitoring token' });
    return;
  }

  next();
}

/**
 * GET /api/monitoring/health
 * Quick health check endpoint (for load balancers, etc.)
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const report = await runQuickHealthCheck();

    const statusCode = report.overall === 'healthy' ? 200 :
                       report.overall === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
      status: report.overall,
      timestamp: report.timestamp,
      summary: report.summary,
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/monitoring/health/full
 * Comprehensive health check (requires auth)
 */
router.get('/health/full', checkMonitoringAuth, async (req: Request, res: Response) => {
  try {
    const report = await runAllHealthChecks();
    res.json(report);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/monitoring/health/:service
 * Check specific service health
 */
router.get('/health/:service', checkMonitoringAuth, async (req: Request, res: Response) => {
  const { service } = req.params;

  try {
    let result;

    switch (service.toLowerCase()) {
      case 'openai':
        result = await checkOpenAIHealth();
        break;
      case 'cim':
      case 'cim-generation':
        result = await checkCIMGenerationHealth();
        break;
      case 'database':
      case 'db':
        result = await checkDatabaseHealth();
        break;
      case 'stripe':
        result = await checkStripeHealth();
        break;
      case 'sendgrid':
      case 'email':
        result = await checkSendGridHealth();
        break;
      case 'storage':
        result = await checkStorageHealth();
        break;
      case 'perplexity':
        result = await checkPerplexityHealth();
        break;
      case 'environment':
      case 'env':
        result = checkEnvironmentHealth();
        break;
      default:
        res.status(404).json({ error: `Unknown service: ${service}` });
        return;
    }

    const statusCode = result.status === 'healthy' ? 200 :
                       result.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json(result);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      service,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/monitoring/reports
 * Get latest cached health reports
 */
router.get('/reports', checkMonitoringAuth, (req: Request, res: Response) => {
  const reports = getLatestReports();
  res.json(reports);
});

/**
 * POST /api/monitoring/trigger
 * Manually trigger a health check
 */
router.post('/trigger', checkMonitoringAuth, async (req: Request, res: Response) => {
  const { full = false } = req.body;

  try {
    const report = await triggerHealthCheck(full);
    res.json(report);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/monitoring/scheduler/start
 * Start the monitoring scheduler
 */
router.post('/scheduler/start', checkMonitoringAuth, (req: Request, res: Response) => {
  const { alertEmail, slackWebhookUrl, webhookUrl } = req.body;

  const alertConfig = {
    enabled: !!(alertEmail || slackWebhookUrl || webhookUrl),
    emailRecipients: alertEmail ? alertEmail.split(',').map((e: string) => e.trim()) : undefined,
    slackWebhookUrl,
    webhookUrl,
  };

  startMonitoring(alertConfig);

  res.json({
    message: 'Monitoring scheduler started',
    alertConfig: {
      emailEnabled: !!alertConfig.emailRecipients,
      slackEnabled: !!alertConfig.slackWebhookUrl,
      webhookEnabled: !!alertConfig.webhookUrl,
    },
  });
});

/**
 * POST /api/monitoring/scheduler/stop
 * Stop the monitoring scheduler
 */
router.post('/scheduler/stop', checkMonitoringAuth, (req: Request, res: Response) => {
  stopMonitoring();
  res.json({ message: 'Monitoring scheduler stopped' });
});

/**
 * GET /api/monitoring/status
 * Get monitoring system status
 */
router.get('/status', checkMonitoringAuth, (req: Request, res: Response) => {
  const reports = getLatestReports();

  res.json({
    schedulerRunning: reports.isRunning,
    lastQuickCheck: reports.quick?.timestamp || null,
    lastFullCheck: reports.full?.timestamp || null,
    lastQuickStatus: reports.quick?.overall || null,
    lastFullStatus: reports.full?.overall || null,
  });
});

/**
 * GET /api/monitoring/dashboard
 * Get data for monitoring dashboard
 */
router.get('/dashboard', checkMonitoringAuth, async (req: Request, res: Response) => {
  try {
    const reports = getLatestReports();
    const currentReport = await runQuickHealthCheck();

    // Build dashboard data
    const dashboard = {
      current: {
        overall: currentReport.overall,
        timestamp: currentReport.timestamp,
        summary: currentReport.summary,
        checks: currentReport.checks.map(c => ({
          name: c.name,
          status: c.status,
          message: c.message,
          latencyMs: c.latencyMs,
        })),
      },
      scheduler: {
        running: reports.isRunning,
        lastQuickCheck: reports.quick?.timestamp || null,
        lastFullCheck: reports.full?.timestamp || null,
      },
      history: {
        quick: reports.quick ? {
          overall: reports.quick.overall,
          timestamp: reports.quick.timestamp,
        } : null,
        full: reports.full ? {
          overall: reports.full.overall,
          timestamp: reports.full.timestamp,
          checks: reports.full.checks.map(c => ({
            name: c.name,
            status: c.status,
          })),
        } : null,
      },
    };

    res.json(dashboard);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate dashboard data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
