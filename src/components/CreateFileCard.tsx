import React from 'react';
import { FilePlus2 } from 'lucide-react'; // Using FilePlus2 for create icon

interface CreateFileCardProps {
  filePath: string;
  // Optionally add content snippet preview later if needed
}

const CreateFileCard: React.FC<CreateFileCardProps> = ({ filePath }) => {
  // Removed unused fileName variable

  return (
    <div className="bg-gradient-to-br from-green-900/30 to-black/20 border border-green-600/40 rounded-lg p-3 mb-3 shadow-sm hover:shadow-md transition-all duration-200 group">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <FilePlus2 size={18} className="text-green-400" />
          <span className="text-sm font-medium text-green-300 group-hover:text-green-200 transition-colors">
            Create File Proposal
          </span>
        </div>
        {/* Add any actions like 'approve/deny' later if needed */}
      </div>
      <div className="bg-black/30 rounded p-2">
        <p className="text-xs text-gray-400 mb-1">File Path:</p>
        <p className="text-sm font-mono text-gray-200 break-all">
          {filePath}
        </p>
      </div>
       {/* Optionally add content preview below */}
       {/* <div className="mt-2 text-xs text-gray-400">Content preview...</div> */}
    </div>
  );
};

export default CreateFileCard; 