'use client';

import { useState } from 'react';
import { HelpCircle, FileText, Search, ChevronDown, ChevronUp } from 'lucide-react';

export default function ToolCallHelp() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mb-4 bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
      <button 
        className="w-full px-4 py-3 flex justify-between items-center text-sm text-gray-300 hover:bg-gray-800/80 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center">
          <HelpCircle size={16} className="mr-2 text-blue-400" />
          <span>Tool Calling Support</span>
        </div>
        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      
      {isExpanded && (
        <div className="px-4 py-3 border-t border-gray-700 text-xs text-gray-300 space-y-3">
          <p>
            You can ask the AI to read files or search content in your project. Here are some examples:
          </p>
          
          <div className="space-y-2">
            <div className="flex items-start">
              <FileText size={14} className="mr-2 mt-0.5 text-blue-400 flex-shrink-0" />
              <div>
                <p className="font-medium mb-1">Reading files:</p>
                <ul className="space-y-1 list-disc list-inside pl-1 text-gray-400">
                  <li>Can you read the file <code className="bg-gray-700 px-1 py-0.5 rounded">src/app/page.tsx</code>?</li>
                  <li>Please show me the contents of <code className="bg-gray-700 px-1 py-0.5 rounded">README.md</code></li>
                  <li>Read <code className="bg-gray-700 px-1 py-0.5 rounded">package.json</code> and explain the dependencies</li>
                </ul>
              </div>
            </div>
            
            <div className="flex items-start">
              <Search size={14} className="mr-2 mt-0.5 text-blue-400 flex-shrink-0" />
              <div>
                <p className="font-medium mb-1">Searching in files:</p>
                <ul className="space-y-1 list-disc list-inside pl-1 text-gray-400">
                  <li>Search for &quot;<code className="bg-gray-700 px-1 py-0.5 rounded">useState</code>&quot; in the project</li>
                  <li>Find &quot;<code className="bg-gray-700 px-1 py-0.5 rounded">handleSendMessage</code>&quot; in the codebase</li>
                  <li>Help me locate where &quot;<code className="bg-gray-700 px-1 py-0.5 rounded">fetchFileContent</code>&quot; is defined</li>
                </ul>
              </div>
            </div>
          </div>
          
          <p className="text-xs text-gray-400 italic">
            The AI will automatically detect these commands and perform the operations for you.
          </p>
        </div>
      )}
    </div>
  );
}