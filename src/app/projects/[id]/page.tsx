// src/app/projects/[id]/page.tsx
'use client';

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { 
  FileText, ChevronRight, ChevronDown, X, Monitor, Smartphone, Settings, Loader2, Copy, Wifi, BatteryFull, 
  QrCode, Code as CodeIcon,
  RefreshCw, Sparkles, Download, AlertCircle, Globe
} from 'lucide-react';
import Image from 'next/image';
import Editor, { Monaco } from '@monaco-editor/react';
import { editor } from 'monaco-editor';

// Import Components
import FileContextMenu from '../../../components/FileContextMenu';
import InlineInput from '../../../components/InlineInput';
import SegmentedControl from '@/components/SegmentedControl';
import RightSidebar from '../../../components/RightSidebar';

// Import Shared Resources and Hooks
import { FileTreeNode } from './_project_page_shared';
import { useFileManagement } from './_project_page_file_management';
import { useChatManagement } from './_project_page_chat_management';

// Helper function to get initial state from localStorage (synchronous)
const getInitialStateSync = <T,>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const storedValue = localStorage.getItem(key);
    if (storedValue) {
      return JSON.parse(storedValue) as T;
    }
  } catch (error) {
    console.error(`Error reading localStorage key "${key}":`, error);
  }
  return defaultValue;
};

// Function to initialize CSS variables immediately
const initializeCSSVariables = (projectId: string | undefined) => {
  if (typeof window === 'undefined' || !projectId) return;
  
  // Load saved widths synchronously and set CSS variables immediately
  const rightSidebarWidth = getInitialStateSync(`layout_${projectId}_rightSidebarWidth`, 450);
  const phoneSidebarWidth = getInitialStateSync(`layout_${projectId}_phoneSidebarWidth`, 400);
  
  // Set CSS variables immediately to prevent visual jumping
  document.documentElement.style.setProperty('--right-sidebar-width', `${rightSidebarWidth}px`, 'important');
  document.documentElement.style.setProperty('--phone-sidebar-width', `${phoneSidebarWidth}px`, 'important');
  
  console.log('CSS variables initialized:', { rightSidebarWidth, phoneSidebarWidth });
  
  return { rightSidebarWidth, phoneSidebarWidth };
};

// Function to manage initial load class
const manageInitialLoadClass = () => {
  if (typeof window === 'undefined') return;
  
  // Add initial-load class immediately to prevent jumps
  document.body.classList.add('initial-load');
  
  // Remove initial-load class after a short delay to allow proper rendering
  setTimeout(() => {
    document.body.classList.remove('initial-load');
  }, 200);
};

export default function ProjectPage() {
  const params = useParams();
  const projectIdParam = params.id;
  const projectId = typeof projectIdParam === 'string' ? projectIdParam : undefined;

  // Initialize CSS variables immediately when we have projectId
  useEffect(() => {
    if (projectId) {
      const savedValues = initializeCSSVariables(projectId);
      manageInitialLoadClass();
      
      // Set states with saved values if they exist and are different from current
      if (savedValues) {
        const { rightSidebarWidth: savedRightWidth, phoneSidebarWidth: savedPhoneWidth } = savedValues;
        
        // Only update if values are different to prevent unnecessary re-renders
        if (savedRightWidth !== rightSidebarWidth) {
          setRightSidebarWidth(savedRightWidth);
        }
        if (savedPhoneWidth !== phoneSidebarWidth) {
          setPhoneSidebarWidth(savedPhoneWidth);
        }
      }
    }
  }, [projectId]);

  // --- Core Logic Hooks ---
  const fileMgmt = useFileManagement(projectId);
  
  // --- Enhanced Diff Application with Visual Feedback ---
  const applyDiffWithVisualFeedback = useCallback(async (filePath: string, diffContent: string) => {
    const result = await fileMgmt.applyDiff(filePath, diffContent);
    
    if (result.success && result.changes && editorRef.current) {
      console.log(`Applied diff with ${result.changes.length} changes`);
      console.log('Changes:', result.changes);
      
      // Apply visual decorations to the editor with longer delay
      setTimeout(() => {
        if (editorRef.current && result.changes) {
          console.log('Applying decorations to editor...');
          const decorationIds = fileMgmt.applyDiffDecorations(editorRef.current, result.changes);
          console.log('Applied decorations:', decorationIds);
          
          // Clear decorations after 10 seconds
          setTimeout(() => {
            if (editorRef.current) {
              editorRef.current.deltaDecorations(decorationIds, []);
              console.log('Cleared decorations');
            }
          }, 10000);
        }
      }, 500);
    }
    
    return result;
  }, [fileMgmt]);
  
  // Initialize chat management with enhanced diff application
  const chatMgmt = useChatManagement(projectId);

  // --- UI State specific to ProjectPage ---
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [sidebarWidth] = useState(200);
  
  // Initialize phone sidebar width - use sync values to prevent layout shifts
  const [phoneSidebarWidth, setPhoneSidebarWidth] = useState(() => {
    if (projectId) {
      return getInitialStateSync(`layout_${projectId}_phoneSidebarWidth`, 400);
    }
    return 400;
  });
  
  // Initialize right sidebar width - use sync values to prevent layout shifts
  const [rightSidebarWidth, setRightSidebarWidth] = useState(() => {
    if (projectId) {
      return getInitialStateSync(`layout_${projectId}_rightSidebarWidth`, 450);
    }
    return 450;
  });
  
  const minRightSidebarWidth = 350;
  const [isPhonePanelCollapsed, setIsPhonePanelCollapsed] = useState(false);
  const [mainView, setMainView] = useState<'code' | 'preview' | 'split'>('preview');
  const [previewDisplayMode, setPreviewDisplayMode] = useState<'phone' | 'web'>('phone');

  // --- ADDED: State for tracking decorations per file ---
  const [diffDecorationsPerFile, setDiffDecorationsPerFile] = useState<Map<string, {
    decorationIds: string[];
    changes: Array<{ startLine: number; endLine: number; type: 'add' | 'delete' | 'modify' }>;
    timestamp: number;
  }>>(new Map());

  // --- ADDED: Style for phone panel based on mainView ---
  const phonePanelStyle = mainView === 'preview' 
    ? { /* No explicit width when in preview mode, flex-grow will handle it */ } 
    : { width: isPhonePanelCollapsed ? '48px' : `${phoneSidebarWidth}px` };

  const mainDartOpenedRef = useRef(false);

  // --- ADDED: Segmented Control Options for Header ---
  const headerViewOptions = [
    { label: 'Code', value: 'code', icon: CodeIcon },
    { label: 'Preview', value: 'preview', icon: Monitor },
  ];

  // Remove the separate useLayoutEffect that was causing issues
  // The CSS variables are now set immediately in the initialization effect

  useEffect(() => {
    document.documentElement.style.setProperty('--phone-sidebar-width', `${phoneSidebarWidth}px`);
  }, [phoneSidebarWidth]);

  // --- Refs for UI ---
  const phoneSidebarRef = useRef<HTMLDivElement>(null);
  const chatHoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const whiteAreaRef = useRef<HTMLDivElement>(null);
  const lastScaleUpdateTime = useRef<number>(0);
  const SCALE_UPDATE_THROTTLE_MS = 30;

  // Constants for device dimensions - must be declared before useState
  const TARGET_DEVICE_WIDTH = 390;
  const TARGET_DEVICE_HEIGHT = 810;
  const STATUS_BAR_HEIGHT_PX = 26;

  // --- State for Preview Scaling - Start with defaults to prevent hydration mismatch ---
  const [contentScaleFactor, setContentScaleFactor] = useState(1);
  const [dynamicScreenHeight, setDynamicScreenHeight] = useState<number | string>('100%');
  const [isScaleCalculated, setIsScaleCalculated] = useState(false);

  // --- Immediate Scale Calculation Effect ---
  useEffect(() => {
    // Calculate scale immediately when component mounts and ref is available
    const calculateImmediateScale = () => {
      if (!whiteAreaRef.current || previewDisplayMode !== 'phone') {
        setIsScaleCalculated(true);
        return;
      }
      
      const rect = whiteAreaRef.current.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      
      if (width > 0 && height > 0) {
        const availableContentHeight = height - STATUS_BAR_HEIGHT_PX;
        if (availableContentHeight > 0) {
          const scaleX = width / TARGET_DEVICE_WIDTH;
          const scaleYForScreen = availableContentHeight / TARGET_DEVICE_HEIGHT;
          const finalScale = Math.min(scaleX, scaleYForScreen);
          const clampedScale = Math.max(0.1, Math.min(2, finalScale));
          
          const scaledContentHeight = TARGET_DEVICE_HEIGHT * clampedScale;
          const finalScreenHeight = scaledContentHeight + STATUS_BAR_HEIGHT_PX;
          
          setContentScaleFactor(clampedScale);
          setDynamicScreenHeight(finalScreenHeight);
          setIsScaleCalculated(true);
          
          console.log('Immediate scale calculated:', { clampedScale, finalScreenHeight, width, height });
        }
      }
    };

    // Small delay to ensure hydration is complete
    const timeoutId = setTimeout(calculateImmediateScale, 50);
    
    return () => clearTimeout(timeoutId);
  }, [previewDisplayMode, TARGET_DEVICE_WIDTH, TARGET_DEVICE_HEIGHT, STATUS_BAR_HEIGHT_PX]);

  // --- Editor Mount Handler ---
  const handleEditorDidMount = useCallback((editorInstance: editor.IStandaloneCodeEditor) => {
    editorRef.current = editorInstance;
    setTimeout(() => editorInstance.layout(), 0);
    
    // Add decorations for recently edited files
    if (fileMgmt.activeFile && fileMgmt.recentlyEditedFiles.has(fileMgmt.activeFile)) {
      const model = editorInstance.getModel();
      if (model) {
        const lineCount = model.getLineCount();
        const decorations = [];
        
        // Add green background to all lines for recently edited files
        for (let i = 1; i <= lineCount; i++) {
          decorations.push({
            range: new (window as any).monaco.Range(i, 1, i, 1),
            options: {
              isWholeLine: true,
              className: 'recently-edited-line',
              glyphMarginClassName: 'recently-edited-glyph'
            }
          });
        }
        
        const decorationIds = editorInstance.deltaDecorations([], decorations);
        
        // Remove decorations after 3 seconds
        setTimeout(() => {
          editorInstance.deltaDecorations(decorationIds, []);
        }, 3000);
      }
    }
  }, [fileMgmt.activeFile, fileMgmt.recentlyEditedFiles]);

  // --- Effect: Trigger Editor Layout on Resize --- 
  useEffect(() => {
    const performLayout = () => {
      if (editorRef.current) {
        editorRef.current.layout();
      }
    };

    performLayout(); 
    window.addEventListener('resize', performLayout);
    return () => {
      window.removeEventListener('resize', performLayout);
    };
  }, []);

  // --- Effect: Observe white area size and calculate scale ---
  useEffect(() => {
    const calculateScale = (width: number, height: number) => {
      // Always ensure we're working with phone display mode
      if (previewDisplayMode !== 'phone') {
        setContentScaleFactor(1);
        setDynamicScreenHeight('100%');
        return;
      }

      const now = Date.now();
      if (now - lastScaleUpdateTime.current < SCALE_UPDATE_THROTTLE_MS) {
        return;
      }
      lastScaleUpdateTime.current = now;

      const availableContentHeight = height - STATUS_BAR_HEIGHT_PX;
      if (width > 0 && availableContentHeight > 0 && TARGET_DEVICE_WIDTH > 0 && TARGET_DEVICE_HEIGHT > 0) {
        // Calculate scale to fit the device width exactly within the available container width
        const scaleX = width / TARGET_DEVICE_WIDTH;
        
        // For the screen height, use the minimum scale to ensure content fits
        const scaleYForScreen = availableContentHeight / TARGET_DEVICE_HEIGHT;
        const finalScale = Math.min(scaleX, scaleYForScreen);
        
        // Ensure scale is reasonable (between 0.1 and 2)
        const clampedScale = Math.max(0.1, Math.min(2, finalScale));
        
        const scaledContentHeight = TARGET_DEVICE_HEIGHT * clampedScale;
        const finalScreenHeight = scaledContentHeight + STATUS_BAR_HEIGHT_PX;

        // Only update if values have actually changed significantly (avoid micro-changes)
        const scaleDiff = Math.abs(contentScaleFactor - clampedScale);
        const heightDiff = Math.abs((typeof dynamicScreenHeight === 'number' ? dynamicScreenHeight : 0) - finalScreenHeight);
        
        if (scaleDiff > 0.01) {
          setContentScaleFactor(clampedScale);
        }
        if (heightDiff > 1) {
          setDynamicScreenHeight(finalScreenHeight);
        }
      } else {
        // Fallback to defaults
        if (contentScaleFactor !== 1) setContentScaleFactor(1);
        if (dynamicScreenHeight !== '100%') setDynamicScreenHeight('100%');
      }
    };

    if (typeof ResizeObserver === 'undefined') {
      console.warn('ResizeObserver not supported, preview scaling may not work.');
      return;
    }

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.contentRect) {
          calculateScale(entry.contentRect.width, entry.contentRect.height);
        }
      }
    });

    const currentWhiteArea = whiteAreaRef.current;
    let timeoutId: NodeJS.Timeout | null = null;

    if (currentWhiteArea && previewDisplayMode === 'phone') {
      // Very small delay to ensure DOM is stable before calculating
      timeoutId = setTimeout(() => {
        if (whiteAreaRef.current) {
          calculateScale(whiteAreaRef.current.offsetWidth, whiteAreaRef.current.offsetHeight);
          observer.observe(whiteAreaRef.current);
        }
      }, 10);
    } else {
      // Reset scaling for non-phone modes
      setContentScaleFactor(1);
      setDynamicScreenHeight('100%');
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (currentWhiteArea) {
        observer.unobserve(currentWhiteArea);
      }
      observer.disconnect();
    };
  }, [mainView, previewDisplayMode, contentScaleFactor, dynamicScreenHeight, TARGET_DEVICE_WIDTH, TARGET_DEVICE_HEIGHT, SCALE_UPDATE_THROTTLE_MS]);

  // --- Define Custom Editor Theme ---
  const handleEditorWillMount = useCallback((monaco: Monaco) => {
    monaco.editor.defineTheme('custom-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#181818',
        'editorGutter.background': '#181818',
      },
    });
    
    console.log('Monaco editor theme defined - using globals.css for diff styling');
  }, []);

  // --- Effect: Update Main View if Preview Active and File Closed ---
  useEffect(() => {
    // Removed: Don't force switch to code view, let user choose
  }, [fileMgmt.activeFile, mainView]);

  // --- Effect: Auto-show explorer when switching to code mode ---
  useEffect(() => {
    if (mainView === 'code') {
      setIsSidebarVisible(true);
    }
  }, [mainView]);

  // --- Effect: Handle File Click -> Set Main View ---
  const handleFileClickAndSetView = useCallback((path: string) => {
       fileMgmt.handleFileClick(path);
  }, [fileMgmt]);

  // --- Effect: Toggle File Explorer with Ctrl+B / Cmd+B ---
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault(); 
        setIsSidebarVisible(prev => !prev); 
      }
      
      // Clear decorations for current file with Ctrl+D
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        if (editorRef.current && fileMgmt.activeFile) {
          const fileDecorations = diffDecorationsPerFile.get(fileMgmt.activeFile);
          if (fileDecorations && fileDecorations.decorationIds.length > 0) {
            editorRef.current.deltaDecorations(fileDecorations.decorationIds, []);
            
            setDiffDecorationsPerFile(prev => {
              const newMap = new Map(prev);
              newMap.delete(fileMgmt.activeFile!);
              return newMap;
            });
            
            console.log('🧹 Manually cleared diff decorations for current file');
          }
        }
      }
      
      // Add Ctrl+T / Cmd+T to test diff decorations
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 't') {
        event.preventDefault();
        if (editorRef.current && fileMgmt.activeFile) {
          const model = editorRef.current.getModel();
          if (model) {
            const lineCount = model.getLineCount();
            const testChanges = [
              { startLine: Math.min(1, lineCount), endLine: Math.min(1, lineCount), type: 'add' as const },
              { startLine: Math.min(3, lineCount), endLine: Math.min(3, lineCount), type: 'delete' as const },
              { startLine: Math.min(5, lineCount), endLine: Math.min(5, lineCount), type: 'add' as const }
            ];
            
            console.log('🧪 Testing diff decorations with Ctrl+T:', testChanges);
            
            const existingDecorations = diffDecorationsPerFile.get(fileMgmt.activeFile);
            if (existingDecorations && existingDecorations.decorationIds.length > 0) {
              editorRef.current.deltaDecorations(existingDecorations.decorationIds, []);
            }
            
            const decorationIds = fileMgmt.applyDiffDecorations(editorRef.current, testChanges);
            
            setDiffDecorationsPerFile(prev => {
              const newMap = new Map(prev);
              newMap.set(fileMgmt.activeFile!, {
                decorationIds,
                changes: testChanges,
                timestamp: Date.now()
              });
              return newMap;
            });
            
            console.log('🧪 Test decorations applied:', decorationIds);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [fileMgmt.activeFile, diffDecorationsPerFile]); 

  // --- Effect: Listen for diff decoration events from file edits ---
  useEffect(() => {
    const handleApplyDecorations = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('🎯 Received diff decoration event:', customEvent.detail);
      
      if (!editorRef.current) {
        console.warn('⚠️ Editor not available for decorations');
        return;
      }
      
      const { filePath, changes } = customEvent.detail;
      
      setDiffDecorationsPerFile(prev => {
        const newMap = new Map(prev);
        
        const existing = newMap.get(filePath);
        if (existing && existing.decorationIds.length > 0 && editorRef.current) {
          editorRef.current.deltaDecorations(existing.decorationIds, []);
        }
        
        if (filePath === fileMgmt.activeFile && editorRef.current && changes && changes.length > 0) {
          console.log('🚀 Applying decorations for active file...');
          
          const decorationIds = fileMgmt.applyDiffDecorations(editorRef.current, changes);
          
          if (decorationIds && decorationIds.length > 0) {
            newMap.set(filePath, {
              decorationIds,
              changes,
              timestamp: Date.now()
            });
            console.log('✅ Stored decorations for file:', filePath);
          }
        }
        
        return newMap;
      });
    };
    
    window.addEventListener('applyDiffDecorations', handleApplyDecorations);
    
    return () => {
      window.removeEventListener('applyDiffDecorations', handleApplyDecorations);
    };
  }, [fileMgmt]);

  useEffect(() => {
    const cleanupHover = () => { if (chatHoverTimeoutRef.current) clearTimeout(chatHoverTimeoutRef.current); };

    return () => {
      cleanupHover();
      
      if (hotReloadTimeout) {
        clearTimeout(hotReloadTimeout);
      }
    };
  }, []);

  // --- State for Build Process ---
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [buildStatus, setBuildStatus] = useState<string | null>(null);
  const [buildComplete, setBuildComplete] = useState<boolean>(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentBuildId, setCurrentBuildId] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingAttemptsRef = useRef<number>(0);

  // --- ADDED: States for initial load and build type ---
  const [isLoadingInitialProjectState, setIsLoadingInitialProjectState] = useState(true);
  const [isProjectFreshForAutoBuild, setIsProjectFreshForAutoBuild] = useState(false);
  const [isRebuildAttempt, setIsRebuildAttempt] = useState(false);

  // --- ADDED: State for iframe content loading ---
  const [isIframeLoading, setIsIframeLoading] = useState(false);
  const [showFlutterDebugInfo, setShowFlutterDebugInfo] = useState(false);

  // --- ADDED: State for hot reload simulation ---
  const [isHotReloading, setIsHotReloading] = useState(false);
  const [hotReloadTimeout, setHotReloadTimeout] = useState<NodeJS.Timeout | null>(null);

  const MAX_POLLING_ATTEMPTS = 60;
  const POLLING_INTERVAL_MS = 5000;

  // --- Determine template status message and overall initial loading state ---
  let templateStatusMessage = "";
  if (fileMgmt.templateStatus === "loading" || fileMgmt.templateStatus === "pending") {
    templateStatusMessage = "Preparing project...";
  } else if (fileMgmt.templateStatus === "error") {
    templateStatusMessage = "Template error";
  }

  const isOverallLoadingInitial = isLoadingInitialProjectState || 
                                (isProjectFreshForAutoBuild && 
                                 (fileMgmt.templateStatus === 'loading' || fileMgmt.templateStatus === 'pending'));

  const dynamicScreenHeightString = typeof dynamicScreenHeight === 'number' ? `${dynamicScreenHeight}px` : dynamicScreenHeight;

  const phoneIframeContainerStyle: React.CSSProperties = {
    width: `${TARGET_DEVICE_WIDTH}px`,
    height: `${TARGET_DEVICE_HEIGHT}px`,
    transformOrigin: 'top left',
    transform: `scale(${contentScaleFactor})`,
    backgroundColor: previewUrl && !isIframeLoading ? 'transparent' : '#1C1C1E',
    overflow: 'auto',
    visibility: 'visible', // Always visible, let iframe handle its own visibility
  };

  const webIframeContainerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    transform: 'none',
    backgroundColor: previewUrl && !isIframeLoading ? 'transparent' : '#1C1C1E',
    overflow: 'auto',
    visibility: 'visible', // Always visible, let iframe handle its own visibility
  };

  // --- ADDED: Ref to track if initial auto-build has been triggered ---
  const initialBuildTriggered = useRef(false);

  // --- >>> PERSISTENCE LOGIC START <<< ---
  const getInitialState = <T,>(key: string, defaultValue: T): T => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const storedValue = localStorage.getItem(key);
      if (storedValue) {
        return JSON.parse(storedValue) as T;
      }
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
    }
    return defaultValue;
  };

  // --- Load persisted state on mount ---
  useEffect(() => {
    if (!projectId) return;

    console.log("ProjectPage: Loading initial state from localStorage...");
    setIsLoadingInitialProjectState(true);

    // Note: phone and right sidebar widths are now initialized synchronously in useState
    setIsSidebarVisible(getInitialState<boolean>(`layout_${projectId}_isSidebarVisible`, false));

    // Load build-related state
    const loadedBuildComplete = getInitialState<boolean>(`build_${projectId}_buildComplete`, false);
    const loadedPreviewUrl = getInitialState<string | null>(`build_${projectId}_previewUrl`, null);
    const loadedBuildError = getInitialState<string | null>(`build_${projectId}_buildError`, null);
    
    setBuildComplete(loadedBuildComplete);
    setPreviewUrl(loadedPreviewUrl);
    setBuildError(loadedBuildError);
    setBuildStatus(getInitialState<string | null>(`build_${projectId}_buildStatus`, null));

    if (loadedBuildComplete || loadedPreviewUrl || loadedBuildError) {
      console.log("ProjectPage: Project has existing build state. Not considered fresh for auto-build.");
      initialBuildTriggered.current = true;
      setIsProjectFreshForAutoBuild(false);
    } else {
      console.log("ProjectPage: Project is fresh. Will be considered for auto-build.");
      setIsProjectFreshForAutoBuild(true);
      initialBuildTriggered.current = false;
    }
    
    setIsLoadingInitialProjectState(false);
    console.log("ProjectPage: Finished loading initial state from localStorage.");

  }, [projectId]);

  // --- Save state to localStorage on change ---
  useEffect(() => {
    if (typeof window !== 'undefined' && projectId) {
      localStorage.setItem(`layout_${projectId}_phoneSidebarWidth`, JSON.stringify(phoneSidebarWidth));
    }
  }, [phoneSidebarWidth, projectId]);

  useEffect(() => {
    if (typeof window !== 'undefined' && projectId) {
      localStorage.setItem(`layout_${projectId}_rightSidebarWidth`, JSON.stringify(rightSidebarWidth));
    }
  }, [rightSidebarWidth, projectId]);

  useEffect(() => {
    if (typeof window !== 'undefined' && projectId) {
      localStorage.setItem(`layout_${projectId}_isSidebarVisible`, JSON.stringify(isSidebarVisible));
    }
  }, [isSidebarVisible, projectId]);

  // --- Save build state to localStorage on change ---
  useEffect(() => {
    if (typeof window !== 'undefined' && projectId) {
      localStorage.setItem(`build_${projectId}_buildComplete`, JSON.stringify(buildComplete));
    }
  }, [buildComplete, projectId]);

  useEffect(() => {
    if (typeof window !== 'undefined' && projectId) {
      localStorage.setItem(`build_${projectId}_previewUrl`, JSON.stringify(previewUrl));
    }
  }, [previewUrl, projectId]);

  useEffect(() => {
    if (typeof window !== 'undefined' && projectId) {
      localStorage.setItem(`build_${projectId}_buildError`, JSON.stringify(buildError));
    }
  }, [buildError, projectId]);

  useEffect(() => {
    if (typeof window !== 'undefined' && projectId) {
      localStorage.setItem(`build_${projectId}_buildStatus`, JSON.stringify(buildStatus));
    }
  }, [buildStatus, projectId]);

  // --- Hot Reload Simulation Function ---
  const triggerHotReload = useCallback(() => {
    if (!previewUrl) return;
    
    console.log('🔥 Triggering hot reload simulation...');
    
    if (hotReloadTimeout) {
      clearTimeout(hotReloadTimeout);
    }
    
    setIsHotReloading(true);
    
    const timeout = setTimeout(() => {
      setIsHotReloading(false);
      console.log('🔥 Hot reload simulation complete');
    }, 2500);
    
    setHotReloadTimeout(timeout);
  }, [previewUrl, hotReloadTimeout]);

  // --- Build Trigger Handler ---
  const handleBuildClick = useCallback(async () => {
    if (!projectId || isBuilding) { 
        return; 
    }
    console.log(`Frontend: Triggering build for project: ${projectId}`);
    
    const wasLiveBeforeThisBuild = !!previewUrl;
    setIsRebuildAttempt(wasLiveBeforeThisBuild);

    setIsBuilding(true);
    setBuildError(null); 
    setBuildStatus(wasLiveBeforeThisBuild ? 'Reinitiating build...' : 'Submitting build request...');
    setBuildComplete(false);
    setIsIframeLoading(false);
    
    pollingAttemptsRef.current = 0;
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current); 
      pollingIntervalRef.current = null;
    }

    try {
        const response = await fetch(`/api/projects/${projectId}/build`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('Frontend: Build API call failed:', result);
            const errorMsg = result.error || result.details || `Build failed with status ${response.status}`;
            setBuildError(errorMsg);
            setIsBuilding(false); 
            return; 
        }

        console.log('Frontend: Build triggered successfully:', result);
        if (result.details && result.details.buildId) {
            setBuildError(null);
            setBuildComplete(false); 
            setPreviewUrl(null); 
            setCurrentBuildId(result.details.buildId);
            setIsBuilding(true); 
        } else {
            console.error('Frontend: Build API call succeeded but no buildId received or details object missing.', result);
            const errorMsg = 'Build triggered, but no Build ID was returned from the server or the details object was missing.';
            setBuildError(errorMsg);
            setIsBuilding(false); 
        }

    } catch (error: unknown) {
        console.error('Frontend: Error calling build API:', error);
        const errorMsg = (typeof error === 'object' && error !== null && 'message' in error) ? (error as {message: string}).message : 'An unknown error occurred during build trigger.';
        setBuildError(errorMsg);
        setIsBuilding(false); 
    }
  }, [projectId, isBuilding, previewUrl]);

  // --- ADDED: useEffect for Polling Build Status ---
  useEffect(() => {
    const stopPolling = () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setIsBuilding(false); 
      pollingAttemptsRef.current = 0; 
    };

    if (currentBuildId && projectId && isBuilding) { 
      pollingAttemptsRef.current = 0; 

      const pollStatus = async () => {
        if (pollingAttemptsRef.current >= MAX_POLLING_ATTEMPTS) {
          console.warn(`Frontend: Max polling attempts reached for build ID ${currentBuildId}. Stopping polling.`);
          setBuildError('Build status polling timed out. Please check Cloud Build logs manually.');
          setBuildStatus('Polling timed out.');
          stopPolling();
          return;
        }

        pollingAttemptsRef.current++;
        console.log(`Frontend: Polling for build status (Attempt ${pollingAttemptsRef.current}/${MAX_POLLING_ATTEMPTS}). ID: ${currentBuildId}`);

        try {
          const response = await fetch(`/api/projects/${projectId}/build/${currentBuildId}/status`);
          const data = await response.json();

          if (!response.ok) {
            console.error('Frontend: Error fetching build status:', data);
            if (response.status === 404) {
                setBuildError(`Build ID ${currentBuildId} not found. ${data.details || ''}`);
                setBuildStatus('Build not found.');
                stopPolling();
                return;
            }
            setBuildStatus(`Error fetching status: ${data.error || 'Network error'}`);
            return; 
          }

          console.log('Frontend: Build status received:', data);
          const statusText = `Status: ${data.status}. ${data.statusDetail || ''}`;
          setBuildStatus(statusText);

          if (data.status === 'SUCCESS') {
              console.log('Frontend: Build completed successfully!');
              setBuildComplete(true);
              setBuildError(null);
              setBuildStatus('Build completed successfully.');
              
              const servicePath = `/api/projects/${projectId}/preview/`;
              const timestamp = Date.now();
              const newPreviewUrl = `${servicePath}index.html?_t=${timestamp}&renderer=html`;
              console.log('Setting Flutter preview URL:', newPreviewUrl);
              setPreviewUrl(newPreviewUrl);
              setIsIframeLoading(true);
              
              // Add timeout fallback to prevent iframe from staying hidden forever
              setTimeout(() => {
                console.log('Flutter iframe timeout - forcing visibility');
                setIsIframeLoading(false);
              }, 10000); // 10 second timeout
              
              stopPolling();
          } 
          else if (data.status === 'FAILURE' || data.status === 'CANCELLED' || data.status === 'TIMEOUT') {
              console.warn(`Frontend: Build ended with status: ${data.status}`);
              setBuildError(`Build ${data.status.toLowerCase()}: ${data.statusDetail || 'See logs for details'}`);
              setBuildComplete(false);
              setPreviewUrl(null);
              stopPolling();
          }

        } catch (error: unknown) {
          console.error('Frontend: Error polling build status:', error);
          const errMsg = (typeof error === 'object' && error !== null && 'message' in error) ? (error as {message: string}).message : 'An unknown error occurred during polling.';
          setBuildStatus(`Polling error: ${errMsg}`);
        }
      };

      pollStatus();

      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      pollingIntervalRef.current = setInterval(pollStatus, POLLING_INTERVAL_MS);

      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };
    }
  }, [currentBuildId, projectId, isBuilding, MAX_POLLING_ATTEMPTS, POLLING_INTERVAL_MS]);

  // --- Effect: Reset building state if stuck for too long ---
  useEffect(() => {
    if (isBuilding) {
      const timeout = setTimeout(() => {
        console.warn('Build process taking too long, resetting state');
        setIsBuilding(false);
        setBuildStatus('Build timed out');
      }, 120000); // 2 minutes timeout

      return () => clearTimeout(timeout);
    }
  }, [isBuilding]);

  // --- Effect: Trigger Initial Build After Template Init ---
  useEffect(() => {
    if (
      !isLoadingInitialProjectState &&
      isProjectFreshForAutoBuild &&
      fileMgmt.templateStatus === 'completed' && 
      projectId && 
      !isBuilding && 
      !initialBuildTriggered.current
    ) {
        console.log('ProjectPage: Template initialization complete for a fresh project. Triggering initial build automatically...');
        initialBuildTriggered.current = true;
        handleBuildClick(); 
    }
  }, [isLoadingInitialProjectState, isProjectFreshForAutoBuild, fileMgmt.templateStatus, projectId, isBuilding, buildComplete, handleBuildClick]);

  // --- Effect: Automatically open main.dart after files are fetched ---
  useEffect(() => {
    if (!fileMgmt.isLoadingFileTree && fileMgmt.actualFileTree && fileMgmt.actualFileTree.length > 0 && !mainDartOpenedRef.current) {
      const findFileByPathRecursive = (
        nodes: FileTreeNode[], 
        targetPath: string,
        currentPathPrefix: string = ''
      ): { path: string; node: FileTreeNode } | null => {
        for (const node of nodes) {
          const fullNodePath = currentPathPrefix ? `${currentPathPrefix}/${node.name}` : node.name;
          if (node.type === 'file' && fullNodePath === targetPath) {
            return { path: fullNodePath, node };
          }
          if (node.type === 'folder' && node.children) {
            const found = findFileByPathRecursive(node.children, targetPath, fullNodePath);
            if (found) return found;
          }
        }
        return null;
      };

      let fileToOpen: { path: string; node: FileTreeNode } | null = null;

      fileToOpen = findFileByPathRecursive(fileMgmt.actualFileTree, 'main.dart');

      if (!fileToOpen) {
        fileToOpen = findFileByPathRecursive(fileMgmt.actualFileTree, 'lib/main.dart');
      }

      if (fileToOpen) {
        console.log(`ProjectPage: Automatically opening default file: ${fileToOpen.path}`);
        handleFileClickAndSetView(fileToOpen.path);
        mainDartOpenedRef.current = true;
      } else {
        console.log('ProjectPage: Default main.dart or lib/main.dart not found in the project structure.');
        if (!fileMgmt.activeFile && fileMgmt.actualFileTree.length > 0) {
          const findFirstFile = (nodes: FileTreeNode[], currentPathPrefix: string = ''): string | null => {
            for (const node of nodes) {
              const fullNodePath = currentPathPrefix ? `${currentPathPrefix}/${node.name}` : node.name;
              if (node.type === 'file') return fullNodePath;
              if (node.type === 'folder' && node.children) {
                const found = findFirstFile(node.children, fullNodePath);
                if (found) return found;
              }
            }
            return null;
          };
          const firstFilePath = findFirstFile(fileMgmt.actualFileTree);
          if (firstFilePath) {
            console.log(`ProjectPage: Opening first available file as fallback: ${firstFilePath}`);
            handleFileClickAndSetView(firstFilePath);
            mainDartOpenedRef.current = true;
          }
        }
      }
    }
  }, [fileMgmt.isLoadingFileTree, fileMgmt.actualFileTree, handleFileClickAndSetView, fileMgmt.activeFile]);

  // --- Recursive File Tree Renderer ---
  const RenderFileTreeRecursive = useCallback(({ items, level = 0, pathPrefix = '' }: { items: FileTreeNode[] | null, level?: number, pathPrefix?: string }) => {
    if (fileMgmt.isLoadingFileTree) {
      return <div className="p-2 text-sm text-gray-400 flex items-center"><Loader2 size={16} className="animate-spin mr-2"/> Loading files...</div>;
    }
    if (!items || items.length === 0) {
      return <div className="p-2 text-sm text-gray-500">No files or folders found.</div>;
    }
    return (
      <ul className="text-sm space-y-0.5">
        {items.map((item) => {
          const currentPath = pathPrefix ? `${pathPrefix}/${item.name}` : item.name;
          const isExpanded = fileMgmt.expandedFolders[currentPath] || false;
          const isSelected = fileMgmt.activeFile === currentPath;
          const isRecentlyEdited = fileMgmt.recentlyEditedFiles.has(currentPath);
          return (
            <li key={currentPath} className="relative">
              {level > 0 && <span className="absolute left-0 top-0 bottom-0 w-px bg-custom-dark" style={{ left: `${level * 1.25 - 0.6}rem` }} aria-hidden="true" />}
              <div
                className={`flex items-center space-x-1.5 rounded cursor-pointer pl-1 pr-1 py-0.5 transition-all duration-300 ${
                  isSelected
                    ? 'bg-blue-800/50 text-white'
                    : isRecentlyEdited
                      ? 'bg-green-800/30 border border-green-500/50 animate-pulse'
                      : 'hover:bg-zinc-800/60'
                }`}
                style={{ paddingLeft: `${level * 1.25}rem` }}
                onClick={() => item.type === 'folder' ? fileMgmt.toggleFolder(currentPath) : handleFileClickAndSetView(currentPath)}
                onContextMenu={(e) => fileMgmt.handleContextMenu(e, currentPath, item.type)}
              >
                {item.type === 'folder' ? (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <FileText size={14} />}
                <span className="truncate flex items-center gap-1">
                  {item.name.split('/').pop()}
                  {isRecentlyEdited && (
                    <span className="text-green-400 text-xs animate-bounce">✨</span>
                  )}
                </span>
              </div>
              {item.type === 'folder' && isExpanded && item.children && (
                <RenderFileTreeRecursive items={item.children} level={level + 1} pathPrefix={currentPath} />
              )}
            </li>
          );
        })}
      </ul>
    );
  }, [handleFileClickAndSetView, fileMgmt]);

  useEffect(() => {
    if (!editorRef.current || !fileMgmt.activeFile) return;
    
    const fileDecorations = diffDecorationsPerFile.get(fileMgmt.activeFile);
    if (fileDecorations && fileDecorations.changes.length > 0) {
      console.log('📄 Reapplying decorations for file:', fileMgmt.activeFile);
      
      setTimeout(() => {
        if (editorRef.current && fileMgmt.activeFile) {
          const decorationIds = fileMgmt.applyDiffDecorations(editorRef.current, fileDecorations.changes);
          
          setDiffDecorationsPerFile(prev => {
            const newMap = new Map(prev);
            const existing = newMap.get(fileMgmt.activeFile!);
            if (existing) {
              existing.decorationIds = decorationIds;
            }
            return newMap;
          });
        }
      }, 100);
    }
  }, [fileMgmt.activeFile]);

  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      
      setDiffDecorationsPerFile(prev => {
        const newMap = new Map(prev);
        
        for (const [filePath, decorations] of newMap.entries()) {
          if (now - decorations.timestamp > fiveMinutes) {
            if (filePath !== fileMgmt.activeFile && editorRef.current) {
              editorRef.current.deltaDecorations(decorations.decorationIds, []);
            }
            newMap.delete(filePath);
          }
        }
        
        return newMap;
      });
    }, 60000);
    
    return () => clearInterval(cleanupInterval);
  }, [fileMgmt.activeFile]);

  // --- Effect: Listen for file changes and trigger hot reload simulation ---
  useEffect(() => {
    const handleFileChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('📝 File change detected for hot reload:', customEvent.detail);
      
      if (previewUrl && !isBuilding && !isHotReloading) {
        triggerHotReload();
      }
    };
    
    window.addEventListener('fileChanged', handleFileChange);
    
    return () => {
      window.removeEventListener('fileChanged', handleFileChange);
    };
  }, [previewUrl, isBuilding, isHotReloading, triggerHotReload]);

  // --- Effect: Auto-hide hot reload overlay for testing ---
  useEffect(() => {
    if (isHotReloading) {
      const timeout = setTimeout(() => {
        setIsHotReloading(false);
        console.log('🔥 Auto-hiding hot reload overlay for testing');
      }, 5000);

      return () => clearTimeout(timeout);
    }
  }, [isHotReloading]);

  // --- Render ---
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-zinc-900 text-gray-300 font-poppins">
      {/* Header Bar */}
      <header className="h-12 bg-zinc-950 border-b border-zinc-800 flex items-center px-4 text-xs justify-between flex-shrink-0 relative">
        {/* Left Section */}
        <div className="flex items-center"> 
          <button
            title="Toggle Explorer"
            className="mr-3 p-1 rounded hover:bg-custom-dark text-gray-400 hover:text-white"
            onClick={() => setIsSidebarVisible(prev => !prev)}
          >
            <FileText size={16} />
          </button>
          <span>Project: {projectId ?? 'Loading...'}</span>
        </div>

        {/* Centered Segmented Control */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <SegmentedControl
              options={headerViewOptions}
              selectedValue={mainView === 'split' ? 'code' : mainView}
              onChange={(value) => setMainView(value as 'code' | 'preview')}
            />
        </div>

        {/* Right Section */}
        <div className="flex items-center space-x-2"> 
          {/* Live Button - Updated */}
          {(() => {
            let buttonText = "Live";
            let buttonTitle = "Start live preview";
            let icon = <RefreshCw size={16} />;
            let bgColor = "bg-zinc-800 text-gray-200 hover:bg-zinc-700";
            let dotColor = "bg-gray-500";
            let isDisabled = false;
            let showSpinningIcon = false;
            let showPulsingDot = false;

            if (isOverallLoadingInitial) {
              buttonText = templateStatusMessage || "Initializing...";
              buttonTitle = templateStatusMessage || "Initializing project preview...";
              icon = <RefreshCw size={16} className="animate-spin" />;
              bgColor = "bg-yellow-500 text-yellow-900 cursor-not-allowed";
              dotColor = "bg-yellow-800 animate-pulse";
              isDisabled = true;
              showSpinningIcon = true;
              showPulsingDot = true;
            } else if (isBuilding) {
              buttonText = isRebuildAttempt ? "Rebuilding" : "Syncing";
              buttonTitle = isRebuildAttempt ? "Rebuilding preview..." : "Syncing preview...";
              icon = <RefreshCw size={16} className="animate-spin" />;
              bgColor = "bg-yellow-500 text-yellow-900 cursor-not-allowed";
              dotColor = "bg-yellow-800 animate-pulse";
              isDisabled = true;
              showSpinningIcon = true;
              showPulsingDot = true;
            } else if (buildError) {
              buttonText = "Error";
              buttonTitle = `Build Error - ${buildError} - Click to retry`;
              icon = <AlertCircle size={16} />;
              bgColor = "bg-red-500 text-white hover:bg-red-600";
              dotColor = "bg-red-900";
            } else if (previewUrl) {
              buttonText = "Live";
              buttonTitle = "Preview is live - Click to rebuild";
              dotColor = "bg-green-500";
            } else {
              buttonText = "Build";
              buttonTitle = "Start live preview";
            }

            return (
              <button
                title={buttonTitle}
                onClick={handleBuildClick}
                disabled={isDisabled}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${bgColor}`}
              >
                {icon} 
                <span>{buttonText}</span>
                <span
                  className={`w-2 h-2 rounded-full ml-1 ${dotColor} ${showPulsingDot ? 'animate-pulse' : ''}`}
                ></span>
              </button>
            );
          })()}

          {/* Upgrade Button */}
          <button 
            title="Upgrade"
            className="px-3 py-1.5 rounded-md bg-zinc-800 text-gray-200 hover:bg-zinc-700 flex items-center space-x-2 text-sm font-medium transition-colors"
          >
            <Sparkles size={16} />
            <span>Upgrade</span>
          </button>

          {/* Code Button (Download) */}
          <button 
            title="Download Code"
            className="px-3 py-1.5 rounded-md bg-zinc-800 text-gray-200 hover:bg-zinc-700 flex items-center space-x-2 text-sm font-medium transition-colors"
          >
            <Download size={16} />
            <span>Code</span>
          </button>
          
          <div className="h-5 w-px bg-zinc-700 mx-1"></div>

          <button title="Publish" className="bg-white text-gray-800 hover:bg-gray-200 px-4 py-1.5 rounded-md text-sm font-medium transition-colors">
            Publish
          </button>
        </div>
      </header>

      {/* Main Row Wrapper: Fixed height and overflow hidden */}
      <div className="flex-grow flex overflow-hidden h-[calc(100vh-3rem)] relative">
        {/* NEW WRAPPER for existing content */}
        <div className="flex-1 flex min-w-0 h-full overflow-hidden relative">
        {/* Combined Phone and Controls Area */}
        <div
          ref={phoneSidebarRef}
            className={`flex ${mainView === 'preview' ? 'flex-1 basis-0' : 'flex-shrink-0'} bg-zinc-950 relative transition-all duration-300 ease-in-out`}
            style={phonePanelStyle}
        >
            {/* Control Panel - Floating controls for full-preview web mode */}
            {mainView === 'preview' && previewDisplayMode === 'web' && previewUrl && (
              <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-20 bg-zinc-900/80 p-2 rounded-lg backdrop-blur-sm shadow-lg">
                <button
                  onClick={() => setPreviewDisplayMode('phone')}
                  title="Switch to Phone View"
                  className="p-2 text-gray-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-full transition-colors"
                >
                  <Smartphone size={18} />
                </button>
                
                <button
                  onClick={() => window.open(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(previewUrl)}&bgcolor=18181b&color=ffffff&qzone=1`, '_blank')}
                  title="View QR Code"
                  className="p-2 text-gray-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-full transition-colors"
                >
                  <QrCode size={18} />
                </button>
                
                <button
                  onClick={handleBuildClick}
                  disabled={isBuilding || isOverallLoadingInitial}
                  title="Rebuild Preview"
                  className={`p-2 rounded-full transition-colors ${
                    isBuilding || isOverallLoadingInitial
                      ? 'bg-yellow-500 text-yellow-900 cursor-not-allowed'
                      : 'text-gray-300 hover:text-white bg-zinc-800 hover:bg-zinc-700'
                  }`}
                >
                  <RefreshCw size={18} className={isBuilding || isOverallLoadingInitial ? 'animate-spin' : ''} />
                </button>
              </div>
            )}

            {/* Mode Toggle Button */}
            {mainView !== 'preview' && ( 
            <button
              onClick={() => setPreviewDisplayMode(prev => prev === 'phone' ? 'web' : 'phone')}
              className="absolute top-2 left-1 z-30 p-2 rounded text-gray-300 hover:bg-zinc-700 hover:text-white transition-colors"
              title={previewDisplayMode === 'phone' ? "Switch to Full Web View" : "Switch to Phone Emulator View"}
            >
              {previewDisplayMode === 'phone' ? <Globe size={18} /> : <Smartphone size={18} />}
            </button>
            )}

            {!isPhonePanelCollapsed && (
              <div className={`flex h-full w-full ${mainView === 'preview' ? 'flex-row items-start justify-center p-4 space-x-8' : ''}`}>
                <aside 
                    className={`flex flex-col ${previewDisplayMode === 'phone' ? 'items-center justify-center' : ''} overflow-hidden 
                              ${mainView === 'preview' ? 'flex-shrink-0' : 'flex-grow'} 
                              ${previewDisplayMode === 'phone' && mainView !== 'preview' ? 'p-4' : ''}`}
                >
                    {/* Wrapper for bezel (phone) or full-size container (web) */}
                    <div 
                      className={`${previewDisplayMode === 'phone' ? 'bg-neutral-800 rounded-[44px] p-[8px] shadow-2xl' : 'w-full h-full'} relative overflow-hidden`}
                      style={previewDisplayMode === 'phone' ? { width: '300px', height: '620px' } : { width: '100%', height: '100%' }} 
                    >
                      {/* Inner "screen" area */}
                      <div 
                        ref={whiteAreaRef}
                        className={`w-full bg-black ${previewDisplayMode === 'phone' ? 'rounded-[40px]' : ''} overflow-hidden relative flex flex-col ${ 
                          !previewUrl && !buildError && !isIframeLoading
                            ? 'bg-[#1C1C1E] text-gray-300' 
                            : (previewUrl && !isIframeLoading) ? 'bg-white text-neutral-700' : 'bg-[#1C1C1E] text-gray-300'
                        }`}
                        style={previewDisplayMode === 'phone' ? { height: dynamicScreenHeightString } : {height: '100%'}}
                      >
                        {/* Phone Status Bar (conditional) */}
                        {previewDisplayMode === 'phone' && (
                          <>
                            <div 
                              className={`w-full flex-shrink-0 flex items-center justify-between px-4 text-sm transition-colors duration-200 ${ 
                                !previewUrl && !buildError && !isIframeLoading
                                  ? 'bg-[#1C1C1E] text-gray-300' 
                                  : (previewUrl && !isIframeLoading) ? 'bg-white text-neutral-700' : 'bg-[#1C1C1E] text-gray-300'   
                              }`}
                              style={{ height: `${STATUS_BAR_HEIGHT_PX}px` }}
                            >
                              <span className="pl-1">9:41</span>
                              <div className="flex items-center space-x-1.5 mt-0.5"><Wifi size={16} /><BatteryFull size={16} /></div>
                            </div>
                            {/* Notch element */}
                            <div 
                              className="absolute left-1/2 -translate-x-1/2 bg-black rounded-full z-10"
                              style={{ top: '6px', width: '100px', height: '24px' }}
                            />
                          </>
                        )}

                        {/* Content Area: iframe or build messages */}
                        <div className={`flex-grow relative overflow-hidden ${previewDisplayMode === 'web' ? 'h-full w-full' : ''}`}>
                          {/* Scaled/Full-size container for iframe content */}
                          <div
                            className={`absolute top-0 left-0 ${previewDisplayMode === 'web' ? 'w-full h-full' : ''} relative ${previewDisplayMode === 'phone' ? 'phone-iframe-content' : ''}`}
                            style={previewDisplayMode === 'phone' ? phoneIframeContainerStyle : webIframeContainerStyle}
                          >
                            {/* Hot Reload Overlay */}
                            {isHotReloading && (
                              <div className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
                                <span className="text-gray-600 text-lg font-medium">Making changes...</span>
                              </div>
                            )}
                            {/* Build/Error/Iframe/Loading Messages */}
                            {buildError ? (
                              <div className={`w-full ${previewDisplayMode === 'phone' ? 'h-[calc(100%-28px)]' : 'h-full'} flex flex-col items-center justify-center p-4 text-center text-gray-300 text-sm bg-[#1C1C1E]`}>
                                <X size={40} className="mb-2 text-red-500"/>
                                <p className="text-base font-semibold text-red-400">Build Problem</p>
                                <p className="text-xs text-gray-400 mt-1 px-2 break-words">{buildError}</p>
                                <button
                                   onClick={handleBuildClick}
                                   className="mt-4 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-md text-xs text-white disabled:opacity-50"
                                   disabled={isBuilding || isOverallLoadingInitial}
                                >
                                   {isBuilding ? 'Processing...' : 'Try Rebuilding'}
                                </button>
                              </div>
                            ) : previewUrl ? (
                              <>
                                {isIframeLoading && (
                                  <div className={`w-full ${previewDisplayMode === 'phone' ? 'h-[calc(100%-28px)]' : 'h-full'} flex flex-col items-center justify-center p-4 text-center text-gray-300 text-sm bg-[#1C1C1E]`}>
                                    <Loader2 size={20} className="animate-spin mb-2"/>
                                    <p>Loading preview...</p>
                                  </div>
                                )}
                                <iframe
                                  src={previewUrl}
                                  title="App Preview"
                                  className={`w-full ${previewDisplayMode === 'phone' ? 'h-[calc(100%-28px)]' : 'h-full'} border-none`}
                                  style={{
                                    backgroundColor: '#ffffff',
                                    visibility: isIframeLoading ? 'hidden' : 'visible',
                                  }}
                                  sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-presentation allow-top-navigation-by-user-activation"
                                  allow="accelerometer; autoplay; camera; clipboard-read; clipboard-write; fullscreen; geolocation; gyroscope; magnetometer; microphone; midi; payment; picture-in-picture; speaker-selection; sync-xhr; usb; web-share"
                                  onLoad={() => {
                                    console.log('Flutter iframe loaded successfully');
                                    setIsIframeLoading(false);
                                    
                                    // Check if Flutter content is visible after a delay
                                    setTimeout(() => {
                                      setShowFlutterDebugInfo(true);
                                    }, 3000);
                                  }}
                                  onError={() => {
                                    console.error('Flutter iframe failed to load');
                                    setIsIframeLoading(false);
                                  }}
                                />
                                
                                {/* Flutter Debug Overlay */}
                                {showFlutterDebugInfo && !isIframeLoading && (
                                  <div className="absolute top-4 left-4 bg-black/80 text-white p-2 rounded text-xs max-w-[80%] z-10">
                                    <div>Flutter Preview URL: {previewUrl}</div>
                                    <div>If you see white content, the Flutter app might be loading or have initialization issues.</div>
                                    <button
                                      onClick={() => setShowFlutterDebugInfo(false)}
                                      className="mt-1 text-blue-400 underline"
                                    >
                                      Hide
                                    </button>
                                  </div>
                                )}
                              </>
                            ) : isBuilding || isOverallLoadingInitial ? (
                              <div className={`absolute top-0 left-0 right-0 w-full ${previewDisplayMode === 'phone' ? 'h-[calc(100%-28px)]' : 'h-full'} flex flex-col items-center justify-center p-4 text-center bg-[#1C1C1E]`}>
                                <p className="text-base font-semibold text-gray-300">{isOverallLoadingInitial ? (templateStatusMessage || 'Initializing...') : 'Building Preview...'}</p>
                                {/* Debug info */}
                                <div className="text-xs text-gray-500 mt-2">
                                  Debug: isBuilding={isBuilding.toString()}, isOverallLoadingInitial={isOverallLoadingInitial.toString()}, previewUrl={previewUrl ? 'exists' : 'null'}
                                </div>
                              </div>
                            ) : (
                              <div className={`w-full ${previewDisplayMode === 'phone' ? 'h-[calc(100%-28px)]' : 'h-full'} flex flex-col items-center justify-center p-4 text-center text-gray-400 text-sm bg-[#1C1C1E]`}>
                                <p className="text-base font-semibold text-gray-300">Start a build to see your preview.</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Phone Home Bar (conditional) */}
                        {previewDisplayMode === 'phone' && (
                          <div
                            className="absolute bottom-3 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-neutral-400 rounded-full z-20"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                    </div>
                </aside>

                {/* QR Code Section */}
                {mainView === 'preview' && (
                  <div className="flex-shrink-0 flex flex-col items-center justify-center w-[300px]">
                    {/* QR Code Container */}
                    <div className="bg-zinc-900 p-4 rounded-lg shadow-xl border border-zinc-800">
                      {previewUrl ? (
                        <Image
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(previewUrl)}&bgcolor=18181b&color=ffffff&qzone=1`}
                          alt="QR Code for App Preview"
                          width={280}
                          height={280}
                          className="rounded-md"
                          unoptimized
                        />
                      ) : (
                        <div className="w-[280px] h-[280px] bg-zinc-800 rounded-md relative overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-zinc-600/20 to-transparent animate-[shimmer_2s_infinite] transform -skew-x-12"></div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                              <QrCode size={48} className="mx-auto mb-2 text-zinc-600" />
                              <p className="text-xs text-zinc-500">QR code will appear here</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Enhanced Info Section */}
                    <div className="w-full mt-6 space-y-3">
                      <div className="text-center">
                        <h3 className="text-sm font-semibold text-white mb-1">Test on Device</h3>
                        <p className="text-xs text-gray-400">Scan with your phone camera</p>
                      </div>
                      
                      <div className="flex flex-col space-y-2">
                        <button
                          onClick={() => previewUrl && navigator.clipboard.writeText(previewUrl)}
                          disabled={!previewUrl}
                          className={`flex items-center justify-center space-x-2 w-full px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                            previewUrl
                              ? 'bg-zinc-800 text-gray-200 hover:bg-zinc-700'
                              : 'bg-zinc-900 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          <Copy size={14} />
                          <span>Copy Link</span>
                        </button>
                        
                        <button
                          onClick={() => previewUrl && window.open(previewUrl, '_blank')}
                          disabled={!previewUrl}
                          className={`flex items-center justify-center space-x-2 w-full px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                            previewUrl
                              ? 'bg-zinc-800 text-gray-200 hover:bg-zinc-700'
                              : 'bg-zinc-900 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          <Globe size={14} />
                          <span>Open Browser</span>
                        </button>
                      </div>
                      
                      <div className="bg-zinc-950 rounded-md p-3 border border-zinc-800">
                        <div className="flex items-center space-x-1.5 mb-1">
                          <Wifi size={12} className="text-gray-400" />
                          <span className="text-xs font-medium text-gray-300">Same Network</span>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          Device must be on same network
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
        </div>

        {/* ADDED: Divider line between phone panel and explorer */}
          <div className={`h-full bg-zinc-800 flex-shrink-0 transition-all duration-300 ease-in-out
                         ${isSidebarVisible && mainView !== 'preview' ? 'w-px opacity-100' : 'w-0 opacity-0 pointer-events-none'}`} />

        {/* File Explorer Sidebar */}
        {isSidebarVisible && (
          <>
            <aside
                className={`left-sidebar bg-black flex flex-col select-none transition-all duration-300 ease-in-out
                           ${mainView === 'preview'
                             ? 'opacity-0 !p-0 !m-0 border-transparent pointer-events-none overflow-hidden'
                             : 'pl-2 pt-2 pb-2 opacity-100'
                           }`}
              style={{
                  width: mainView === 'preview' ? '0px' : `${sidebarWidth}px`,
                height: '100%'
              }}
              onContextMenu={fileMgmt.handleBackgroundContextMenu}
            >
                <div className={`flex flex-col flex-grow min-h-0 ${mainView === 'preview' ? 'invisible' : ''}`}>
              <div className="flex justify-between items-center mb-2 px-1 flex-shrink-0">
                <span className="font-semibold text-sm text-white">EXPLORER</span>
                <span className="ml-auto bg-zinc-800 px-1.5 py-0.5 rounded-full text-xs text-gray-400 font-mono select-none">
                  Ctrl + B
                </span>
              </div>
              <div className="flex-grow overflow-y-auto min-h-0 custom-scrollbar">
                 <RenderFileTreeRecursive items={fileMgmt.actualFileTree} />
                  </div>
              </div>
            </aside>
          </>
        )}

          {/* Main Content Area */}
          <main className={`flex-shrink flex flex-col bg-zinc-900 h-full transition-all duration-300 ease-in-out
                         ${mainView === 'preview'
                           ? 'flex-grow-0 flex-shrink-0 !basis-0 !min-w-0 opacity-0 pointer-events-none overflow-hidden'
                           : 'flex-grow min-w-0 opacity-100 overflow-hidden'
                         }`}
          >
          {/* Editor Tabs */}
              <div className={`h-8 bg-black flex items-center justify-between px-2 space-x-1 overflow-x-auto flex-shrink-0 z-10 ${mainView === 'preview' ? 'invisible' : ''}`}>
            {fileMgmt.activeFile ? (
              <div className="flex items-center space-x-2 text-sm text-gray-300 flex-grow min-w-0">
                <FileText size={14} className="flex-shrink-0"/>
                <span className="truncate" title={fileMgmt.activeFile}>{fileMgmt.activeFile}</span>
              </div>
            ) : (
              <div className="px-3 py-1 text-xs text-gray-500 italic flex-grow">No file selected</div>
            )}
            {fileMgmt.activeFile && (
                <button 
                    title="Copy Path"
                    className="p-1 rounded hover:bg-custom-dark text-gray-400 hover:text-white flex-shrink-0"
                    onClick={() => navigator.clipboard.writeText(fileMgmt.activeFile || '')}
                >
                    <Copy size={14} />
                </button>
            )}
          </div>

          {/* View Container */}
              <div className={`flex-grow h-[calc(100%-2rem)] min-h-0 overflow-hidden ${mainView === 'preview' ? 'invisible' : ''}`}>
              <>
                {fileMgmt.activeFile ? (
                  <div className="w-full h-full relative overflow-hidden">
                    <Editor
                        key={fileMgmt.activeFile}
                        height="100%"
                        language={fileMgmt.getFileLanguage(fileMgmt.activeFile)}
                        theme="custom-dark"
                        value={fileMgmt.code}
                        onChange={fileMgmt.handleEditorChange}
                        options={{
                            minimap: { enabled: true },
                            fontSize: 14,
                            wordWrap: 'off',
                            automaticLayout: true,
                            readOnly: true,
                            glyphMargin: true,
                            lineDecorationsWidth: 10,
                            lineNumbersMinChars: 3
                        }}
                        onMount={handleEditorDidMount}
                        beforeMount={handleEditorWillMount}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500 text-lg">
                    Building...
                  </div>
                )}
              </>
          </div>
        </main>
        </div>

        {/* Render the RightSidebar component */}
        <RightSidebar
          initialWidth={rightSidebarWidth}
          minWidth={minRightSidebarWidth}
          onWidthChange={setRightSidebarWidth}
          projectId={projectId}
          messages={chatMgmt.messages}
          isAiResponding={chatMgmt.isAiResponding}
          onSendMessage={chatMgmt.handleSendMessage}
          onStopGeneration={chatMgmt.onStopGeneration}
          currentChatId={chatMgmt.currentChatId}
          isLoadingMessages={chatMgmt.isLoadingMessages}
          isExecutingTool={chatMgmt.isExecutingTools}
          currentToolType={chatMgmt.currentToolType}
        />
      </div>

      {/* Context Menu */}
      {fileMgmt.contextMenuVisible && (
      <FileContextMenu
        isVisible={fileMgmt.contextMenuVisible}
        position={fileMgmt.contextMenuPosition}
        itemPath={fileMgmt.contextMenuItemPath}
        itemType={fileMgmt.contextMenuItemType}
        onClose={fileMgmt.closeContextMenu}
      />
      )}

      {/* Inline Input */}
      <InlineInput
        isVisible={fileMgmt.isInputVisible}
        position={fileMgmt.inputPosition}
        initialValue={fileMgmt.inputValue}
        actionType={fileMgmt.inputActionType}
        onSubmit={fileMgmt.handleInputSubmit}
        onCancel={fileMgmt.handleInputCancel}
      />
    </div>
  );
}