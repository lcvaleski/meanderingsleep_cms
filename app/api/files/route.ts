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

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get('fileName');
    const folder = searchParams.get('folder') || '';
    
    if (!fileName) {
      return NextResponse.json(
        { error: 'File name is required' },
        { status: 400 }
      );
    }

    // Only allow deletion for History Sleep files
    if (folder !== 'boringhistory') {
      return NextResponse.json(
        { error: 'Deletion is only allowed for History Sleep files' },
        { status: 403 }
      );
    }

    const bucket = storage.bucket(bucketName);
    const filePath = `${folder}/${fileName}`;
    
    // Delete the file from storage
    await bucket.file(filePath).delete();
    
    // Update the JSON file
    const jsonFileName = 'history-audio-list.json';
    const jsonFile = bucket.file(jsonFileName);
    const [exists] = await jsonFile.exists();
    
    if (exists) {
      const [contents] = await jsonFile.download();
      const json = JSON.parse(contents.toString());
      
      // Extract ID from filename (HIST001.mp3 -> HIST001)
      const idToRemove = fileName.replace('.mp3', '');
      
      // Filter out the deleted entry
      json.audios = json.audios.filter((audio: { id: string }) => audio.id !== idToRemove);
      
      // Save updated JSON
      await jsonFile.save(JSON.stringify(json, null, 2), {
        metadata: {
          contentType: 'application/json',
        },
      });
      
      // Make sure JSON file remains public
      await jsonFile.makePublic();
    }
    
    return NextResponse.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete file',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 