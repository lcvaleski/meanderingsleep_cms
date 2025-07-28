import { NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS || '{}'),
});

const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || '';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const folder = searchParams.get('folder') || '';
  try {
    // Validate environment variables
    if (!process.env.GOOGLE_CLOUD_PROJECT_ID) {
      throw new Error('GOOGLE_CLOUD_PROJECT_ID is not set');
    }
    if (!process.env.GOOGLE_CLOUD_CREDENTIALS) {
      throw new Error('GOOGLE_CLOUD_CREDENTIALS is not set');
    }
    if (!bucketName) {
      throw new Error('GOOGLE_CLOUD_BUCKET_NAME is not set');
    }

    const [files] = await storage.bucket(bucketName).getFiles({
      prefix: folder ? `${folder}/` : '',
    });

    const audioFiles = files
      .filter(file => {
        // Check if it's an audio file
        if (!file.name.match(/\.(mp3|wav|m4a|ogg)$/i)) return false;
        
        // If we're looking for root files (Meandering Sleep), exclude boringhistory folder
        if (!folder && file.name.startsWith('boringhistory/')) return false;
        
        return true;
      })
      .map(file => ({
        name: folder ? file.name.replace(`${folder}/`, '') : file.name,
        size: file.metadata.size,
        contentType: file.metadata.contentType,
        updated: file.metadata.updated,
        url: `https://storage.googleapis.com/${bucketName}/${file.name}`,
      }));

    return NextResponse.json({ files: audioFiles });
  } catch (error) {
    console.error('Error listing files:', error);
    return NextResponse.json(
      { 
        error: 'Failed to list files',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 