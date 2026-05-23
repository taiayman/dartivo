// _project_page_file_management.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { FileTreeNode, insertNodeIntoTree } from './_project_page_shared'; // Import necessary types/helpers
// Removed rigid diff library - using custom smart diff application
import { doc, onSnapshot } from 'firebase/firestore'; // Removed DocumentData
import { db } from '@/firebase/config'; // Added db import

// Define template status type
type TemplateStatus = 'pending' | 'completed' | 'error' | 'loading' | 'unknown' | null;

// Define return type for applyDiff
interface ApplyDiffResult {
    success: boolean;
    error?: string;
    patchedContent?: string; // Return patched content on success
    changes?: Array<{ startLine: number; endLine: number; type: 'add' | 'delete' | 'modify' }>; // For visual highlighting
}

// Define CreateFileResult type
interface CreateFileResult {
    success: boolean;
    error?: string;
    filePath?: string;
}

export function useFileManagement(projectId: string | undefined) {
  // --- Editor/File State ---
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [code, setCode] = useState(''); // Default code (empty)
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [actualFileTree, setActualFileTree] = useState<FileTreeNode[] | null>(null);
  const [isLoadingFileTree, setIsLoadingFileTree] = useState(true);
  const [isFileContentLoading, setIsFileContentLoading] = useState(false);
  const fetchTriggeredByStatusRef = useRef(false); // Ref to track if fetch was triggered by status change

  // --- ADDED: State for Template Initialization Status ---
  const [templateStatus, setTemplateStatus] = useState<TemplateStatus>('loading');
  const [templateError, setTemplateError] = useState<string | null>(null);

  // --- Auto-Save State ---
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'typing' | 'saving' | 'saved' | 'error'>('idle');

  // --- Context Menu State ---
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuItemPath, setContextMenuItemPath] = useState<string | null>(null);
  const [contextMenuItemType, setContextMenuItemType] = useState<'file' | 'folder' | 'background' | null>(null);

  // --- Inline Input State ---
  const [isInputVisible, setIsInputVisible] = useState(false);
  const [inputPosition, setInputPosition] = useState({ x: 0, y: 0 });
  const [inputValue, setInputValue] = useState('');
  const [inputActionType, setInputActionType] = useState<'newFile' | 'newFolder' | 'rename' | null>(null);
  const [inputBasePath, setInputBasePath] = useState<string | null>(null);

  // --- Fetch File Content ---
  const fetchFileContent = useCallback(async (filePath: string) => {
    if (!projectId || !filePath) return;
    console.log(`Fetching content for: ${filePath}`);
    setIsFileContentLoading(true);
    // Removed loading message to prevent UI flicker
    try {
      const encodedPath = encodeURIComponent(filePath);
      const response = await fetch(`/api/projects/${projectId}/files/content?path=${encodedPath}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to fetch content for ${filePath}: ${response.status}`, errorText);
        setCode(`// Error loading file: ${response.status}\n// ${errorText}`);
        throw new Error(`Failed to fetch content: ${response.status}`);
      }
      const fileContent = await response.text();
      setCode(fileContent);
      console.log(`Successfully fetched content for ${filePath}`);
    } catch (error) {
      console.error(`Error in fetchFileContent for ${filePath}:`, error);
      if (!code.startsWith('// Error')) {
        setCode(`// Error loading file content.`);
      }
    } finally {
      setIsFileContentLoading(false);
    }
  }, [projectId, code]); // Include 'code' only if error fallback depends on it

  // --- Fetch File Tree ---
  const fetchTree = useCallback(async (triggeredByStatus: boolean = false) => {
    if (!projectId) {
      setIsLoadingFileTree(false);
      setActualFileTree([]);
      return;
    }
    console.log(`Fetching file tree for project: ${projectId}${triggeredByStatus ? ' (triggered by status update)': ''}`);
    setIsLoadingFileTree(true);
    if (!triggeredByStatus) {
      setActualFileTree(null);
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/files/tree`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to fetch file tree: ${response.status}`, errorText);
        throw new Error(`Failed to fetch file tree (${response.status})`);
      }
      const treeData: FileTreeNode[] = await response.json();
      setActualFileTree(treeData);
      console.log("Successfully fetched file tree.", treeData);
      if (triggeredByStatus) {
        fetchTriggeredByStatusRef.current = true;
      }
    } catch (error) {
      console.error("Error fetching file tree:", error);
      setActualFileTree([]);
    } finally {
      setIsLoadingFileTree(false);
    }
  }, [projectId]);

  // --- Effect: Fetch Initial Tree (Runs once on mount) ---
  useEffect(() => {
    console.log("Initial fetchTree effect running...");
    fetchTree();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]); // Rerun ONLY if projectId changes

  // --- Effect: Listen for Project Initialization Status --- 
  useEffect(() => {
    if (!projectId) return;

    console.log(`Setting up Firestore listener for projects/${projectId}`);
    const docRef = doc(db, 'projects', projectId);
    
    fetchTriggeredByStatusRef.current = false; 

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const status = data?.templateInitStatus as TemplateStatus; // Extract status
        const error = data?.templateInitError as string | null; // Extract error
        console.log(`Firestore update for ${projectId}: status = ${status}, error = ${error}`);

        // --- ADDED: Update template status state ---
        setTemplateStatus(status || 'unknown'); // Set state, default to 'unknown' if field missing
        setTemplateError(error || null);
        // --- END ADDED --- 

        if (status === 'completed' && !fetchTriggeredByStatusRef.current) {
            console.log(`Status is 'completed' and fetch not yet triggered by status. Fetching tree...`);
            if (actualFileTree === null || actualFileTree.length === 0) {
                 fetchTree(true);
            } else {
                console.log('Tree already populated, skipping status-triggered fetch.');
                fetchTriggeredByStatusRef.current = true;
            }
        }
      } else {
        console.log(`Document projects/${projectId} does not exist.`);
      }
    }, (error) => {
      console.error(`Error listening to project document ${projectId}:`, error);
    });

    return () => {
      console.log(`Cleaning up Firestore listener for projects/${projectId}`);
      unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, fetchTree]); // Removed actualFileTree from dependencies

  // --- Toggle Folder Expansion ---
  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => ({ ...prev, [path]: !prev[path] }));
  };

  // --- Auto Save Function ---
  const autoSaveContent = useCallback(async (filePath: string, content: string) => {
    if (!projectId) return;
    console.log(`Auto-saving ${filePath}...`);
    setSaveStatus('saving');
    try {
      const encodedPath = encodeURIComponent(filePath);
      const response = await fetch(`/api/projects/${projectId}/files/content?path=${encodedPath}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || `Failed to save ${filePath}`);
      }
      console.log(`${filePath} auto-saved successfully.`);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(prev => prev === 'saved' ? 'idle' : prev), 2000); // Reset if still 'saved'
    } catch (error: unknown) {
      console.error(`Error auto-saving ${filePath}:`, error);
      setSaveStatus('error');
    }
  }, [projectId]);

  // --- Handle File Click in Tree ---
  const handleFileClick = useCallback((path: string) => {
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    setSaveStatus('idle');
    if (!openFiles.includes(path)) setOpenFiles(prev => [...prev, path]);
    setActiveFile(path);
    fetchFileContent(path);
    // Removed setMainView('code') - main component should handle view changes
  }, [openFiles, fetchFileContent]);

  // --- Handle Tab Click ---
  const handleTabClick = useCallback((path: string) => {
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    setSaveStatus('idle');
    if (activeFile !== path) {
      setActiveFile(path);
      fetchFileContent(path);
    } else {
        // Optionally re-fetch or do nothing if already active
        // fetchFileContent(path);
    }
  }, [activeFile, fetchFileContent]);

  // --- Handle Close Tab ---
  const handleCloseTab = useCallback((path: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (path === activeFile && saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }

    const remainingFiles = openFiles.filter(f => f !== path);
    setOpenFiles(remainingFiles);
    if (activeFile === path) {
      const closedTabIndex = openFiles.findIndex(f => f === path);
      const newActiveIndex = closedTabIndex > 0 ? closedTabIndex - 1 : (remainingFiles.length > 0 ? 0 : -1);
      const newActiveFile: string | null = newActiveIndex >= 0 ? remainingFiles[newActiveIndex] : null;
      setActiveFile(newActiveFile);
      if (newActiveFile) {
        fetchFileContent(newActiveFile);
        setSaveStatus('idle');
      } else {
        setCode('Hello Dartivo'); // Reset editor content
        setSaveStatus('idle');
      }
      // View logic should be handled by the main component based on newActiveFile
    }
  }, [openFiles, activeFile, fetchFileContent]);

  // --- Context Menu Handlers ---
  const handleContextMenu = useCallback((event: React.MouseEvent, path: string, type: 'file' | 'folder') => {
    event.preventDefault();
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
    setContextMenuItemPath(path);
    setContextMenuItemType(type);
    setContextMenuVisible(true);
    console.log(`Context menu for ${type}: ${path}`);
  }, []);

  const handleBackgroundContextMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
    setContextMenuItemPath(null);
    setContextMenuItemType('background');
    setContextMenuVisible(true);
    console.log(`Context menu for background`);
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenuVisible(false);
    setContextMenuItemPath(null);
    setContextMenuItemType(null);
  }, []);

  // --- Effect: Global Click/Esc to Close Context Menu ---
  useEffect(() => {
    if (!contextMenuVisible) return;
    const handleClick = () => closeContextMenu();
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') closeContextMenu(); };
    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [contextMenuVisible, closeContextMenu]);

  // --- API Call for Create ---
  const callCreateApi = useCallback(async (type: 'file' | 'folder', basePath: string | null, newItemName: string): Promise<boolean> => {
    if (!projectId) return false;
    console.log(`Calling create API: type=${type}, basePath=${basePath}, name=${newItemName}`);
    try {
      const response = await fetch(`/api/projects/${projectId}/files/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, basePath, newItemName }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Failed to create ${type}`);
      console.log('Create API success:', result.message);
      return true;
    } catch (error: unknown) {
      console.error(`Error calling create ${type} API:`, error);
      alert(`Error creating ${type}: ${ (typeof error === 'object' && error !== null && 'message' in error) ? (error as {message: string}).message : 'Unknown API error'}`);
      return false;
    }
  }, [projectId]);

  // --- Trigger Inline Input ---
  const triggerInputMode = useCallback((actionType: 'newFile' | 'newFolder' | 'rename') => {
    const targetPath = contextMenuItemPath;
    const itemType = contextMenuItemType;
    let basePathForInput: string | null = null;
    let initialInputValue = '';

    if (actionType === 'newFile' || actionType === 'newFolder') {
      basePathForInput = itemType === 'folder' ? targetPath : null;
    } else if (actionType === 'rename') {
      if (!targetPath) return;
      basePathForInput = targetPath;
      initialInputValue = targetPath.split('/').pop() || '';
    }

    setInputPosition(contextMenuPosition);
    setInputActionType(actionType);
    setInputBasePath(basePathForInput);
    setInputValue(initialInputValue);
    setIsInputVisible(true);
    closeContextMenu(); // Close context menu
  }, [contextMenuItemPath, contextMenuItemType, contextMenuPosition, closeContextMenu]);

  // --- Handle Inline Input Submission ---
  const handleInputSubmit = useCallback(async (finalValue: string) => {
    const action = inputActionType;
    const basePath = inputBasePath; // Path of folder for new items, null for root
    const itemPathToRename = (action === 'rename') ? inputBasePath : null;

    setIsInputVisible(false);
    setInputValue('');
    setInputActionType(null);
    setInputBasePath(null);

    if (!finalValue || !finalValue.trim() || finalValue.includes('/') || finalValue.includes('\\')) {
      console.log('Input cancelled, empty, or invalid.');
      if (finalValue?.includes('/') || finalValue?.includes('\\')) alert('Name cannot contain slashes.');
      return;
    }

    const trimmedValue = finalValue.trim();
    let success = false;

    if (action === 'newFile' || action === 'newFolder') {
      const type = action === 'newFile' ? 'file' : 'folder';
      success = await callCreateApi(type, basePath, trimmedValue);
      if (success) {
        const newPath = basePath ? `${basePath}/${trimmedValue}` : trimmedValue;
        const newNode: FileTreeNode = { name: trimmedValue, type: type, path: newPath, ...(type === 'folder' && { children: [] }) };
        setActualFileTree(prevTree => insertNodeIntoTree(prevTree, basePath, newNode)); // Optimistic update
      }
    } else if (action === 'rename') {
      console.log(`Rename action needed for: ${itemPathToRename} to ${trimmedValue}`);
      alert('Rename functionality not yet implemented.'); // Placeholder
      // success = await callRenameApi(itemPathToRename, trimmedValue); // TODO: Implement rename API call
      // if (success) { /* TODO: Optimistic UI update for rename */ await fetchTree(); }
    }
    // No automatic fetchTree() on success for create to rely on optimistic update
  }, [inputActionType, inputBasePath, callCreateApi]); // Removed fetchTree

  // --- Handle Inline Input Cancellation ---
  const handleInputCancel = useCallback(() => {
    setIsInputVisible(false);
    setInputValue('');
    setInputActionType(null);
    setInputBasePath(null);
  }, []);

  // --- Handle Editor Change (Debounced Save) ---
  const handleEditorChange = useCallback((value: string | undefined) => {
    const currentContent = value || '';
    setCode(currentContent);
    setSaveStatus('typing');

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    if (activeFile) {
      const currentActiveFile = activeFile;
      saveTimerRef.current = setTimeout(() => {
        autoSaveContent(currentActiveFile, currentContent);
        
        // Emit file change event for hot reload simulation
        window.dispatchEvent(new CustomEvent('fileChanged', {
          detail: { filePath: currentActiveFile, content: currentContent }
        }));
        console.log('📝 File change event dispatched for hot reload:', currentActiveFile);
      }, 1500);
    }
  }, [activeFile, autoSaveContent]);

  // --- Get File Language for Editor ---
  const getFileLanguage = useCallback((filePath: string | null): string => {
    if (!filePath) return 'plaintext';
    const extension = filePath.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'ts': case 'tsx': return 'typescript';
      case 'js': case 'jsx': return 'javascript';
      case 'json': return 'json';
      case 'md': return 'markdown';
      case 'css': return 'css';
      case 'html': return 'html';
      case 'dart': return 'dart';
      default: return 'plaintext';
    }
  }, []);

  // --- Diff Decorations for Monaco Editor ---
  const applyDiffDecorations = useCallback((
    editor: any, 
    changes: Array<{ startLine: number; endLine: number; type: 'add' | 'delete' | 'modify' }>
  ) => {
    if (!editor || !changes.length) {
      console.log('No editor or changes provided for decorations');
      return [];
    }

    console.log('🎨 Applying diff decorations:', changes);
    
    const decorations = changes.map((change, index) => {
      let className = '';
      let glyphMarginClassName = '';
      
      switch (change.type) {
        case 'add':
          className = 'diff-line-added';
          glyphMarginClassName = 'diff-glyph-added';
          break;
        case 'delete':
          className = 'diff-line-deleted';
          glyphMarginClassName = 'diff-glyph-deleted';
          break;
        case 'modify':
          className = 'diff-line-modified';
          glyphMarginClassName = 'diff-glyph-modified';
          break;
      }

      const decoration = {
        range: new (window as any).monaco.Range(
          change.startLine,
          1,
          change.endLine,
          1
        ),
        options: {
          isWholeLine: true,
          className,
          glyphMarginClassName,
          glyphMarginHoverMessage: { 
            value: `Line ${change.type}${change.type === 'modify' ? 'ied' : change.type === 'delete' ? 'd' : 'ed'} by AI` 
          },
          hoverMessage: { 
            value: `This line was ${change.type}${change.type === 'modify' ? 'ied' : change.type === 'delete' ? 'd' : 'ed'} by AI` 
          }
        }
      };
      
      console.log(`  ${index + 1}. ${change.type.toUpperCase()} lines ${change.startLine}-${change.endLine} with class "${className}"`);
      return decoration;
    });

    try {
      // Apply decorations and return decoration IDs for cleanup
      const decorationIds = editor.deltaDecorations([], decorations);
      console.log('✅ Successfully applied decorations with IDs:', decorationIds);
      
      // Force editor to re-render to show decorations
      setTimeout(() => {
        editor.layout();
        console.log('🔄 Editor layout refreshed to show decorations');
      }, 100);
      
      return decorationIds;
    } catch (error) {
      console.error('❌ Error applying decorations:', error);
      return [];
    }
  }, []);

  // --- ENHANCED AI-POWERED DIFF APPLICATION SYSTEM ---
  const applyDiff = useCallback(async (filePath: string, diffContent: string): Promise<ApplyDiffResult> => {
    console.log('🚀 AI-POWERED DIFF APPLICATION SYSTEM');

    if (filePath !== activeFile) {
        return { success: false, error: `File "${filePath}" must be open and active.` };
    }

    try {
        // Get original content for reference
        const originalContent = code;
        const originalLines = originalContent.split(/\r?\n/);
        
        // Normalize both contents for comparison (but preserve original for final result)
        const normalizedCode = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const normalizedDiffContent = diffContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        
        const currentLines = normalizedCode.split('\n');
        let newLines = [...currentLines];
        const changes: Array<{ startLine: number; endLine: number; type: 'add' | 'delete' | 'modify' }> = [];
        
        // Enhanced regex for diff hunks with better flexibility
        const hunkRegex = /:start_line:\s*(\d+)\s*\n-{5,}\s*\n([\s\S]*?)\n={5,}\s*\n([\s\S]*?)(?=\n:start_line:|\]\]>|$)/g;
        let match;
        let foundHunks = false;
        
        // Function to find best matching line using fuzzy matching
        const findBestMatch = (searchContent: string, startLine: number, tolerance: number = 3): number => {
            const searchLines = searchContent.split('\n');
            const firstSearchLine = searchLines[0];
            
            // Try exact match first
            for (let i = Math.max(0, startLine - tolerance); i <= Math.min(currentLines.length - searchLines.length, startLine + tolerance); i++) {
                let isMatch = true;
                for (let j = 0; j < searchLines.length; j++) {
                    if (i + j >= currentLines.length || currentLines[i + j] !== searchLines[j]) {
                        isMatch = false;
                        break;
                    }
                }
                if (isMatch) return i;
            }
            
            // Try fuzzy matching (ignoring whitespace differences)
            for (let i = Math.max(0, startLine - tolerance); i <= Math.min(currentLines.length - searchLines.length, startLine + tolerance); i++) {
            let isMatch = true;
                for (let j = 0; j < searchLines.length; j++) {
                    const currentLineTrimmed = (currentLines[i + j] || '').trim();
                    const searchLineTrimmed = searchLines[j].trim();
                    if (currentLineTrimmed !== searchLineTrimmed) {
                    isMatch = false;
                    break;
                    }
                }
                if (isMatch) return i;
            }
            
            // Try partial matching (first line only)
            for (let i = Math.max(0, startLine - tolerance); i <= Math.min(currentLines.length - 1, startLine + tolerance); i++) {
                if (currentLines[i].trim() === firstSearchLine.trim()) {
                    return i;
                }
            }
            
            return -1; // No match found
        };
        
        while ((match = hunkRegex.exec(normalizedDiffContent)) !== null) {
            foundHunks = true;
            const targetLine = parseInt(match[1]) - 1; // Convert to 0-based
            const searchContent = match[2];
            const replaceContent = match[3].trim();
            
            console.log(`🔍 Processing hunk targeting line ${targetLine + 1}:`);
            console.log(`  Search content: "${searchContent}"`);
            console.log(`  Replace content: "${replaceContent}"`);
            
            // Find the best matching location
            const actualStartLine = findBestMatch(searchContent, targetLine, 5);
            
            if (actualStartLine === -1) {
                console.warn(`⚠️ Could not find match for hunk at line ${targetLine + 1}, trying alternative strategies...`);
                
                // Alternative strategy: Look for key identifiers in the search content
                const searchLines = searchContent.split('\n');
                const keyLine = searchLines.find(line => line.trim().length > 10 && !line.trim().startsWith('//'));
                
                if (keyLine) {
                    const keyLineTrimmed = keyLine.trim();
                    const foundIndex = currentLines.findIndex(line => line.trim() === keyLineTrimmed);
                    
                    if (foundIndex !== -1) {
                        console.log(`✅ Found key line "${keyLineTrimmed}" at line ${foundIndex + 1}`);
                        const replaceLines = replaceContent ? replaceContent.split('\n') : [];
                        
                        // Replace just this line
                        newLines.splice(foundIndex, 1, ...replaceLines);
                    changes.push({ 
                            startLine: foundIndex + 1, 
                            endLine: foundIndex + replaceLines.length, 
                        type: 'modify' 
                    });
                        continue;
                    }
                }
                
                return {
                    success: false,
                    error: `Could not find matching content for hunk at line ${targetLine + 1}. The content may have changed or the line numbers may be incorrect.`
                };
            }
            
            const searchLines = searchContent.split('\n');
            const replaceLines = replaceContent ? replaceContent.split('\n') : [];
            
            console.log(`✅ Found match at line ${actualStartLine + 1}, replacing ${searchLines.length} lines with ${replaceLines.length} lines`);
            
            // Apply the replacement
            newLines.splice(actualStartLine, searchLines.length, ...replaceLines);
            
            // Record the change
            if (searchLines.length === 0 && replaceLines.length > 0) {
                changes.push({ 
                    startLine: actualStartLine + 1, 
                    endLine: actualStartLine + replaceLines.length, 
                    type: 'add' 
                });
            } else if (searchLines.length > 0 && replaceLines.length === 0) {
                changes.push({ 
                    startLine: actualStartLine + 1, 
                    endLine: actualStartLine + searchLines.length, 
                    type: 'delete' 
                });
            } else {
                changes.push({ 
                    startLine: actualStartLine + 1, 
                    endLine: actualStartLine + Math.max(searchLines.length, replaceLines.length), 
                    type: 'modify' 
                });
            }
        }
        
        // If no hunks found, try intelligent line commands
        if (!foundHunks) {
            console.log('🤖 No diff hunks found, trying intelligent line commands...');
            
            const intelligentCommands = [
                // Smart REPLACE patterns
                /(?:REPLACE|replace|Replace)\s+line\s+(\d+)\s+with\s*[:"']([^"']+)[:"']/gi,
                /(?:REPLACE|replace|Replace)\s+lines?\s+(\d+)(?:\s*-\s*(\d+))?\s+with\s*[:"']([^"']+)[:"']/gi,
                
                // Smart DELETE patterns
                /(?:DELETE|delete|Delete|REMOVE|remove|Remove)\s+lines?\s+(\d+)(?:\s*-\s*(\d+))?/gi,
                
                // Smart INSERT patterns
                /(?:INSERT|insert|Insert)\s+at\s+line\s+(\d+)\s*[:"']([^"']+)[:"']/gi,
                /(?:ADD|add|Add)\s+after\s+line\s+(\d+)\s*[:"']([^"']+)[:"']/gi,
                
                // Content-based replacements
                /replace\s*[:"']([^"']+)[:"']\s*with\s*[:"']([^"']+)[:"']/gi,
                /change\s*[:"']([^"']+)[:"']\s*to\s*[:"']([^"']+)[:"']/gi,
            ];
            
            let foundCommands = false;
            
            for (const pattern of intelligentCommands) {
                let cmdMatch;
                pattern.lastIndex = 0;
                while ((cmdMatch = pattern.exec(normalizedDiffContent)) !== null) {
                    foundCommands = true;
                    const command = cmdMatch[0].toLowerCase();
                    
                    if (command.includes('replace') && cmdMatch[1] && cmdMatch[2]) {
                        // Content-based replacement
                        const searchText = cmdMatch[1];
                        const replaceText = cmdMatch[2];
                        
                        const lineIndex = currentLines.findIndex(line => line.includes(searchText));
                        if (lineIndex !== -1) {
                            console.log(`🔄 REPLACE content "${searchText}" with "${replaceText}" at line ${lineIndex + 1}`);
                            newLines[lineIndex] = newLines[lineIndex].replace(searchText, replaceText);
                            changes.push({ startLine: lineIndex + 1, endLine: lineIndex + 1, type: 'modify' });
                        }
                    } else if (command.includes('replace') && cmdMatch[1]) {
                        // Line-based replacement
                        const lineNum = parseInt(cmdMatch[1]) - 1;
                        const newContent = cmdMatch[3] || cmdMatch[2];
                        
                        if (lineNum >= 0 && lineNum < newLines.length && newContent) {
                            console.log(`🔄 REPLACE line ${lineNum + 1}: "${newLines[lineNum]}" → "${newContent}"`);
                            newLines[lineNum] = newContent;
                            changes.push({ startLine: lineNum + 1, endLine: lineNum + 1, type: 'modify' });
                        }
                    } else if (command.includes('delete') || command.includes('remove')) {
                        const startLineNum = parseInt(cmdMatch[1]) - 1;
                        const endLineNum = cmdMatch[2] ? parseInt(cmdMatch[2]) - 1 : startLineNum;
                        
                        if (startLineNum >= 0 && startLineNum < newLines.length) {
                            const deleteCount = endLineNum - startLineNum + 1;
                            console.log(`🗑️ DELETE lines ${startLineNum + 1}-${endLineNum + 1}`);
                            newLines.splice(startLineNum, deleteCount);
                            changes.push({ startLine: startLineNum + 1, endLine: endLineNum + 1, type: 'delete' });
                        }
                    } else if (command.includes('insert') || command.includes('add')) {
                        const lineNum = parseInt(cmdMatch[1]) - 1;
                        const newContent = cmdMatch[2];
                        const insertPos = command.includes('add') ? lineNum + 1 : lineNum;
                        
                        if (lineNum >= 0 && insertPos <= newLines.length && newContent) {
                            console.log(`➕ INSERT at line ${insertPos + 1}: "${newContent}"`);
                            newLines.splice(insertPos, 0, newContent);
                            changes.push({ startLine: insertPos + 1, endLine: insertPos + 1, type: 'add' });
                        }
                    }
                }
            }
            
            if (!foundCommands) {
                return { 
                    success: false, 
                    error: `No valid diff hunks or commands found. Please use the proper diff format:

:start_line: [LINE_NUMBER]
-------
[Exact content to find]
=======
[New content to replace with]

Or use commands like: REPLACE line X with "content", DELETE line X, etc.` 
                };
            }
        }
        
        // Preserve original line endings in final content
        const finalContent = newLines.join(originalContent.includes('\r\n') ? '\r\n' : '\n');
        
        // Apply the changes
        setCode(finalContent);
        handleEditorChange(finalContent);
        
        console.log(`✅ Applied ${changes.length} changes successfully`);
        
        // Dispatch event for decoration application immediately (no delay)
        if (changes.length > 0) {
          window.dispatchEvent(new CustomEvent('applyDiffDecorations', {
            detail: { changes, filePath }
          }));
          console.log('🎯 Dispatched diff decoration event with changes:', changes);
        }
        
        return {
            success: true,
            patchedContent: finalContent,
            changes: changes
        };

    } catch (error: unknown) {
        console.error('💥 Error in AI-powered diff system:', error);
        return { success: false, error: `Failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }, [activeFile, code, handleEditorChange, setCode]);

  // --- Helper: Get Line Editing Instructions ---
  const getLineEditingInstructions = useCallback(() => {
    if (!activeFile || !code) return '';
    
    const lines = code.split('\n');
    const preview = lines.slice(0, 15).map((line, i) => `${i + 1}: ${line}`).join('\n');
    
    return `
📝 LINE EDITING SYSTEM - Use these exact commands:

COMMANDS:
• DELETE line 3 (removes line 3)
• REPLACE line 5 with "new content" (replaces line 5)
• INSERT line 10: "new content" (inserts at line 10)
• ADD line 15: "new content" (adds after line 15)

CURRENT FILE (${activeFile}) - ${lines.length} lines:
${preview}
${lines.length > 15 ? `... (${lines.length - 15} more lines)` : ''}

EXAMPLES:
• To remove import: DELETE line 1
• To change a color: REPLACE line 12 with "backgroundColor: Colors.red,"
• To add a button: INSERT line 25: "child: ElevatedButton(onPressed: () {}, child: Text('Click')),"
`;
  }, [activeFile, code]);

  // --- NEW: Handle Create File Function ---
  const handleCreateFile = useCallback(async (filePath: string, content: string): Promise<CreateFileResult> => {
    if (!projectId) {
      return { success: false, error: 'No project ID' };
    }

    try {
      // First, create the file in the tree structure
      const pathParts = filePath.split('/');
      const fileName = pathParts.pop();
      const basePath = pathParts.length > 0 ? pathParts.join('/') : null;
      
      if (!fileName) {
        return { success: false, error: 'Invalid file path' };
      }

      // Call the create API
      const success = await callCreateApi('file', basePath, fileName);
      
      if (success) {
        // Update the file content
        const encodedPath = encodeURIComponent(filePath);
        const response = await fetch(`/api/projects/${projectId}/files/content?path=${encodedPath}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        });

        if (!response.ok) {
          return { success: false, error: 'Failed to save file content' };
        }

        // Update the tree optimistically
        const newNode: FileTreeNode = { 
          name: fileName, 
          type: 'file', 
          path: filePath 
        };
        setActualFileTree(prevTree => insertNodeIntoTree(prevTree, basePath, newNode));

        return { success: true };
      } else {
        return { success: false, error: 'Failed to create file' };
      }
    } catch (error: unknown) {
      console.error('Error creating file:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }, [projectId, callCreateApi]);

  // --- State for tracking edited files ---
  const [recentlyEditedFiles, setRecentlyEditedFiles] = useState<Set<string>>(new Set());

  // Add this helper function to calculate diff changes
  const calculateDiffChanges = useCallback((oldContent: string, newContent: string): Array<{ startLine: number; endLine: number; type: 'add' | 'delete' | 'modify' }> => {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const changes: Array<{ startLine: number; endLine: number; type: 'add' | 'delete' | 'modify' }> = [];
    
    // Use a simple LCS-based diff algorithm
    const lcs = computeLCS(oldLines, newLines);
    
    let oldIndex = 0;
    let newIndex = 0;
    let lcsIndex = 0;
    
    while (oldIndex < oldLines.length || newIndex < newLines.length) {
      if (lcsIndex < lcs.length && 
          oldIndex < oldLines.length && 
          newIndex < newLines.length &&
          oldLines[oldIndex] === lcs[lcsIndex] && 
          newLines[newIndex] === lcs[lcsIndex]) {
        // Lines match, move forward in all sequences
        oldIndex++;
        newIndex++;
        lcsIndex++;
      } else if (oldIndex < oldLines.length && 
                 (lcsIndex >= lcs.length || oldLines[oldIndex] !== lcs[lcsIndex])) {
        // Line was deleted
        changes.push({
          startLine: newIndex + 1, // Position in new file where deletion would appear
          endLine: newIndex + 1,
          type: 'delete'
        });
        oldIndex++;
      } else if (newIndex < newLines.length && 
                 (lcsIndex >= lcs.length || newLines[newIndex] !== lcs[lcsIndex])) {
        // Line was added
        changes.push({
          startLine: newIndex + 1,
          endLine: newIndex + 1,
          type: 'add'
        });
        newIndex++;
      }
    }
    
    // Merge consecutive changes of the same type
    const mergedChanges: Array<{ startLine: number; endLine: number; type: 'add' | 'delete' | 'modify' }> = [];
    let currentChange: { startLine: number; endLine: number; type: 'add' | 'delete' | 'modify' } | null = null;
    
    for (const change of changes) {
      if (currentChange && currentChange.type === change.type && currentChange.endLine === change.startLine - 1) {
        currentChange.endLine = change.endLine;
      } else {
        if (currentChange) {
          mergedChanges.push(currentChange);
        }
        currentChange = { ...change };
      }
    }
    
    if (currentChange) {
      mergedChanges.push(currentChange);
    }
    
    return mergedChanges;
  }, []);

  // Helper function to compute Longest Common Subsequence
  const computeLCS = useCallback((oldLines: string[], newLines: string[]): string[] => {
    const m = oldLines.length;
    const n = newLines.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    // Build LCS table
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (oldLines[i - 1] === newLines[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }
    
    // Reconstruct LCS
    const lcs: string[] = [];
    let i = m, j = n;
    while (i > 0 && j > 0) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        lcs.unshift(oldLines[i - 1]);
        i--;
        j--;
      } else if (dp[i - 1][j] > dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }
    
    return lcs;
  }, []);

  // --- Listen for file edit events from tool execution ---
  useEffect(() => {
    const handleFileEdited = async (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('🔄 File edited event received:', customEvent.detail);
      const { filePath } = customEvent.detail;
      
      // Store the old content before refreshing
      let oldContent = '';
      if (filePath && activeFile === filePath) {
        oldContent = code;
      }
      
      // Refresh file tree to show new/updated files
      fetchTree();
      
      // Mark file as recently edited for visual indication
      if (filePath) {
        setRecentlyEditedFiles(prev => new Set(prev).add(filePath));
        
        // Remove the indicator after 3 seconds
        setTimeout(() => {
          setRecentlyEditedFiles(prev => {
            const newSet = new Set(prev);
            newSet.delete(filePath);
            return newSet;
          });
        }, 3000);

        // If the edited file is currently open, refresh its content
        if (activeFile === filePath && activeFile) {
          // Fetch new content
          const encodedPath = encodeURIComponent(filePath);
          const response = await fetch(`/api/projects/${projectId}/files/content?path=${encodedPath}`);
          if (response.ok) {
            const newContent = await response.text();
            
            // Calculate diff if we have old content
            const changes = oldContent ? calculateDiffChanges(oldContent, newContent) : [];
            
            // Set the new content
            setCode(newContent);
            
            // Dispatch event for decoration application immediately (no delay)
            if (changes.length > 0) {
              window.dispatchEvent(new CustomEvent('applyDiffDecorations', {
                detail: { changes, filePath }
              }));
              console.log('🎯 Dispatched diff decoration event with changes:', changes);
            }
          }
        } else if (!openFiles.includes(filePath)) {
          // If the file is not open but should be shown, optionally open it
          setOpenFiles(prev => [...prev, filePath]);
          setActiveFile(filePath);
          fetchFileContent(filePath);
        }
      } else {
        // Fallback: refresh current file if no specific path
        if (activeFile) {
          fetchFileContent(activeFile);
        }
      }
    };

    window.addEventListener('fileEdited', handleFileEdited);
    
    return () => {
      window.removeEventListener('fileEdited', handleFileEdited);
    };
  }, [fetchTree, fetchFileContent, activeFile, openFiles, code, projectId, calculateDiffChanges, computeLCS]);

  return {
    // State
    openFiles,
    activeFile,
    code,
    setCode, // Expose setCode if needed for external updates (e.g., AI edits)
    expandedFolders,
    actualFileTree,
    isLoadingFileTree,
    isFileContentLoading,
    templateStatus, // <-- Expose template status
    templateError,  // <-- Expose template error
    saveStatus,
    recentlyEditedFiles,
    contextMenuVisible,
    contextMenuPosition,
    contextMenuItemPath,
    contextMenuItemType,
    isInputVisible,
    inputPosition,
    inputValue,
    inputActionType,
    inputBasePath,
    // Setters (Careful exposing these directly)
    // setCode, // Maybe not expose directly if only changed via handleEditorChange
    // Handlers
    fetchFileContent,
    fetchTree,
    toggleFolder,
    handleFileClick,
    handleTabClick,
    handleCloseTab,
    handleContextMenu,
    handleBackgroundContextMenu,
    closeContextMenu,
    triggerInputMode,
    handleInputSubmit,
    handleInputCancel,
    handleEditorChange,
    getFileLanguage,
    // Expose setters needed by main component?
    setActiveFile, // Needed if main view changes impact active file
    // NEW Handler
    applyDiff,
    callCreateApi,
    handleCreateFile,
    // NEW Handler
    applyDiffDecorations,
    // Helper for AI instructions
    getLineEditingInstructions,
  };
}