import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import fs from 'fs/promises';
import path from 'path';

// Count total lines in a file efficiently without loading entire content
export async function countFileLines(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let lineCount = 0;
    
    const readStream = createReadStream(filePath);
    const rl = createInterface({
      input: readStream,
      crlfDelay: Infinity, // Handle CRLF properly
    });
    
    rl.on('line', () => lineCount++);
    rl.on('close', () => resolve(lineCount));
    rl.on('error', reject);
    readStream.on('error', reject);
  });
}

// Read specific line range from a file using streaming
export function readLines(
  filepath: string, 
  endLine?: number, 
  startLine?: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const effectiveStartLine = startLine ?? 0;
    const input = createReadStream(filepath);
    let buffer = '';
    let lineCount = 0;
    let result = '';
    
    input.on('data', (chunk) => {
      buffer += chunk.toString();
      let pos = 0;
      let nextNewline = buffer.indexOf('\n', pos);
      
      while (nextNewline !== -1) {
        if (lineCount >= effectiveStartLine && 
            (endLine === undefined || lineCount <= endLine)) {
          result += buffer.substring(pos, nextNewline + 1);
        }
        
        pos = nextNewline + 1;
        lineCount++;
        
        if (endLine !== undefined && lineCount > endLine) {
          input.destroy();
          resolve(result);
          return;
        }
        
        nextNewline = buffer.indexOf('\n', pos);
      }
      
      buffer = buffer.substring(pos);
    });
    
    input.on('end', () => {
      if (buffer.length > 0 && 
          lineCount >= effectiveStartLine && 
          (endLine === undefined || lineCount <= endLine)) {
        result += buffer;
      }
      resolve(result);
    });
    
    input.on('error', reject);
  });
}

// Add line numbers to content with proper formatting
export function addLineNumbers(content: string, startLine: number = 1): string {
  if (content === '') {
    return startLine === 1 ? '' : `${startLine} | \n`;
  }
  
  const lines = content.split('\n');
  const lastLineEmpty = lines[lines.length - 1] === '';
  if (lastLineEmpty) {
    lines.pop();
  }
  
  const maxLineNumberWidth = String(startLine + lines.length - 1).length;
  const numberedContent = lines
    .map((line, index) => {
      const lineNumber = String(startLine + index)
        .padStart(maxLineNumberWidth, ' ');
      return `${lineNumber} | ${line}`;
    })
    .join('\n');
    
  return numberedContent + '\n';
}

// Check if file is binary
export async function isBinaryFile(filePath: string): Promise<boolean> {
  try {
    const buffer = await fs.readFile(filePath);
    const chunk = buffer.subarray(0, Math.min(8000, buffer.length));
    
    // Check for null bytes (common in binary files)
    for (let i = 0; i < chunk.length; i++) {
      if (chunk[i] === 0) {
        return true;
      }
    }
    
    // Check for high percentage of non-printable characters
    let nonPrintableCount = 0;
    for (let i = 0; i < chunk.length; i++) {
      const byte = chunk[i];
      if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
        nonPrintableCount++;
      }
    }
    
    return (nonPrintableCount / chunk.length) > 0.3;
  } catch (error) {
    return false;
  }
}

// Extract text from various file types
export async function extractTextFromFile(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  
  try {
    switch (ext) {
      case '.json':
      case '.js':
      case '.ts':
      case '.tsx':
      case '.jsx':
      case '.dart':
      case '.py':
      case '.java':
      case '.cpp':
      case '.c':
      case '.h':
      case '.css':
      case '.scss':
      case '.html':
      case '.xml':
      case '.yaml':
      case '.yml':
      case '.md':
      case '.txt':
      case '.log':
      case '.env':
      case '.gitignore':
      case '.dockerfile':
      case '':
        // Regular text files
        const content = await fs.readFile(filePath, 'utf8');
        return addLineNumbers(content);
        
      default:
        // Check if it's actually a text file despite the extension
        const isActuallyBinary = await isBinaryFile(filePath);
        if (!isActuallyBinary) {
          const content = await fs.readFile(filePath, 'utf8');
          return addLineNumbers(content);
        } else {
          return `[Binary file: ${ext} files are not readable as text]`;
        }
    }
  } catch (error) {
    throw new Error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Get source code definitions (simplified version)
export async function getSourceCodeDefinitions(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n');
    const definitions: string[] = [];
    const fileName = path.basename(filePath);
    
    definitions.push(`# ${fileName}`);
    
    // Simple pattern matching for common definitions
    const patterns = [
      { regex: /^(export\s+)?(class|interface|enum|type)\s+(\w+)/i, type: 'class/interface' },
      { regex: /^(export\s+)?(function|const|let|var)\s+(\w+)/i, type: 'function/variable' },
      { regex: /^(export\s+)?(\w+)\s*[:=]\s*(function|\()/i, type: 'function' },
      { regex: /^\s*\/\/\s*@(\w+)/i, type: 'annotation' },
    ];
    
    lines.forEach((line, index) => {
      for (const pattern of patterns) {
        const match = line.match(pattern.regex);
        if (match) {
          const lineNum = index + 1;
          const name = match[3] || match[1];
          definitions.push(`${lineNum}--${lineNum} | ${line.trim()}`);
          break;
        }
      }
    });
    
    return definitions.join('\n');
  } catch (error) {
    return '';
  }
} 