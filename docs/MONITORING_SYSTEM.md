# System Monitoring Guide

This document describes the comprehensive monitoring system for detecting issues with critical application components before they impact users.

## Overview

The monitoring system provides:
- **Proactive health checks** for all external APIs and critical services
- **Scheduled background monitoring** with configurable intervals
- **Multi-channel alerting** (Email, Slack, Webhooks)
- **Manual health check scripts** for on-demand testing
- **REST API endpoints** for integration with external monitoring tools

---

## Quick Start

### Run a Health Check Manually

```bash
# Full comprehensive check
npx tsx scripts/run-health-check.ts

# Quick check (env, database, OpenAI only)
npx tsx scripts/run-health-check.ts --quick

# JSON output for scripting
npx tsx scripts/run-health-check.ts --json

# With email alerts
ALERT_EMAIL=admin@example.com npx tsx scripts/run-health-check.ts --alert-email

# With Slack alerts
SLACK_WEBHOOK_URL=https://hooks.slack.com/... npx tsx scripts/run-health-check.ts --alert-slack
```

### Schedule Daily Checks (Cron)

Add to your crontab (`crontab -e`):

```bash
# Run comprehensive health check daily at 9 AM
0 9 * * * cd /path/to/app && npx tsx scripts/run-health-check.ts --alert-email >> /var/log/health-check.log 2>&1

# Run quick check every hour
0 * * * * cd /path/to/app && npx tsx scripts/run-health-check.ts --quick >> /var/log/health-check.log 2>&1
```

---

## What Gets Monitored

### Critical Services (Quick Check)

| Service | What's Checked | Healthy Criteria |
|---------|---------------|------------------|
| Environment | Required env vars configured | All required vars present |
| Database | Connectivity and query performance | Response < 1000ms |
| OpenAI API | API key validity, model availability | API responds, models available |

### All Services (Comprehensive Check)

| Service | What's Checked | Healthy Criteria |
|---------|---------------|------------------|
| CIM Generation | Actual document generation test | JSON response generated |
| Perplexity API | API connectivity | API responds (optional) |
| Stripe | Account status, payments enabled | Account accessible |
| SendGrid | API key validity | API responds |
| Object Storage | Read/write operations | CRUD operations succeed |

---

## Health Check API Endpoints

All endpoints return JSON with status codes:
- `200` - Healthy or Degraded
- `503` - Unhealthy (critical failure)
- `401` - Unauthorized (missing token)

### Public Endpoints

```
GET /api/health                           # Basic health (db + pool)
GET /api/ready                            # Kubernetes readiness probe
GET /api/alive                            # Kubernetes liveness probe
GET /api/monitoring/health/quick          # Quick check (no auth)
```

### Protected Endpoints (require MONITORING_TOKEN)

```
GET /api/monitoring/health/comprehensive  # Full system check
GET /api/monitoring/health/cim            # CIM generation check
GET /api/monitoring/health/:service       # Specific service check
GET /api/monitoring/scheduler/status      # Scheduler status
POST /api/monitoring/scheduler/start      # Start background monitoring
POST /api/monitoring/scheduler/stop       # Stop background monitoring
POST /api/monitoring/trigger              # Trigger manual check
```

### Authentication

Set the `MONITORING_TOKEN` environment variable and include in requests:

```bash
curl -H "x-monitoring-token: YOUR_TOKEN" http://localhost:5000/api/monitoring/health/comprehensive
```

Or as query parameter:
```bash
curl http://localhost:5000/api/monitoring/health/comprehensive?token=YOUR_TOKEN
```

---

## Response Format

### Health Check Result

```json
{
  "overall": "healthy|degraded|unhealthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "checks": [
    {
      "name": "OpenAI API",
      "status": "healthy",
      "message": "API is healthy and responsive",
      "latencyMs": 245,
      "details": {
        "modelsAvailable": 15
      },
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  ],
  "summary": {
    "total": 8,
    "healthy": 7,
    "degraded": 1,
    "unhealthy": 0
  }
}
```

### Status Definitions

| Status | Meaning | Action Required |
|--------|---------|-----------------|
| `healthy` | Service operating normally | None |
| `degraded` | Service working but with issues | Monitor closely |
| `unhealthy` | Service failed or unavailable | Immediate attention |

---

## Background Monitoring Scheduler

### Start via API

```bash
curl -X POST http://localhost:5000/api/monitoring/scheduler/start \
  -H "x-monitoring-token: YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "alertEmail": "admin@example.com,ops@example.com",
    "slackWebhookUrl": "https://hooks.slack.com/services/...",
    "webhookUrl": "https://your-alerting-system.com/webhook"
  }'
```

### Check Status

```bash
curl -H "x-monitoring-token: YOUR_TOKEN" \
  http://localhost:5000/api/monitoring/scheduler/status
```

Response:
```json
{
  "schedulerRunning": true,
  "lastQuickCheck": "2024-01-15T10:25:00.000Z",
  "lastFullCheck": "2024-01-15T10:00:00.000Z",
  "lastQuickStatus": "healthy",
  "lastFullStatus": "healthy"
}
```

### Stop Scheduler

```bash
curl -X POST http://localhost:5000/api/monitoring/scheduler/stop \
  -H "x-monitoring-token: YOUR_TOKEN"
```

### Default Intervals

| Check Type | Interval | Purpose |
|------------|----------|---------|
| Quick Check | 5 minutes | Detect critical failures fast |
| Full Check | 1 hour | Comprehensive system status |

---

## Alerting Configuration

### Email Alerts (SendGrid)

Required environment variables:
```
SENDGRID_API_KEY=SG.xxxxx
ALERT_EMAIL=admin@example.com,ops@example.com
SUPPORT_EMAIL=noreply@yourapp.com
```

### Slack Alerts

Set the webhook URL:
```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX
```

### Generic Webhook

The system can POST to any webhook URL with this payload:
```json
{
  "type": "health_alert",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "overall": "unhealthy",
  "summary": { "total": 8, "healthy": 6, "degraded": 1, "unhealthy": 1 },
  "checks": [...]
}
```

---

## Alert Rate Limiting

To prevent alert fatigue:
- Maximum 3 alerts per check type per day
- Counters reset at midnight
- Healthy status doesn't trigger alerts
- Only unhealthy services are alerted

---

## Exit Codes (Script)

The health check script returns exit codes for CI/CD integration:

| Exit Code | Meaning |
|-----------|---------|
| 0 | All checks healthy |
| 1 | Some checks degraded |
| 2 | Critical checks unhealthy |

Use in CI/CD:
```bash
npx tsx scripts/run-health-check.ts --quick
if [ $? -ne 0 ]; then
  echo "Health check failed!"
  exit 1
fi
```

---

## Environment Variables

### Required for Monitoring

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Database connection string |
| `OPENAI_API_KEY` | OpenAI API key for CIM generation |

### Recommended for Monitoring

| Variable | Description |
|----------|-------------|
| `MONITORING_TOKEN` | Secret token for protected endpoints |
| `SENDGRID_API_KEY` | For email alerts |
| `ALERT_EMAIL` | Email recipient(s) for alerts |
| `SLACK_WEBHOOK_URL` | Slack webhook for alerts |

### Optional

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | For Stripe health checks |
| `PERPLEXITY_API_KEY` | For Perplexity health checks |

---

## File Locations

```
server/
├── monitoring/
│   ├── index.ts           # Module exports
│   ├── health-checks.ts   # Individual health check functions
│   ├── scheduler.ts       # Background monitoring scheduler
│   └── routes.ts          # Standalone router (alternative)
├── routes/
│   └── monitoring-routes.ts  # Integrated monitoring routes

scripts/
└── run-health-check.ts    # CLI health check script

docs/
├── AI_MODELS_AND_DOCUMENT_GENERATION.md  # AI model documentation
└── MONITORING_SYSTEM.md                   # This file
```

---

## Troubleshooting

### "OPENAI_API_KEY not configured"
Set the environment variable: `export OPENAI_API_KEY=sk-...`

### "Database connection failed"
Check `DATABASE_URL` is correct and database is accessible.

### "CIM Generation failed"
1. Check OpenAI API status: https://status.openai.com/
2. Verify API key has credits/quota
3. Check if model `gpt-4o-mini` is available

### "Storage operation failed"
Check object storage (Replit Object Storage) is configured and accessible.

### Health checks timing out
- Increase timeout values in `health-checks.ts`
- Check network connectivity to external services

---

## Integration Examples

### Uptime Robot / StatusCake

Use the quick health endpoint:
```
GET https://yourapp.com/api/monitoring/health/quick
Expected: HTTP 200
```

### Datadog / New Relic

Send metrics via webhook or use the JSON endpoint with polling.

### PagerDuty / Opsgenie

Use webhook alerts:
```bash
curl -X POST http://localhost:5000/api/monitoring/scheduler/start \
  -H "x-monitoring-token: TOKEN" \
  -d '{"webhookUrl": "https://events.pagerduty.com/..."}'
```

---

## Best Practices

1. **Run quick checks frequently** (every 5 minutes) for critical service monitoring
2. **Run comprehensive checks hourly** to catch slower degradation
3. **Set up multiple alert channels** (email + Slack) for redundancy
4. **Review alerts weekly** to tune thresholds and reduce noise
5. **Test the monitoring system** periodically by simulating failures
6. **Keep MONITORING_TOKEN secure** and rotate regularly
