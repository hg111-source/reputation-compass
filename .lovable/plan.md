
## Remove Platform Icons from Score Cells

A simple design cleanup to show only the numeric ratings without the platform letter indicators (G, TA, B, E).

### Change

**File:** `src/components/properties/PlatformScoreCell.tsx`

Remove the platform icon span from the score display, keeping only the numeric score. The column headers already identify which platform each column represents, so the letters are redundant.

**Before:**
```
G 4.5   TA 4.2   B 8.7   E 8.3
```

**After:**
```
4.5     4.2      8.7     8.3
```

### Technical Details

- Remove line 44 which renders the icon: `<span className={cn('text-xs font-medium', config.color)}>{config.icon}</span>`
- The `PLATFORM_ICONS` constant can be removed or simplified since it's no longer needed
- The score color will continue to use the existing `getScoreColor()` function based on the 0-10 normalized score
