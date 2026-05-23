import { readFileTool, ReadFileToolParams, ReadFileConfig } from './read-file-tool';

// Tool execution result interface
export interface ToolExecutionResult {
  success: boolean;
  result?: string;
  error?: string;
  toolName: string;
  toolId?: string;
}

// Tool call interface (matches Anthropic's format)
export interface ToolCall {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, any>;
}

// Tool result interface (for sending back to AI)
export interface ToolResult {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

// Main tool execution handler
export async function executeToolCall(
  toolCall: ToolCall,
  projectId?: string
): Promise<ToolExecutionResult> {
  const { name, input, id } = toolCall;
  
  console.log(`🔧 Executing tool: ${name} with input:`, input);
  
  try {
    switch (name) {
      case 'read_file':
        return await executeReadFileTool(input, id, projectId);
      
      case 'edit_file':
        return await executeEditFileTool(input, id, projectId);
      
      default:
        return {
          success: false,
          error: `Unknown tool: ${name}`,
          toolName: name,
          toolId: id,
        };
    }
  } catch (error) {
    console.error(`Error executing tool ${name}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      toolName: name,
      toolId: id,
    };
  }
}

// Execute read_file tool
async function executeReadFileTool(
  input: Record<string, any>,
  toolId: string,
  projectId?: string
): Promise<ToolExecutionResult> {
  try {
    // Validate input parameters
    if (!input.path || typeof input.path !== 'string') {
      return {
        success: false,
        error: 'Missing or invalid required parameter: path',
        toolName: 'read_file',
        toolId,
      };
    }

    if (!projectId) {
      return {
        success: false,
        error: 'Project ID is required for reading files',
        toolName: 'read_file',
        toolId,
      };
    }

    // Build query parameters for the API call
    const params = new URLSearchParams();
    params.append('path', input.path);
    if (input.start_line) params.append('start_line', String(input.start_line));
    if (input.end_line) params.append('end_line', String(input.end_line));
    
    // Construct absolute URL for edge runtime compatibility
    let baseUrl: string;
    
    if (process.env.VERCEL_URL) {
      // Production on Vercel
      baseUrl = `https://${process.env.VERCEL_URL}`;
    } else if (process.env.NEXTAUTH_URL) {
      // Use NEXTAUTH_URL if available
      baseUrl = process.env.NEXTAUTH_URL;
    } else {
      // Local development fallback
      baseUrl = 'http://localhost:3000';
    }
    
    const apiUrl = `${baseUrl}/api/projects/${projectId}/files/read?${params.toString()}`;
    
    console.log(`🌐 Making API call to:`, apiUrl);

    // Make API call to read file from Cloud Storage
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API Error: ${response.status}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorMessage;
      } catch {
        errorMessage += ` - ${errorText}`;
      }
      
      return {
        success: false,
        error: errorMessage,
        toolName: 'read_file',
        toolId,
      };
    }

    const result = await response.text();
    console.log(`✅ read_file tool executed successfully for: ${input.path}`);
    
    return {
      success: true,
      result,
      toolName: 'read_file',
      toolId,
    };
    
  } catch (error) {
    console.error('Error in executeReadFileTool:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      toolName: 'read_file',
      toolId,
    };
  }
}

// Execute edit_file tool
async function executeEditFileTool(
  input: Record<string, any>,
  toolId: string,
  projectId?: string
): Promise<ToolExecutionResult> {
  try {
    // Validate input parameters
    if (!input.path || typeof input.path !== 'string') {
      return {
        success: false,
        error: 'Missing or invalid required parameter: path',
        toolName: 'edit_file',
        toolId,
      };
    }

    if (!input.content || typeof input.content !== 'string') {
      return {
        success: false,
        error: 'Missing or invalid required parameter: content',
        toolName: 'edit_file',
        toolId,
      };
    }

    if (!projectId) {
      return {
        success: false,
        error: 'Project ID is required for editing files',
        toolName: 'edit_file',
        toolId,
      };
    }

    // Construct absolute URL for edge runtime compatibility
    let baseUrl: string;
    
    if (process.env.VERCEL_URL) {
      // Production on Vercel
      baseUrl = `https://${process.env.VERCEL_URL}`;
    } else if (process.env.NEXTAUTH_URL) {
      // Use NEXTAUTH_URL if available
      baseUrl = process.env.NEXTAUTH_URL;
    } else {
      // Local development fallback
      baseUrl = 'http://localhost:3000';
    }
    
    const apiUrl = `${baseUrl}/api/projects/${projectId}/files/edit`;
    
    console.log(`🌐 Making API call to:`, apiUrl);

    // Make API call to create/edit file in Cloud Storage
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: input.path,
        content: input.content,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API Error: ${response.status}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorMessage;
      } catch {
        errorMessage += ` - ${errorText}`;
      }
      
      return {
        success: false,
        error: errorMessage,
        toolName: 'edit_file',
        toolId,
      };
    }

    const result = await response.text();
    console.log(`✅ edit_file tool executed successfully for: ${input.path}`);
    
    return {
      success: true,
      result: JSON.stringify({
        message: `File ${input.path} has been successfully created/edited.`,
        filePath: input.path,
        action: 'edit_file'
      }),
      toolName: 'edit_file',
      toolId,
    };
    
  } catch (error) {
    console.error('Error in executeEditFileTool:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      toolName: 'edit_file',
      toolId,
    };
  }
}

// Parse tool calls from streaming response
export function parseToolCallsFromChunk(chunk: string): ToolCall[] {
  const toolCalls: ToolCall[] = [];
  
  try {
    // Look for tool_use blocks in the chunk
    const toolUseRegex = /<tool_use>\s*<name>([^<]+)<\/name>\s*<input>([^<]*)<\/input>\s*<\/tool_use>/g;
    let match;
    
    while ((match = toolUseRegex.exec(chunk)) !== null) {
      const [, name, inputStr] = match;
      
      try {
        // Parse input as JSON or create simple object
        let input: Record<string, any> = {};
        
        if (inputStr.trim()) {
          try {
            input = JSON.parse(inputStr);
          } catch {
            // If not JSON, try to parse as simple key-value pairs
            const keyValueRegex = /(\w+):\s*([^,\n]+)/g;
            let kvMatch;
            while ((kvMatch = keyValueRegex.exec(inputStr)) !== null) {
              const [, key, value] = kvMatch;
              input[key] = value.trim().replace(/['"]/g, '');
            }
          }
        }
        
        toolCalls.push({
          type: 'tool_use',
          id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: name.trim(),
          input,
        });
      } catch (parseError) {
        console.warn('Failed to parse tool input:', parseError);
      }
    }
    
    // Also look for XML-style tool calls
    const xmlToolRegex = /<(\w+)>\s*<path>([^<]+)<\/path>(?:\s*<start_line>([^<]+)<\/start_line>)?(?:\s*<end_line>([^<]+)<\/end_line>)?\s*<\/\1>/g;
    
    while ((match = xmlToolRegex.exec(chunk)) !== null) {
      const [, toolName, path, startLine, endLine] = match;
      
      if (toolName === 'read_file') {
        const input: Record<string, any> = { path };
        if (startLine) input.start_line = startLine;
        if (endLine) input.end_line = endLine;
        
        toolCalls.push({
          type: 'tool_use',
          id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: toolName,
          input,
        });
      }
    }
    
  } catch (error) {
    console.warn('Error parsing tool calls from chunk:', error);
  }
  
  return toolCalls;
}

// Convert tool execution result to tool result format
export function createToolResult(execution: ToolExecutionResult): ToolResult {
  return {
    type: 'tool_result',
    tool_use_id: execution.toolId || 'unknown',
    content: execution.success ? (execution.result || '') : `Error: ${execution.error}`,
    is_error: !execution.success,
  };
}

// Batch execute multiple tool calls
export async function executeToolCalls(
  toolCalls: ToolCall[],
  projectId?: string
): Promise<ToolExecutionResult[]> {
  const results: ToolExecutionResult[] = [];
  
  // Execute tools sequentially to avoid overwhelming the system
  for (const toolCall of toolCalls) {
    const result = await executeToolCall(toolCall, projectId);
    results.push(result);
  }
  
  return results;
} 