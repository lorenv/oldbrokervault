// Lightweight test harness with colored console output

const COLORS = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
};

interface TestResult {
  name: string;
  group: string;
  passed: boolean;
  error?: string;
  skipped?: boolean;
  info?: boolean; // informational only, doesn't count as pass/fail
}

const results: TestResult[] = [];
let currentGroup = '';

export function describe(name: string, fn: () => void | Promise<void>): void {
  currentGroup = name;
  console.log(`\n${COLORS.bold}${COLORS.cyan}  ${name}${COLORS.reset}`);
  const result = fn();
  if (result instanceof Promise) {
    // Will be handled by runTests
  }
}

// Async version for use inside runTests
export async function describeAsync(name: string, fn: () => Promise<void>): Promise<void> {
  currentGroup = name;
  console.log(`\n${COLORS.bold}${COLORS.cyan}  ${name}${COLORS.reset}`);
  await fn();
}

export async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name, group: currentGroup, passed: true });
    console.log(`    ${COLORS.green}✓${COLORS.reset} ${name}`);
  } catch (err: any) {
    const message = err?.message || String(err);
    results.push({ name, group: currentGroup, passed: false, error: message });
    console.log(`    ${COLORS.red}✗${COLORS.reset} ${name}`);
    console.log(`      ${COLORS.red}${message}${COLORS.reset}`);
  }
}

export async function testSkip(name: string, reason: string): Promise<void> {
  results.push({ name, group: currentGroup, passed: true, skipped: true });
  console.log(`    ${COLORS.yellow}-${COLORS.reset} ${COLORS.dim}${name} (${reason})${COLORS.reset}`);
}

// Informational test — logs result but doesn't affect pass/fail counts
export async function testInfo(name: string, fn: () => Promise<string>): Promise<void> {
  try {
    const info = await fn();
    results.push({ name, group: currentGroup, passed: true, info: true });
    console.log(`    ${COLORS.dim}○${COLORS.reset} ${name} ${COLORS.dim}→ ${info}${COLORS.reset}`);
  } catch (err: any) {
    const message = err?.message || String(err);
    results.push({ name, group: currentGroup, passed: true, info: true });
    console.log(`    ${COLORS.yellow}○${COLORS.reset} ${name} ${COLORS.yellow}→ ${message}${COLORS.reset}`);
  }
}

export function expect(actual: any) {
  return {
    toBe(expected: any) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toBeOneOf(options: any[]) {
      if (!options.includes(actual)) {
        throw new Error(`Expected one of ${JSON.stringify(options)}, got ${JSON.stringify(actual)}`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected truthy value, got ${JSON.stringify(actual)}`);
      }
    },
    toBeFalsy() {
      if (actual) {
        throw new Error(`Expected falsy value, got ${JSON.stringify(actual)}`);
      }
    },
    toEqual(expected: any) {
      const a = JSON.stringify(actual);
      const b = JSON.stringify(expected);
      if (a !== b) {
        throw new Error(`Expected ${b}, got ${a}`);
      }
    },
  };
}

export function printSummary(): boolean {
  const passed = results.filter(r => r.passed && !r.skipped && !r.info).length;
  const failed = results.filter(r => !r.passed).length;
  const skipped = results.filter(r => r.skipped).length;
  const info = results.filter(r => r.info).length;

  console.log(`\n${COLORS.bold}  ─────────────────────────────────${COLORS.reset}`);
  console.log(`  ${COLORS.green}${passed} passed${COLORS.reset}${failed > 0 ? `, ${COLORS.red}${failed} failed${COLORS.reset}` : ''}${skipped > 0 ? `, ${COLORS.yellow}${skipped} skipped${COLORS.reset}` : ''}${info > 0 ? `, ${COLORS.dim}${info} info${COLORS.reset}` : ''}`);

  if (failed > 0) {
    console.log(`\n${COLORS.bold}${COLORS.red}  Failures:${COLORS.reset}`);
    for (const r of results.filter(r => !r.passed)) {
      console.log(`    ${COLORS.red}✗${COLORS.reset} [${r.group}] ${r.name}`);
      if (r.error) {
        console.log(`      ${COLORS.red}${r.error}${COLORS.reset}`);
      }
    }
  }

  console.log('');
  return failed === 0;
}

export function resetResults(): void {
  results.length = 0;
  currentGroup = '';
}
