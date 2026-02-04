---
description: Run the BrokerVault pre-deployment testing checklist
argument-hint: [quick|full]
---

# Pre-Deployment Testing

Run the BrokerVault pre-deployment testing checklist to verify all functionality before deployment.

## Mode

Check if an argument was provided:
- `quick` or `smoke` - Run only critical tests (page loads, login, create document, share link) - ~15 min
- `full` or no argument - Run all 128 tests - ~1 hour

## Prerequisites

Before starting, verify:
1. App is running locally (`npm run dev` on port 5000)
2. Browser automation is available (use agent-browser skill if needed)
3. Database is accessible

If prerequisites fail, help the user fix them first.

## Execution Steps

### Step 1: Setup Results File

```bash
cp docs/testing/TEST-RESULTS-TEMPLATE.md "docs/testing/results/$(date +%Y-%m-%d)-test-run.md"
```

### Step 2: Read the Checklist

Read `docs/testing/PRE-DEPLOYMENT-CHECKLIST.md` for the full test list.

### Step 3: Create Test Account

1. Navigate to http://localhost:5000/register
2. Register: `test-YYYYMMDD-HHMM@example.com` / `TestPassword123!`
3. Record in results file

### Step 4: Execute Tests

For **quick mode**, run only:
- Phase 3: All page load tests (check for 404s)
- Phase 4.2: Login test
- Phase 5.1: Create one document
- Phase 7.1: Create one share link
- Phase 7.2: Access the share link

For **full mode**, run all phases 1-12 from the checklist.

For each test:
- Navigate/perform action
- Check console for errors (DevTools > Console)
- Check network for failures (DevTools > Network)
- Mark pass `[x]` or fail `[!]`
- Document failures with details

### Step 5: Handle Failures

When tests fail:
1. Check `docs/testing/TROUBLESHOOTING-GUIDE.md`
2. Apply the suggested fix
3. Re-run the failed test
4. Document the resolution

### Step 6: Generate Summary

Fill in the results file:
- Statistics (passed/failed/skipped)
- Pass rate percentage
- List of failures with details
- Overall result (PASS/FAIL)

### Step 7: Report

Provide summary to user:
- Total tests run
- Pass/fail counts
- Pass rate
- Critical issues (if any)
- Link to full results file

## Files

| File | Purpose |
|------|---------|
| `docs/testing/PRE-DEPLOYMENT-CHECKLIST.md` | 128 tests |
| `docs/testing/TEST-RESULTS-TEMPLATE.md` | Results template |
| `docs/testing/TROUBLESHOOTING-GUIDE.md` | Fix reference |
| `docs/testing/results/` | Historical runs |

## Test Card for Stripe

When testing payments, use: `4242 4242 4242 4242` (any future date, any CVC)
