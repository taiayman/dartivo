import { NextRequest, NextResponse } from 'next/server';
import { adminStorage, adminDb } from '../../../../../../firebase/adminConfig';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const resolvedParams = await params;
    const { projectId } = resolvedParams;
    
    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const { path, content } = await request.json();
    
    if (!path || typeof path !== 'string') {
      return NextResponse.json({ error: 'Path is required and must be a string' }, { status: 400 });
    }
    
    if (typeof content !== 'string') {
      return NextResponse.json({ error: 'Content must be a string' }, { status: 400 });
    }
    
    // Decode the file path
    const decodedFilePath = decodeURIComponent(path);
    
    // Basic path validation
    if (decodedFilePath.includes('..')) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }
    
    // Upload file to Cloud Storage
    const fullStoragePath = `projects/${projectId}/files/${decodedFilePath}`;
    const bucket = adminStorage.bucket();
    const file = bucket.file(fullStoragePath);
    
    await file.save(content, {
      metadata: {
        contentType: 'text/plain',
      },
    });
    
    // Update Firestore with the file content and ensure it's in the file tree
    const projectDocRef = adminDb.collection('projects').doc(projectId);
    
    await adminDb.runTransaction(async (transaction) => {
      const projectDocSnap = await transaction.get(projectDocRef);
      
      if (!projectDocSnap.exists) {
        throw new Error('Project document not found');
      }
      
      const projectData = projectDocSnap.data();
      if (!projectData) {
        throw new Error('Project data is empty');
      }
      
      // Update file contents
      const currentContents = projectData.fileContents || {};
      currentContents[decodedFilePath] = content;
      
      // Ensure file is in the tree structure
      const currentTree = projectData.fileTree || [];
      const pathParts = decodedFilePath.split('/');
      const fileName = pathParts[pathParts.length - 1];
      const dirPath = pathParts.slice(0, -1);
      
      // Function to ensure path exists in tree
      function ensurePathInTree(tree: any[], parts: string[], currentPath: string = ''): any[] {
        if (parts.length === 0) return tree;
        
        const [currentPart, ...remainingParts] = parts;
        const fullPath = currentPath ? `${currentPath}/${currentPart}` : currentPart;
        
        let node = tree.find(n => n.name === currentPart);
        if (!node) {
          node = {
            name: currentPart,
            type: remainingParts.length === 0 ? 'file' : 'folder',
            path: fullPath,
            ...(remainingParts.length > 0 && { children: [] })
          };
          tree.push(node);
          tree.sort((a, b) => {
            if (a.type === 'folder' && b.type === 'file') return -1;
            if (a.type === 'file' && b.type === 'folder') return 1;
            return a.name.localeCompare(b.name);
          });
        }
        
        if (remainingParts.length > 0) {
          node.children = node.children || [];
          ensurePathInTree(node.children, remainingParts, fullPath.substring(0, fullPath.lastIndexOf('/')));
        }
        
        return tree;
      }
      
      ensurePathInTree(currentTree, pathParts);
      
      transaction.update(projectDocRef, {
        fileContents: currentContents,
        fileTree: currentTree
      });
    });
    
    console.log(`✅ File ${decodedFilePath} successfully saved to Cloud Storage and Firestore`);
    
    return NextResponse.json({
      success: true,
      message: `File ${decodedFilePath} has been successfully saved.`,
      path: decodedFilePath,
      filePath: decodedFilePath // Add explicit filePath for easier extraction
    }, { status: 200 });
    
  } catch (error) {
    console.error('Error editing file:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to edit file' },
      { status: 500 }
    );
  }
}