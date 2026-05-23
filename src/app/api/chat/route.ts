import { NextRequest, NextResponse } from 'next/server';
import { executeToolCall, createToolResult, parseToolCallsFromChunk } from '@/lib/tool-execution';

export const runtime = 'edge'; // Keep edge runtime

// Enhanced system prompt with read_file and edit_file tools
const SYSTEM_PROMPT = `You are a helpful AI assistant for a Flutter development environment with file editing capabilities.

You have access to these tools:
- read_file: Read file contents
- edit_file: Create or modify files

CRITICAL RULES:
1. When user asks to edit/modify/change/update any file: IMMEDIATELY use the edit_file tool with the complete new file content
2. When user asks to read a file: IMMEDIATELY use the read_file tool
3. NEVER just describe what you would do - ALWAYS execute the actual tool
4. After reading a file, if editing is requested, IMMEDIATELY call edit_file
5. Do NOT ask for permission - just execute the tools when requested

WORKFLOW:
- Read request → use read_file tool
- Edit request → use edit_file tool with complete file content
- NO explanations without tool execution
- NO "I would do X" - just DO X

You MUST use tools when requested. No exceptions.`;

// Tool definitions for Anthropic API
const TOOLS = [
  {
    name: "read_file",
    description: "Read file contents with optional line range specification. Returns file content with line numbers for easy reference.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path relative to project root"
        },
        start_line: {
          type: "string",
          description: "Starting line number (1-based, optional)"
        },
        end_line: {
          type: "string",
          description: "Ending line number (1-based, inclusive, optional)"
        }
      },
      required: ["path"]
    }
  },
  {
    name: "edit_file",
    description: "Edit or create a file with the provided content. Can create new files or overwrite existing ones.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path relative to project root"
        },
        content: {
          type: "string",
          description: "The complete file content to write"
        }
      },
      required: ["path", "content"]
    }
  }
];

// Reusable function to process streams with tool detection
async function processStreamWithTools(
  response: Response,
  projectId: string,
  controller: ReadableStreamDefaultController,
  messages: any[],
  sendData: (data: any) => void,
  anthropicUrl: string,
  apiKey: string,
  anthropicVersion: string
): Promise<void> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  
  let toolCalls: Array<{ id: string; name: string; input: string }> = [];
  let currentToolCall: { id: string; name: string; input: string } | null = null;
  let toolsDetected = false;
  
  while (true) {
    const { done, value } = await reader.read();
    
    if (done) {
      if (toolsDetected && toolCalls.length > 0) {
        console.log('🔧 Processing detected tools:', toolCalls.map(tc => tc.name));
        
        // Execute all tools
        const toolResults = [];
        for (const toolCall of toolCalls) {
          try {
            const toolInput = JSON.parse(toolCall.input);
            const result = await executeToolCall({
              type: 'tool_use',
              id: toolCall.id,
              name: toolCall.name,
              input: toolInput,
            }, projectId);
            
            sendData({
              type: 'tool_execution',
              tool: toolCall.name,
              status: 'completed',
              tool_id: toolCall.id,
              result: result.result
            });
            
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolCall.id,
              content: result.success ? result.result || '' : `Error: ${result.error}`,
              is_error: !result.success,
            });
          } catch (error) {
            console.error('Error executing tool:', error);
            sendData({
              type: 'tool_execution',
              tool: toolCall.name,
              status: 'error',
              tool_id: toolCall.id,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
        
        // Make follow-up request with tool results
        const followUpMessages = [
          ...messages,
          {
            role: 'assistant',
            content: toolCalls.map(tc => ({
              type: 'tool_use',
              id: tc.id,
              name: tc.name,
              input: JSON.parse(tc.input)
            }))
          },
          {
            role: 'user',
            content: toolResults
          }
        ];
        
        const followUpBody = {
          model: "claude-3-5-sonnet-20241022",
          system: SYSTEM_PROMPT,
          messages: followUpMessages,
          tools: TOOLS,
          max_tokens: 8192,
          stream: true,
        };
        
        console.log('🔄 Making follow-up request with tool results...');
        
        const followUpResponse = await fetch(anthropicUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': anthropicVersion,
          },
          body: JSON.stringify(followUpBody),
        });
        
        if (followUpResponse.ok && followUpResponse.body) {
          // Recursively process the follow-up stream
          await processStreamWithTools(
            followUpResponse,
            projectId,
            controller,
            followUpMessages,
            sendData,
            anthropicUrl,
            apiKey,
            anthropicVersion
          );
          return;
        }
      }
      
      controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
      controller.close();
      break;
    }
    
    // Process chunks
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (!data || data === '[DONE]') continue;
        
        try {
          const parsed = JSON.parse(data);
          
          // Tool detection logic
          if (parsed.type === 'content_block_start' && parsed.content_block?.type === 'tool_use') {
            toolsDetected = true;
            currentToolCall = {
              id: parsed.content_block.id,
              name: parsed.content_block.name,
              input: '',
            };
            
            sendData({
              type: 'tool_execution',
              tool: parsed.content_block.name,
              status: 'started',
              tool_id: parsed.content_block.id
            });
            
            sendData(parsed);
          } else if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'input_json_delta') {
            if (currentToolCall) {
              currentToolCall.input += parsed.delta.partial_json || '';
            }
            sendData(parsed);
          } else if (parsed.type === 'content_block_stop' && currentToolCall) {
            toolCalls.push(currentToolCall);
            currentToolCall = null;
            sendData(parsed);
          } else {
            sendData(parsed);
          }
        } catch (parseError) {
          controller.enqueue(value);
        }
      } else if (line.trim()) {
        controller.enqueue(new TextEncoder().encode(line + '\n'));
      }
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { messages, projectId } = await req.json();

    // Input validation
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Invalid request body: messages array is required.' }, { status: 400 });
    }

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required.' }, { status: 400 });
    }

    // Check for Anthropic API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("ANTHROPIC_API_KEY is not set in environment variables.");
      return NextResponse.json({ error: 'API key not configured.' }, { status: 500 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const anthropicUrl = 'https://api.anthropic.com/v1/messages';
    const anthropicVersion = '2023-06-01';

    // Filter messages
    const userAndAssistantMessages = messages
      .filter(msg => (msg.role === 'user' || msg.role === 'assistant') && msg.content)
      .map(msg => ({
        role: msg.role,
        content: msg.content
      }));

    const requestBody = {
      model: "claude-3-5-sonnet-20241022",
      system: SYSTEM_PROMPT,
      messages: userAndAssistantMessages,
      tools: TOOLS,
      max_tokens: 8192,
      stream: true,
    };

    console.log("Sending stream request to Anthropic API with tools support...");

    const response = await fetch(anthropicUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': anthropicVersion,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`Anthropic API Error (${response.status}):`, errorData);
      return NextResponse.json({ error: errorData.error?.message || 'Anthropic API request failed' }, { status: response.status });
    }

    if (!response.body) {
      return NextResponse.json({ error: 'Missing response body from Anthropic stream.' }, { status: 500 });
    }

    // Use the new recursive function
    const stream = new ReadableStream({
      async start(controller) {
        const sendData = (data: any) => {
          const chunk = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(new TextEncoder().encode(chunk));
        };

        try {
          await processStreamWithTools(
            response,
            projectId,
            controller,
            userAndAssistantMessages,
            sendData,
            anthropicUrl,
            apiKey,
            anthropicVersion
          );
        } catch (error) {
          console.error('Error in streaming:', error);
          const errorData = `data: ${JSON.stringify({
            type: 'error',
            error: error instanceof Error ? error.message : 'Stream error'
          })}\n\n`;
          controller.enqueue(new TextEncoder().encode(errorData));
          controller.error(error);
        }
      }
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: unknown) {
    console.error("Error in /api/chat handler:", error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}