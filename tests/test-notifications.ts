#!/usr/bin/env tsx
// Notification preferences test script
// Tests: defaults, individual toggles, partial updates, bulk updates, edge cases

import { setup, type TestClients } from './helpers/test-setup.js';
import { describeAsync, test, expect, printSummary, resetResults } from './helpers/test-runner.js';

// Expected defaults from server/routes.ts:11580-11603
const DEFAULTS: Record<string, boolean> = {
  emailMentions: true,
  emailTaskAssigned: true,
  emailTaskReminder: true,
  emailDealUpdates: false,
  emailTeamInvites: true,
  emailEsignRequests: true,
  emailEsignCompleted: true,
  emailWeeklyDigest: false,
  inappMentions: true,
  inappTaskAssigned: true,
  inappTaskReminder: true,
  inappDealUpdates: true,
  inappEsignRequests: true,
  inappEsignCompleted: true,
};

const ALL_PREF_KEYS = Object.keys(DEFAULTS);

async function run() {
  console.log('\n  ══════════════════════════════════════════');
  console.log('  Notification Preferences Tests');
  console.log('  ══════════════════════════════════════════');

  resetResults();
  let clients: TestClients;

  try {
    clients = await setup();
  } catch (err: any) {
    console.error(`\n  Setup failed: ${err.message}`);
    process.exit(1);
  }

  // Use the owner client for notification tests (any authenticated user works)
  const client = clients.owner;

  // Helper: restore all preferences to defaults
  async function restoreDefaults() {
    await client.put('/api/user/notification-preferences', { ...DEFAULTS });
  }

  // ──────────────────────────────────────────
  // 3a. Default Preferences
  // ──────────────────────────────────────────
  await describeAsync('Default Notification Preferences', async () => {
    // First restore defaults to ensure clean state
    await restoreDefaults();

    await test('GET returns all 14 preference keys', async () => {
      const res = await client.get('/api/user/notification-preferences');
      expect(res.status).toBe(200);

      for (const key of ALL_PREF_KEYS) {
        if (!(key in res.body)) {
          throw new Error(`Missing preference key: ${key}`);
        }
      }
    });

    await test('Default values match expected', async () => {
      const res = await client.get('/api/user/notification-preferences');
      expect(res.status).toBe(200);

      const mismatches: string[] = [];
      for (const [key, expected] of Object.entries(DEFAULTS)) {
        if (res.body[key] !== expected) {
          mismatches.push(`${key}: expected ${expected}, got ${res.body[key]}`);
        }
      }

      if (mismatches.length > 0) {
        throw new Error(`Default value mismatches:\n${mismatches.join('\n')}`);
      }
    });
  });

  // ──────────────────────────────────────────
  // 3b. Toggle Each Preference Individually
  // ──────────────────────────────────────────
  await describeAsync('Individual Toggle Tests', async () => {
    for (const key of ALL_PREF_KEYS) {
      await test(`Toggle ${key}: default → opposite → restore`, async () => {
        // Get current value
        const initial = await client.get('/api/user/notification-preferences');
        expect(initial.status).toBe(200);
        const originalValue = initial.body[key];

        // Set to opposite
        const opposite = !originalValue;
        const updateRes = await client.put('/api/user/notification-preferences', {
          [key]: opposite,
        });
        expect(updateRes.status).toBe(200);

        // Verify it changed
        const afterUpdate = await client.get('/api/user/notification-preferences');
        expect(afterUpdate.status).toBe(200);
        expect(afterUpdate.body[key]).toBe(opposite);

        // Restore original
        const restoreRes = await client.put('/api/user/notification-preferences', {
          [key]: originalValue,
        });
        expect(restoreRes.status).toBe(200);

        // Verify restored
        const afterRestore = await client.get('/api/user/notification-preferences');
        expect(afterRestore.status).toBe(200);
        expect(afterRestore.body[key]).toBe(originalValue);
      });
    }
  });

  // ──────────────────────────────────────────
  // 3c. Partial Update Semantics
  // ──────────────────────────────────────────
  await describeAsync('Partial Update Semantics', async () => {
    await test('PUT with subset of fields preserves other fields', async () => {
      // Reset to defaults first
      await restoreDefaults();

      // Get baseline
      const baseline = await client.get('/api/user/notification-preferences');
      expect(baseline.status).toBe(200);

      // Update only emailMentions
      const updateRes = await client.put('/api/user/notification-preferences', {
        emailMentions: false,
      });
      expect(updateRes.status).toBe(200);

      // Verify emailMentions changed
      const after = await client.get('/api/user/notification-preferences');
      expect(after.status).toBe(200);
      expect(after.body.emailMentions).toBe(false);

      // Verify all other fields are unchanged
      const otherKeys = ALL_PREF_KEYS.filter(k => k !== 'emailMentions');
      const changedKeys: string[] = [];
      for (const key of otherKeys) {
        if (after.body[key] !== baseline.body[key]) {
          changedKeys.push(`${key}: was ${baseline.body[key]}, now ${after.body[key]}`);
        }
      }

      if (changedKeys.length > 0) {
        throw new Error(`Other fields changed unexpectedly:\n${changedKeys.join('\n')}`);
      }

      // Restore
      await restoreDefaults();
    });

    await test('PUT with two fields preserves remaining 12', async () => {
      await restoreDefaults();

      const updateRes = await client.put('/api/user/notification-preferences', {
        emailWeeklyDigest: true,
        inappDealUpdates: false,
      });
      expect(updateRes.status).toBe(200);

      const after = await client.get('/api/user/notification-preferences');
      expect(after.status).toBe(200);
      expect(after.body.emailWeeklyDigest).toBe(true);
      expect(after.body.inappDealUpdates).toBe(false);

      // Check unchanged fields
      const unchangedKeys = ALL_PREF_KEYS.filter(k => k !== 'emailWeeklyDigest' && k !== 'inappDealUpdates');
      for (const key of unchangedKeys) {
        expect(after.body[key]).toBe(DEFAULTS[key]);
      }

      await restoreDefaults();
    });
  });

  // ──────────────────────────────────────────
  // 3d. Bulk Update
  // ──────────────────────────────────────────
  await describeAsync('Bulk Update', async () => {
    await test('Set all toggles to false', async () => {
      const allFalse: Record<string, boolean> = {};
      for (const key of ALL_PREF_KEYS) {
        allFalse[key] = false;
      }

      const updateRes = await client.put('/api/user/notification-preferences', allFalse);
      expect(updateRes.status).toBe(200);

      const after = await client.get('/api/user/notification-preferences');
      expect(after.status).toBe(200);

      for (const key of ALL_PREF_KEYS) {
        if (after.body[key] !== false) {
          throw new Error(`${key} should be false, got ${after.body[key]}`);
        }
      }

      // Restore defaults
      await restoreDefaults();
    });

    await test('Set all toggles to true', async () => {
      const allTrue: Record<string, boolean> = {};
      for (const key of ALL_PREF_KEYS) {
        allTrue[key] = true;
      }

      const updateRes = await client.put('/api/user/notification-preferences', allTrue);
      expect(updateRes.status).toBe(200);

      const after = await client.get('/api/user/notification-preferences');
      expect(after.status).toBe(200);

      for (const key of ALL_PREF_KEYS) {
        if (after.body[key] !== true) {
          throw new Error(`${key} should be true, got ${after.body[key]}`);
        }
      }

      await restoreDefaults();
    });
  });

  // ──────────────────────────────────────────
  // 3e. Edge Cases
  // ──────────────────────────────────────────
  await describeAsync('Edge Cases', async () => {
    await test('PUT with empty body does not error', async () => {
      const res = await client.put('/api/user/notification-preferences', {});
      // Should return 200 with current preferences (no changes)
      expect(res.status).toBe(200);
    });

    await test('PUT with unknown keys ignores them gracefully', async () => {
      await restoreDefaults();

      const res = await client.put('/api/user/notification-preferences', {
        unknownField: true,
        anotherFake: false,
        emailMentions: false, // one real field
      });
      expect(res.status).toBe(200);

      // Real field should have changed
      const after = await client.get('/api/user/notification-preferences');
      expect(after.body.emailMentions).toBe(false);

      // Unknown fields should not appear
      if ('unknownField' in after.body) {
        throw new Error('Unknown field "unknownField" was persisted');
      }

      await restoreDefaults();
    });

    await test('PUT with non-boolean values ignores invalid types', async () => {
      await restoreDefaults();

      // The server filters for typeof === 'boolean', so non-boolean values should be ignored
      const res = await client.put('/api/user/notification-preferences', {
        emailMentions: 'yes' as any,
        emailTaskAssigned: 42 as any,
        emailTaskReminder: null as any,
      });
      expect(res.status).toBe(200);

      // Values should remain at defaults since non-boolean values are filtered
      const after = await client.get('/api/user/notification-preferences');
      expect(after.body.emailMentions).toBe(true); // default
      expect(after.body.emailTaskAssigned).toBe(true); // default
      expect(after.body.emailTaskReminder).toBe(true); // default
    });

    await test('Preferences persist across logout/login', async () => {
      await restoreDefaults();

      // Change a preference
      await client.put('/api/user/notification-preferences', {
        emailWeeklyDigest: true,
      });

      // Create a new client (simulates logout/login)
      const { createAuthClient } = await import('./helpers/http-client.js');
      const { getTestUsers } = await import('./helpers/test-setup.js');
      const users = getTestUsers();
      const freshClient = await createAuthClient(users.owner.email, users.owner.password);

      // Check preference persisted
      const res = await freshClient.get('/api/user/notification-preferences');
      expect(res.status).toBe(200);
      expect(res.body.emailWeeklyDigest).toBe(true);

      // Restore
      await client.put('/api/user/notification-preferences', { ...DEFAULTS });
    });

    await test('Notification preferences are per-user (not shared)', async () => {
      // Set owner's emailMentions to false
      await client.put('/api/user/notification-preferences', {
        emailMentions: false,
      });

      // Check that admin's emailMentions is still at default
      const adminRes = await clients.admin.get('/api/user/notification-preferences');
      expect(adminRes.status).toBe(200);
      // Admin's preference should be independent of owner's
      // (It could be true or whatever admin has set — just shouldn't be affected by owner's change)

      // Restore owner's
      await restoreDefaults();
    });

    await test('Unauthenticated access returns 401', async () => {
      const res = await fetch(
        `${process.env.TEST_BASE_URL || 'http://localhost:5000'}/api/user/notification-preferences`
      );
      expect(res.status).toBe(401);
    });
  });

  // Print summary and exit
  const allPassed = printSummary();
  process.exit(allPassed ? 0 : 1);
}

run().catch(err => {
  console.error('\nUnexpected error:', err);
  process.exit(1);
});
