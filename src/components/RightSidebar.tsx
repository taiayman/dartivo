// src/components/RightSidebar.tsx
'use client';

import React, { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { Send, Square, Paperclip, Loader2, ArrowUp, FileText, FolderOpen, Search, Edit, Plus, Settings, Eye, File, Folder } from 'lucide-react';
import { ChatMessage } from '@/app/projects/[id]/_project_page_shared';
import { parseToolCallsFromXML, executeToolCall } from '@/lib/tool-execution-client';

interface RightSidebarProps {
  initialWidth: number;
  minWidth: number;
  onWidthChange: (newWidth: number) => void;
  
  // Chat-related props
  projectId: string | undefined;
  messages: ChatMessage[];
  isAiResponding: boolean;
  onSendMessage: (userMessageContent: string) => Promise<void>;
  onStopGeneration: () => void;
  currentChatId: string | null;
  isLoadingMessages: boolean;
  isExecutingTool?: boolean;
  currentToolType?: string;
}

export default function RightSidebar({
  initialWidth,
  minWidth,
  onWidthChange,
  projectId,
  messages,
  isAiResponding,
  onSendMessage,
  onStopGeneration,
  currentChatId,
  isLoadingMessages,
  isExecutingTool = false,
  currentToolType,
}: RightSidebarProps) {
  // DEBUG: Log whenever messages change
  useEffect(() => {
    console.log('🎨 RightSidebar messages updated:', {
      messageCount: messages.length,
      isAiResponding,
      isExecutingTool,
      currentToolType,
      lastMessagePreview: messages.length > 0 ? {
        role: messages[messages.length - 1].role,
        contentLength: messages[messages.length - 1].content?.length || 0,
        contentStart: messages[messages.length - 1].content?.substring(0, 100) + '...',
      } : null,
    });
  }, [messages, isAiResponding, isExecutingTool, currentToolType]);

  const [currentWidth, setCurrentWidth] = useState(450); // Always start with default for SSR
  const [inputValue, setInputValue] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const isResizing = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const MAX_TEXTAREA_HEIGHT = 150;
  const [showTopShadow, setShowTopShadow] = useState(false);
  const [showBottomShadow, setShowBottomShadow] = useState(false);

  // Handle client-side hydration and width synchronization
  useEffect(() => {
    // Only run on client side after hydration
    if (typeof window !== 'undefined') {
      setCurrentWidth(initialWidth);
      // Update CSS variable to ensure consistency
      document.documentElement.style.setProperty('--right-sidebar-width', `${initialWidth}px`, 'important');
    }
  }, [initialWidth]);

  // CSS variable is now set before first render in the project page
  // The above useEffect ensures CSS variable stays in sync with component state

  // Resize handler
  const startResizing = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    isResizing.current = true;
    document.body.style.cursor = 'ew-resize';
    const startX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const startWidth = currentWidth;
    let animationFrameId: number | null = null;
    let lastWidth = currentWidth;

    const sidebarElement = document.querySelector('.right-sidebar-component') as HTMLElement | null;
    sidebarElement?.classList.add('resizing');
    if (sidebarElement) {
      sidebarElement.style.setProperty('will-change', 'width');
    }

    const handleMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
      if (!isResizing.current) return;

      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }

      animationFrameId = requestAnimationFrame(() => {
        const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
        const deltaX = startX - currentX;
        const newWidth = Math.max(minWidth, Math.min(600, startWidth + deltaX));

        if (newWidth !== lastWidth) {
          lastWidth = newWidth;
          document.documentElement.style.setProperty('--right-sidebar-width', `${newWidth}px`, 'important');
        }
        animationFrameId = null;
      });
    };

    const handleMouseUp = () => {
      if (!isResizing.current) return;
      isResizing.current = false;
      document.body.style.cursor = '';

      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }

      if (sidebarElement) sidebarElement.style.removeProperty('will-change');
      sidebarElement?.classList.remove('resizing');

      setCurrentWidth(lastWidth);
      onWidthChange(lastWidth);
      
      // Update CSS variable to maintain consistency
      document.documentElement.style.setProperty('--right-sidebar-width', `${lastWidth}px`, 'important');

      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: false });
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleMouseMove, { passive: false });
    window.addEventListener('touchend', handleMouseUp);
    document.body.style.userSelect = 'none';
  }, [currentWidth, minWidth, onWidthChange]);

  // Scroll to bottom when messages change
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle textarea scroll shadows
  const handleTextareaScroll = useCallback(() => {
    if (textareaRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = textareaRef.current;
      const isScrollable = scrollHeight > clientHeight;
      setShowTopShadow(isScrollable && scrollTop > 5);
      setShowBottomShadow(isScrollable && scrollTop + clientHeight < scrollHeight - 5);
    }
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = 'auto';
      
      const currentMinHeight = parseInt(textarea.style.minHeight || '0', 10) || 63;
      let newHeight = Math.max(currentMinHeight, textarea.scrollHeight);
      
      textarea.style.height = `${newHeight}px`;
      handleTextareaScroll();
    }
  }, [inputValue, handleTextareaScroll]);

  // Handle send message
  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isAiResponding) return;
    
    const message = inputValue.trim();
    setInputValue('');
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    
    try {
      await onSendMessage(message);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }, [inputValue, isAiResponding, onSendMessage]);

  // Handle Enter key
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Tool execution loading component
  const ToolExecutionLoader = ({ toolType }: { toolType: string }) => {
    const getToolInfo = (type: string) => {
      switch (type) {
        case 'read_file':
          return { text: 'Reading', icon: Eye };
        case 'list_files':
          return { text: 'Listing', icon: Folder };
        case 'search_files':
          return { text: 'Searching', icon: Search };
        case 'edit_file':
          return { text: 'Editing', icon: Edit };
        case 'create_file':
          return { text: 'Creating', icon: Plus };
        default:
          return { text: 'Processing', icon: Loader2 };
      }
    };

    const { text, icon: Icon } = getToolInfo(toolType);

    return (
      <div className="flex items-center gap-2 text-sm mb-2">
        <Icon size={14} className="text-gray-400" />
        <span className="text-gray-400 animate-pulse">
          {text}...
        </span>
      </div>
    );
  };

  // Render message content
  const renderMessageContent = (message: ChatMessage) => {
    // DEBUG: Log all message rendering
    console.log('🎨 RightSidebar renderMessageContent called for:', {
      role: message.role,
      contentLength: message.content?.length || 0,
      contentPreview: message.content?.substring(0, 100) + '...',
      toolName: message.toolName,
      displayContent: message.displayContent,
      hasXML: message.content?.includes('<') && message.content?.includes('>'),
    });

    // Handle tool messages with icon and text display
    if (message.role === 'tool') {
      // Parse the XML result if it's a read_file response
      if (message.toolName === 'read_file' && message.content?.includes('<file>')) {
        // Extract file path from XML
        const pathMatch = message.content.match(/<path>([^<]+)<\/path>/);
        const filePath = pathMatch ? pathMatch[1] : 'Unknown file';
        
        console.log('🎨 Rendering tool message - read_file:', filePath);
        return (
          <div className="mb-2">
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <File size={14} />
              <span>Read {filePath}</span>
            </div>
          </div>
        );
      }
      
      // Default tool display
      const getToolDisplay = (toolName: string, displayContent: string) => {
        switch (toolName) {
          case 'read_file':
            return `Read ${displayContent.replace('Executed ', '').replace('read_file', '')}`;
          case 'list_files':
            return `Listed ${displayContent.replace('Executed ', '').replace('list_files', '')}`;
          case 'search_files':
            return `Searched ${displayContent.replace('Executed ', '').replace('search_files', '')}`;
          case 'edit_file':
            return `Edited ${displayContent.replace('Executed ', '').replace('edit_file', '')}`;
          case 'create_file':
            return `Created ${displayContent.replace('Executed ', '').replace('create_file', '')}`;
          default:
            return displayContent;
        }
      };

      const text = getToolDisplay(message.toolName || '', message.displayContent || '');
      console.log('🎨 Rendering default tool message:', text);
      
      const getToolIcon = (toolName: string) => {
        switch (toolName) {
          case 'read_file':
            return File;
          case 'list_files':
            return Folder;
          case 'search_files':
            return Search;
          case 'edit_file':
            return Edit;
          case 'create_file':
            return Plus;
          default:
            return File;
        }
      };
      
      const IconComponent = getToolIcon(message.toolName || '');
      
      return (
        <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
          <IconComponent size={14} />
          <span>{text}</span>
        </div>
      );
    }

    // Handle edit proposals with icon and text
    if (message.editProposal) {
      const fileName = message.editProposal.path.split('/').pop() || message.editProposal.path;
      console.log('🎨 Rendering edit proposal:', fileName);
      return (
        <div className="mb-2">
          <div className="flex items-center gap-2 text-orange-400 text-sm mb-1">
            <Edit size={14} />
            <span>Edited {fileName}</span>
          </div>
          {message.content && (
            <p className="text-gray-300 text-sm leading-relaxed">{message.content}</p>
          )}
        </div>
      );
    }

    // Handle create proposals with icon and text
    if (message.createProposal) {
      const fileName = message.createProposal.path.split('/').pop() || message.createProposal.path;
      console.log('🎨 Rendering create proposal:', fileName);
      return (
        <div className="mb-2">
          <div className="flex items-center gap-2 text-green-400 text-sm mb-1">
            <Plus size={14} />
            <span>Created {fileName}</span>
          </div>
          {message.content && (
            <p className="text-gray-300 text-sm leading-relaxed">{message.content}</p>
          )}
        </div>
      );
    }

    // Regular message content - improved XML handling for streaming
    if (message.content) {
      // Check if this message contains XML-like tool calls
      const hasXMLContent = message.content.includes('<') && message.content.includes('>');
      
      if (hasXMLContent) {
        console.log('🎨 Message contains XML-like content, processing...');
        
        // Check for complete tool tags
        const completeToolRegex = /<(read_file|list_files|search_files|edit_file|create_file)[\s\S]*?<\/\1>/g;
        const incompleteToolRegex = /<(read_file|list_files|search_files|edit_file|create_file)(?:[^>]*>(?:(?!<\/\1>)[\s\S])*)?$/;
        
        const isLastMessage = messages[messages.length - 1] === message;
        
        // If this is the last message and AI is responding, check for incomplete tool calls
        if (isLastMessage && isAiResponding) {
          const incompleteMatch = message.content.match(incompleteToolRegex);
          if (incompleteMatch) {
            const toolType = incompleteMatch[1];
            console.log('🎨 Found incomplete tool call, showing loader for:', toolType);
            
            // Extract any text before the incomplete tool call
            const beforeToolIndex = message.content.indexOf(`<${toolType}`);
            const textBeforeTool = beforeToolIndex > 0 ? message.content.substring(0, beforeToolIndex).trim() : '';
            
            return (
              <>
                {textBeforeTool && <div className="mb-2">{textBeforeTool}</div>}
                <ToolExecutionLoader toolType={toolType} />
              </>
            );
          }
        }
        
        // For complete tool calls or non-streaming messages, strip the XML and show content
        let processedContent = message.content;
        
        // Remove complete tool XML blocks
        processedContent = processedContent.replace(completeToolRegex, '');
        
        // Remove any remaining incomplete tool XML
        processedContent = processedContent.replace(incompleteToolRegex, '');
        
        // Clean up extra whitespace
        processedContent = processedContent.trim();
        
        console.log('🎨 Processed content length:', processedContent.length);
        
        // If there's remaining content after XML removal, show it
        if (processedContent) {
          return processedContent;
        }
        
        // If only XML was present and it's been removed, show nothing for this message
        return null;
      }
    }
    
    // Regular message content without XML
    console.log('🎨 Rendering regular message content, length:', message.content?.length || 0);
    return message.content;
  };

  return (
    <aside
      className="right-sidebar-component h-full bg-zinc-950 border-l border-zinc-800 flex-shrink-0 flex flex-col p-4 relative"
      style={{ width: `var(--right-sidebar-width, 450px)` }}
    >
      {/* Resize Handle */}
      <div
        onMouseDown={startResizing}
        onTouchStart={startResizing}
        className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize bg-transparent transition-colors duration-150"
        style={{ transform: 'translateX(-50%)' }}
      />

            {/* Input Area - At top when no messages */}
      {messages.length === 0 && !isLoadingMessages && (
        <div className={`
          w-full bg-zinc-800/50 border border-zinc-600/25 mb-4 transition-colors rounded-lg
          ${isInputFocused ? 'bg-zinc-800/70 border-zinc-500/30' : ''}
        `}>
          <div className="p-3">
            <textarea
              ref={textareaRef}
              onScroll={handleTextareaScroll}
              className="block w-full bg-transparent resize-none outline-none text-white placeholder-gray-500 text-sm leading-relaxed"
              placeholder="Ask anything about your code..."
              style={{
                minHeight: '40px',
                maxHeight: `${MAX_TEXTAREA_HEIGHT}px`,
              }}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              onKeyDown={handleKeyDown}
              disabled={isAiResponding}
            />
          </div>
          
          {/* Controls Container */}
          <div className="flex justify-between items-center px-3 pb-3">
            <div className="flex items-center gap-2">
              {/* Attach file button */}
              <button
                className="p-1.5 text-gray-400 hover:text-gray-300 hover:bg-zinc-800/50 transition-colors rounded-md"
                aria-label="Attach file"
                disabled={isAiResponding}
              >
                <Paperclip size={14} />
              </button>
            </div>
            
            {/* Send/Stop Button */}
            <div className="flex items-center">
              {isAiResponding ? (
                <button
                  onClick={onStopGeneration}
                  className="p-1.5 bg-red-500/90 hover:bg-red-500 text-white transition-colors rounded-md"
                  aria-label="Stop generation"
                >
                  <Square size={12} fill="white" />
                </button>
              ) : (
                <button
                  onClick={handleSendMessage}
                  className="p-1.5 bg-white hover:bg-gray-100 text-black transition-colors disabled:bg-gray-600 disabled:text-gray-400 rounded-md"
                  aria-label="Send"
                  disabled={!inputValue.trim()}
                >
                  <ArrowUp size={12} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Conversation Area */}
      <div className="flex-grow overflow-y-auto space-y-3 mb-4 custom-scrollbar -mr-4 pr-4">
        {isLoadingMessages ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-gray-500" size={20} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
            Start a conversation...
          </div>
        ) : (
          messages.map((message, index) => (
            <div key={message.id || index} className="space-y-2">
              {message.role === 'user' ? (
                // User Message
                <div className="bg-zinc-800/50 border border-zinc-600/25 rounded-lg p-3">
                  <div className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap break-words">
                    {message.content}
                  </div>
                </div>
              ) : message.role === 'assistant' || message.role === 'tool' ? (
                // AI Message or Tool Result
                <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {renderMessageContent(message)}
                </div>
              ) : null}
            </div>
          ))
        )}
        
        {/* Show typing indicator if AI is responding */}
        {isAiResponding && !isExecutingTool && (
          <div className="flex items-center gap-2 py-2">
            <Loader2 className="animate-spin text-gray-500" size={14} />
            <span className="text-xs text-gray-500">AI is thinking...</span>
          </div>
        )}
        
        {/* Show tool execution indicator */}
        {isExecutingTool && currentToolType && (
          <div className="py-1">
            <ToolExecutionLoader toolType={currentToolType} />
          </div>
        )}
        
        <div ref={conversationEndRef} />
      </div>

      {/* Input Area - At bottom when messages exist */}
      {(messages.length > 0 || isLoadingMessages) && (
        <div className={`
          w-full bg-zinc-800/50 border border-zinc-600/25 transition-colors mt-auto rounded-lg
          ${isInputFocused ? 'bg-zinc-800/70 border-zinc-500/30' : ''}
        `}>
          <div className="p-3">
            <textarea
              ref={textareaRef}
              onScroll={handleTextareaScroll}
              className="block w-full bg-transparent resize-none outline-none text-white placeholder-gray-500 text-sm leading-relaxed"
              placeholder="Ask anything about your code..."
              style={{
                minHeight: '40px',
                maxHeight: `${MAX_TEXTAREA_HEIGHT}px`,
              }}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              onKeyDown={handleKeyDown}
              disabled={isAiResponding}
            />
          </div>
          
          {/* Controls Container */}
          <div className="flex justify-between items-center px-3 pb-3">
            <div className="flex items-center gap-2">
              {/* Attach file button */}
              <button
                className="p-1.5 text-gray-400 hover:text-gray-300 hover:bg-zinc-800/50 transition-colors rounded-md"
                aria-label="Attach file"
                disabled={isAiResponding}
              >
                <Paperclip size={14} />
              </button>
            </div>
            
            {/* Send/Stop Button */}
            <div className="flex items-center">
              {isAiResponding ? (
                <button
                  onClick={onStopGeneration}
                  className="p-1.5 bg-red-500/90 hover:bg-red-500 text-white transition-colors rounded-md"
                  aria-label="Stop generation"
                >
                  <Square size={12} fill="white" />
                </button>
              ) : (
                <button
                  onClick={handleSendMessage}
                  className="p-1.5 bg-white hover:bg-gray-100 text-black transition-colors disabled:bg-gray-600 disabled:text-gray-400 rounded-md"
                  aria-label="Send"
                  disabled={!inputValue.trim()}
                >
                  <ArrowUp size={12} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}