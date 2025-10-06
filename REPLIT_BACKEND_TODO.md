# Backend Implementation Required for Analytics Dashboard

## What to tell Replit AI:

**"Implement the 5 analytics API endpoints specified in `/home/runner/workspace/REPLIT_AI_PROMPT.md`. Pay special attention to these requirements:**

**1. The `/api/analytics/overview` endpoint MUST accept a `range` query parameter (7d, 30d, 90d, all) and filter the totalViews and totalSignatures counts to ONLY include data within that time period.**

**2. For totalViews: Only count documentViews where `viewedAt` is within the selected range.**

**3. For totalSignatures: Only count ndaSignatures where `signedAt` is within the selected range.**

**4. Pending approvals and active documents should NOT be time-filtered - always show totals.**

**5. Calculate trends by comparing the current period (e.g., last 30 days) to the previous period of the same length (e.g., 30 days before that).**

**6. All 5 endpoints are detailed in the REPLIT_AI_PROMPT.md file with full specifications."**

---

## Summary of Changes Made to Frontend:

### Analytics Page (/analytics):
1. ✅ Removed "Conversion" column from Most Active Documents table
2. ✅ Added Status filter (All/Active/Inactive) to Most Active Documents
3. ✅ Added Time Period filter to Most Active Documents header (note: needs backend support for time filtering)
4. ✅ Pending Approvals section now truncates to 10 items with "See All" button
5. ✅ Fixed Refresh button - calls refetch() to reload all analytics data
6. ✅ Fixed Export button - downloads analytics as CSV file
7. ✅ Added time period labels to stat cards ("Last 7 days", "Last 30 days", etc.)
8. ✅ Stat cards now properly update when time range selector changes (once backend is implemented)

### What Still Needs Backend Support:
- Time period filter on Most Active Documents table (currently only status filter works)
- All 5 analytics endpoints need to be created per the spec in REPLIT_AI_PROMPT.md

### Key Point About Signatures Count:
The user wants `totalSignatures` to reflect signatures **within the selected time period**, not all-time signatures. This is now clearly specified in the backend requirements.
