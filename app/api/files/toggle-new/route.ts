import { NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

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
}

export async function POST(request: Request) {
  try {
    const { fileName, isNew } = await request.json();
    
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
      
      let json: { audios: AudioEntry[] } = { audios: [] };
      
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
          isNew
        };
      } else {
        return NextResponse.json(
          { error: 'Audio entry not found in JSON' },
          { status: 404 }
        );
      }
      
      // Save updated JSON
      await jsonFile.save(JSON.stringify(json, null, 2), {
        metadata: {
          contentType: 'application/json',
        },
      });
      
      // Make sure JSON file remains public
      await jsonFile.makePublic();
      
      return NextResponse.json({ 
        message: 'New status updated successfully',
        isNew 
      });
    } catch (parseError) {
      console.error('Error parsing/updating JSON:', parseError);
      return NextResponse.json(
        { error: 'Failed to update JSON file' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error toggling new status:', error);
    return NextResponse.json(
      { 
        error: 'Failed to toggle new status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}