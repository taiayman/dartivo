'use client';

import React from 'react';
import { FileText, Search, Loader2, Check, AlertTriangle } from 'lucide-react'; // Added AlertTriangle

// Tool execution states
export type ToolStatus = 'pending' | 'running' | 'completed' | 'error';

// --- Updated Interface for Tool Info ---
// Represents the information needed to render a tool card,
// combining aspects of the AI's call and the execution result.
export interface RenderableToolInfo {
  id: string; // Unique ID for the tool call (e.g., tool_call_id from AI)
  functionName: string; // e.g., 'read_file'
  functionArgs: Record<string, unknown>; // Parsed arguments e.g., { filename: "src/app.ts" }
  status: ToolStatus; // 'pending', 'running', 'completed', 'error'
  resultJsonString?: string; // Raw JSON string result '{"success":true,...}' or '{"success":false,...}'
}

interface ToolCardProps {
  tool: RenderableToolInfo; // Use the new interface
}

export default function ToolCard({ tool }: ToolCardProps) {

  // --- Tool Icon ---
  const getToolIcon = () => {
    switch (tool.functionName) {
      case 'read_file':
        return <FileText size={14} className="mr-1.5 flex-shrink-0" />;
      case 'search_files': // Anticipate search_files
        return <Search size={14} className="mr-1.5 flex-shrink-0" />;
      default:
        return <FileText size={14} className="mr-1.5 flex-shrink-0" />; // Default icon
    }
  };

  // --- Tool Title (using parsed args) ---
  const getToolTitle = () => {
    switch (tool.functionName) {
      case 'read_file':
        const filename = tool.functionArgs?.filename || '[unknown file]';
        return `Reading file: ${filename}`;
      case 'search_files':
         const query = tool.functionArgs?.query || '[unknown query]';
         const path = tool.functionArgs?.path || '.';
         return `Searching in "${path}" for: ${query}`;
      default:
        return `Executing tool: ${tool.functionName}`;
    }
  };

  // --- Status Text (Helper) ---
   const getStatusText = () => {
     switch (tool.status) {
       case 'pending': return 'Pending';
       case 'running': return 'Running';
       case 'completed': return 'Completed';
       case 'error': return 'Error';
       default: return '';
     }
   };

  // --- Status Icon (Helper) ---
   const getStatusIcon = () => {
     switch (tool.status) {
       case 'pending': return null;
       case 'running': return <Loader2 size={14} className="animate-spin ml-1.5" />;
       case 'completed': return <Check size={14} className="text-green-500 ml-1.5" />;
       case 'error': return <AlertTriangle size={14} className="text-red-500 ml-1.5" />; // Use AlertTriangle for error
       default: return null;
     }
   };

  // --- Parse Result and Determine Final State ---
  let displayContent: string | null = null;
  let displayError: string | null = null;
  let isFinalErrorState = tool.status === 'error'; // Start assuming error if status is error

  if (tool.status === 'completed' || tool.status === 'error') {
      if (tool.resultJsonString) {
          try {
              const parsedResult = JSON.parse(tool.resultJsonString);
              if (parsedResult.success === true && parsedResult.content !== undefined) {
                  // Success case
                  displayContent = typeof parsedResult.content === 'string'
                      ? parsedResult.content
                      : JSON.stringify(parsedResult.content, null, 2); // Pretty print if content is object/array
                  isFinalErrorState = false; // Mark as success
              } else if (parsedResult.success === false && parsedResult.error !== undefined) {
                  // Explicit failure case from tool execution
                  displayError = typeof parsedResult.error === 'string'
                      ? parsedResult.error
                      : JSON.stringify(parsedResult.error, null, 2);
                  isFinalErrorState = true; // Mark as error
              } else {
                  // Parsed successfully, but unexpected structure
                  console.warn("Parsed tool result has unexpected structure:", parsedResult);
                  displayError = `Unexpected result format:\n${tool.resultJsonString}`;
                  isFinalErrorState = true; // Treat unexpected structure as error
              }
          } catch (e) {
              // JSON parsing failed
              console.error("Failed to parse tool result JSON:", e);
              displayError = `Invalid result format (not JSON):\n${tool.resultJsonString}`;
              isFinalErrorState = true; // Treat parse failure as error
          }
      } else {
          // Handle cases where status is 'completed' or 'error' but there's no resultJsonString
          // This block is reached if the outer 'if' is true, but 'if (tool.resultJsonString)' is false.
          displayError = `Tool ${tool.status}, but no result data received.`;
          isFinalErrorState = true; // Treat missing result as error
      }
  }

  // --- Determine Background Color based on Final State ---
   const getBackgroundColor = () => {
     if (isFinalErrorState) return 'bg-red-900/20'; // Error state takes precedence
     switch (tool.status) {
       case 'pending': return 'bg-gray-800';
       case 'running': return 'bg-blue-900/30';
       case 'completed': return 'bg-green-900/20';
       // 'error' case handled by isFinalErrorState check above
       default: return 'bg-gray-800';
     }
   };

  // --- Determine Final Status Text/Icon ---
  const finalStatusText = isFinalErrorState ? 'Error' : getStatusText();
  // Use specific error icon if it's an error, otherwise use status-based icon
  const finalStatusIcon = isFinalErrorState ? <AlertTriangle size={14} className="text-red-500 ml-1.5" /> : getStatusIcon();

  // --- Render ---
  return (
    <div className={`mb-2 rounded-md border border-white/10 ${getBackgroundColor()} overflow-hidden text-sm`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 text-xs">
        <div className="flex items-center min-w-0"> {/* Added min-w-0 for truncation */}
          {getToolIcon()}
          <span className="truncate" title={getToolTitle()}>{getToolTitle()}</span>
        </div>
        <div className="flex items-center text-xs opacity-80 flex-shrink-0 pl-2">
          <span>{finalStatusText}</span>
          {finalStatusIcon}
        </div>
      </div>
      {/* Body (Content or Error) */}
      {displayContent !== null && (
        <div className="px-3 py-2 text-xs overflow-auto max-h-[200px] bg-black/30">
          <pre className="whitespace-pre-wrap font-mono text-gray-300">{displayContent}</pre>
        </div>
      )}
      {displayError !== null && (
        <div className="px-3 py-2 text-xs overflow-auto max-h-[200px] bg-black/30">
          <pre className="whitespace-pre-wrap font-mono text-red-400">{displayError}</pre>
        </div>
      )}
    </div>
  );
}