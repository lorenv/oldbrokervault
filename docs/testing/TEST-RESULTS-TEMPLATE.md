# Test Run Results: YYYY-MM-DD HH:MM

**Copy this template for each test run. Save to `docs/testing/results/` with date in filename.**

---

## Summary

| Field | Value |
|-------|-------|
| **Tester** | [Agent name or human] |
| **Date** | YYYY-MM-DD |
| **Start Time** | HH:MM |
| **End Time** | HH:MM |
| **Duration** | X hours Y minutes |
| **Environment** | Local (localhost:5000) |
| **Branch** | [git branch name] |
| **Commit** | [git commit hash] |

---

## Test Account

| Field | Value |
|-------|-------|
| **Email** | test-YYYYMMDD-HHMM@example.com |
| **Created At** | [timestamp] |
| **Password** | TestPassword123! |

---

## Overall Result

- [ ] **PASS** - All tests passed, ready for deployment
- [ ] **PASS WITH WARNINGS** - Minor issues found, acceptable for deployment
- [ ] **FAIL** - Critical issues found, do NOT deploy

---

## Statistics

| Category | Total | Passed | Failed | Skipped |
|----------|-------|--------|--------|---------|
| Prerequisites | 5 | | | |
| Page Load Tests | 44 | | | |
| Authentication | 10 | | | |
| Documents | 14 | | | |
| CRM | 16 | | | |
| Share Links | 10 | | | |
| File Uploads | 8 | | | |
| E-Signature | 10 | | | |
| Stripe Payments | 9 | | | |
| API Health | 8 | | | |
| Error Handling | 4 | | | |
| **TOTAL** | **128** | | | |

**Pass Rate:** ____%

---

## Failures

### Failure #1: [Test Name]

| Field | Details |
|-------|---------|
| **Category** | [e.g., Page Load, Authentication] |
| **Test** | [specific test name] |
| **Route/Feature** | [URL or feature tested] |
| **Expected** | [what should happen] |
| **Actual** | [what actually happened] |
| **Console Errors** | [copy error messages] |
| **Network Errors** | [HTTP status codes, failed requests] |
| **Screenshot** | [filename or link if captured] |

**Steps to Reproduce:**
1.
2.
3.

**Root Cause:** [identified cause if known]

**Fix Applied:**
- [ ] Fixed during test run
- [ ] Escalated for later fix
- [ ] Blocked - cannot proceed

**Fix Details:** [what was done to fix, or why blocked]

---

### Failure #2: [Test Name]

| Field | Details |
|-------|---------|
| **Category** | |
| **Test** | |
| **Route/Feature** | |
| **Expected** | |
| **Actual** | |
| **Console Errors** | |
| **Network Errors** | |
| **Screenshot** | |

**Steps to Reproduce:**
1.
2.
3.

**Root Cause:**

**Fix Applied:**
- [ ] Fixed during test run
- [ ] Escalated for later fix
- [ ] Blocked - cannot proceed

**Fix Details:**

---

### Failure #3: [Test Name]

*(Copy the failure template above for additional failures)*

---

## Warnings / Notes

Non-critical observations during testing:

1.
2.
3.

---

## Skipped Tests

Tests that were skipped and why:

| Test | Reason Skipped |
|------|----------------|
| | |
| | |

---

## Environment Notes

Any environment-specific observations:

-
-

---

## Recommendations

Based on this test run:

### Must Fix Before Deploy
1.
2.

### Should Fix Soon
1.
2.

### Nice to Have
1.
2.

---

## Sign-off

| Role | Name | Approved | Date |
|------|------|----------|------|
| Tester | | [ ] | |
| Reviewer | | [ ] | |

---

*Test run completed: YYYY-MM-DD HH:MM*
