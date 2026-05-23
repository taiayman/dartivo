import { NextRequest, NextResponse } from 'next/server';
import { readFileTool, ReadFileToolParams, ReadFileConfig } from '@/lib/read-file-tool';
import path from 'path';

export const runtime = 'nodejs'; // Use Node.js runtime for file system access

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { params, config } = body as {
      params: ReadFileToolParams;
      config?: ReadFileConfig;
    };

    // Validate required parameters
    if (!params || !params.path) {
      return NextResponse.json(
        { error: 'Missing required parameter: path' },
        { status: 400 }
      );
    }

    // Set workspace root to the project directory
    const workspaceRoot = process.cwd();
    
    // Configure the tool with default settings
    const toolConfig: ReadFileConfig = {
      maxReadFileLine: 500,
      enableDefinitions: true,
      workspaceRoot,
      ...config, // Allow overrides from request
    };

    // Call the read file tool
    const result = await readFileTool(params, toolConfig);

    // Return the XML result
    return new Response(result, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
      },
    });

  } catch (error: unknown) {
    console.error('Error in readFile API:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    
    // Return error in XML format to maintain consistency
    const errorXml = `<file><path></path><error>API Error: ${message}</error></file>`;
    
    return new Response(errorXml, {
      status: 500,
      headers: {
        'Content-Type': 'application/xml',
      },
    });
  }
}

// GET method for simple file reading (optional convenience method)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get('path');
    const startLine = searchParams.get('start_line');
    const endLine = searchParams.get('end_line');
    const maxLines = searchParams.get('max_lines');

    if (!filePath) {
      return NextResponse.json(
        { error: 'Missing required parameter: path' },
        { status: 400 }
      );
    }

    const params: ReadFileToolParams = {
      path: filePath,
      ...(startLine && { start_line: startLine }),
      ...(endLine && { end_line: endLine }),
    };

    const config: ReadFileConfig = {
      maxReadFileLine: maxLines ? parseInt(maxLines) : 500,
      enableDefinitions: true,
      workspaceRoot: process.cwd(),
    };

    const result = await readFileTool(params, config);

    return new Response(result, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
      },
    });

  } catch (error: unknown) {
    console.error('Error in readFile GET API:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    
    const errorXml = `<file><path></path><error>API Error: ${message}</error></file>`;
    
    return new Response(errorXml, {
      status: 500,
      headers: {
        'Content-Type': 'application/xml',
      },
    });
  }
}