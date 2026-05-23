'use client';

import React from 'react';
import { Copy } from 'lucide-react';

interface FileContextMenuProps {
  isVisible: boolean;
  position: { x: number; y: number };
  itemPath: string | null;
  itemType: 'file' | 'folder' | 'background' | null;
  onClose: () => void;
  // Removed unused props
  // onNewFile: () => void;
  // onNewFolder: () => void;
  // onDelete: (path: string, type: 'file' | 'folder') => void;
  // onDelete: (path: string, type: 'file' | 'folder') => void;
}

const FileContextMenu: React.FC<FileContextMenuProps> = ({
  isVisible,
  position,
  itemPath,
  itemType,
  onClose,
  // Removed unused props from destructuring
  // onNewFile,
  // onNewFolder,
}) => {
  if (!isVisible || (itemType !== 'background' && !itemPath)) {
    return null;
  }

  // Prevent menu click from closing itself immediately
  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation(); 
  };

  // Basic styling - enhance as needed
  const menuStyle: React.CSSProperties = {
    position: 'fixed', // Use fixed to position relative to viewport
    left: `${position.x}px`,
    top: `${position.y}px`,
    zIndex: 1000, // Ensure it's above other elements
  };



  // Handler for copying path
  const handleCopyPath = async () => {
    if (itemPath) {
      try {
        await navigator.clipboard.writeText(itemPath);
        console.log(`Copied path to clipboard: ${itemPath}`);
        // Optionally show a success notification here
      } catch (err) {
        console.error('Failed to copy path: ', err);
        // Optionally show an error notification here
      } finally {
        onClose(); // Close menu regardless of success/failure
      }
    } else {
      onClose();
    }
  };

  return (
    <div 
      style={menuStyle} 
      className="bg-custom-darker border border-custom-dark rounded-md shadow-lg text-sm text-gray-200 min-w-[180px] py-1"
      onClick={handleMenuClick} // Prevent clicks inside from closing it via the window listener
      onContextMenu={(e) => e.preventDefault()} // Prevent nested context menus
    >
        {/* Display Item Info (Optional) */}
        {/* <div className="px-3 py-1 text-xs text-gray-400 border-b border-custom-dark truncate">{itemPath}</div> */}

        {/* Menu Items */} 
        <ul className="space-y-0.5">
            {/* Rename/Delete only show for actual files/folders */} 
            {(itemType === 'file' || itemType === 'folder') && itemPath && (
                <>
                    {/* 
                    <li 
                        className="flex items-center px-3 py-1 hover:bg-custom-dark cursor-pointer space-x-2"
                        onClick={onRename}
                    >
                         <Edit3 size={14} /> <span>Rename</span>
                    </li>
                    */}
                    {/* Add Copy Path item */}
                    <li
                        className="flex items-center px-3 py-1 hover:bg-custom-dark cursor-pointer space-x-2"
                        onClick={handleCopyPath}
                    >
                         <Copy size={14} /> <span>Copy Path</span>
                    </li>
                    {/* 
                    <li
                        className="flex items-center px-3 py-1 hover:bg-custom-dark cursor-pointer text-red-400 hover:text-red-300 space-x-2"
                        onClick={() => handleAction('Delete')} // Delete action needs implementation
                    >
                        <Trash2 size={14} /> <span>Delete</span>
                    </li>
                    */}
                </>
            )}

            {/* New File/Folder show for folders OR background */} 
            {(itemType === 'folder' || itemType === 'background') && (
                <>
                    {/* Add separator only if rename/delete were shown (Commented out as Rename/Delete are hidden) */}
                    {/* 
                    {(itemType === 'folder') && (
                        <li className="h-px bg-custom-dark my-1 mx-2"></li> 
                    )}
                    */}
                    {/* 
                    <li 
                        className="flex items-center px-3 py-1 hover:bg-custom-dark cursor-pointer space-x-2"
                        onClick={onNewFile}
                    >
                        <FilePlus size={14} /> <span>New File</span>
                    </li>
                    <li 
                        className="flex items-center px-3 py-1 hover:bg-custom-dark cursor-pointer space-x-2"
                        onClick={onNewFolder}
                    >
                        <FolderPlus size={14} /> <span>New Folder</span>
                    </li>
                    */}
                </>
            )}
            
            {/* Close Button (Optional) - Usually handled by outside click */} 
            {/* 
            <li className="h-px bg-custom-dark my-1 mx-2"></li> 
            <li 
                className="flex items-center px-3 py-1 hover:bg-custom-dark cursor-pointer space-x-2"
                onClick={onClose} 
            >
                <X size={14} /> <span>Close Menu</span>
            </li>
            */}
        </ul>
    </div>
  );
};

export default FileContextMenu; 