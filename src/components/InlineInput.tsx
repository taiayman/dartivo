'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Check, X as CancelIcon } from 'lucide-react';

interface InlineInputProps {
  isVisible: boolean;
  position: { x: number; y: number };
  initialValue: string;
  actionType: 'newFile' | 'newFolder' | 'rename' | null;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

const InlineInput: React.FC<InlineInputProps> = ({
  isVisible,
  position,
  initialValue,
  actionType,
  onSubmit,
  onCancel,
}) => {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Set initial value and focus when becoming visible
  useEffect(() => {
    if (isVisible) {
      setValue(initialValue);
      // Use timeout to ensure input is rendered before focusing
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select(); // Select text for easy rename
      }, 0);
      return () => clearTimeout(timer);
    } else {
        setValue(''); // Clear value when hidden
    }
  }, [isVisible, initialValue]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };

  const handleSubmit = () => {
    if (value.trim()) {
      onSubmit(value.trim());
    } else {
      // If submitted empty, treat as cancel?
      onCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  // Prevent clicks inside input area from closing via window listener (if applicable)
  const handleContainerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  if (!isVisible || !actionType) {
    return null;
  }

  // Style to position near the original context menu click
  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    left: `${position.x}px`,
    top: `${position.y}px`,
    zIndex: 1001, // Higher than context menu
  };

  const labelText = actionType === 'rename' ? 'Rename to:' : 
                   actionType === 'newFile' ? 'New File Name:' : 'New Folder Name:';

  return (
    <div 
      style={containerStyle}
      className="flex items-center gap-1 p-1 bg-custom-darker border border-custom-dark rounded shadow-lg"
      onClick={handleContainerClick}
    >
      <label htmlFor="inline-input" className="text-xs text-gray-300 pl-1 whitespace-nowrap">
        {labelText}
      </label>
      <input
        ref={inputRef}
        id="inline-input"
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={handleSubmit} // Submit on blur as well?
        className="bg-custom-dark text-white text-sm px-1.5 py-0.5 rounded outline-none border border-transparent focus:border-blue-400 flex-grow min-w-0"
        spellCheck="false"
        autoComplete="off"
      />
      <button 
        onClick={handleSubmit}
        className="p-0.5 text-green-400 hover:text-green-300 rounded hover:bg-custom-dark"
        aria-label="Confirm"
        title="Confirm (Enter)"
      >
        <Check size={16} />
      </button>
      <button 
        onClick={onCancel}
        className="p-0.5 text-red-400 hover:text-red-300 rounded hover:bg-custom-dark"
        aria-label="Cancel"
        title="Cancel (Escape)"
      >
        <CancelIcon size={16} />
      </button>
    </div>
  );
};

export default InlineInput; 