# Sleep CMS - Project Status

## Overview
This is a Next.js CMS for managing audio files for the History Sleep podcast app.
- **History Sleep**: Historical sleep content with HIST-prefixed files
- **Stories**: AI-generated sleep lecture content using Claude

Note: Meandering Sleep UI was removed (2026-01-31). API endpoints and GCS data remain intact.

## Recent Changes (2026-01-31)

### Removed Meandering Sleep UI
- Removed Meandering Sleep tab from the CMS frontend
- Only History Sleep and Stories tabs remain
- API endpoints preserved for potential future use
- GCS data (`audio-list.json`, root/archive files) remains untouched

### Previous Changes (2025-07-31)
- Implemented DELETE endpoint in `/app/api/files/route.ts`
- Added delete button for History Sleep files
- Delete functionality removes both the audio file from GCS and updates JSON
- Added error handling for corrupted JSON files

## Known Issues
1. **File Size Limit**: Vercel has a 4.5MB limit for file uploads
   - Current workaround: Manual upload to GCS + JSON update
   - Future solution: Implement direct GCS upload with signed URLs

## File Structure
- **History Sleep**: Files stored in `boringhistory/` folder as `HIST###.mp3`
- **Legacy Meandering Sleep** (API only, no UI):
  - Boring topics: stored in `archive/` folder
  - Meandering topics: stored in root
  - Format: `{8-char-id}_{topic}_{gender}.mp3`

## JSON Files
- `history-audio-list.json`: Tracks History Sleep files
- `audio-list.json`: Tracks Meandering Sleep files (legacy, no UI)

## Environment Variables Required
```
GOOGLE_CLOUD_PROJECT_ID=
GOOGLE_CLOUD_CREDENTIALS=
GOOGLE_CLOUD_BUCKET_NAME=
```

## Commands
- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run lint`: Run linting

## Next Steps
- [ ] Implement large file upload solution (signed URLs)
- [ ] Add batch operations
- [ ] Add search/filter functionality
