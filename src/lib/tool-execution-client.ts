// Client-side tool execution that makes API calls
// This version doesn't import Node.js modules

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

// Main tool execution handler (client-side)
export async function executeToolCall(
  toolCall: ToolCall,
  projectId?: string
): Promise<ToolExecutionResult> {
  const { name, input, id } = toolCall;
  
  console.log(`🔧 Executing tool: ${name} with input:`, input);
  
  try {
    switch (name) {
      case 'read_file':
        return await executeReadFileToolClient(input, id, projectId);
      
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

// Execute read_file tool via API call
async function executeReadFileToolClient(
  input: Record<string, any>,
  toolId: string,
  projectId?: string
): Promise<ToolExecutionResult> {
  try {
    console.log(`🔧 [DEBUG] executeReadFileToolClient called with:`, {
      input,
      toolId,
      projectId
    });

    // Validate input parameters
    if (!input.path || typeof input.path !== 'string') {
      console.error(`❌ [DEBUG] Invalid path parameter:`, input.path);
      return {
        success: false,
        error: 'Missing or invalid required parameter: path',
        toolName: 'read_file',
        toolId,
      };
    }

    // Validate projectId is available
    if (!projectId) {
      console.error(`❌ [DEBUG] Missing projectId`);
      return {
        success: false,
        error: 'Project ID is required for reading files',
        toolName: 'read_file',
        toolId,
      };
    }

    // Use the new read API endpoint that returns formatted XML
    const params = new URLSearchParams();
    params.append('path', input.path);
    if (input.start_line) params.append('start_line', String(input.start_line));
    if (input.end_line) params.append('end_line', String(input.end_line));
    
    const apiUrl = `/api/projects/${projectId}/files/read?${params.toString()}`;
    
    console.log(`🌐 [DEBUG] Making API call to:`, apiUrl);

    // Make API call to read file with tool formatting
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    console.log(`📡 [DEBUG] API response status:`, response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [DEBUG] API error response:`, errorText);
      
      let errorMessage = `API Error: ${response.status}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error) {
          errorMessage += ` - ${errorJson.error}`;
        }
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

    // The /read endpoint returns properly formatted XML, so we can use it directly
    const result = await response.text();
    console.log(`✅ [DEBUG] read_file tool completed successfully for: ${input.path}`);
    
    return {
      success: true,
      result,
      toolName: 'read_file',
      toolId,
    };
    
  } catch (error) {
    console.error('❌ [DEBUG] Error in executeReadFileToolClient:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      toolName: 'read_file',
      toolId,
    };
  }
}

// Parse tool calls from streaming response
export function parseToolCallsFromChunk(chunk: string): ToolCall[] {
  const toolCalls: ToolCall[] = [];
  
  // Debug: Log what we're trying to parse
  console.log('🔍 parseToolCallsFromChunk called with chunk length:', chunk.length);
  if (chunk.includes('read_file') || chunk.includes('<') || chunk.includes('tool')) {
    console.log('🔍 Chunk contains potential tool content:', chunk.substring(0, 300));
  }
  
  try {
    // Look for tool_use blocks in the chunk
    const toolUseRegex = /<tool_use>\s*<name>([^<]+)<\/name>\s*<input>([^<]*)<\/input>\s*<\/tool_use>/g;
    let match;
    
    while ((match = toolUseRegex.exec(chunk)) !== null) {
      console.log('🔍 Found tool_use block:', match[0]);
      const [, name, inputStr] = match;
      
      try {
        // Parse input as JSON or create simple object
        let input: Record<string, any> = {};
        
        if (inputStr.trim()) {
          try {
            // Validate JSON before parsing
            if (inputStr.trim().startsWith('{') && inputStr.trim().endsWith('}')) {
              input = JSON.parse(inputStr);
            } else {
              // If not JSON, try to parse as simple key-value pairs
              const keyValueRegex = /(\w+):\s*([^,\n]+)/g;
              let kvMatch;
              while ((kvMatch = keyValueRegex.exec(inputStr)) !== null) {
                const [, key, value] = kvMatch;
                input[key] = value.trim().replace(/['"]/g, '');
              }
            }
          } catch (jsonError) {
            console.warn('Failed to parse tool input as JSON, trying key-value parsing:', jsonError);
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
        console.warn('Problematic input string:', inputStr);
      }
    }
    
    // Also look for XML-style tool calls
    const xmlToolRegex = /<(\w+)>\s*<path>([^<]+)<\/path>(?:\s*<start_line>([^<]+)<\/start_line>)?(?:\s*<end_line>([^<]+)<\/end_line>)?\s*<\/\1>/g;
    
    while ((match = xmlToolRegex.exec(chunk)) !== null) {
      console.log('🔍 Found XML tool call:', match[0]);
      const [, toolName, path, startLine, endLine] = match;
      
      if (toolName === 'read_file') {
        const input: Record<string, any> = { path: path.trim() };
        if (startLine) input.start_line = startLine.trim();
        if (endLine) input.end_line = endLine.trim();
        
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
    console.warn('Problematic chunk (first 500 chars):', chunk.substring(0, 500));
  }
  
  console.log('🔍 parseToolCallsFromChunk returning', toolCalls.length, 'tool calls');
  return toolCalls;
}

// Parse tool calls from XML format in streaming response
export function parseToolCallsFromXML(content: string): ToolCall[] {
  const toolCalls: ToolCall[] = [];
  
  // Look for read_file XML tags
  const readFileRegex = /<read_file>\s*<path>([^<]+)<\/path>(?:\s*<start_line>([^<]+)<\/start_line>)?(?:\s*<end_line>([^<]+)<\/end_line>)?\s*<\/read_file>/g;
  
  let match;
  while ((match = readFileRegex.exec(content)) !== null) {
    const [, path, startLine, endLine] = match;
    
    const input: Record<string, any> = { path: path.trim() };
    if (startLine) input.start_line = startLine.trim();
    if (endLine) input.end_line = endLine.trim();
    
    toolCalls.push({
      type: 'tool_use',
      id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: 'read_file',
      input,
    });
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