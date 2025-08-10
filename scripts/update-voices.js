const { Storage } = require('@google-cloud/storage');
require('dotenv').config({ path: '.env.local' });

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS || '{}'),
});

const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || '';

async function updateVoices() {
  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file('history-audio-list.json');
    
    // Download current JSON
    const [contents] = await file.download();
    const json = JSON.parse(contents.toString());
    
    // Remove HIST004 test entry and update voices
    json.audios = json.audios
      .filter(entry => entry.id !== 'HIST004')
      .map(entry => {
        if (entry.id === 'HIST003') {
          return { ...entry, voice: 'Female Grad Student' };
        } else {
          return { ...entry, voice: 'Male British Professor' };
        }
      });
    
    // Save updated JSON
    await file.save(JSON.stringify(json, null, 2), {
      metadata: {
        contentType: 'application/json',
      },
    });
    
    // Make sure it's public
    await file.makePublic();
    
    console.log('Successfully updated voice names:');
    json.audios.forEach(entry => {
      console.log(`  ${entry.id}: ${entry.voice}`);
    });
    
  } catch (error) {
    console.error('Error updating voices:', error);
  }
}

updateVoices();