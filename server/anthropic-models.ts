import type Anthropic from '@anthropic-ai/sdk';

/**
 * Ordered chain of Claude models to try, best-fit first.
 *
 * If a model is retired (Anthropic returns 404 / not_found_error) or transiently
 * fails (overload, server error, rate limit), the next model in the chain is tried
 * automatically. This means a single model retirement can no longer break
 * generation the way `claude-3-5-sonnet-20241022` (retired 2025-10-28) and
 * `claude-sonnet-4-20250514` (retired 2026-06-15) did.
 *
 * Keep this list current as Anthropic releases/retires models. All entries must be
 * vision-capable, since the same chain is used for document/image analysis.
 *
 * Tier note: Sonnet is the primary because this app deliberately used the Sonnet
 * tier for CIM generation (cost/quality balance for high-volume writing). To prefer
 * maximum quality, move 'claude-opus-4-8' to the front.
 */
export const CLAUDE_MODEL_CHAIN = [
  'claude-sonnet-4-6', // current Sonnet — balanced speed/quality, 1M context
  'claude-opus-4-8', // most capable — used if Sonnet is unavailable
  'claude-haiku-4-5', // fast/cheap last resort
] as const;

/** The model we attempt first. */
export const PRIMARY_CLAUDE_MODEL = CLAUDE_MODEL_CHAIN[0];

/**
 * Create a Claude message, falling back through CLAUDE_MODEL_CHAIN on failure.
 *
 * Fails fast on 400 (invalid request) — switching models won't fix a malformed
 * request — but retries the next model on 404/5xx/429/connection errors.
 *
 * @param anthropic  An initialized Anthropic SDK client.
 * @param params     messages.create params WITHOUT `model` (the chain supplies it).
 * @param options    Optional log label and a custom model list.
 */
export async function createClaudeMessage(
  anthropic: Anthropic,
  params: Omit<Anthropic.MessageCreateParamsNonStreaming, 'model'>,
  options?: { label?: string; models?: readonly string[] },
): Promise<Anthropic.Message> {
  const models = options?.models ?? CLAUDE_MODEL_CHAIN;
  const label = options?.label ?? 'Claude';
  let lastError: any;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      const response = await anthropic.messages.create({ ...params, model });
      if (i > 0) {
        console.log(`[${label}] Succeeded with fallback model "${model}"`);
      }
      return response;
    } catch (err: any) {
      lastError = err;
      const status = err?.status ?? err?.statusCode;

      // A 400 means the request itself is invalid — a different model won't help.
      if (status === 400) throw err;

      const isLast = i === models.length - 1;
      console.warn(
        `[${label}] Model "${model}" failed (${status ?? 'error'}: ${err?.message})` +
          (isLast ? '' : ' — trying next model in chain'),
      );
    }
  }

  // Every model in the chain failed — surface the last error to the caller.
  throw lastError;
}
