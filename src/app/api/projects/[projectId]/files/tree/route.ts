import { NextRequest, NextResponse } from 'next/server';
// Assuming adminConfig initializes admin SDK and makes storage available
import { adminStorage } from '../../../../../../firebase/adminConfig'; 
import { File } from '@google-cloud/storage'; // Import File type

export const runtime = 'nodejs'; // Keep Node.js runtime

interface FileTreeNode {
  name: string;
  type: 'file' | 'folder';
  children?: FileTreeNode[];
  path: string; // Include the full path
}

// Helper function to build the tree structure
function buildTree(files: File[], prefix: string): FileTreeNode[] {
  const tree: FileTreeNode[] = [];
  const map: { [key: string]: FileTreeNode } = {};

  files.forEach(file => {
    // Get path relative to the prefix (e.g., 'lib/main.dart')
    const relativePath = file.name.substring(prefix.length);

    // Skip empty paths (sometimes listing might include the folder itself)
    if (!relativePath) return;

    const parts = relativePath.split('/');
    let currentLevel = tree;
    let pathAccumulator = '';

    parts.forEach((part, index) => {
      if (!part) return; // Skip empty parts if path has //

      pathAccumulator += (pathAccumulator ? '/' : '') + part;
      const isLastPart = index === parts.length - 1;
      const nodeType = isLastPart && !file.name.endsWith('/') ? 'file' : 'folder'; // Infer type

      let node = map[pathAccumulator];

      if (!node) {
        node = {
          name: part,
          type: nodeType,
          path: prefix + pathAccumulator // Store full path from prefix root
        };
        if (node.type === 'folder') {
          node.children = [];
        }
        map[pathAccumulator] = node;

        // Find parent and add node
        if (index === 0) {
          currentLevel.push(node);
        } else {
          const parentPath = pathAccumulator.substring(0, pathAccumulator.lastIndexOf('/'));
          const parentNode = map[parentPath];
          if (parentNode && parentNode.children) {
             // Avoid adding duplicates if folder implicitly created by multiple files
             if (!parentNode.children.some(child => child.name === node.name && child.type === node.type)) {
                parentNode.children.push(node);
             }
          } else {
             // This case should ideally not happen if paths are processed sequentially, but log if it does
             console.warn(`Parent node not found for path: ${pathAccumulator}`);
             currentLevel.push(node); // Add to root as fallback
          }
        }
      } else {
         // If node exists but was inferred as file and now we see it's a dir
         if (node.type === 'file' && nodeType === 'folder') {
            node.type = 'folder';
            node.children = node.children || [];
         }
      }


      if (node.type === 'folder') {
        currentLevel = node.children!;
      }
    });
  });

  // Sort tree nodes alphabetically (folders first, then files)
  const sortNodes = (nodes: FileTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type === 'folder' && b.type === 'file') return -1;
      if (a.type === 'file' && b.type === 'folder') return 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach(node => {
      if (node.children) {
        sortNodes(node.children);
      }
    });
  };

  sortNodes(tree);
  return tree;
}


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> } // Wrap params type in Promise<>
) {
  // const projectId = context.params.projectId; // Old way
  const awaitedParams = await params; // Await the promise
  const projectId = awaitedParams.projectId; // Get projectId from awaited object

  if (!projectId) {
    return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
  }

  console.log(`Fetching file tree from Cloud Storage for project: ${projectId}`);
  const storagePrefix = `projects/${projectId}/files/`; // Define the prefix

  try {
    const bucket = adminStorage.bucket(); // Get default bucket via admin config

    // List files starting with the project's prefix
    const [files] = await bucket.getFiles({ prefix: storagePrefix });

    if (!files || files.length === 0) {
        console.log(`No files found in Cloud Storage for prefix: ${storagePrefix}`);
        // Check if the project document exists in Firestore before returning empty
        // This distinguishes an empty project from one that doesn't exist at all.
        // Optional: Add Firestore check here if needed
        return NextResponse.json([], { status: 200 }); // Return empty if no files found
    }

    console.log(`Found ${files.length} file objects in Storage for project ${projectId}`);

    // Build the tree structure from the file list
    const fileTree = buildTree(files, storagePrefix);

    console.log(`Successfully built file tree from Storage for project ${projectId}`);
    return NextResponse.json(fileTree);

  } catch (error: unknown) {
    console.error(`Error fetching file tree from Storage for project ${projectId}:`, error);
    // Add a more specific error message if possible
    const message = error instanceof Error ? error.message : 'Failed to retrieve file structure from storage.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 