# Claude Code Guidelines for This Project

## UI/UX Standards

### Text Color Rules (IMPORTANT)
Never use light grey text colors that cause legibility issues on white/light backgrounds:

**DO NOT USE for primary/readable text:**
- `text-gray-300`
- `text-gray-400`
- Any color lighter than `text-gray-500`

**USE INSTEAD:**
- Primary text: `text-gray-900` or `text-gray-800`
- Secondary text: `text-gray-700` or `text-gray-600`
- Muted/helper text: `text-gray-500` (minimum for readable text)
- Disabled text: `text-gray-400` (only for truly disabled states)

**Always explicitly set text colors** - don't rely on inheritance, as parent components may have light text colors that get inherited unexpectedly.

### Button Variants
- Use `variant="outline"` for secondary actions that appear below or alongside a primary action button
- The global header has a primary "Create" button, so page-level action buttons should typically use `variant="outline"`

### Table Styling
- Use `w-full` on tables to ensure they span the full container width
- When using dynamic columns, calculate percentage widths that sum to 100%
- Prefer `table-fixed` with explicit column widths for consistent layouts

## Tech Stack
- React with TypeScript
- Tailwind CSS for styling
- Shadcn/ui components
- TanStack Query for data fetching
- Wouter for routing
