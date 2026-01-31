---
title: Remove Meandering Sleep UI
type: refactor
date: 2026-01-31
---

# Remove Meandering Sleep UI

## Overview

Remove the Meandering Sleep tab from the CMS frontend, leaving only History Sleep and Stories tabs. API endpoints and GCS data remain intact for potential future use or direct API access.

## Problem Statement / Motivation

The Meandering Sleep tab is no longer needed in the CMS. Removing it simplifies the interface and reduces maintenance burden while preserving the underlying data and API capabilities.

## Proposed Solution

Remove all Meandering Sleep UI elements from `/app/page.tsx`:
- Tab navigation link
- State variables (`gender`, `topic`)
- Conditional form fields
- Change default active tab to 'history'

## Acceptance Criteria

- [x] CMS loads with History Sleep tab active by default
- [x] Only two tabs visible: "History Sleep" and "Stories"
- [x] History Sleep upload form works (title, voice, category, isNew, imageUrl)
- [x] History Sleep file management works (edit, delete, toggle new)
- [x] Stories tab functions normally
- [x] `npm run build` succeeds with no TypeScript errors
- [ ] No console errors in browser
- [x] API endpoints remain functional (not modified)

## Technical Approach

### File: `/app/page.tsx`

**1. Update tab type and default (line 9)**
```typescript
// Before
const [activeTab, setActiveTab] = useState<'meandering' | 'history' | 'stories'>('meandering');

// After
const [activeTab, setActiveTab] = useState<'history' | 'stories'>('history');
```

**2. Remove unused state variables (lines 16-17)**
```typescript
// Remove these lines
const [gender, setGender] = useState<'male' | 'female'>('female');
const [topic, setTopic] = useState<'boring' | 'meandering'>('boring');
```

**3. Remove Meandering tab link (lines 288-298)**
```typescript
// Remove entire <a> block for Meandering Sleep tab
```

**4. Remove Meandering form fields (lines 398-443)**
```typescript
// Remove entire {activeTab === 'meandering' && (...)} conditional block
```

**5. Remove gender/topic from upload handler (lines 204-205, 242-243)**
```typescript
// Remove these lines from formData and fetch body
gender: activeTab === 'meandering' ? gender : null,
topic: activeTab === 'meandering' ? topic : null,
```

**6. Simplify file list header (line 486)**
```typescript
// Before
{activeTab === 'meandering' ? 'Meandering Sleep' : 'History Sleep'} Files

// After
History Sleep Files
```

**7. Clean up table conditionals (optional)**
Remove `{activeTab === 'history' && ...}` wrappers from table columns since they're always true now.

### File: `/CLAUDE.md`

Update to reflect Meandering Sleep UI removal and that only History Sleep + Stories remain.

## Out of Scope

- API endpoint modifications (kept intact per requirement)
- GCS data cleanup (`audio-list.json`, root/archive files remain)
- Type definitions in `/app/types/audio.ts` (optional future cleanup)

## Testing Checklist

- [ ] Load CMS - should show History Sleep tab by default
- [ ] Switch to Stories tab - should work
- [ ] Upload a test History Sleep file
- [ ] Edit category on existing file
- [ ] Edit image URL on existing file
- [ ] Toggle "new" status on existing file
- [ ] Delete a test file
- [ ] Generate a story in Stories tab
- [ ] Run `npm run build` - should succeed

## References

- Main page component: `app/page.tsx`
- Stories component: `app/components/StoriesTab.tsx` (no changes needed)
- API routes: `app/api/files/*` (no changes - kept intact)
