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

#### Table Column Layout Pattern (IMPORTANT)
When creating data tables with checkboxes and multiple columns, follow this pattern to avoid white space issues:

**Container Structure:**
```tsx
<div className="bg-white rounded-lg border overflow-hidden">  {/* outer: NO w-full */}
  <div className="overflow-x-auto">                            {/* inner: scrollable */}
    <table className="w-full table-fixed">                     {/* table: w-full + table-fixed */}
      ...
    </table>
  </div>
  <TablePagination ... />                                      {/* pagination outside inner div */}
</div>
```

**Checkbox Column:**
- Use fixed width `w-10` class on both `<th>` and `<td>` for checkbox columns
- Do NOT use percentage widths for checkbox columns

**Data Column Widths:**
- Set percentage widths ONLY on header cells (`<th>`), not body cells (`<td>`)
- Percentages should total ~100% for visible columns (excluding checkbox)
- Example for 6 columns: 28% + 20% + 13% + 13% + 13% + 13% = 100%

**Common Mistakes:**
- Adding `w-full` to outer container causes width issues
- Setting width on `<td>` cells (unnecessary with `table-fixed`)
- Percentages totaling less than 100% leaves white space on right
- Using `overflow-x-auto` directly on outer div instead of nested structure

## Tech Stack
- React with TypeScript
- Tailwind CSS for styling
- Shadcn/ui components
- TanStack Query for data fetching
- Wouter for routing
