import { NextResponse } from 'next/server';

export const runtime = 'nodejs'; // 👈 Force server to use Node.js runtime

// Disable the default body parser
export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req: Request) {
  try {
    // Get the raw request body
    const rawBody = await req.arrayBuffer();
    const contentType = req.headers.get('content-type') || '';
    
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Content type must be multipart/form-data' },
        { status: 400 }
      );
    }

    // Create a new request with the raw body
    const newReq = new Request(req.url, {
      method: req.method,
      headers: req.headers,
      body: rawBody,
    });

    const formData = await newReq.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // For now, just return the file info
    return NextResponse.json({
      message: `Received file: ${file.name}`,
      size: file.size,
      type: file.type
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process upload' },
      { status: 500 }
    );
  }
}