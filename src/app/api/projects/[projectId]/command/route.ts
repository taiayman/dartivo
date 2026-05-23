import { NextResponse, type NextRequest } from 'next/server';
// Removed unused util imports - Assuming service is public and URL is via env var

// --- Configuration ---

// No longer caching URL here as it depends on env var

export const dynamic = 'force-dynamic'; // Ensure the route is dynamic

// Handles POST requests to run a validated command on the build service
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> } // Wrap params type in Promise<>
) {
  // const { projectId } = params; // Old way
  const awaitedParams = await params; // Await the promise
  const { projectId } = awaitedParams; // Destructure from awaited object

  if (!projectId) {
    return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
  }

  let command: string;
  try {
    const body = await request.json();
    command = body.command;
    if (typeof command !== 'string' || !command.trim()) {
      throw new Error('Invalid command format');
    }
    command = command.trim(); // Use the trimmed command
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // --- Security Validation ---
  // MODIFIED: Allow any command starting with 'flutter '
  if (!command.startsWith('flutter ')) { 
      console.warn(`Command rejected (not allowed): ${command} for project ${projectId}`);
      // Keep error message generic for security
      return NextResponse.json({ error: `Command not allowed.` }, { status: 403 }); // Forbidden
  }
  // --- End Security Validation ---

  console.log(`API: Received validated command request for project ${projectId}: ${command}`);

  try {
    // --- Get Cloud Run URL from Environment Variable ---
    const cloudRunUrl = process.env.REACT_BUILDER_SERVICE_URL; 
    if (!cloudRunUrl) {
        console.error("API: Environment variable REACT_BUILDER_SERVICE_URL is not set.");
        throw new Error('Cloud Run service URL is not configured.');
    }
    // --- End Get Cloud Run URL ---

    // Removed auth token logic as service is assumed public

    // Construct the target URL for the Cloud Run command endpoint
    const targetUrl = `${cloudRunUrl}/command`; 

    console.log(`API: Forwarding command '${command}' to ${targetUrl}`);

    // Call the Cloud Run service (no Authorization header needed)
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        // Removed Authorization header
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ projectId, command }), // Send projectId and command
    });

    // Handle Cloud Run response
    const result = await response.json();

    if (!response.ok) {
        console.error(`API: Cloud Run command execution failed (${response.status}):`, result);
        throw new Error(result.error || `Command execution service failed with status ${response.status}`);
    }

    console.log(`API: Cloud Run command execution successful for ${projectId}. Output length: ${result.output?.length ?? 0}`);
    
    // Return the output from the Cloud Run service
    return NextResponse.json({ output: result.output });

  } catch (error: unknown) { // Changed from any to unknown
    console.error(`API: Error forwarding command for project ${projectId}:`, error);
    const message = error instanceof Error ? error.message : 'Failed to run command';
    return NextResponse.json({ error: 'Failed to run command', details: message }, { status: 500 });
  }
}

// Removed Placeholder functions 