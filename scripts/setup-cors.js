const { Storage } = require('@google-cloud/storage');
require('dotenv').config({ path: '.env.local' });

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS || '{}'),
});

const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || '';

async function setCorsConfiguration() {
  const corsConfiguration = [
    {
      origin: ['http://localhost:3000', 'http://localhost:3001', 'https://*.vercel.app', '*'],
      method: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
      responseHeader: ['*'],
      maxAgeSeconds: 3600,
    },
  ];

  try {
    await storage.bucket(bucketName).setCorsConfiguration(corsConfiguration);
    console.log(`CORS configuration updated for bucket ${bucketName}`);
    
    // Get and display the current CORS configuration
    const [metadata] = await storage.bucket(bucketName).getMetadata();
    console.log('Current CORS configuration:', JSON.stringify(metadata.cors, null, 2));
  } catch (error) {
    console.error('Error setting CORS configuration:', error);
  }
}

setCorsConfiguration();