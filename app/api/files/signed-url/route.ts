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
    const file = bucket.file('history-audio-list.json');
    const [exists] = await file.exists();
    
    if (!exists) {
      return 'HIST001';
    }
    
    const [contents] = await file.download();
    const json = JSON.parse(contents.toString());
    
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
    return 'HIST001';
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { folder, title, gender, topic } = body;

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    const bucket = storage.bucket(bucketName);
    
    // Determine the file name and path
    let fileName: string;
    let uploadPath: string;
    let id: string;

    if (folder === 'boringhistory') {
      // History Sleep
      id = await getNextHistoryNumber(bucket);
      fileName = `${id}.mp3`;
      uploadPath = `${folder}/${fileName}`;
    } else {
      // Meandering Sleep
      id = generateRandomId();
      const topicPart = topic || 'boring';
      const genderPart = gender || 'female';
      fileName = `${id}_${topicPart}_${genderPart}.mp3`;
      
      // Determine if it goes to archive or root
      uploadPath = topicPart === 'boring' ? `archive/${fileName}` : fileName;
    }

    // Generate a signed URL for direct upload to GCS
    const file = bucket.file(uploadPath);
    
    // Create a signed URL that allows PUT requests for 15 minutes
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType: 'audio/mpeg',
      extensionHeaders: {
        'x-goog-acl': 'public-read',
      },
    });

    return NextResponse.json({
      signedUrl,
      uploadPath,
      fileName,
      id,
      publicUrl: `https://storage.googleapis.com/${bucketName}/${uploadPath}`
    });
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate signed URL',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}