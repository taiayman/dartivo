import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../../../firebase/adminConfig';

export const runtime = 'nodejs';

// --- Type Definitions (ensure consistency with frontend) ---
interface FileTreeNode {
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileTreeNode[];
}

// --- Helper Functions for Tree Manipulation --- 

/**
 * Finds a node (folder) in the tree by its path.
 * Returns the node or null if not found.
 */
function findNodeByPath(tree: FileTreeNode[], targetPath: string): FileTreeNode | null {
    if (!targetPath) return null; // Should not happen if targetPath is validated

    const parts = targetPath.split('/');
    let currentNode: FileTreeNode | undefined;
    let currentLevel = tree;

    for (const part of parts) {
        currentNode = currentLevel.find(node => node.name === part && node.type === 'folder');
        if (!currentNode) return null; // Path segment not found
        currentLevel = currentNode.children || [];
    }
    return currentNode ?? null;
}

/**
 * Inserts a new node into a children array in the correct sorted order.
 */
function insertNodeSorted(children: FileTreeNode[], newNode: FileTreeNode): void {
    children.push(newNode);
    children.sort((a, b) => {
        if (a.type === 'folder' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
    });
}

// --- Main API Handler --- 
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const awaitedParams = await params;
  const projectId = awaitedParams.projectId;
  let requestBody;

  // 1. Validation
  if (!projectId) {
    return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
  }

  try {
      requestBody = await request.json();
  } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { type, basePath, newItemName } = requestBody;

  if (!type || (type !== 'file' && type !== 'folder')) {
      return NextResponse.json({ error: "Invalid type specified (must be 'file' or 'folder')" }, { status: 400 });
  }
  if (typeof newItemName !== 'string' || !newItemName.trim() || newItemName.includes('/') || newItemName.includes('\\')) {
      return NextResponse.json({ error: "Invalid newItemName specified (cannot be empty or contain slashes)" }, { status: 400 });
  }
  if (basePath !== null && typeof basePath !== 'string') {
      return NextResponse.json({ error: "Invalid basePath specified (must be string or null)" }, { status: 400 });
  }

  const trimmedNewName = newItemName.trim();
  const newPath = basePath ? `${basePath}/${trimmedNewName}` : trimmedNewName;

  console.log(`Attempting to create ${type}: ${newPath} in project ${projectId}`);

  // 2. Firestore Transaction
  const projectDocRef = adminDb.collection('projects').doc(projectId);

  try {
    await adminDb.runTransaction(async (transaction) => {
      const projectDocSnap = await transaction.get(projectDocRef);

      if (!projectDocSnap.exists) {
        throw new Error('Project document not found');
      }

      const projectData = projectDocSnap.data();
      if (!projectData) {
        throw new Error('Project data is empty');
      }

      // Get current tree and contents, defaulting if they don't exist
      const currentTree: FileTreeNode[] = projectData.fileTree && Array.isArray(projectData.fileTree) ? projectData.fileTree : [];
      const currentContents: Record<string, string> = projectData.fileContents && typeof projectData.fileContents === 'object' ? projectData.fileContents : {};

      let targetChildrenArray: FileTreeNode[];
      let parentNode: FileTreeNode | null = null;

      // Determine where to insert the new node
      if (basePath) {
          parentNode = findNodeByPath(currentTree, basePath);
          if (!parentNode || parentNode.type !== 'folder') {
              throw new Error(`Base path folder '${basePath}' not found or is not a folder.`);
          }
          // Ensure children array exists
          parentNode.children = parentNode.children || [];
          targetChildrenArray = parentNode.children;
      } else {
          // Inserting at the root
          targetChildrenArray = currentTree;
      }

      // Check for duplicates
      const exists = targetChildrenArray.some(node => node.name === trimmedNewName);
      if (exists) {
          throw new Error(`An item named '${trimmedNewName}' already exists in ${basePath || 'the root'}.`);
      }

      // Create the new node
      const newNode: FileTreeNode = {
          name: trimmedNewName,
          type: type,
          path: newPath,
          ...(type === 'folder' && { children: [] }), // Add empty children for folders
      };

      // Insert the new node into the target array (sorted)
      insertNodeSorted(targetChildrenArray, newNode);

      // Prepare updates for the transaction
      const updates: { fileTree: FileTreeNode[], fileContents?: Record<string, string> } = { fileTree: currentTree };

      // If creating a file, add empty content to the map
      if (type === 'file') {
          currentContents[newPath] = ''; // Add new file with empty content
          updates.fileContents = currentContents;
      }

      // Perform the update within the transaction
      transaction.update(projectDocRef, updates);
      console.log(`${type} '${newPath}' created successfully in transaction.`);
    });

    // Transaction successful
    return NextResponse.json({ success: true, message: `${type.charAt(0).toUpperCase() + type.slice(1)} '${newPath}' created successfully.` }, { status: 201 });

  } catch (error: unknown) {
    console.error(`Error creating ${type} '${newPath}' in project ${projectId}:`, error);
    // Check for specific transaction errors or validation errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage === 'Project document not found') {
        return NextResponse.json({ error: errorMessage }, { status: 404 });
    }
    if (errorMessage.startsWith('Base path folder') || errorMessage.startsWith('An item named')) {
        return NextResponse.json({ error: errorMessage }, { status: 409 }); // 409 Conflict might be appropriate
    }
    return NextResponse.json({ error: `Failed to create ${type}: ${errorMessage}` }, { status: 500 });
  }
} 