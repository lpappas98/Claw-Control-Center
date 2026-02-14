# QA Verification Standards

**Updated:** 2026-02-14
**Based on:** Task overflow fix lesson

## Core Principle

**Code review ≠ verification.** Compilation ≠ execution. You don't ship until you've USED it.

---

## Standard Verification Workflow

### For ALL UI Changes (CSS, styling, layout, visual fixes)

```
Code written → Compiled → Tested in browser/app → Verified visually → Complete
```

**Each step is mandatory:**

1. **Code Review** ✅
   - Read the changes (CSS, component, markup)
   - Check for syntax errors, logic issues
   - Understand the intent

2. **Compilation** ✅
   - Zero TypeScript errors
   - Build succeeds

3. **Load in Real Browser/App** ✅ (NON-NEGOTIABLE)
   - Web: Open in browser (Chrome DevTools available)
   - Expo: Run on simulator
   - Flutter: Build & run on emulator
   - Native: Simulator/device

4. **Take Screenshots** ✅
   - Before (original issue)
   - After (fixed)
   - Edge cases (long text, small screens, etc.)

5. **Verify Computed Styles** ✅
   - Use DevTools to inspect actual computed CSS
   - Do NOT trust CSS source code alone
   - Verify calculated width, height, margins, overflow behavior
   - Check for conflicting styles from parent/sibling elements

6. **Test Edge Cases** ✅
   - Long text (should truncate, wrap, or ellipsis as intended)
   - Small screens (should reflow correctly)
   - Different zoom levels (browser)
   - Empty states
   - Error states

7. **Visual Behavior Verification** ✅
   - Does it LOOK right to you?
   - Would you use this?
   - Is it professional/polished?
   - Does it match design intent?

8. **Document Results** ✅
   - Screenshot of fixed area
   - Computed styles (from DevTools)
   - List of tested edge cases
   - Sign-off with timestamp

---

## UI Verification Checklist

Use this for every UI change (CSS fix, layout change, styling update):

### Pre-Verification
- [ ] Understand what's being fixed (read acceptance criteria)
- [ ] Know what "done" looks like (design spec, reference image)
- [ ] Have test account/data ready

### During Verification
- [ ] Start browser/app locally (don't just read code)
- [ ] Navigate to the changed screen/component
- [ ] Take screenshot of current state (before fix)
- [ ] Open DevTools (web: F12, Expo: shake menu)
- [ ] Inspect the element (compute styles for width, overflow, etc.)
- [ ] Verify CSS rules applied vs what's expected
- [ ] Test long content (paste >50 char text if applicable)
- [ ] Test small screen (resize browser or test mobile)
- [ ] Take screenshot of fixed state (after)
- [ ] Compare before/after visually

### Red Flags (Stop and Investigate)
- [ ] CSS rule added but computed style shows something different
- [ ] Element overflows despite having `overflow: hidden`
- [ ] Text truncation doesn't work even though `text-overflow: ellipsis` is there
- [ ] Borders/spacing look wrong despite CSS being correct
- [ ] Hover/focus states broken or missing
- [ ] Font size/weight not what's in CSS
- [ ] Colors don't match (check for opacity, filters, gradients)

### Sign-Off
- [ ] All edge cases passed
- [ ] Computed styles confirmed correct
- [ ] Visual appearance matches intent
- [ ] Screenshots captured
- [ ] Document: `✅ VERIFIED [YYYY-MM-DD HH:MM UTC] - [Brief summary]`

---

## Common UI Pitfalls (And How to Catch Them)

### Issue: Text Overflow Not Truncating

**Symptom:** CSS has `text-overflow: ellipsis` but text still overflows.

**Why it happens:**
- Parent element doesn't constrain width
- Missing `white-space: nowrap`
- Missing `max-width`
- `overflow: hidden` not applied

**Verification step:**
1. Use DevTools to check parent element width
2. Check if `max-width: 100%` exists
3. Check computed overflow value (should be `hidden`)
4. Test with very long text (50+ chars)
5. Screenshot should show ellipsis, not overflow

**Fix checklist:**
- [ ] `overflow: hidden` on parent
- [ ] `text-overflow: ellipsis` on text
- [ ] `white-space: nowrap` on text
- [ ] `max-width: 100%` on text (or parent)
- [ ] Retest with long content

---

### Issue: Dark Theme Colors Not Applied

**Symptom:** CSS has dark colors but UI looks light (or vice versa).

**Why it happens:**
- Component overrides with inline styles
- CSS specificity issues (global styles winning)
- Missing `!important` (last resort)
- Scoped CSS not reaching target element

**Verification step:**
1. Right-click → Inspect element in DevTools
2. Look at Computed styles, not source CSS
3. Check for strikethrough (overridden rules)
4. Trace up the cascade (parent, global, etc.)
5. Check component vs global CSS specificity

**Fix checklist:**
- [ ] Use DevTools to find overriding rules
- [ ] Increase specificity or remove override
- [ ] Test multiple component instances
- [ ] Verify colors match design spec (use color picker in DevTools)

---

### Issue: Layout Breaks on Small Screens

**Symptom:** Responsive design works on desktop but breaks on mobile.

**Why it happens:**
- Fixed widths used instead of percentages
- Missing media queries
- Flexbox/grid gaps too large for small space
- Padding/margins consume too much space

**Verification step:**
1. Open DevTools (F12)
2. Use device emulation (click phone icon)
3. Test common sizes: 375px (iPhone), 768px (iPad), 1024px (desktop)
4. Scroll horizontally - should be NO horizontal scroll
5. Text should be readable at each size
6. Buttons should be tappable (min 44x44px)

**Fix checklist:**
- [ ] Test at 375px, 768px, 1024px widths
- [ ] No horizontal overflow
- [ ] Text readable at all sizes
- [ ] Buttons accessible (min size, spacing)
- [ ] Images scale correctly

---

## Verification Evidence

Every completed UI verification should include:

### Screenshots
- [ ] Original (broken) state
- [ ] Fixed state
- [ ] Edge case #1 (long text)
- [ ] Edge case #2 (small screen)
- [ ] DevTools computed styles (proof)

### Documentation
```
✅ VERIFIED [2026-02-14 09:48 UTC]
- Task: Fix task title overflow in Mission Control
- Changed: Added max-width: 100% to .home-task-title
- Tested: Long titles (50+ chars) now show ellipsis ✓
- Tested: Small screens (375px) no overflow ✓
- Verified: Computed styles correct (max-width: 100%, overflow: hidden) ✓
- Evidence: Screenshots attached
```

### What NOT to Accept as Verification
- ❌ "I read the code and it looks good"
- ❌ "TypeScript compiled without errors"
- ❌ "The CSS is there, must work"
- ❌ "I tested on desktop only"
- ❌ No screenshots

---

## Quick Reference: Verification Timebox

| Change Type | Time Budget | Steps |
|---|---|---|
| CSS fix (single element) | 5 min | Load → inspect → test edge case → screenshot |
| Layout change | 15 min | Load → test responsive sizes → edge cases → screenshot |
| Theme/color update | 10 min | Load → color picker verify → test contrast → screenshot |
| Component styling | 20 min | Load → test all instances → interactive states → screenshot |

---

## When to Escalate

Stop and report if:

- [ ] Changes work in code but break in practice
- [ ] Computed styles don't match CSS source
- [ ] Fixes break on different browsers/devices
- [ ] Performance noticeably degrades
- [ ] Accessibility issues (color contrast, keyboard nav, etc.)

---

## Tools & Resources

### Web UI Verification (Browser)
- **DevTools:** F12 (Chrome/Edge), Inspector (Firefox)
- **Color picker:** DevTools → pick eyedropper, click element
- **Responsive mode:** Ctrl+Shift+M (Chrome)
- **Computed styles:** Right-click → Inspect → Computed tab

### Expo/React Native
- **Simulator:** iOS Simulator or Android Emulator
- **Expo DevTools:** Shake device, select "Dev Tools"
- **React DevTools:** Install Flipper plugin
- **Screenshot:** System screenshot tool (Shift+Cmd+5 macOS, PrtScn Windows)

### Flutter
- **Emulator:** Android Emulator or iOS Simulator
- **DevTools:** Run app → follow console URL
- **Widget inspector:** Open DevTools, select Inspector tab
- **Screenshot:** `flutter screenshot` command

---

## Sign-Off Template

```markdown
## Verification Report

**Task:** [Task ID] - [Task Title]
**Tester:** Sentinel (QA Agent)
**Date:** 2026-02-14
**Time:** 09:48 UTC

### Changes Verified
- [ ] CSS changes applied correctly
- [ ] Computed styles match expectations
- [ ] Edge cases tested
- [ ] Visual behavior correct

### Testing Summary
- **Desktop:** ✅ Verified at 1440px
- **Tablet:** ✅ Verified at 768px
- **Mobile:** ✅ Verified at 375px
- **Edge case - long text:** ✅ Verified
- **Edge case - empty state:** ✅ Verified

### Screenshots
- [Before image URL/path]
- [After image URL/path]
- [Edge case image URL/path]

### Conclusion
✅ READY FOR PRODUCTION - All criteria met, all edge cases passed, visual behavior verified.

---
_This verification followed QA_VERIFICATION_STANDARDS.md (updated 2026-02-14)_
```

---

## Last Updated
**2026-02-14** - Initial QA Verification Standards based on task overflow fix lesson
