import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { Storage } from '@google-cloud/storage';

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS || '{}'),
});

const bucket = storage.bucket(process.env.GOOGLE_CLOUD_BUCKET_NAME!);

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { fileName, imageUrl } = await req.json();

    if (!fileName) {
      return NextResponse.json({ error: 'File name is required' }, { status: 400 });
    }

    const fileId = fileName.replace('.mp3', '');
    const jsonFile = bucket.file('history-audio-list.json');

    const [exists] = await jsonFile.exists();
    if (!exists) {
      return NextResponse.json({ error: 'JSON file not found' }, { status: 404 });
    }

    const [content] = await jsonFile.download();
    let jsonData;

    try {
      jsonData = JSON.parse(content.toString());
    } catch (parseError) {
      console.error('Error parsing JSON:', parseError);
      jsonData = { audios: [] };
    }

    if (!jsonData.audios) {
      jsonData.audios = [];
    }

    const audioIndex = jsonData.audios.findIndex((item: { id: string }) => item.id === fileId);

    if (audioIndex !== -1) {
      if (imageUrl) {
        jsonData.audios[audioIndex].imageUrl = imageUrl;
      } else {
        delete jsonData.audios[audioIndex].imageUrl;
      }
    } else {
      return NextResponse.json({ error: 'Audio entry not found' }, { status: 404 });
    }

    await jsonFile.save(JSON.stringify(jsonData, null, 2), {
      metadata: {
        contentType: 'application/json',
        cacheControl: 'no-cache, no-store, must-revalidate',
      },
    });

    return NextResponse.json({ success: true, imageUrl });
  } catch (error) {
    console.error('Error updating image URL:', error);
    return NextResponse.json(
      { error: 'Failed to update image URL' },
      { status: 500 }
    );
  }
}