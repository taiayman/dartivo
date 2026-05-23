import { NextRequest, NextResponse } from 'next/server';

export async function GET(
    request: NextRequest, 
    { params }: { params: Promise<{ projectId: string; buildId: string }> }
) {
    const resolvedParams = await params;
    const { projectId, buildId } = resolvedParams;

    console.log(`API (Build Status): Received status request for Project ${projectId}, Build ${buildId} (from flutter-builder-service).`);

    // Since the flutter-builder-service build is synchronous from the perspective of the
    // /api/projects/[projectId]/build route that called it, if we are polling for status here,
    // it implies the initial call to the builder service (and thus the build itself) was successful.
    // If the initial call had failed, the frontend wouldn't have received a buildId to poll with.

        return NextResponse.json({
            projectId,
            buildId,
        status: 'SUCCESS',
        statusDetail: 'Build completed successfully by flutter-builder-service.',
        logUrl: null, // No direct equivalent Cloud Build log URL for this flow
        logs: 'Build logs are available in the flutter-builder-service Cloud Run logs.',
    });
}
