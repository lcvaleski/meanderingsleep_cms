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
  topic?: string;
  subtopic?: string;
  gender?: string;
  voice?: string;
  isNew?: boolean;
}

async function updateJsonInBucket(bucket: ReturnType<Storage['bucket']>, fileName: string, newEntry: AudioEntry) {
  try {
    const file = bucket.file(fileName);
    const [exists] = await file.exists();
    
    let json: { audios: AudioEntry[] } = { audios: [] };
    
    if (exists) {
      try {
        const [contents] = await file.download();
        const contentStr = contents.toString().trim();
        
        // Handle empty or malformed JSON
        if (contentStr && contentStr !== 'audios []') {
          json = JSON.parse(contentStr);
        }
        
        // Ensure json has the correct structure
        if (!json.audios || !Array.isArray(json.audios)) {
          json = { audios: [] };
        }
      } catch (parseError) {
        console.error(`Error parsing ${fileName}, resetting to empty array:`, parseError);
        json = { audios: [] };
      }
    }
    
    json.audios.push(newEntry);
    
    await file.save(JSON.stringify(json, null, 2), {
      metadata: {
        contentType: 'application/json',
      },
    });
    
    // Make the JSON file publicly accessible
    await file.makePublic();
  } catch (error) {
    console.error(`Error updating ${fileName}:`, error);
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { folder, title, gender, topic, id, uploadPath, voiceName, isNew } = body;

    if (!id || !uploadPath) {
      return NextResponse.json(
        { error: 'ID and upload path are required' },
        { status: 400 }
      );
    }

    const bucket = storage.bucket(bucketName);
    
    // Make the uploaded file public
    const uploadedFile = bucket.file(uploadPath);
    await uploadedFile.makePublic();

    // Prepare JSON entry
    let jsonEntry: AudioEntry;
    let jsonFileName: string;

    if (folder === 'boringhistory') {
      // History Sleep
      jsonEntry = {
        id: id,
        title: title,
        voice: voiceName || 'Unknown',
        ...(isNew !== undefined && { isNew })
      };
      jsonFileName = 'history-audio-list.json';
    } else {
      // Meandering Sleep
      jsonEntry = {
        topic: topic || 'boring',
        subtopic: title,
        id: id,
        gender: gender || 'female'
      };
      jsonFileName = 'audio-list.json';
    }

    // Update the JSON file
    await updateJsonInBucket(bucket, jsonFileName, jsonEntry);

    return NextResponse.json({
      message: 'JSON updated successfully',
      jsonEntry
    });
  } catch (error) {
    console.error('Error updating JSON:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update JSON',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}