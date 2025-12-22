# Sidebar Navigation Implementation Plan

## Overview

Migrate from top navigation bar to sidebar navigation for logged-in users. This addresses navigation crowding, eliminates the hidden "More" dropdown, and removes the confusing double-tab pattern in Account Settings.

---

## Final Sidebar Structure

```
┌──────────────────────┐
│  [Logo]              │
│                      │
│   Create CIM         │  → /dashboard
│   My CIMs            │  → /documents
│   CRM                │  → /investor-database
│   Sign               │  → /esign
│                      │  ← subtle visual gap (8-12px)
│   Analytics          │  → /analytics
│   Messages           │  → /messages
│   Listings           │  → /listings-settings (new consolidated page)
│   SDE Analyzer [Beta]│  → /sde-analyzer
│                      │
│  SETTINGS            │  ← section header
│   Account            │  → /account (profile + security combined)
│   Billing            │  → /account?tab=billing (or /billing)
│   PDF Branding       │  → /account?tab=pdf-branding (or dedicated route)
│   Online CIM Branding│  → /account?tab=online-branding (or dedicated route)
│   NDA Templates      │  → /nda-templates
│   Integrations       │  → /integrations
│                      │
│  ──────────────────  │
│  [User Avatar] Name  │  → dropdown: Sign Out, Admin (if admin)
└──────────────────────┘
```

---

## Implementation Steps

### Phase 1: Create Sidebar Component

**File:** `client/src/components/ui/sidebar.tsx`

1. Create new `Sidebar` component with the structure above
2. Implement navigation items with icons matching current navbar icons
3. Add "Beta" badge styling for SDE Analyzer
4. Add subtle gap (8-12px margin) between Sign and Analytics items
5. Add "SETTINGS" section header with muted styling
6. Add user profile section at bottom with avatar, name, and dropdown menu
7. Implement active state highlighting for current route
8. Add collapsible toggle button (hamburger or chevron icon)

**Collapsible behavior:**
- Expanded: Full sidebar with text labels (~240px width)
- Collapsed: Icons only (~64px width) with tooltips on hover
- Store preference in localStorage

### Phase 2: Create App Layout Wrapper

**File:** `client/src/components/layout/app-layout.tsx`

1. Create layout component that wraps authenticated pages
2. Structure:
   ```
   ┌─────────────────────────────────────────┐
   │ [Collapse] │     Minimal Top Bar        │  ← optional: just for mobile toggle
   ├────────────┼────────────────────────────┤
   │            │                            │
   │  Sidebar   │      Main Content          │
   │            │                            │
   │            │                            │
   └────────────┴────────────────────────────┘
   ```
3. Handle sidebar width transition smoothly (CSS transition)
4. Main content area adjusts width based on sidebar state

### Phase 3: Update App Router

**File:** `client/src/App.tsx`

1. Wrap all authenticated routes with new `AppLayout` component
2. Keep current top navbar for unauthenticated routes (landing, login, etc.)
3. Remove navbar from authenticated pages (it's replaced by sidebar)

### Phase 4: Consolidate Listings Page

**File:** `client/src/pages/listings-page.tsx` (new or refactored)

1. Move content from current `account-page.tsx` subtab=listings to dedicated page
2. Add prominent "Preview Listings Page" button at top of page
3. Add "Active Listings" section showing:
   - Compact list/cards of CIMs with active teasers on public listings page
   - Each item clickable → navigates to that CIM's detail page
   - Show key info: CIM name, maybe teaser status
4. Keep existing listings settings (slug, branding, etc.) below
5. Route: `/listings` or `/listings-settings`

### Phase 5: Refactor Account Settings Page

**File:** `client/src/pages/account-page.tsx`

**Current structure (to remove):**
- Primary tabs: Account & Security, Profile & Branding, Subscription, Admin
- Secondary tabs under Profile & Branding: Profile Info, PDF Branding, Online CIM Branding, Public Listings

**New structure:**
- Remove ALL tabs - this page becomes single-purpose
- Combine "Account & Security" + "Profile Info" into one page
- Content: Email, password/security settings, personal info (name, title, phone)
- No sub-navigation needed

**Other settings pages become standalone:**
- Billing → `/billing` or keep as `/account?tab=billing`
- PDF Branding → `/settings/pdf-branding` or similar
- Online CIM Branding → `/settings/online-branding` or similar
- Listings → Already handled in Phase 4
- NDA Templates → Already exists at `/nda-templates`
- Integrations → Already exists at `/integrations`

**Decision needed:** Either create separate routes for each settings page, or keep a simple tab parameter. Separate routes are cleaner with sidebar navigation.

### Phase 6: Mobile Responsiveness

**Updates to:** `sidebar.tsx`, `app-layout.tsx`

1. On mobile (< 768px or similar breakpoint):
   - Sidebar hidden by default
   - Hamburger menu in minimal top bar
   - Tap hamburger → sidebar slides in as overlay/drawer
   - Tap outside or navigate → drawer closes
2. Use same sidebar component, just different display behavior
3. Consider using Radix UI Sheet component for drawer behavior

### Phase 7: Remove Old Navigation

**File:** `client/src/components/ui/navbar.tsx`

1. Keep navbar component but only use for unauthenticated pages
2. Remove authenticated navigation items (they're now in sidebar)
3. Simplify to: Logo, Login/Sign Up buttons only
4. Or create separate `public-navbar.tsx` for clarity

### Phase 8: Polish & QA

1. Verify all routes work correctly
2. Test sidebar collapse/expand with localStorage persistence
3. Test mobile drawer behavior
4. Verify active states highlight correctly on all routes
5. Check keyboard navigation / accessibility
6. Ensure smooth transitions (no layout jumps)

---

## Component Specifications

### Sidebar Nav Items

| Label | Icon | Route | Notes |
|-------|------|-------|-------|
| Create CIM | Plus or PlusCircle | /dashboard | Was "New CIM" |
| My CIMs | FileText | /documents | |
| CRM | Users | /investor-database | |
| Sign | PenTool or Signature | /esign | |
| — | — | — | *subtle gap* |
| Analytics | BarChart or TrendingUp | /analytics | |
| Messages | MessageSquare | /messages | |
| Listings | LayoutList or Globe | /listings | New consolidated page |
| SDE Analyzer | Calculator or DollarSign | /sde-analyzer | Show "Beta" badge |

### Settings Section Items

| Label | Icon | Route | Notes |
|-------|------|-------|-------|
| Account | User or UserCircle | /account | Combined profile + security |
| Billing | CreditCard | /billing | Subscription management |
| PDF Branding | FileText or Palette | /settings/pdf-branding | |
| Online CIM Branding | Globe or Monitor | /settings/online-branding | |
| NDA Templates | FileSignature or ClipboardList | /nda-templates | Existing route |
| Integrations | Plug or Link | /integrations | Includes webhooks |

### Beta Badge

```tsx
<span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
  Beta
</span>
```

---

## File Changes Summary

| File | Action |
|------|--------|
| `client/src/components/ui/sidebar.tsx` | Create new |
| `client/src/components/layout/app-layout.tsx` | Create new |
| `client/src/pages/listings-page.tsx` | Create new (or rename/refactor) |
| `client/src/pages/account-page.tsx` | Major refactor - remove tabs, simplify |
| `client/src/pages/billing-page.tsx` | Create new (extract from account) |
| `client/src/pages/pdf-branding-page.tsx` | Create new (extract from account) |
| `client/src/pages/online-branding-page.tsx` | Create new (extract from account) |
| `client/src/App.tsx` | Update routing, add layout wrapper |
| `client/src/components/ui/navbar.tsx` | Simplify for public pages only |

---

## Design Decisions Made

1. **Sidebar always visible on desktop** - no click-to-expand sections
2. **Collapsible to icons-only mode** - user preference stored in localStorage
3. **Mobile: slide-out drawer** - triggered by hamburger menu
4. **Flat list with section headers** - no nested/expandable groups
5. **Settings as separate pages** - not tabs within one page (eliminates double-tab pattern)
6. **Listings page consolidates all listings-related functionality** - settings + active listings preview
7. **Account page merges profile info + security** - simpler single-purpose page
8. **SDE Analyzer shows Beta badge** - visual indicator of feature status

---

## Open Items / Future Considerations

1. **Search:** Consider adding global search to top bar or sidebar in future
2. **Notifications:** Could add notification bell to sidebar or top bar
3. **Keyboard shortcuts:** Could add shortcut hints in sidebar tooltips
4. **Favorites/pinning:** Could let users pin frequently used items to top
5. **Admin section:** Currently in user dropdown - could become sidebar section for admin users
