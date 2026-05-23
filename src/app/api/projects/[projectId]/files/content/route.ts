import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '../../../../../../firebase/adminConfig'; 

export const runtime = 'nodejs'; 

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) { 
  const awaitedParams = await params;
  const projectId = awaitedParams.projectId;
  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get('path'); // Path relative to project root (e.g., lib/main.dart)

  if (!projectId) {
    return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
  }
  if (!filePath) {
    return NextResponse.json({ error: 'File path query parameter is required' }, { status: 400 });
  }

  // Decode the file path just in case it has encoded characters
  const decodedFilePath = decodeURIComponent(filePath);
  const fullStoragePath = `projects/${projectId}/files/${decodedFilePath}`; // Construct full path

  console.log(`Fetching content for file: ${fullStoragePath}`);

  try {
    const bucket = adminStorage.bucket(); // Use configured bucket
    const file = bucket.file(fullStoragePath);

    // Check if the file exists in storage
    const [exists] = await file.exists();
    if (!exists) {
      console.log(`File not found in Cloud Storage: ${fullStoragePath}`);
      return NextResponse.json({ error: `Content not found for file: ${decodedFilePath}` }, { status: 404 });
    }

    // Download the file content
    const [contentBuffer] = await file.download();
    const fileContent = contentBuffer.toString('utf-8'); // Assuming UTF-8 content

    console.log(`Successfully fetched content from Storage for file: ${fullStoragePath}`);

    // Return the content as plain text
    return new Response(fileContent, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }, // Specify charset
    });

  } catch (error: unknown) {
    console.error(`Error fetching file content from Storage for ${fullStoragePath}:`, error);
    // Provide a more specific error message if possible
    const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve file content from storage.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest, 
  { params }: { params: Promise<{ projectId: string }> }
) {
  const awaitedParams = await params;
  const { projectId } = awaitedParams;
  const searchParams = request.nextUrl.searchParams;
  const encodedPath = searchParams.get('path');
  let filePath = ''; // Initialize filePath for logging in catch block

  if (!projectId) {
    return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
  }
  if (!encodedPath) {
    return NextResponse.json({ error: 'File path query parameter is required' }, { status: 400 });
  }

  try {
    filePath = decodeURIComponent(encodedPath);
    const { content } = await request.json();

    if (typeof content !== 'string') {
      return NextResponse.json({ error: 'Invalid request body: content must be a string' }, { status: 400 });
    }

    // Basic path validation
    if (filePath.includes('..')) {
        return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }

    // --- Firestore Read-Modify-Write Logic ---
    const projectDocRef = adminDb.collection('projects').doc(projectId);
    const projectDocSnap = await projectDocRef.get();

    if (!projectDocSnap.exists) {
        console.error(`Project document ${projectId} not found.`);
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get current fileContents map or initialize if it doesn't exist
    const currentFileContents = projectDocSnap.data()?.fileContents || {};

    // Update the specific file path within the map
    currentFileContents[filePath] = content;

    // Update the entire fileContents map in Firestore
    await projectDocRef.update({
        fileContents: currentFileContents
    });

    console.log(`File content updated successfully in Firestore for: ${filePath} in project ${projectId}`);
    return NextResponse.json({ message: 'File saved successfully to Firestore' }, { status: 200 });

  } catch (error: unknown) {
    console.error(`Error saving file to Firestore for project ${projectId}, path ${filePath}:`, error);
    if (error instanceof SyntaxError) {
      // JSON parsing error
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    } 
    // Removed specific checks for error codes 5 and path errors as read-modify-write handles them differently
    else {
        const message = error instanceof Error ? error.message : 'Internal Server Error saving file to Firestore';
        return NextResponse.json({ error: 'Internal ServerError saving file to Firestore', details: message }, { status: 500 });
    }
  }
} 