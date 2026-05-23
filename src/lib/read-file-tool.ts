import path from 'path';
import fs from 'fs/promises';
import { 
  countFileLines, 
  readLines, 
  addLineNumbers, 
  extractTextFromFile, 
  getSourceCodeDefinitions,
  isBinaryFile 
} from './file-utils';

// Tool parameter interface
export interface ReadFileToolParams {
  path: string;           // Required: File path relative to workspace
  start_line?: string;    // Optional: Starting line number (1-based)
  end_line?: string;      // Optional: Ending line number (1-based, inclusive)
}

// Configuration interface
export interface ReadFileConfig {
  maxReadFileLine?: number;  // Default: 500, -1 for unlimited, 0 for definitions only
  enableDefinitions?: boolean; // Enable source code parsing
  workspaceRoot?: string;    // Workspace root directory
}

// Main read file tool implementation
export async function readFileTool(
  params: ReadFileToolParams,
  config: ReadFileConfig = {}
): Promise<string> {
  const { path: relPath, start_line, end_line } = params;
  const maxReadFileLine = config.maxReadFileLine ?? 500;
  const enableDefinitions = config.enableDefinitions ?? true;
  const workspaceRoot = config.workspaceRoot ?? process.cwd();
  const isFullRead = maxReadFileLine === -1;
  
  try {
    // Validate parameters
    if (!relPath) {
      return `<file><path></path><error>Missing required parameter: path</error></file>`;
    }

    // Security: Prevent path traversal attacks
    const normalizedPath = path.normalize(relPath);
    if (normalizedPath.includes('..') || path.isAbsolute(normalizedPath)) {
      return `<file><path>${relPath}</path><error>Invalid path: Path traversal not allowed</error></file>`;
    }
    
    const absolutePath = path.resolve(workspaceRoot, relPath);
    
    // Check if file exists
    try {
      await fs.access(absolutePath);
    } catch (error) {
      return `<file><path>${relPath}</path><error>File not found: ${relPath}</error></file>`;
    }

    // Check if it's a directory
    const stats = await fs.stat(absolutePath);
    if (stats.isDirectory()) {
      return `<file><path>${relPath}</path><error>Path is a directory, not a file</error></file>`;
    }
    
    // Parse line numbers if provided
    let startLine: number | undefined;
    let endLine: number | undefined;
    let isRangeRead = false;
    
    if (!isFullRead && (start_line || end_line)) {
      isRangeRead = true;
      
      if (start_line) {
        const parsedStart = parseInt(start_line);
        if (isNaN(parsedStart) || parsedStart < 1) {
          return `<file><path>${relPath}</path><error>Invalid start_line: must be a positive integer</error></file>`;
        }
        startLine = parsedStart - 1; // Convert to 0-based
      }
      
      if (end_line) {
        const parsedEnd = parseInt(end_line);
        if (isNaN(parsedEnd) || parsedEnd < 1) {
          return `<file><path>${relPath}</path><error>Invalid end_line: must be a positive integer</error></file>`;
        }
        endLine = parsedEnd - 1; // Convert to 0-based
      }

      // Validate range
      if (startLine !== undefined && endLine !== undefined && startLine > endLine) {
        return `<file><path>${relPath}</path><error>Invalid range: start_line must be less than or equal to end_line</error></file>`;
      }
    }
    
    // Count total lines
    const totalLines = await countFileLines(absolutePath);
    
    // Handle empty files
    if (totalLines === 0) {
      return `<file><path>${relPath}</path>\n<content/><notice>File is empty</notice>\n</file>`;
    }
    
    // Determine read strategy
    let content: string = '';
    let isFileTruncated = false;
    let sourceCodeDef = '';
    
    const isBinary = await isBinaryFile(absolutePath);
    
    if (isBinary) {
      return `<file><path>${relPath}</path><error>Binary file detected: Cannot read as text</error></file>`;
    }
    
    if (isRangeRead) {
      // Read specific range
      const effectiveStartLine = startLine ?? 0;
      const effectiveEndLine = endLine ?? totalLines - 1;
      
      // Validate range against file size
      if (effectiveStartLine >= totalLines) {
        return `<file><path>${relPath}</path><error>start_line (${(startLine ?? 0) + 1}) exceeds file length (${totalLines} lines)</error></file>`;
      }
      
      content = await readLines(absolutePath, effectiveEndLine, effectiveStartLine);
      content = addLineNumbers(content, effectiveStartLine + 1);
    } else if (!isFullRead && maxReadFileLine >= 0 && totalLines > maxReadFileLine) {
      // File exceeds limit - truncate and get definitions
      isFileTruncated = true;
      
      if (maxReadFileLine > 0) {
        content = await readLines(absolutePath, maxReadFileLine - 1, 0);
        content = addLineNumbers(content);
      }
      
      // Get source code definitions if enabled
      if (enableDefinitions) {
        sourceCodeDef = await getSourceCodeDefinitions(absolutePath);
      }
    } else {
      // Read entire file
      content = await extractTextFromFile(absolutePath);
    }
    
    // Build XML response
    let xmlResult = `<file><path>${relPath}</path>\n`;
    
    // Add content tag
    if (isRangeRead) {
      const displayStartLine = (startLine ?? 0) + 1;
      const displayEndLine = Math.min((endLine ?? totalLines - 1) + 1, totalLines);
      xmlResult += `<content lines="${displayStartLine}-${displayEndLine}">\n${content}</content>\n`;
    } else if (maxReadFileLine === 0 && !isRangeRead) {
      // Skip content for definitions-only mode
      xmlResult += `<content lines="definitions-only">Showing definitions only</content>\n`;
    } else {
      const lines = isFileTruncated ? maxReadFileLine : totalLines;
      xmlResult += `<content lines="1-${lines}">\n${content}</content>\n`;
    }
    
    // Add truncation notice and definitions
    if (isFileTruncated) {
      xmlResult += `<notice>Showing only ${maxReadFileLine} of ${totalLines} total lines. Use start_line and end_line if you need to read more</notice>\n`;
      
      if (sourceCodeDef) {
        xmlResult += `<list_code_definition_names>\n${sourceCodeDef}\n</list_code_definition_names>\n`;
      }
    }
    
    xmlResult += `</file>`;
    return xmlResult;
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return `<file><path>${relPath || ''}</path><error>Error reading file: ${errorMsg}</error></file>`;
  }
}

// Helper function to validate file path
export function validateFilePath(filePath: string, workspaceRoot: string): { isValid: boolean; error?: string } {
  if (!filePath) {
    return { isValid: false, error: 'Path cannot be empty' };
  }
  
  const normalizedPath = path.normalize(filePath);
  
  if (normalizedPath.includes('..')) {
    return { isValid: false, error: 'Path traversal not allowed' };
  }
  
  if (path.isAbsolute(normalizedPath)) {
    return { isValid: false, error: 'Absolute paths not allowed' };
  }
  
  const absolutePath = path.resolve(workspaceRoot, filePath);
  
  if (!absolutePath.startsWith(workspaceRoot)) {
    return { isValid: false, error: 'Path outside workspace not allowed' };
  }
  
  return { isValid: true };
}

// Export types for external use
// Note: Types are already exported above with their declarations