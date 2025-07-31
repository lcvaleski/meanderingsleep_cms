# Meandering Sleep CMS - Project Status

## Overview
This is a Next.js CMS for managing audio files for two sleep podcast apps:
- **Meandering Sleep**: General sleep content with topics and gender options
- **History Sleep**: Historical sleep content with HIST-prefixed files

## Recent Changes (2025-07-31)

### File Deletion Feature
- ✅ Implemented DELETE endpoint in `/app/api/files/route.ts`
- ✅ Added delete button (trash icon) for History Sleep files only
- ✅ Delete functionality removes both the audio file from GCS and updates JSON
- ✅ Fixed TypeScript errors for production build
- ✅ Added error handling for corrupted JSON files

### Known Issues
1. **File Size Limit**: Vercel has a 4.5MB limit for file uploads
   - Current workaround: Manual upload to GCS + JSON update
   - Future solution: Implement direct GCS upload with signed URLs

2. **JSON Corruption**: Fixed - system now handles malformed JSON gracefully

## File Structure
- **History Sleep**: Files stored in `boringhistory/` folder as `HIST###.mp3`
- **Meandering Sleep**: 
  - Boring topics: stored in `archive/` folder
  - Meandering topics: stored in root
  - Format: `{8-char-id}_{topic}_{gender}.mp3`

## JSON Files
- `history-audio-list.json`: Tracks History Sleep files
- `audio-list.json`: Tracks Meandering Sleep files

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
- [ ] Add file deletion for Meandering Sleep (archive folder handling)
- [ ] Add batch operations
- [ ] Add search/filter functionality