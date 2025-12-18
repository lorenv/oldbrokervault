/**
 * Health Check System for Critical Application Components
 *
 * This module provides comprehensive health monitoring for:
 * - CIM Generation (OpenAI/Perplexity AI models)
 * - Database connectivity and performance
 * - External APIs (Stripe, SendGrid)
 * - File storage systems
 * - Authentication system
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { objectStorage } from '../object-storage';

// Health check result types
export interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  latencyMs?: number;
  details?: Record<string, any>;
  timestamp: Date;
}

export interface SystemHealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  checks: HealthCheckResult[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

// Thresholds for health checks
const THRESHOLDS = {
  database: {
    connectionTimeoutMs: 5000,
    queryTimeoutMs: 3000,
    slowQueryMs: 1000,
  },
  api: {
    timeoutMs: 30000,
    slowResponseMs: 5000,
  },
  storage: {
    timeoutMs: 10000,
  },
};

/**
 * Check OpenAI API health and CIM generation capability
 */
export async function checkOpenAIHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const name = 'OpenAI API';

  try {
    if (!process.env.OPENAI_API_KEY) {
      return {
        name,
        status: 'unhealthy',
        message: 'OPENAI_API_KEY environment variable is not set',
        timestamp: new Date(),
      };
    }

    // Test with a minimal API call to check connectivity and auth
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(THRESHOLDS.api.timeoutMs),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      return {
        name,
        status: 'unhealthy',
        message: `API returned ${response.status}: ${errorText.substring(0, 200)}`,
        latencyMs,
        timestamp: new Date(),
      };
    }

    const data = await response.json();

    // Check if the models we need are available
    // Note: gpt-4o-mini may appear with variations in the name
    const requiredModels = ['gpt-4o-mini', 'gpt-4o'];
    const availableModels = data.data?.map((m: any) => m.id) || [];

    // More flexible model matching - check if any model contains the key identifier
    const hasGpt4oMini = availableModels.some((m: string) =>
      m.includes('gpt-4o-mini') || m.includes('gpt-4o')
    );

    if (!hasGpt4oMini && availableModels.length === 0) {
      return {
        name,
        status: 'degraded',
        message: 'No models found in response - API may have issues',
        latencyMs,
        details: { availableModelsCount: availableModels.length },
        timestamp: new Date(),
      };
    }

    // If API responds with models, consider it healthy
    // The actual CIM generation test (checkCIMGenerationHealth) will catch model-specific issues
    return {
      name,
      status: latencyMs > THRESHOLDS.api.slowResponseMs ? 'degraded' : 'healthy',
      message: latencyMs > THRESHOLDS.api.slowResponseMs
        ? `API responding slowly (${latencyMs}ms)`
        : 'API is healthy and responsive',
      latencyMs,
      details: { modelsAvailable: availableModels.length },
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      name,
      status: 'unhealthy',
      message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      latencyMs: Date.now() - startTime,
      timestamp: new Date(),
    };
  }
}

/**
 * Test actual CIM generation with a minimal prompt
 */
export async function checkCIMGenerationHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const name = 'CIM Generation';

  try {
    if (!process.env.OPENAI_API_KEY) {
      return {
        name,
        status: 'unhealthy',
        message: 'OPENAI_API_KEY not configured',
        timestamp: new Date(),
      };
    }

    // Minimal test prompt to verify the model can generate structured content
    const testPrompt = {
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a health check bot. Respond with valid JSON only.',
        },
        {
          role: 'user',
          content: 'Respond with: {"status": "ok", "timestamp": "<current ISO timestamp>"}',
        },
      ],
      max_tokens: 100,
      temperature: 0,
      response_format: { type: 'json_object' },
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPrompt),
      signal: AbortSignal.timeout(THRESHOLDS.api.timeoutMs),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      return {
        name,
        status: 'unhealthy',
        message: `Generation failed with ${response.status}: ${errorText.substring(0, 200)}`,
        latencyMs,
        timestamp: new Date(),
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return {
        name,
        status: 'unhealthy',
        message: 'No content in response',
        latencyMs,
        timestamp: new Date(),
      };
    }

    // Try to parse the JSON response
    try {
      const parsed = JSON.parse(content);
      if (parsed.status === 'ok') {
        return {
          name,
          status: latencyMs > THRESHOLDS.api.slowResponseMs ? 'degraded' : 'healthy',
          message: latencyMs > THRESHOLDS.api.slowResponseMs
            ? `Generation working but slow (${latencyMs}ms)`
            : 'CIM generation is fully functional',
          latencyMs,
          details: {
            model: data.model,
            tokensUsed: data.usage?.total_tokens,
          },
          timestamp: new Date(),
        };
      }
    } catch {
      return {
        name,
        status: 'degraded',
        message: 'Response received but JSON parsing failed',
        latencyMs,
        details: { rawResponse: content.substring(0, 100) },
        timestamp: new Date(),
      };
    }

    return {
      name,
      status: 'degraded',
      message: 'Unexpected response format',
      latencyMs,
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      name,
      status: 'unhealthy',
      message: `Generation test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      latencyMs: Date.now() - startTime,
      timestamp: new Date(),
    };
  }
}

/**
 * Check Anthropic/Claude API health
 */
export async function checkAnthropicHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const name = 'Anthropic Claude API';

  // Models to check - primary and fallback
  // claude-sonnet-4-20250514 is Claude Sonnet 4 (stable)
  const PRIMARY_MODEL = 'claude-sonnet-4-20250514';
  const FALLBACK_MODEL = 'claude-3-5-sonnet-20241022';

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY2 || process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return {
        name,
        status: 'degraded',
        message: 'ANTHROPIC_API_KEY not configured (optional for CIM generation)',
        timestamp: new Date(),
      };
    }

    // Test with a minimal API call
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: PRIMARY_MODEL,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Reply with only: OK' }],
      }),
      signal: AbortSignal.timeout(THRESHOLDS.api.timeoutMs),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      const errorMessage = errorData.error?.message || `Status ${response.status}`;

      // Check if it's a model not found error
      if (errorMessage.includes('model') || errorMessage.includes('not found') || response.status === 404) {
        // Try fallback model
        console.log(`[HEALTH] Primary model ${PRIMARY_MODEL} failed, trying fallback...`);

        const fallbackResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: FALLBACK_MODEL,
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Reply with only: OK' }],
          }),
          signal: AbortSignal.timeout(THRESHOLDS.api.timeoutMs),
        });

        if (fallbackResponse.ok) {
          return {
            name,
            status: 'degraded',
            message: `Primary model ${PRIMARY_MODEL} unavailable, using fallback ${FALLBACK_MODEL}`,
            latencyMs: Date.now() - startTime,
            details: {
              primaryModel: PRIMARY_MODEL,
              fallbackModel: FALLBACK_MODEL,
              primaryError: errorMessage,
            },
            timestamp: new Date(),
          };
        }

        return {
          name,
          status: 'unhealthy',
          message: `Both primary (${PRIMARY_MODEL}) and fallback (${FALLBACK_MODEL}) models failed`,
          latencyMs: Date.now() - startTime,
          details: { primaryError: errorMessage },
          timestamp: new Date(),
        };
      }

      return {
        name,
        status: 'unhealthy',
        message: `API error: ${errorMessage}`,
        latencyMs,
        timestamp: new Date(),
      };
    }

    return {
      name,
      status: latencyMs > THRESHOLDS.api.slowResponseMs ? 'degraded' : 'healthy',
      message: latencyMs > THRESHOLDS.api.slowResponseMs
        ? `API responding slowly (${latencyMs}ms)`
        : `Anthropic API healthy (model: ${PRIMARY_MODEL})`,
      latencyMs,
      details: {
        model: PRIMARY_MODEL,
        fallbackModel: FALLBACK_MODEL,
      },
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      name,
      status: 'unhealthy',
      message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      latencyMs: Date.now() - startTime,
      timestamp: new Date(),
    };
  }
}

/**
 * Check Perplexity API health (fallback AI provider)
 */
export async function checkPerplexityHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const name = 'Perplexity API';

  try {
    if (!process.env.PERPLEXITY_API_KEY) {
      return {
        name,
        status: 'degraded',
        message: 'PERPLEXITY_API_KEY not configured (optional fallback)',
        timestamp: new Date(),
      };
    }

    // Simple test request
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: 'Reply with only: OK' }],
        max_tokens: 10,
      }),
      signal: AbortSignal.timeout(THRESHOLDS.api.timeoutMs),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      return {
        name,
        status: 'degraded',
        message: `API returned ${response.status}: ${errorText.substring(0, 100)}`,
        latencyMs,
        timestamp: new Date(),
      };
    }

    return {
      name,
      status: 'healthy',
      message: 'Perplexity API is responsive',
      latencyMs,
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      name,
      status: 'degraded',
      message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      latencyMs: Date.now() - startTime,
      timestamp: new Date(),
    };
  }
}

/**
 * Check database connectivity and performance
 */
export async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const name = 'Database';

  try {
    // Simple query to test connectivity
    const result = await db.execute(sql`SELECT 1 as health_check, NOW() as server_time`);
    const latencyMs = Date.now() - startTime;

    if (!result || result.rows?.length === 0) {
      return {
        name,
        status: 'unhealthy',
        message: 'Query returned no results',
        latencyMs,
        timestamp: new Date(),
      };
    }

    // Get additional stats
    const statsStart = Date.now();
    const stats = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM users) as user_count,
        (SELECT COUNT(*) FROM cim_documents) as document_count,
        pg_database_size(current_database()) as db_size_bytes
    `);
    const statsLatency = Date.now() - statsStart;

    const dbStats = stats.rows?.[0] as any;

    if (latencyMs > THRESHOLDS.database.slowQueryMs) {
      return {
        name,
        status: 'degraded',
        message: `Database responding slowly (${latencyMs}ms)`,
        latencyMs,
        details: {
          userCount: dbStats?.user_count,
          documentCount: dbStats?.document_count,
          dbSizeMB: dbStats?.db_size_bytes ? Math.round(dbStats.db_size_bytes / 1024 / 1024) : null,
          statsQueryMs: statsLatency,
        },
        timestamp: new Date(),
      };
    }

    return {
      name,
      status: 'healthy',
      message: 'Database is healthy and responsive',
      latencyMs,
      details: {
        userCount: dbStats?.user_count,
        documentCount: dbStats?.document_count,
        dbSizeMB: dbStats?.db_size_bytes ? Math.round(dbStats.db_size_bytes / 1024 / 1024) : null,
      },
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      name,
      status: 'unhealthy',
      message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      latencyMs: Date.now() - startTime,
      timestamp: new Date(),
    };
  }
}

/**
 * Check Stripe API health
 */
export async function checkStripeHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const name = 'Stripe API';

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return {
        name,
        status: 'unhealthy',
        message: 'STRIPE_SECRET_KEY not configured',
        timestamp: new Date(),
      };
    }

    // Check account status
    const response = await fetch('https://api.stripe.com/v1/account', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      },
      signal: AbortSignal.timeout(THRESHOLDS.api.timeoutMs),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      return {
        name,
        status: 'unhealthy',
        message: `API returned ${response.status}: ${errorText.substring(0, 100)}`,
        latencyMs,
        timestamp: new Date(),
      };
    }

    const account = await response.json();

    return {
      name,
      status: 'healthy',
      message: 'Stripe API is healthy',
      latencyMs,
      details: {
        accountId: account.id,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
      },
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      name,
      status: 'unhealthy',
      message: `Stripe connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      latencyMs: Date.now() - startTime,
      timestamp: new Date(),
    };
  }
}

/**
 * Check SendGrid API health
 */
export async function checkSendGridHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const name = 'SendGrid API';

  try {
    if (!process.env.SENDGRID_API_KEY) {
      return {
        name,
        status: 'unhealthy',
        message: 'SENDGRID_API_KEY not configured',
        timestamp: new Date(),
      };
    }

    // Check API key validity
    const response = await fetch('https://api.sendgrid.com/v3/user/profile', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
      },
      signal: AbortSignal.timeout(THRESHOLDS.api.timeoutMs),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      if (response.status === 401) {
        return {
          name,
          status: 'unhealthy',
          message: 'Invalid API key',
          latencyMs,
          timestamp: new Date(),
        };
      }
      return {
        name,
        status: 'degraded',
        message: `API returned ${response.status}`,
        latencyMs,
        timestamp: new Date(),
      };
    }

    return {
      name,
      status: 'healthy',
      message: 'SendGrid API is healthy',
      latencyMs,
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      name,
      status: 'unhealthy',
      message: `SendGrid connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      latencyMs: Date.now() - startTime,
      timestamp: new Date(),
    };
  }
}

/**
 * Check object storage health
 */
export async function checkStorageHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const name = 'Object Storage';

  try {
    // Try to write and read a test file
    const testKey = `health-check/test-${Date.now()}.txt`;
    const testContent = Buffer.from(`Health check at ${new Date().toISOString()}`);

    // Write test file using the correct method
    const uploadResult = await objectStorage.uploadBuffer(testKey, testContent, 'text/plain');

    if (!uploadResult || !uploadResult.url) {
      return {
        name,
        status: 'degraded',
        message: 'Upload succeeded but no URL returned',
        latencyMs: Date.now() - startTime,
        timestamp: new Date(),
      };
    }

    // Read it back using the correct method
    const retrieved = await objectStorage.downloadBuffer(testKey);

    // Delete test file
    await objectStorage.deleteFile(testKey);

    const latencyMs = Date.now() - startTime;

    if (!retrieved) {
      return {
        name,
        status: 'degraded',
        message: 'Write succeeded but read failed',
        latencyMs,
        timestamp: new Date(),
      };
    }

    return {
      name,
      status: 'healthy',
      message: 'Object storage is fully functional',
      latencyMs,
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      name,
      status: 'unhealthy',
      message: `Storage operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      latencyMs: Date.now() - startTime,
      timestamp: new Date(),
    };
  }
}

/**
 * Check environment variables are configured
 */
export function checkEnvironmentHealth(): HealthCheckResult {
  const name = 'Environment Configuration';

  const required = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'OPENAI_API_KEY',
  ];

  const recommended = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'SENDGRID_API_KEY',
  ];

  const optional = [
    'PERPLEXITY_API_KEY',
    'MONITORING_TOKEN',
  ];

  const missingRequired = required.filter(key => !process.env[key]);
  const missingRecommended = recommended.filter(key => !process.env[key]);
  const missingOptional = optional.filter(key => !process.env[key]);

  if (missingRequired.length > 0) {
    return {
      name,
      status: 'unhealthy',
      message: `Missing required environment variables: ${missingRequired.join(', ')}`,
      details: {
        missingRequired,
        missingRecommended,
        missingOptional,
      },
      timestamp: new Date(),
    };
  }

  if (missingRecommended.length > 0) {
    return {
      name,
      status: 'degraded',
      message: `Missing recommended environment variables: ${missingRecommended.join(', ')}`,
      details: {
        missingRecommended,
        missingOptional,
      },
      timestamp: new Date(),
    };
  }

  return {
    name,
    status: 'healthy',
    message: 'All environment variables configured',
    details: {
      missingOptional: missingOptional.length > 0 ? missingOptional : undefined,
    },
    timestamp: new Date(),
  };
}

/**
 * Run all health checks and generate a comprehensive report
 */
export async function runAllHealthChecks(): Promise<SystemHealthReport> {
  console.log('🏥 Starting comprehensive health check...');
  const startTime = Date.now();

  // Run checks in parallel for efficiency
  const [
    envCheck,
    dbCheck,
    openaiCheck,
    cimCheck,
    anthropicCheck,
    perplexityCheck,
    stripeCheck,
    sendgridCheck,
    storageCheck,
  ] = await Promise.all([
    Promise.resolve(checkEnvironmentHealth()),
    checkDatabaseHealth(),
    checkOpenAIHealth(),
    checkCIMGenerationHealth(),
    checkAnthropicHealth(),
    checkPerplexityHealth(),
    checkStripeHealth(),
    checkSendGridHealth(),
    checkStorageHealth(),
  ]);

  const checks = [
    envCheck,
    dbCheck,
    openaiCheck,
    cimCheck,
    anthropicCheck,
    perplexityCheck,
    stripeCheck,
    sendgridCheck,
    storageCheck,
  ];

  const summary = {
    total: checks.length,
    healthy: checks.filter(c => c.status === 'healthy').length,
    degraded: checks.filter(c => c.status === 'degraded').length,
    unhealthy: checks.filter(c => c.status === 'unhealthy').length,
  };

  // Determine overall status
  let overall: 'healthy' | 'degraded' | 'unhealthy';

  // Critical services that must be healthy
  const criticalChecks = [envCheck, dbCheck, openaiCheck, cimCheck];
  const criticalUnhealthy = criticalChecks.filter(c => c.status === 'unhealthy');

  if (criticalUnhealthy.length > 0) {
    overall = 'unhealthy';
  } else if (summary.unhealthy > 0 || summary.degraded > 2) {
    overall = 'degraded';
  } else if (summary.degraded > 0) {
    overall = 'degraded';
  } else {
    overall = 'healthy';
  }

  const totalTime = Date.now() - startTime;
  console.log(`🏥 Health check completed in ${totalTime}ms - Overall: ${overall}`);

  return {
    overall,
    timestamp: new Date(),
    checks,
    summary,
  };
}

/**
 * Quick health check for critical services only
 */
export async function runQuickHealthCheck(): Promise<SystemHealthReport> {
  console.log('⚡ Running quick health check...');

  const [envCheck, dbCheck, openaiCheck] = await Promise.all([
    Promise.resolve(checkEnvironmentHealth()),
    checkDatabaseHealth(),
    checkOpenAIHealth(),
  ]);

  const checks = [envCheck, dbCheck, openaiCheck];

  const summary = {
    total: checks.length,
    healthy: checks.filter(c => c.status === 'healthy').length,
    degraded: checks.filter(c => c.status === 'degraded').length,
    unhealthy: checks.filter(c => c.status === 'unhealthy').length,
  };

  const overall = summary.unhealthy > 0 ? 'unhealthy' :
                  summary.degraded > 0 ? 'degraded' : 'healthy';

  return {
    overall,
    timestamp: new Date(),
    checks,
    summary,
  };
}
