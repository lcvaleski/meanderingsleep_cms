import { NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS || '{}'),
});

const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || '';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const folder = formData.get('folder') as string | null;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedExtensions = ['.mp3', '.wav', '.m4a', '.ogg'];
    const fileNameLower = file.name.toLowerCase();
    if (!allowedExtensions.some(ext => fileNameLower.endsWith(ext))) {
      return NextResponse.json(
        { error: 'Invalid file type. Only MP3, WAV, M4A, and OGG files are allowed.' },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to Google Cloud Storage
    const bucket = storage.bucket(bucketName);
    const uploadPath = folder ? `${folder}/${file.name}` : file.name;
    const blob = bucket.file(uploadPath);
    
    await blob.save(buffer, {
      metadata: {
        contentType: file.type,
      },
    });

    // Make the file publicly accessible
    await blob.makePublic();

    return NextResponse.json({
      message: 'File uploaded successfully',
      file: {
        name: file.name,
        size: file.size,
        contentType: file.type,
        url: `https://storage.googleapis.com/${bucketName}/${uploadPath}`,
      },
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