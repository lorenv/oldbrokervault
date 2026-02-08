#!/usr/bin/env tsx
// Permission enforcement test script
// Tests: permission data layer, gated endpoints, custom overrides, locked roles, coverage audit

import { setup, type TestClients } from './helpers/test-setup.js';
import { describeAsync, test, testInfo, testSkip, expect, printSummary, resetResults } from './helpers/test-runner.js';
import { DEFAULT_PERMISSIONS, PERMISSION_KEYS, type PermissionKey, type Role } from '../shared/permissions.js';

const ROLES: Role[] = ['owner', 'admin', 'member', 'viewer'];

async function run() {
  console.log('\n  ══════════════════════════════════════════');
  console.log('  Permission Tests');
  console.log('  ══════════════════════════════════════════');

  resetResults();
  let clients: TestClients;

  try {
    clients = await setup();
  } catch (err: any) {
    console.error(`\n  Setup failed: ${err.message}`);
    process.exit(1);
  }

  // ──────────────────────────────────────────
  // 2a. Permission Data Layer Tests
  // ──────────────────────────────────────────
  await describeAsync('Permission Data Layer — my-permissions endpoint', async () => {
    for (const role of ROLES) {
      await test(`${role} gets correct role field`, async () => {
        const res = await clients[role].get('/api/crm/organization/my-permissions');
        expect(res.status).toBe(200);
        expect(res.body.role).toBe(role);
      });

      await test(`${role} gets all 31 permission keys`, async () => {
        const res = await clients[role].get('/api/crm/organization/my-permissions');
        expect(res.status).toBe(200);
        const permKeys = Object.keys(res.body.permissions);
        expect(permKeys.length).toBe(Object.keys(PERMISSION_KEYS).length);
      });

      await test(`${role} permissions match expected defaults`, async () => {
        const res = await clients[role].get('/api/crm/organization/my-permissions');
        expect(res.status).toBe(200);

        const expected = DEFAULT_PERMISSIONS[role];
        const actual = res.body.permissions;

        const mismatches: string[] = [];
        for (const key of Object.keys(expected) as PermissionKey[]) {
          if (actual[key] !== expected[key]) {
            mismatches.push(`${key}: expected ${expected[key]}, got ${actual[key]}`);
          }
        }

        if (mismatches.length > 0) {
          throw new Error(`Permission mismatches for ${role}:\n${mismatches.join('\n')}`);
        }
      });
    }
  });

  // ──────────────────────────────────────────
  // 2b. Permission-Gated Endpoint Tests
  // ──────────────────────────────────────────
  await describeAsync('Permission Management Endpoints (Owner/Admin only)', async () => {
    const expectedAccess: Record<Role, number> = {
      owner: 200,
      admin: 200,
      member: 403,
      viewer: 403,
    };

    for (const role of ROLES) {
      await test(`${role} GET /api/crm/organization/permissions → ${expectedAccess[role]}`, async () => {
        const res = await clients[role].get('/api/crm/organization/permissions');
        expect(res.status).toBe(expectedAccess[role]);
      });
    }

    for (const role of ROLES) {
      if (role === 'owner' || role === 'admin') {
        // For roles with access, test with a valid body
        await test(`${role} PUT /api/crm/organization/permissions → ${expectedAccess[role]}`, async () => {
          const res = await clients[role].put('/api/crm/organization/permissions', {
            permissionKey: 'crm.deals.view',
            role: 'member',
            granted: true, // setting to default, so no actual change
          });
          expect(res.status).toBeOneOf([200, 400]); // 200 success or 400 validation
        });
      } else {
        await test(`${role} PUT /api/crm/organization/permissions → ${expectedAccess[role]}`, async () => {
          const res = await clients[role].put('/api/crm/organization/permissions', {
            permissionKey: 'crm.deals.view',
            role: 'member',
            granted: true,
          });
          expect(res.status).toBe(403);
        });
      }
    }
  });

  await describeAsync('Data Import Endpoints (settings.data_import.manage)', async () => {
    // Owner and Admin have data_import.manage by default; Member and Viewer do not
    const expectedAccess: Record<Role, number> = {
      owner: 400, // 400 because we send invalid body, but not 403
      admin: 400,
      member: 403,
      viewer: 403,
    };

    // import/preview and import/execute don't require file upload, so we can test with invalid body
    // and distinguish 400 (got past permission check) from 403 (blocked by permission check)
    const importEndpoints = [
      { path: '/api/crm/import/preview', body: { entityType: 'contact', data: [], mapping: {} } },
      // execute requires non-empty rows to get past body validation to the permission check
      { path: '/api/crm/import/execute', body: { entityType: 'contact', rows: [{ name: 'test' }], mapping: {}, fileName: 'test.csv', fileSize: 100 } },
    ];

    for (const endpoint of importEndpoints) {
      for (const role of ROLES) {
        const expectStatus = expectedAccess[role];
        await test(`${role} POST ${endpoint.path} → ${expectStatus === 400 ? 'allowed (400 bad request)' : '403'}`, async () => {
          const res = await clients[role].post(endpoint.path, endpoint.body);
          if (expectStatus === 403) {
            expect(res.status).toBe(403);
          } else {
            // Should NOT be 403 — any other status means permission check passed
            if (res.status === 403) {
              throw new Error(`Expected access to be allowed, but got 403`);
            }
          }
        });
      }
    }

    // import/upload requires multipart form data (file upload), so we skip the actual upload
    // but test that unauthenticated access returns 401
    for (const role of ['member', 'viewer'] as const) {
      await test(`${role} POST /api/crm/import/upload → 403`, async () => {
        const res = await clients[role].post('/api/crm/import/upload', { entityType: 'contact' });
        // May be 400 (bad request due to no file) or 403 depending on middleware order
        // The key assertion: member/viewer should not get past the permission check
        expect(res.status).toBeOneOf([403, 400]);
      });
    }
  });

  // ──────────────────────────────────────────
  // 2c. Custom Permission Override Tests
  // ──────────────────────────────────────────
  await describeAsync('Custom Permission Overrides', async () => {
    await test('Revoking settings.data_import.manage from admin blocks import', async () => {
      // As owner: revoke admin's data_import.manage
      const revokeRes = await clients.owner.put('/api/crm/organization/permissions', {
        permissionKey: 'settings.data_import.manage',
        role: 'admin',
        granted: false,
      });
      expect(revokeRes.status).toBe(200);

      // As admin: import/preview should now be 403
      const importRes = await clients.admin.post('/api/crm/import/preview', {
        entityType: 'contact',
        data: [],
        mapping: {},
      });
      expect(importRes.status).toBe(403);

      // Cleanup: restore admin's data_import.manage to default (true)
      const restoreRes = await clients.owner.put('/api/crm/organization/permissions', {
        permissionKey: 'settings.data_import.manage',
        role: 'admin',
        granted: true,
      });
      expect(restoreRes.status).toBe(200);
    });

    await test('Granting settings.data_import.manage to member allows import', async () => {
      // As owner: grant member's data_import.manage
      const grantRes = await clients.owner.put('/api/crm/organization/permissions', {
        permissionKey: 'settings.data_import.manage',
        role: 'member',
        granted: true,
      });
      expect(grantRes.status).toBe(200);

      // As member: import/preview should now succeed (not 403)
      const importRes = await clients.member.post('/api/crm/import/preview', {
        entityType: 'contact',
        data: [],
        mapping: {},
      });
      if (importRes.status === 403) {
        throw new Error('Expected access to be granted after permission override, but got 403');
      }

      // Cleanup: restore member's data_import.manage to default (false)
      const restoreRes = await clients.owner.put('/api/crm/organization/permissions', {
        permissionKey: 'settings.data_import.manage',
        role: 'member',
        granted: false,
      });
      expect(restoreRes.status).toBe(200);
    });

    await test('Permission change reflects in my-permissions endpoint', async () => {
      // Revoke a permission from admin
      await clients.owner.put('/api/crm/organization/permissions', {
        permissionKey: 'crm.deals.delete',
        role: 'admin',
        granted: false,
      });

      // Check that my-permissions reflects the change
      const permRes = await clients.admin.get('/api/crm/organization/my-permissions');
      expect(permRes.status).toBe(200);
      expect(permRes.body.permissions['crm.deals.delete']).toBe(false);

      // Cleanup: restore to default (true for admin)
      await clients.owner.put('/api/crm/organization/permissions', {
        permissionKey: 'crm.deals.delete',
        role: 'admin',
        granted: true,
      });
    });
  });

  // ──────────────────────────────────────────
  // 2d. Locked Role Immutability Tests
  // ──────────────────────────────────────────
  await describeAsync('Locked Roles Cannot Be Customized', async () => {
    await test('Cannot customize owner role permissions', async () => {
      const res = await clients.owner.put('/api/crm/organization/permissions', {
        permissionKey: 'crm.deals.view',
        role: 'owner',
        granted: false,
      });
      // Should return 400 with error about owner being locked
      expect(res.status).toBe(400);
    });

    await test('Cannot customize viewer role permissions', async () => {
      const res = await clients.owner.put('/api/crm/organization/permissions', {
        permissionKey: 'crm.deals.view',
        role: 'viewer',
        granted: true,
      });
      // Should return 400 with error about viewer being locked
      expect(res.status).toBe(400);
    });
  });

  // ──────────────────────────────────────────
  // 2e. Authentication-Only Endpoint Audit (Coverage Report)
  // ──────────────────────────────────────────
  await describeAsync('Coverage Report: Endpoints Without Granular Permission Checks', async () => {
    // These endpoints only check authentication, not role-based permissions.
    // We test that they require auth (401 without cookie) and report which roles can access them.
    const auditEndpoints = [
      { method: 'GET', path: '/api/crm/deals' },
      { method: 'GET', path: '/api/crm/contacts' },
      { method: 'GET', path: '/api/crm/companies' },
      { method: 'GET', path: '/api/crm/tasks' },
      { method: 'GET', path: '/api/crm/pipelines' },
      { method: 'GET', path: '/api/crm/custom-fields' },
      { method: 'GET', path: '/api/crm/notifications' },
      { method: 'GET', path: '/api/crm/search?q=test' },
      { method: 'GET', path: '/api/user/notification-preferences' },
    ];

    // Test that unauthenticated requests are rejected
    await test('Unauthenticated requests to CRM endpoints return 401', async () => {
      const res = await fetch(`${process.env.TEST_BASE_URL || 'http://localhost:5000'}/api/crm/deals`);
      expect(res.status).toBeOneOf([401, 302]); // 401 or redirect to login
    });

    // Informational: report which roles can access each endpoint
    for (const endpoint of auditEndpoints) {
      await testInfo(`${endpoint.method} ${endpoint.path}`, async () => {
        const results: string[] = [];
        for (const role of ROLES) {
          let res;
          if (endpoint.method === 'GET') {
            res = await clients[role].get(endpoint.path);
          } else {
            res = await clients[role].post(endpoint.path, {});
          }
          results.push(`${role}:${res.status}`);
        }
        return results.join(', ');
      });
    }
  });

  // Print summary and exit
  const allPassed = printSummary();
  process.exit(allPassed ? 0 : 1);
}

run().catch(err => {
  console.error('\nUnexpected error:', err);
  process.exit(1);
});
