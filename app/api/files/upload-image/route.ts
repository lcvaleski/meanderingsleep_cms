import { NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS || '{}'),
});

const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || '';

export async function POST(request: Request) {
  try {
    const { fileName, contentType } = await request.json();

    if (!fileName) {
      return NextResponse.json(
        { error: 'File name is required' },
        { status: 400 }
      );
    }

    const bucket = storage.bucket(bucketName);
    const uploadPath = `images/${fileName}`;
    const file = bucket.file(uploadPath);

    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000,
      contentType: contentType || 'image/jpeg',
      extensionHeaders: {
        'x-goog-acl': 'public-read',
      },
    });

    return NextResponse.json({
      signedUrl,
      publicUrl: `https://storage.googleapis.com/${bucketName}/${uploadPath}`,
    });
  } catch (error) {
    console.error('Error generating image upload URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}
