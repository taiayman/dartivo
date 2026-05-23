'use client';

import React from 'react';
import { FilePenLine } from 'lucide-react';

interface EditProposalCardProps {
  filePath: string;
  // diffContent: string; // Optionally pass diff later for display
}

const EditProposalCard: React.FC<EditProposalCardProps> = ({
  filePath,
}) => {
  const filename = filePath.split('/').pop() || filePath;

  return (
    <div className="w-full rounded-lg bg-transparent text-gray-400 border border-dashed border-blue-500/50 p-3">
      <div className="flex items-center space-x-2">
        <FilePenLine size={16} className="flex-shrink-0 text-blue-400" />
        <span className="text-gray-300">Proposing edit for:</span>
        <span className="font-mono text-blue-300 bg-blue-900/30 px-1.5 py-0.5 rounded text-xs">{filename}</span>
      </div>
      {/* Optional: Add a button or preview area for the diff later */}
      {/* <pre className="mt-2 text-xs bg-black/20 p-2 rounded overflow-auto max-h-40"><code>{diffContent}</code></pre> */}
    </div>
  );
};

export default EditProposalCard; 