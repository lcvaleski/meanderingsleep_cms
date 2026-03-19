import { NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';
import { HISTORY_CATEGORIES } from '@/app/types/audio';

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
}

interface SectionConfig {
  type: 'daily' | 'free' | 'new' | 'all' | 'category';
  title?: string;
  categoryId?: string;
}

interface AppConfig {
  dailyAudioId?: string;
  freeAudioIds: string[];
  sections: SectionConfig[];
}

interface AudioListJson {
  version?: number;
  audios: AudioEntry[];
  categories?: typeof HISTORY_CATEGORIES;
  config?: AppConfig;
}

// GET: Read current config from history-audio-list.json
export async function GET() {
  try {
    const bucket = storage.bucket(bucketName);
    const jsonFile = bucket.file('history-audio-list.json');
    const [exists] = await jsonFile.exists();

    if (!exists) {
      return NextResponse.json({ error: 'JSON file not found' }, { status: 404 });
    }

    const [contents] = await jsonFile.download();
    const json: AudioListJson = JSON.parse(contents.toString().trim());

    return NextResponse.json({
      config: json.config || null,
      audios: json.audios || [],
      categories: json.categories || HISTORY_CATEGORIES,
    });
  } catch (error) {
    console.error('Error reading config:', error);
    return NextResponse.json(
      { error: 'Failed to read config', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

// PUT: Save categories only (used when creating/deleting categories)
export async function PUT(request: Request) {
  try {
    const { categories: updatedCategories } = await request.json() as {
      categories: typeof HISTORY_CATEGORIES;
    };

    if (!updatedCategories || !Array.isArray(updatedCategories)) {
      return NextResponse.json({ error: 'categories array is required' }, { status: 400 });
    }

    const bucket = storage.bucket(bucketName);
    const jsonFile = bucket.file('history-audio-list.json');
    const [exists] = await jsonFile.exists();

    if (!exists) {
      return NextResponse.json({ error: 'JSON file not found' }, { status: 404 });
    }

    const [contents] = await jsonFile.download();
    const json: AudioListJson = JSON.parse(contents.toString().trim());

    json.categories = updatedCategories;

    await jsonFile.save(JSON.stringify(json, null, 2), {
      metadata: {
        contentType: 'application/json',
        cacheControl: 'no-cache, no-store, must-revalidate',
      },
    });
    await jsonFile.makePublic();

    return NextResponse.json({
      message: 'Categories saved successfully',
      categories: json.categories,
    });
  } catch (error) {
    console.error('Error saving categories:', error);
    return NextResponse.json(
      { error: 'Failed to save categories', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

// POST: Save config to history-audio-list.json
export async function POST(request: Request) {
  try {
    const { config, categories: updatedCategories } = await request.json() as {
      config: AppConfig;
      categories?: typeof HISTORY_CATEGORIES;
    };

    if (!config) {
      return NextResponse.json({ error: 'Config is required' }, { status: 400 });
    }

    // Validate freeAudioIds is not empty
    if (!config.freeAudioIds || config.freeAudioIds.length === 0) {
      return NextResponse.json(
        { error: 'freeAudioIds cannot be empty — at least one free track is required' },
        { status: 422 },
      );
    }

    // Validate sections
    const validTypes = new Set(['daily', 'free', 'new', 'all', 'category']);
    for (const section of config.sections) {
      if (!validTypes.has(section.type)) {
        return NextResponse.json(
          { error: `Invalid section type: ${section.type}` },
          { status: 422 },
        );
      }
      if (section.type === 'category' && !section.categoryId) {
        return NextResponse.json(
          { error: 'Category sections require a categoryId' },
          { status: 422 },
        );
      }
    }

    const bucket = storage.bucket(bucketName);
    const jsonFile = bucket.file('history-audio-list.json');
    const [exists] = await jsonFile.exists();

    if (!exists) {
      return NextResponse.json({ error: 'JSON file not found' }, { status: 404 });
    }

    // Read current file
    const [contents] = await jsonFile.download();
    const json: AudioListJson = JSON.parse(contents.toString().trim());

    // Validate all referenced audio IDs exist
    const audioIds = new Set((json.audios || []).map(a => a.id));

    if (config.dailyAudioId && !audioIds.has(config.dailyAudioId)) {
      return NextResponse.json(
        { error: `dailyAudioId "${config.dailyAudioId}" not found in audio library` },
        { status: 422 },
      );
    }

    const invalidFreeIds = config.freeAudioIds.filter(id => !audioIds.has(id));
    if (invalidFreeIds.length > 0) {
      return NextResponse.json(
        { error: `These freeAudioIds not found in library: ${invalidFreeIds.join(', ')}` },
        { status: 422 },
      );
    }

    // Validate category section references
    const categoryIds = new Set((updatedCategories || json.categories || HISTORY_CATEGORIES).map(c => c.id));
    for (const section of config.sections) {
      if (section.type === 'category' && section.categoryId && !categoryIds.has(section.categoryId)) {
        return NextResponse.json(
          { error: `Section references unknown categoryId: ${section.categoryId}` },
          { status: 422 },
        );
      }
    }

    // Merge config into JSON
    json.version = json.version || 1;
    json.config = config;
    if (updatedCategories) {
      json.categories = updatedCategories;
    }

    // Save
    await jsonFile.save(JSON.stringify(json, null, 2), {
      metadata: {
        contentType: 'application/json',
        cacheControl: 'no-cache, no-store, must-revalidate',
      },
    });
    await jsonFile.makePublic();

    return NextResponse.json({
      message: 'Config saved successfully',
      config: json.config,
    });
  } catch (error) {
    console.error('Error saving config:', error);
    return NextResponse.json(
      { error: 'Failed to save config', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
