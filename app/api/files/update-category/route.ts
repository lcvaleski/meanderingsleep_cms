import { NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';
import { HISTORY_CATEGORIES } from '@/app/types/audio';

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS || '{}'),
});

const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || '';

interface AudioEntry {
  id: string;
  title?: string;
  voice?: string;
  isNew?: boolean;
  category?: string;
}

export async function POST(request: Request) {
  try {
    const { fileName, category } = await request.json();
    
    if (!fileName) {
      return NextResponse.json(
        { error: 'File name is required' },
        { status: 400 }
      );
    }

    const bucket = storage.bucket(bucketName);
    const jsonFileName = 'history-audio-list.json';
    const jsonFile = bucket.file(jsonFileName);
    const [exists] = await jsonFile.exists();
    
    if (!exists) {
      return NextResponse.json(
        { error: 'JSON file not found' },
        { status: 404 }
      );
    }

    try {
      const [contents] = await jsonFile.download();
      const contentStr = contents.toString().trim();
      
      let json: { audios: AudioEntry[], categories?: typeof HISTORY_CATEGORIES } = { audios: [] };
      
      // Handle empty or malformed JSON
      if (contentStr && contentStr !== 'audios []') {
        json = JSON.parse(contentStr);
      }
      
      // Ensure json has the correct structure
      if (!json.audios || !Array.isArray(json.audios)) {
        json = { audios: [] };
      }
      
      // Extract ID from filename (HIST001.mp3 -> HIST001)
      const idToUpdate = fileName.replace('.mp3', '');
      
      // Find and update the entry
      const entryIndex = json.audios.findIndex((audio: AudioEntry) => audio.id === idToUpdate);
      
      if (entryIndex !== -1) {
        json.audios[entryIndex] = {
          ...json.audios[entryIndex],
          category
        };
      } else {
        return NextResponse.json(
          { error: 'Audio entry not found in JSON' },
          { status: 404 }
        );
      }
      
      // Add categories array
      json.categories = HISTORY_CATEGORIES;
      
      // Save updated JSON with no-cache headers
      await jsonFile.save(JSON.stringify(json, null, 2), {
        metadata: {
          contentType: 'application/json',
          cacheControl: 'no-cache, no-store, must-revalidate',
        },
      });
      
      // Make sure JSON file remains public
      await jsonFile.makePublic();
      
      return NextResponse.json({ 
        message: 'Category updated successfully',
        category 
      });
    } catch (parseError) {
      console.error('Error parsing/updating JSON:', parseError);
      return NextResponse.json(
        { error: 'Failed to update JSON file' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error updating category:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update category',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}