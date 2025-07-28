import { NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS || '{}'),
});

const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || '';

// Generate a random 8-character hex ID for Meandering Sleep
function generateRandomId(): string {
  return Math.random().toString(16).substring(2, 10).toUpperCase();
}

// Get the next HIST number for History Sleep
async function getNextHistoryNumber(bucket: ReturnType<Storage['bucket']>): Promise<string> {
  try {
    // Read the JSON from the bucket
    const file = bucket.file('history-audio-list.json');
    const [exists] = await file.exists();
    
    if (!exists) {
      return 'HIST001';
    }
    
    const [contents] = await file.download();
    const json = JSON.parse(contents.toString());
    
    // Find the highest HIST number
    let maxNum = 0;
    for (const audio of json.audios || []) {
      const match = audio.id.match(/HIST(\d+)/);
      if (match) {
        const num = parseInt(match[1]);
        if (num > maxNum) maxNum = num;
      }
    }
    
    return `HIST${String(maxNum + 1).padStart(3, '0')}`;
  } catch (error) {
    console.error('Error reading history JSON:', error);
    return 'HIST001'; // Fallback
  }
}

// Update JSON file in the bucket
interface AudioEntry {
  id: string;
  title?: string;
  topic?: string;
  subtopic?: string;
  gender?: string;
}

async function updateJsonInBucket(bucket: ReturnType<Storage['bucket']>, fileName: string, newEntry: AudioEntry) {
  try {
    const file = bucket.file(fileName);
    const [exists] = await file.exists();
    
    let json: { audios: AudioEntry[] } = { audios: [] };
    
    if (exists) {
      const [contents] = await file.download();
      json = JSON.parse(contents.toString());
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
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const folder = formData.get('folder') as string | null;
    const title = formData.get('title') as string;
    const gender = formData.get('gender') as string | null;
    const topic = formData.get('topic') as string | null;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    // Validate file type (only MP3)
    if (!file.name.toLowerCase().endsWith('.mp3')) {
      return NextResponse.json(
        { error: 'Only MP3 files are allowed' },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    const bucket = storage.bucket(bucketName);

    // Determine the file name based on the app type
    let fileName: string;
    let uploadPath: string;
    let jsonEntry: AudioEntry;
    let jsonFileName: string;

    if (folder === 'boringhistory') {
      // History Sleep
      const histId = await getNextHistoryNumber(bucket);
      fileName = `${histId}.mp3`;
      uploadPath = `${folder}/${fileName}`;
      
      jsonEntry = {
        id: histId,
        title: title
      };
      
      jsonFileName = 'history-audio-list.json';
    } else {
      // Meandering Sleep
      const randomId = generateRandomId();
      const topicPart = topic || 'boring';
      const genderPart = gender || 'female';
      fileName = `${randomId}_${topicPart}_${genderPart}.mp3`;
      
      // Determine if it goes to archive or root
      uploadPath = topicPart === 'boring' ? `archive/${fileName}` : fileName;
      
      jsonEntry = {
        topic: topicPart,
        subtopic: title,
        id: randomId,
        gender: genderPart
      };
      
      jsonFileName = 'audio-list.json';
    }

    // Upload the audio file to Google Cloud Storage
    const blob = bucket.file(uploadPath);
    
    await blob.save(buffer, {
      metadata: {
        contentType: 'audio/mpeg',
        metadata: {
          title: title,
          ...(gender && { gender }),
          ...(topic && { topic })
        }
      },
    });

    // Make the file publicly accessible
    await blob.makePublic();

    // Update the JSON file in the bucket
    await updateJsonInBucket(bucket, jsonFileName, jsonEntry);

    return NextResponse.json({
      message: 'File uploaded successfully',
      file: {
        name: fileName,
        size: file.size,
        contentType: 'audio/mpeg',
        url: `https://storage.googleapis.com/${bucketName}/${uploadPath}`,
      },
      jsonEntry
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { 
        error: 'Failed to upload file',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}