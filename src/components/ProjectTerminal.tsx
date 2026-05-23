import React, { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css'; // Import xterm CSS

interface ProjectTerminalProps {
  initialContent?: string; // For build logs
  onCommand: (command: string) => void; // Callback when user enters a command
  prompt?: string;
  isProcessing?: boolean; // To disable input while command runs
  projectId?: string; // Added projectId for localStorage key
}

export interface ProjectTerminalRef {
  writeOutput: (data: string) => void;
  clearTerminal: () => void;
  focusTerminal: () => void;
  displayPrompt: () => void;
}

const ProjectTerminal = forwardRef<ProjectTerminalRef, ProjectTerminalProps>(
  ({ initialContent, onCommand, prompt = '/workspace$ ', isProcessing = false, projectId }, ref) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const term = useRef<Terminal | null>(null);
    const fitAddon = useRef<FitAddon | null>(null);
    const currentCommand = useRef<string>('');

    const writeOutput = useCallback((data: string) => {
      if (term.current) {
        // Preserve standalone \r for same-line updates, convert \n and \r\n to \r\n for xterm
        const processedData = data.replace(/\r(?!\n)/g, '\r').replace(/\n/g, '\r\n');
        term.current.write(processedData);
      }
    }, []);

    const displayPrompt = useCallback(() => {
      currentCommand.current = '';
      term.current?.write(`\r\n${prompt}`);
    }, [prompt]);

    const handleData = useCallback((data: string) => {
      if (!term.current || isProcessing) return;

      const code = data.charCodeAt(0);

      if (code === 13) { // Enter key
        if (currentCommand.current.trim()) {
          term.current.write('\r\n'); // Move to next line
          onCommand(currentCommand.current);
          // Don't display prompt immediately, wait for command output
        } else {
          // If empty command entered, just show new prompt
          term.current.write(`\r\n${prompt}`);
        }
        currentCommand.current = '';
      } else if (code === 127 || code === 8) { // Backspace/Delete
        if (currentCommand.current.length > 0) {
          term.current.write('\b \b'); // Move cursor back, write space, move back again
          currentCommand.current = currentCommand.current.slice(0, -1);
        }
      } else if (code >= 32 && code <= 126) { // Printable characters
        currentCommand.current += data;
        term.current.write(data);
      }
    }, [onCommand, prompt, isProcessing]);

    useEffect(() => {
      if (terminalRef.current && !term.current) {
        console.log("Initializing xterm");
        const terminal = new Terminal({
          cursorBlink: true,
          convertEol: true, // Convert line endings
          theme: { // Basic dark theme
            background: '#0C0C0E', // <-- CHANGED to rgb(12, 12, 14)
            foreground: '#d4d4d8', // zinc-300
            cursor: '#f4f4f5',     // zinc-100
            selectionBackground: '#3f3f46', // zinc-700
          },
          fontSize: 13,
          fontFamily: 'Consolas, "Courier New", monospace',
          rows: 20, // Initial rows, FitAddon will adjust
        });

        // @ts-expect-error - wordWrap option is not recognized in terminal type definitions but it exists at runtime
        terminal.options.wordWrap = false; // Disable line wrapping

        const addon = new FitAddon();
        fitAddon.current = addon;
        terminal.loadAddon(addon);

        term.current = terminal;
        terminal.open(terminalRef.current);

        // --- Restore saved content --- 
        let restoredContent = false;
        if (projectId) {
          const savedContent = localStorage.getItem(`terminal_content_${projectId}`);
          if (savedContent) {
            console.log("Restoring terminal content from localStorage");
            // Use writeOutput to handle newline conversion
            writeOutput(savedContent); 
            // Optional: Add a newline if the saved content didn't end with one
            if (!savedContent.endsWith('\n') && !savedContent.endsWith('\r')) {
                terminal.write('\r\n');
            }
            restoredContent = true;
            // Display prompt after restoring content
            displayPrompt(); 
          }
        }

        // Write initial content or prompt if nothing was restored
        if (!restoredContent && initialContent) {
            writeOutput(initialContent);
            displayPrompt(); // Display prompt after initial content
        } else if (!restoredContent) {
            terminal.write(prompt); // Start with the prompt if nothing else to show
        }

        terminal.onData(handleData);

        // Fit terminal initially and on resize
        addon.fit();
        const resizeObserver = new ResizeObserver(() => {
          try {
            addon.fit();
          } catch {
            // Sometimes resize observer fires rapidly, ignore fit errors
            // console.warn("FitAddon error:", e);
          }
        });
        // Observe the parent element for size changes
        if (terminalRef.current?.parentElement) {
             resizeObserver.observe(terminalRef.current.parentElement);
        }

        terminal.focus();

        // Save references to avoid stale closures in cleanup function
        const currentTerminalRef = terminalRef.current;

        return () => {
          console.log("Disposing xterm");
           if (currentTerminalRef?.parentElement) {
               resizeObserver.unobserve(currentTerminalRef.parentElement);
           }
          resizeObserver.disconnect();
          terminal.dispose();
          term.current = null;
          fitAddon.current = null;
        };
      }
    }, [handleData, prompt, initialContent, writeOutput, displayPrompt, projectId]); // Added dependencies

    // --- Effect to save terminal content on unload --- 
    useEffect(() => {
      const handleBeforeUnload = () => {
        if (term.current && projectId) {
          console.log("Saving terminal content to localStorage");
          const buffer = term.current.buffer.active;
          let content = '';
          for (let i = 0; i < buffer.length; i++) {
            // Get line content, trim trailing whitespace only if requested (false here keeps it)
            content += buffer.getLine(i)?.translateToString(false) + (i === buffer.length - 1 ? '' : '\r\n');
          }
          // Also capture the current command line if any
          const commandLine = prompt + currentCommand.current;
          // Avoid adding duplicate prompt if last line was already the prompt
          if (!content.endsWith(prompt.trim())) { // Check trimmed prompt
             content += '\r\n' + commandLine; 
          } else {
              // If last line *was* the prompt, overwrite it with current command state
              const lines = content.split('\r\n');
              lines[lines.length - 1] = commandLine;
              content = lines.join('\r\n');
          }
          
          localStorage.setItem(`terminal_content_${projectId}`, content);
        }
      };

      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }, [projectId, prompt]); // Rerun if projectId or prompt changes

    // Update initial content if it changes after mount
    useEffect(() => {
        if (term.current && initialContent) {
            console.log("Updating terminal with new initial content");
            term.current.clear();
            writeOutput(initialContent);
            displayPrompt();
        }
     }, [initialContent, writeOutput, displayPrompt]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      writeOutput: (data: string) => {
         writeOutput(data);
      },
      clearTerminal: () => {
        term.current?.clear();
      },
      focusTerminal: () => {
        term.current?.focus();
      },
      displayPrompt: () => {
        displayPrompt();
      }
    }), [writeOutput, displayPrompt]); // Include dependencies

    return <div 
              ref={terminalRef} 
              className="w-full h-full overflow-hidden bg-zinc-900" 
              style={{ userSelect: 'text' }}
            ></div>; // Ensure it takes full space
  }
);

ProjectTerminal.displayName = 'ProjectTerminal'; // Add display name

export default ProjectTerminal; 