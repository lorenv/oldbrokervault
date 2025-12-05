# Onboarding Guide System Documentation

This document describes the onboarding/guided tour system that was implemented for new users. The system is currently **disabled** but the components remain in the codebase for future use.

## Overview

The onboarding system consists of two tour components designed to help new users navigate the application:

1. **GuidedTour** - A general welcome tour for new account signups
2. **CimEditTour** - A document editor-specific tour for first-time CIM creation

## Components

### GuidedTour (`client/src/components/guided-tour.tsx`)

A modal-based tour that appears after a user creates a new account.

**Features:**
- 5-step introduction to the platform
- Step-by-step navigation with Previous/Next buttons
- Skip option to bypass the tour
- Session storage tracking via `isNewUser` key
- Smooth fade animations

**Tour Steps:**
1. Welcome message
2. Create Your First CIM
3. Secure Document Sharing
4. NDA Management
5. Analytics & Insights

**Props:**
```typescript
interface GuidedTourProps {
  onComplete: () => void;  // Callback when tour is completed or skipped
}
```

**Usage:**
```tsx
import { GuidedTour } from "@/components/guided-tour";

<GuidedTour onComplete={() => setShowTour(false)} />
```

### CimEditTour (`client/src/components/cim-edit-tour.tsx`)

A contextual tour that appears when viewing a CIM document for the first time.

**Features:**
- 5-step editor-focused tour
- Auto-starts for first-time users (1.5 second delay)
- LocalStorage persistence via `cim-edit-tour-completed` key
- URL parameter detection (`?first-time=true`)
- Overlay backdrop with blur effect

**Tour Steps:**
1. Welcome to Your CIM Editor
2. Click to Edit Content
3. Rearrange Sections (drag and drop)
4. Share Your CIM
5. Export Options

**Props:**
```typescript
interface CimEditTourProps {
  isFirstTime?: boolean;   // Whether to auto-start the tour
  onComplete?: () => void; // Callback when tour is completed
}
```

**Hook:**
```typescript
// Hook to manage tour state
const { shouldShowTour, completeTour } = useCimEditTour();
```

**Usage:**
```tsx
import { CimEditTour, useCimEditTour } from "@/components/cim-edit-tour";

function DocumentPage() {
  const { shouldShowTour, completeTour } = useCimEditTour();

  return (
    <>
      <CimEditTour
        isFirstTime={shouldShowTour}
        onComplete={completeTour}
      />
      {/* ... rest of page */}
    </>
  );
}
```

## Activation Triggers

### GuidedTour Activation
The GuidedTour was designed to be triggered by setting `sessionStorage.setItem('isNewUser', 'true')` after account creation.

### CimEditTour Activation
The CimEditTour is triggered by the URL parameter `?first-time=true`, which was added when redirecting after CIM generation:
```typescript
window.location.assign(`/documents/${result.id}?tab=edit&first-time=true`);
```

## Why It Was Disabled

The onboarding guide was disabled because:
1. The tour components were not properly integrated with the main application flow
2. The positioning of tour tooltips was not working correctly
3. User feedback indicated the tours were disruptive to the workflow

## Re-enabling the Tours

To re-enable the onboarding system:

1. **For GuidedTour:** Import and render in the dashboard or main layout after detecting new user signup
2. **For CimEditTour:** Add `?first-time=true` back to the redirect URL in `cim-generator.tsx`:
   ```typescript
   window.location.assign(`/documents/${result.id}?tab=edit&first-time=true`);
   ```
3. Import and render `CimEditTour` in the document display page

## Storage Keys

| Key | Storage | Purpose |
|-----|---------|---------|
| `isNewUser` | sessionStorage | Tracks if user just signed up |
| `cim-edit-tour-completed` | localStorage | Persists tour completion across sessions |

## Future Improvements

If re-implementing the tours, consider:
- Using a tour library like `react-joyride` for better element targeting
- Implementing highlight animations on target elements
- Adding analytics to track tour completion rates
- Making tours skippable with a "Don't show again" checkbox
- Progressive disclosure instead of modal-based tours
