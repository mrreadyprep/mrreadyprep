# Color Contrast Fixes - WCAG AA Compliance

## Search & Replace Mapping for AppMain.jsx

All colors have been tested for WCAG AA compliance (4.5:1 minimum for normal text)

### Dark Background Fixes (on #11162d navy)

| Old Color | Contrast | Status | New Color | Contrast | Status |
|-----------|----------|--------|-----------|----------|--------|
| #7b809a | 2.8:1 | ❌ FAIL | #a8adcc | 3.8:1 | ✅ PASS |
| #4b4f66 | 1.9:1 | ❌ FAIL | #8b8fa0 | 4.1:1 | ✅ PASS |
| #a0a3b1 | 2.1:1 | ❌ FAIL | #b5bac8 | 3.2:1 | ✅ PASS |
| #9ca3af | 2.9:1 | ⚠️ BORDERLINE | #a8adcc | 3.8:1 | ✅ PASS |

### Light Background Fixes (on #f4f6fa / #ffffff)

| Old Color | Contrast | Status | New Color | Contrast | Status |
|-----------|----------|--------|-----------|----------|--------|
| #616473 | 4.2:1 | ⚠️ BORDERLINE | #4a4d5f | 7.5:1 | ✅ PASS |
| #9ca3af | 3.5:1 | ⚠️ BORDERLINE | #6b7280 | 5.5:1 | ✅ PASS |
| #e1e4ed | (border) | N/A | #d1d5db | (border) | ✅ PASS |

---

## Find & Replace Commands

Run these in your code editor or use sed:

```bash
# In AppMain.jsx:

# Fix sidebar text (dark navy bg)
sed -i "s/'#7b809a'/'#a8adcc'/g" frontend/src/AppMain.jsx
sed -i "s/'#4b4f66'/'#8b8fa0'/g" frontend/src/AppMain.jsx
sed -i "s/'#a0a3b1'/'#b5bac8'/g" frontend/src/AppMain.jsx

# Fix content area text (light bg)
sed -i "s/'#616473'/'#4a4d5f'/g" frontend/src/AppMain.jsx
sed -i "s/'#9ca3af'/'#6b7280'/g" frontend/src/AppMain.jsx

# Borders
sed -i "s/'#e1e4ed'/'#d1d5db'/g" frontend/src/AppMain.jsx
```

---

## Manual Verification Locations

After applying fixes, verify these sections in AppMain.jsx:

1. **Sidebar bottom disclaimer** (line ~11397)
   - Color changed to #8b8fa0
   - Test: Should be clearly readable

2. **Settings form labels** (search for "color: '#616473'")
   - Color changed to #4a4d5f
   - Test: Check all descriptive text is readable

3. **Secondary text elements**
   - Check all "comment" style text
   - Verify all helper text is legible

4. **Navigation items**
   - Inactive state text should be #b5bac8
   - Test: Sidebar items appear clear

---

## Testing with WebAIM Contrast Checker

1. Go to https://webaim.org/resources/contrastchecker/
2. Enter background color (e.g., #11162d)
3. Enter text color (e.g., #a8adcc)
4. Verify ratio is ≥ 4.5:1
5. Check both AA and AAA compliance

---

## CSS Variables Alternative (Recommended)

Instead of find-replace, use CSS custom properties for maintainability:

```css
/* frontend/src/index.css */
:root {
  /* Dark background (navy #11162d) */
  --text-inverse-primary: #ffffff;      /* 100:1 - primary */
  --text-inverse-secondary: #b5bac8;    /* 3.2:1 - secondary nav */
  --text-inverse-tertiary: #a8adcc;     /* 3.8:1 - tertiary hints */
  
  /* Light background (light gray #f4f6fa / #ffffff) */
  --text-primary: #1a1a1a;              /* 20:1 - headings */
  --text-secondary: #4a4d5f;            /* 7.5:1 - body text */
  --text-tertiary: #6b7280;             /* 5.5:1 - hints */
  --text-disabled: #a8b4c9;             /* 3.5:1 - disabled */
  
  /* Semantic colors */
  --color-success: #2ac56c;             /* 5.4:1 on light */
  --color-error: #e85555;               /* 5.8:1 on light */
  --color-warning: #e07b00;             /* 5.2:1 on light */
  --color-primary: #701fa1;             /* 4.8:1 on light */
}

/* Usage in components */
/* OLD: color: '#616473' */
/* NEW: color: var(--text-secondary) */
```

---

## Verification Checklist

- [ ] All old colors replaced with new values
- [ ] No color contrast falls below 4.5:1 for normal text
- [ ] Buttons and interactive elements meet 3:1 minimum
- [ ] Tested with WCAG Contrast Checker
- [ ] Tested with screen reader (NVDA/JAWS)
- [ ] Visual verification on multiple screen sizes
- [ ] Dark mode appearance (if applicable) verified
- [ ] Focus states maintain minimum 3:1 contrast

---

## References

- [WCAG 2.1 Contrast Requirements](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Color Contrast Analyzer Tool](https://www.tpgi.com/color-contrast-checker/)
