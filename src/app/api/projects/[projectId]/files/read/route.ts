import { NextRequest, NextResponse } from 'next/server';
import { readFileTool, ReadFileToolParams } from '@/lib/read-file-tool';
import { adminStorage } from '../../../../../../firebase/adminConfig';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const resolvedParams = await params;
    const { projectId } = resolvedParams;
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path');
    const startLine = searchParams.get('start_line') || undefined;
    const endLine = searchParams.get('end_line') || undefined;
    
    if (!path) {
      return NextResponse.json({ error: 'Path parameter is required' }, { status: 400 });
    }
    
    // Decode the file path
    const decodedFilePath = decodeURIComponent(path);
    
    // Basic path validation
    if (decodedFilePath.includes('..')) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }
    
    // Check if file exists in Cloud Storage
    const fullStoragePath = `projects/${projectId}/files/${decodedFilePath}`;
    const bucket = adminStorage.bucket();
    const file = bucket.file(fullStoragePath);
    
    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json({ error: `File not found: ${decodedFilePath}` }, { status: 404 });
    }
    
    // Download the file content
    const [contentBuffer] = await file.download();
    const fileContent = contentBuffer.toString('utf-8');
    
    // Apply line range filtering if specified
    let result: string;
    
    if (startLine || endLine) {
      const lines = fileContent.split('\n');
      const totalLines = lines.length;
      
      const start = startLine ? parseInt(startLine) : 1;
      const end = endLine ? parseInt(endLine) : totalLines;
      
      // Validate line numbers
      if (isNaN(start) || start < 1) {
        return NextResponse.json({ error: 'Invalid start_line: must be a positive integer' }, { status: 400 });
      }
      
      if (isNaN(end) || end < 1) {
        return NextResponse.json({ error: 'Invalid end_line: must be a positive integer' }, { status: 400 });
      }
      
      if (start > end) {
        return NextResponse.json({ error: 'Invalid range: start_line must be less than or equal to end_line' }, { status: 400 });
      }
      
      if (start > totalLines) {
        return NextResponse.json({ error: `start_line (${start}) exceeds file length (${totalLines} lines)` }, { status: 400 });
      }
      
      // Extract the specified range (convert to 0-based indexing)
      const effectiveEnd = Math.min(end, totalLines);
      const selectedLines = lines.slice(start - 1, effectiveEnd);
      
      // Add line numbers
      const numberedContent = selectedLines
        .map((line, index) => `${start + index} | ${line}`)
        .join('\n');
      
      // Format as XML
      result = `<file><path>${decodedFilePath}</path>
<content lines="${start}-${effectiveEnd}">
${numberedContent}
</content>
</file>`;
    } else {
      // Return entire file with line numbers
      const lines = fileContent.split('\n');
      const numberedContent = lines
        .map((line, index) => `${index + 1} | ${line}`)
        .join('\n');
      
      result = `<file><path>${decodedFilePath}</path>
<content lines="1-${lines.length}">
${numberedContent}
</content>
</file>`;
    }
    
    return new NextResponse(result, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
    
  } catch (error) {
    console.error('Error reading file:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to read file' },
      { status: 500 }
    );
  }
} 