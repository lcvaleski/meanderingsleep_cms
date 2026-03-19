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
  category?: string;
  imageUrl?: string;
  duration?: number;
}

// POST: Receive durations from client and save to JSON
export async function POST(request: Request) {
  try {
    const { durations } = await request.json() as {
      durations: Record<string, number>;
    };

    if (!durations || typeof durations !== 'object') {
      return NextResponse.json({ error: 'durations object is required' }, { status: 400 });
    }

    const bucket = storage.bucket(bucketName);
    const jsonFile = bucket.file('history-audio-list.json');
    const [exists] = await jsonFile.exists();

    if (!exists) {
      return NextResponse.json({ error: 'JSON file not found' }, { status: 404 });
    }

    const [contents] = await jsonFile.download();
    const json = JSON.parse(contents.toString().trim());

    let updated = 0;
    for (const audio of (json.audios || []) as AudioEntry[]) {
      if (durations[audio.id] && !audio.duration) {
        audio.duration = durations[audio.id];
        updated++;
      }
    }

    if (updated === 0) {
      return NextResponse.json({ message: 'No tracks needed updating', updated: 0 });
    }

    await jsonFile.save(JSON.stringify(json, null, 2), {
      metadata: {
        contentType: 'application/json',
        cacheControl: 'no-cache, no-store, must-revalidate',
      },
    });
    await jsonFile.makePublic();

    return NextResponse.json({ message: `Updated ${updated} tracks with duration`, updated });
  } catch (error) {
    console.error('Error backfilling durations:', error);
    return NextResponse.json(
      { error: 'Failed to backfill durations', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
