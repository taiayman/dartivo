import { NextRequest, NextResponse } from 'next/server';
// Removed: import { Storage } from '@google-cloud/storage';
// Removed: import { CloudBuildClient } from '@google-cloud/cloudbuild';

const FLUTTER_BUILDER_SERVICE_URL = process.env.FLUTTER_BUILDER_SERVICE_URL || 'https://flutter-builder-service-545076060902.us-central1.run.app'; // Fallback to direct URL if ENV var not set

// Removed GCS client, CloudBuildClient, SENTINEL_FILE_NAME, etc. as they are no longer needed here.
// The sentinel file logic, if still desired, would need to be handled differently or communicated to the builder service.
// For now, we are simplifying to directly call the builder service.

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> } 
) {
    const awaitedParams = await params;
    const projectId = awaitedParams.projectId;

    if (!projectId) {
        return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    if (!FLUTTER_BUILDER_SERVICE_URL) {
        console.error("API (Build): Environment variable FLUTTER_BUILDER_SERVICE_URL is not set and no fallback is configured.");
        return NextResponse.json({ error: 'Flutter builder service URL is not configured.' }, { status: 500 });
    }

    console.log(`API (Build): Received build request for project: ${projectId}. Forwarding to: ${FLUTTER_BUILDER_SERVICE_URL}/build`);

    try {
        const response = await fetch(`${FLUTTER_BUILDER_SERVICE_URL}/build`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ projectId }),
        });

        const result = await response.json(); // Try to parse JSON regardless of status for more info

        if (!response.ok) {
            console.error(`API (Build): Call to flutter-builder-service failed (${response.status}):`, result);
            return NextResponse.json(
                { 
                    error: `Build service failed with status ${response.status}`,
                    details: result.error || result.message || 'No additional details from builder service.'
                },
                { status: response.status }
            );
        }

        console.log(`API (Build): Build request for project ${projectId} forwarded successfully to flutter-builder-service. Response:`, result);
        return NextResponse.json(
            { 
                message: result.message || 'Build successfully triggered by flutter-builder-service.', 
                details: result // Forward the entire response from the builder service
            },
            { status: 202 } // Accepted
        );

    } catch (error) {
        console.error('API (Build): Error forwarding request to flutter-builder-service:', error);
        const errorMessage = 'Failed to forward build request to flutter-builder-service';
        let errorDetails: string | undefined = undefined;

        if (error instanceof Error) {
            errorDetails = error.message;
            console.error('Error stack:', error.stack);
        }

        return NextResponse.json({ error: errorMessage, details: errorDetails || String(error) }, { status: 500 });
    }
}