import { NextResponse, type NextRequest } from 'next/server';
import { adminStorage } from '@/firebase/adminConfig'; // Assuming adminConfig exports storage
import { PassThrough } from 'stream';
import mime from 'mime-types'; // To determine content type

export const dynamic = 'force-dynamic'; // Ensure the route is dynamic

// Handles GET requests to fetch specific build files from GCS
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; filePath: string[] }> } // Wrap and type filePath as string[]
) {
  // const projectId = context.params.projectId; // Old way
  // const filePath = context.params.filePath; // Old way
  const awaitedParams = await params; // Await the promise
  const { projectId, filePath } = awaitedParams; // Destructure from awaited object

  if (!projectId || !filePath || filePath.length === 0) {
    return NextResponse.json({ error: 'Missing projectId or filePath' }, { status: 400 });
  }

  // Join the potentially multi-segment file path
  // e.g., ['assets', 'logo.png'] -> 'assets/logo.png'
  // Decode URI components just in case they are encoded (e.g., spaces %20)
  const relativePath = filePath.map(segment => decodeURIComponent(segment)).join('/');

  // Construct the full path in GCS for the build artifact
  // Note: We upload to 'build/' now, not 'build/web/'
  const gcsPath = `projects/${projectId}/build/${relativePath}`;
  const bucket = adminStorage.bucket();
  const file = bucket.file(gcsPath);

  console.log(`Proxy request for project ${projectId}, path: ${relativePath} -> GCS: ${gcsPath}`);

  try {
    // Check if the file exists in GCS
    const [exists] = await file.exists();
    if (!exists) {
      console.warn(`File not found in GCS: ${gcsPath}`);
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Get metadata to determine content type (optional but good practice)
    // Note: This adds a small delay but ensures correct browser rendering
    let contentType = mime.lookup(relativePath) || 'application/octet-stream'; // Guess from path or default
    try {
        const [metadata] = await file.getMetadata();
        if (metadata.contentType) {
            contentType = metadata.contentType;
        }
    } catch (metaError) {
        console.warn(`Could not get metadata for ${gcsPath}, falling back to mime-type guess:`, metaError);
    }

    // Create a pass-through stream to pipe the GCS read stream to the response
    const stream = new PassThrough();

    // Start streaming the file from GCS
    const gcsStream = file.createReadStream();

    // Handle errors during the GCS stream
    gcsStream.on('error', (err) => {
      console.error(`Error streaming file from GCS: ${gcsPath}`, err);
      stream.emit('error', err); // Propagate the error to the response stream
    });

    // Pipe the GCS stream to our pass-through stream
    gcsStream.pipe(stream);

    // Return the stream as the response body
    // Note: NextResponse automatically handles ReadableStream types
    return new NextResponse(stream as unknown as ReadableStream<Uint8Array>, { // Changed to unknown as ReadableStream<Uint8Array>
      status: 200,
      headers: {
        'Content-Type': contentType,
        // Add cache control headers if desired, e.g., 'Cache-Control': 'public, max-age=3600'
      },
    });

  } catch (error: unknown) { // Changed to unknown
    console.error(`Error fetching file ${gcsPath} for project ${projectId}:`, error);
    const message = error instanceof Error ? error.message : 'Failed to fetch file';
    return NextResponse.json({ error: 'Failed to fetch file', details: message }, { status: 500 });
  }
} 