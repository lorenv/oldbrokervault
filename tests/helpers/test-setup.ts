// Test environment setup: health check, auth clients for all roles

import { createAuthClient, getBaseUrl, type AuthClient } from './http-client.js';

export interface TestClients {
  owner: AuthClient;
  admin: AuthClient;
  member: AuthClient;
  viewer: AuthClient;
}

// Test user configuration — these must exist in the dev database
const TEST_USERS = {
  owner: { email: 'test-owner@test.local', password: 'TestPass123!' },
  admin: { email: 'test-admin@test.local', password: 'TestPass123!' },
  member: { email: 'test-member@test.local', password: 'TestPass123!' },
  viewer: { email: 'test-viewer@test.local', password: 'TestPass123!' },
};

export function getTestUsers() {
  return TEST_USERS;
}

// Check if the server is reachable
async function healthCheck(): Promise<void> {
  const baseUrl = getBaseUrl();
  const maxRetries = 3;
  const retryDelay = 2000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${baseUrl}/api/user`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      // 401 is fine — it means the server is up, we're just not authenticated
      if (res.status === 401 || res.ok) {
        return;
      }
    } catch (err: any) {
      if (attempt === maxRetries) {
        throw new Error(
          `Server not reachable at ${baseUrl} after ${maxRetries} attempts.\n` +
          `Make sure the dev server is running: npm run dev\n` +
          `Error: ${err.message}`
        );
      }
      console.log(`  Health check attempt ${attempt}/${maxRetries} failed, retrying in ${retryDelay / 1000}s...`);
      await sleep(retryDelay);
    }
  }
}

// Authenticate all 4 role users
async function authenticateAllRoles(): Promise<TestClients> {
  const roles = ['owner', 'admin', 'member', 'viewer'] as const;
  const clients: Partial<TestClients> = {};

  for (const role of roles) {
    const { email, password } = TEST_USERS[role];
    try {
      clients[role] = await createAuthClient(email, password);
    } catch (err: any) {
      throw new Error(
        `Failed to authenticate as ${role} (${email}).\n` +
        `Make sure test users exist in the database. See tests/README.md for setup.\n` +
        `Error: ${err.message}`
      );
    }
  }

  return clients as TestClients;
}

export async function setup(): Promise<TestClients> {
  console.log('\n  Setting up test environment...');

  console.log('  Checking server health...');
  await healthCheck();
  console.log('  Server is reachable.');

  console.log('  Authenticating test users...');
  const clients = await authenticateAllRoles();
  console.log('  All 4 role users authenticated.');

  return clients;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
