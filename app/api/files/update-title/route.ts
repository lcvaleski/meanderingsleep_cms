import { NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS || '{}'),
});

const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || '';

export async function POST(request: Request) {
  try {
    const { fileName, title } = await request.json();

    if (!fileName || !title) {
      return NextResponse.json(
        { error: 'File name and title are required' },
        { status: 400 },
      );
    }

    const bucket = storage.bucket(bucketName);
    const jsonFile = bucket.file('history-audio-list.json');
    const [exists] = await jsonFile.exists();

    if (!exists) {
      return NextResponse.json({ error: 'JSON file not found' }, { status: 404 });
    }

    const [contents] = await jsonFile.download();
    const json = JSON.parse(contents.toString().trim());

    if (!json.audios || !Array.isArray(json.audios)) {
      return NextResponse.json({ error: 'Invalid JSON structure' }, { status: 500 });
    }

    const idToUpdate = fileName.replace('.mp3', '');
    const entryIndex = json.audios.findIndex((a: { id: string }) => a.id === idToUpdate);

    if (entryIndex === -1) {
      return NextResponse.json({ error: 'Audio entry not found' }, { status: 404 });
    }

    json.audios[entryIndex].title = title;

    await jsonFile.save(JSON.stringify(json, null, 2), {
      metadata: {
        contentType: 'application/json',
        cacheControl: 'no-cache, no-store, must-revalidate',
      },
    });
    await jsonFile.makePublic();

    return NextResponse.json({ message: 'Title updated successfully', title });
  } catch (error) {
    console.error('Error updating title:', error);
    return NextResponse.json(
      { error: 'Failed to update title' },
      { status: 500 },
    );
  }
}
