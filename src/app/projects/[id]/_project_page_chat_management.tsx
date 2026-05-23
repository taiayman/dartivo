'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '@/firebase/config';
import { collection, query, orderBy, getDocs, doc, getDoc, Timestamp, addDoc, serverTimestamp, updateDoc, setDoc } from 'firebase/firestore';
import { ChatMessage, ChatHistoryItem, INITIAL_ASSISTANT_MESSAGE } from './_project_page_shared';
import {
  parseToolCallsFromChunk, 
  executeToolCalls, 
  createToolResult,
  ToolCall,
  ToolExecutionResult,
  executeToolCall
} from '@/lib/tool-execution-client';

export function useChatManagement(projectId: string | undefined) {
  // --- State Variables ---
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [currentChatTitle, setCurrentChatTitle] = useState<string>('New Chat');
  const [chatHistoryList, setChatHistoryList] = useState<ChatHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_ASSISTANT_MESSAGE]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [viewMode, setViewMode] = useState<'chats' | 'teammate'>('chats');
  const [isChatLocked, setIsChatLocked] = useState(true);
  const [initialMessageFromHome, setInitialMessageFromHome] = useState<string | null>(null);
  const [initialMessageSent, setInitialMessageSent] = useState(false);

  // --- Tool Execution State ---
  const [isExecutingTools, setIsExecutingTools] = useState(false);
  const [currentToolType, setCurrentToolType] = useState<string>('');
  const [executedTools, setExecutedTools] = useState<ToolExecutionResult[]>([]);
  const [isContinuationMode, setIsContinuationMode] = useState(false);
  const [hasContinuationOccurred, setHasContinuationOccurred] = useState(false);

  // --- Refs ---
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingToolCallsRef = useRef<ToolCall[]>([]);
  const assistantContentRef = useRef<string>('');
  const continuationTookOverRef = useRef<boolean>(false);

  // --- NEW: Anthropic Tool State ---
  const currentToolCallRef = useRef<{
    id: string;
    name: string;
    input: string;
  } | null>(null);

  // --- Effects for localStorage ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pendingMessage = localStorage.getItem('pendingChatMessage');
      if (pendingMessage) {
        console.log("Found pending chat message in localStorage:", pendingMessage);
        setInitialMessageFromHome(pendingMessage);
        localStorage.removeItem('pendingChatMessage');
                setIsChatLocked(true);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedLockPreference = localStorage.getItem('chatLockedPreference');
      if (storedLockPreference !== null) {
        try {
          setIsChatLocked(JSON.parse(storedLockPreference));
        } catch (e) { 
          console.error("Failed to parse chat lock preference", e); 
        }
      } else {
                localStorage.setItem('chatLockedPreference', JSON.stringify(true));
      }
    }
  }, []);

  // --- Fetch Chat History ---
  const fetchChatHistory = useCallback(async () => {
    if (!projectId) return;
    setIsLoadingHistory(true);
    console.log(`ChatMgmt: Fetching history for project: ${projectId}`);
    try {
      const chatsRef = collection(db, 'projects', projectId, 'chats');
      const q = query(chatsRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const history: ChatHistoryItem[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if ((typeof data.title === 'string' || data.title === null) && data.createdAt instanceof Timestamp) {
             history.push({ id: doc.id, title: data.title, createdAt: data.createdAt });
        } else { 
          console.warn(`Skipping invalid chat history item: ${doc.id}`, data); 
        }
      });
      setChatHistoryList(history);
      console.log("ChatMgmt: Fetched history:", history.length);
    } catch (error) {
      console.error("ChatMgmt: Error fetching chat history:", error);
      setChatHistoryList([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [projectId]);

  // --- Load Chat Messages ---
  const loadChatMessages = useCallback(async (chatId: string) => {
    if (!projectId) return;
    setIsLoadingMessages(true);
        setMessages([]);
    console.log(`ChatMgmt: Loading messages for chat: ${chatId}`);
    try {
      const messagesRef = collection(db, 'projects', projectId, 'chats', chatId, 'messages');
      const q = query(messagesRef, orderBy('createdAt', 'asc'));
      const querySnapshot = await getDocs(q);
      const loadedMessages: ChatMessage[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.role && data.createdAt instanceof Timestamp) {
             loadedMessages.push({ id: doc.id, ...data } as ChatMessage);
        } else { 
          console.warn(`Skipping invalid message item: ${doc.id} in chat ${chatId}`, data); 
        }
      });
            setMessages(loadedMessages.length > 0 ? loadedMessages : [INITIAL_ASSISTANT_MESSAGE]);
      console.log(`ChatMgmt: Loaded ${loadedMessages.length} messages.`);
    } catch (error) {
      console.error("ChatMgmt: Error loading messages:", error);
            setMessages([INITIAL_ASSISTANT_MESSAGE]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [projectId]);

  // --- Handle New Chat ---
  const handleNewChat = useCallback(() => {
    setCurrentChatId(null);
    setCurrentChatTitle('New Chat');
    setMessages([INITIAL_ASSISTANT_MESSAGE]);
    setIsAiResponding(false);
    setIsLoadingMessages(false);
    setIsExecutingTools(false);
    setExecutedTools([]);
    setIsContinuationMode(false);
    setHasContinuationOccurred(false);
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    pendingToolCallsRef.current = [];
    assistantContentRef.current = '';
    continuationTookOverRef.current = false;
    console.log("ChatMgmt: Started new chat state");
  }, []);

  // --- Load Chat ---
  const loadChat = useCallback(async (chatId: string) => {
    if (!projectId) return;
    console.log(`ChatMgmt: Selecting chat: ${chatId}`);
        setIsLoadingMessages(true);
        setMessages([]);
    setIsExecutingTools(false);
    setExecutedTools([]);
    setIsContinuationMode(false);
    setHasContinuationOccurred(false);
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        setIsAiResponding(false);
    pendingToolCallsRef.current = [];
    assistantContentRef.current = '';
    continuationTookOverRef.current = false;
    try {
      const chatDocRef = doc(db, 'projects', projectId, 'chats', chatId);
      const chatDocSnap = await getDoc(chatDocRef);
      if (chatDocSnap.exists()) {
        const chatData = chatDocSnap.data();
        setCurrentChatId(chatId);
                setCurrentChatTitle(chatData?.title || 'Chat');
                await loadChatMessages(chatId);
      } else {
        console.error("Chat document not found:", chatId);
                handleNewChat();
        fetchChatHistory();
      }
    } catch (error) {
      console.error("ChatMgmt: Error loading chat details:", error);
            handleNewChat();
    }
  }, [projectId, loadChatMessages, handleNewChat, fetchChatHistory]);

  // --- Generate and Save Title ---
  const generateAndSaveTitle = useCallback(async (chatId: string, firstMessageContent: string) => {
    console.log("Requesting title generation for chat:", chatId);
    try {
      const response = await fetch('/api/generate-title', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageContent: firstMessageContent }),
      });
      if (!response.ok) throw new Error('Failed to generate title');
      const { title } = await response.json();
      if (title && projectId && chatId) {
        const chatDocRef = doc(db, 'projects', projectId, 'chats', chatId);
        await updateDoc(chatDocRef, { title: title });
        console.log(`Chat ${chatId} title updated to: ${title}`);
                if (currentChatId === chatId) setCurrentChatTitle(title);
        setChatHistoryList(prev => prev.map(c => c.id === chatId ? { ...c, title: title } : c));
      } else {
         console.warn("Generated title was empty or invalid.");
      }
    } catch (error) {
      console.error("Error generating or saving title:", error);
    }
  }, [projectId, currentChatId]);

  // --- Save Assistant Message ---
    const saveAssistantMessage = useCallback(async (chatId: string, message: ChatMessage): Promise<string | undefined> => {
        if (!projectId || !chatId || !message || message.role !== 'assistant') return undefined; 

      console.log(`Saving assistant message to chat ${chatId}`);
      try {
          const assistantMessageRef = doc(collection(db, 'projects', projectId, 'chats', chatId, 'messages'));
          const messageData: Partial<ChatMessage> = {
              role: 'assistant',
        content: message.content,
              createdAt: serverTimestamp(),
          };
          await setDoc(assistantMessageRef, messageData);
      console.log(`Assistant message saved with ID: ${assistantMessageRef.id}`);
          return assistantMessageRef.id;
    } catch (error) {
      console.error("Error saving assistant message:", error);
          return undefined;
      }
    }, [projectId]);

  // --- Execute Tool Calls ---
  const executeToolCallsHandler = useCallback(async (toolCalls: ToolCall[]) => {
    if (toolCalls.length === 0) return;
    
    console.log(`🔧 Executing ${toolCalls.length} tool calls...`);
    setIsExecutingTools(true);
    
    try {
      const results = await executeToolCalls(toolCalls, projectId);
      setExecutedTools(prev => [...prev, ...results]);
      
      // Add tool results to the assistant's response
      const toolResultsText = results
        .map(result => result.success ? result.result : `Error: ${result.error}`)
        .join('\n\n');
      
      // Update assistant content with tool results
      assistantContentRef.current += `\n\n[Tool Results]\n${toolResultsText}`;
      
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
          lastMessage.content = assistantContentRef.current;
        }
        return newMessages;
      });
      
      console.log(`✅ Executed ${results.length} tools successfully`);
      } catch (error) {
      console.error('Error executing tool calls:', error);
    } finally {
      setIsExecutingTools(false);
    }
  }, [projectId]);

  // --- Toggle Chat Lock ---
  const toggleChatLock = useCallback(() => {
    const newLockState = !isChatLocked;
    setIsChatLocked(newLockState);
    if (typeof window !== 'undefined') {
      localStorage.setItem('chatLockedPreference', JSON.stringify(newLockState));
    }
    console.log(`Chat lock toggled to: ${newLockState}`);
  }, [isChatLocked]);

  // --- Save Edit ---
  const onSaveEdit = useCallback(async (messageId: string, newContent: string): Promise<void> => {
    if (!projectId || !currentChatId) return;
    
    try {
      const messageRef = doc(db, 'projects', projectId, 'chats', currentChatId, 'messages', messageId);
      await updateDoc(messageRef, { content: newContent });
      
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, content: newContent } : msg
      ));
      
      console.log(`Message ${messageId} updated successfully.`);
    } catch (error) {
      console.error('Error updating message:', error);
      throw error;
    }
  }, [projectId, currentChatId]);

  // --- Delete Chat ---
    const handleDeleteChat = useCallback(async (chatId: string) => {
    if (!projectId) return;
    console.log(`Deleting chat: ${chatId}`);
    try {
      await updateDoc(doc(db, 'projects', projectId, 'chats', chatId), {
        deleted: true,
        deletedAt: serverTimestamp()
      });
      
      setChatHistoryList(prev => prev.filter(chat => chat.id !== chatId));
      
            if (currentChatId === chatId) {
                handleNewChat();
            }
      
      console.log(`Chat ${chatId} marked as deleted.`);
        } catch (error) {
      console.error(`Error deleting chat ${chatId}:`, error);
        }
    }, [projectId, currentChatId, handleNewChat]);

  // --- Handle Send Message ---
  const handleSendMessage = useCallback(async (userMessageContent: string) => {
    if (!projectId || !userMessageContent.trim() || isAiResponding) return;
    console.log('ChatMgmt: handleSendMessage initiated.');
    
    setIsAiResponding(true);
    setIsExecutingTools(false);
    setExecutedTools([]);
    setHasContinuationOccurred(false);
    continuationTookOverRef.current = false;
    pendingToolCallsRef.current = [];
    assistantContentRef.current = '';

    try {
      // Create or use existing chat
      let chatId = currentChatId;
      if (!chatId) {
        console.log('ChatMgmt: Creating new chat.');
        const chatsRef = collection(db, 'projects', projectId, 'chats');
        const newChatDoc = await addDoc(chatsRef, {
          title: 'New Chat',
          createdAt: serverTimestamp(),
        });
        chatId = newChatDoc.id;
        setCurrentChatId(chatId);
        console.log(`ChatMgmt: New chat created with ID: ${chatId}.`);
      } else {
        console.log(`ChatMgmt: Using existing chat ${chatId}.`);
      }

      // Save user message
      const userMessage: ChatMessage = {
        role: 'user',
        content: userMessageContent,
      };
      
      const userMessageRef = doc(collection(db, 'projects', projectId, 'chats', chatId, 'messages'));
      await setDoc(userMessageRef, {
        ...userMessage,
        createdAt: serverTimestamp(),
      });
      
      userMessage.id = userMessageRef.id;
      setMessages(prev => [...prev, userMessage]);
      console.log(`ChatMgmt: User message saved with ID: ${userMessageRef.id}`);

      // Prepare messages for API - include tool messages to maintain context
      const apiMessages = messages
        .filter(msg => msg.role === 'user' || msg.role === 'assistant' || msg.role === 'tool')
        .map(msg => {
          if (msg.role === 'tool') {
            // Format tool messages for API
            return {
              role: 'user',
              content: `[Previous tool execution - ${msg.toolName}]: ${msg.content}`,
            };
          }
          return {
            role: msg.role,
            content: msg.content || '',
          };
        });
      
      apiMessages.push({
        role: 'user',
        content: userMessageContent,
      });
      console.log('ChatMgmt: Messages history being sent:', apiMessages);

      // Create abort controller
      abortControllerRef.current = new AbortController();

      // Call chat API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: apiMessages,
          projectId: projectId 
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body received');
      }

      // Handle streaming response - simplified without tool execution
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              if (!data || !data.trim()) continue;

              try {
                const parsed = JSON.parse(data);
                
                // Handle server-side tool execution events
                if (parsed.type === 'tool_execution') {
                  console.log(`🔧 Tool execution: ${parsed.tool} - ${parsed.status}`);
                  
                  if (parsed.status === 'started') {
                    setIsExecutingTools(true);
                    setCurrentToolType(parsed.tool);
                  } else if (parsed.status === 'completed') {
                    setIsExecutingTools(false);
                    setCurrentToolType('');
                    
                    // Add tool result as a separate message and save it to conversation
                    const toolMessage: ChatMessage = {
                      role: 'tool',
                      content: parsed.result,
                      toolName: parsed.tool,
                      displayContent: `Executed ${parsed.tool}`,
                    };
                    
                    setMessages(prev => [...prev, toolMessage]);
                    
                    // Save tool result to chat history for context preservation
                    if (chatId) {
                      saveAssistantMessage(chatId, toolMessage);
                    }
                    
                    // Trigger refresh for file-related tools
                    if (parsed.tool === 'edit_file' && parsed.result) {
                      // Extract file path from tool result
                      let filePath = null;
                      try {
                        const resultData = JSON.parse(parsed.result);
                        filePath = resultData.filePath || resultData.path;
                      } catch {
                        // If not JSON, try to extract from string result
                        const pathMatch = parsed.result.match(/File ([^\s]+) has been/);
                        filePath = pathMatch ? pathMatch[1] : null;
                      }
                      
                      window.dispatchEvent(new CustomEvent('fileEdited', {
                        detail: {
                          tool: parsed.tool,
                          result: parsed.result,
                          filePath: filePath
                        }
                      }));
                    }
                    
                    // Reset assistant content for follow-up response
                    assistantContentRef.current = '';
                  } else if (parsed.status === 'error') {
                    setIsExecutingTools(false);
                    setCurrentToolType('');
                    console.error('Tool execution error:', parsed.error);
                  }
                  continue;
                }

                // Handle regular streaming content
                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                  const deltaText = parsed.delta.text;
                  assistantContentRef.current += deltaText;
                  
                  // Update the assistant message
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    if (lastMessage && lastMessage.role === 'assistant') {
                      lastMessage.content = assistantContentRef.current;
                    } else {
                      newMessages.push({
                        role: 'assistant',
                        content: assistantContentRef.current,
                      });
                    }
                    return newMessages;
                  });
                }

                // Handle other Anthropic event types
                if (parsed.type === 'message_start') {
                  console.log('📨 Message started');
                } else if (parsed.type === 'content_block_start') {
                  console.log('📝 Content block started');
                } else if (parsed.type === 'content_block_stop') {
                  console.log('📝 Content block stopped');
                } else if (parsed.type === 'message_stop') {
                  console.log('📨 Message completed');
                }
              } catch (parseError) {
                // Skip malformed JSON silently
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Save final assistant message
      if (assistantContentRef.current.trim()) {
        console.log('ChatMgmt: Saving final assistant message.');
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: assistantContentRef.current,
        };
        const assistantMessageId = await saveAssistantMessage(chatId, assistantMessage);
        if (assistantMessageId) {
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage && lastMessage.role === 'assistant') {
              lastMessage.id = assistantMessageId;
            }
            return newMessages;
          });
        }
      }

      // Generate title if this is a new chat
      if (messages.length <= 1) {
        console.log('ChatMgmt: Generating title after completion.');
        await generateAndSaveTitle(chatId, userMessageContent);
      }

    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('ChatMgmt: Request was aborted by user.');
      } else {
        console.error('ChatMgmt: Error in handleSendMessage:', error);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
        }]);
      }
    } finally {
      setIsAiResponding(false);
      setIsExecutingTools(false);
      setIsContinuationMode(false);
      setHasContinuationOccurred(false);
      abortControllerRef.current = null;
      pendingToolCallsRef.current = [];
      assistantContentRef.current = '';
      console.log('ChatMgmt: Entering final cleanup for handleSendMessage.');
    }
  }, [projectId, currentChatId, messages, isAiResponding, saveAssistantMessage, generateAndSaveTitle]);

  // --- Stop Generation ---
  const onStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      console.log('ChatMgmt: Stopping AI generation...');
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsAiResponding(false);
      setIsExecutingTools(false);
    }
  }, []);

  // --- View Mode Change ---
  const onViewModeChange = useCallback((newMode: 'chats' | 'teammate') => {
    setViewMode(newMode);
  }, []);

  // --- Initial Effects ---
  useEffect(() => {
    fetchChatHistory();
  }, [fetchChatHistory]);

  // --- Handle Initial Message ---
  useEffect(() => {
    if (initialMessageFromHome && !initialMessageSent && !isAiResponding) {
      console.log("Sending initial message from home:", initialMessageFromHome);
      handleSendMessage(initialMessageFromHome);
            setInitialMessageSent(true);
      setInitialMessageFromHome(null);
      }
  }, [initialMessageFromHome, initialMessageSent, isAiResponding, handleSendMessage]);

  return {
    // State
    currentChatId,
    currentChatTitle,
    messages,
    isLoadingMessages,
    isAiResponding,
    chatHistoryList,
    isLoadingHistory,
    viewMode,
    isChatLocked,
    isExecutingTools,
    currentToolType,
    executedTools,
    
    // Actions
    handleSendMessage,
    onStopGeneration,
    loadChat,
    handleDeleteChat,
    fetchChatHistory,
    onSaveEdit,
    onViewModeChange,
    toggleChatLock,
  };
}