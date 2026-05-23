'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react'; // Removed unused imports

interface SegmentOption {
  label: string;
  value: string;
  icon: LucideIcon;
}

interface SegmentedControlProps {
  options: SegmentOption[];
  selectedValue: string;
  onChange: (value: string) => void;
}

const SegmentedControl: React.FC<SegmentedControlProps> = ({
  options,
  selectedValue,
  onChange,
}) => {
  return (
    <div className="flex items-center p-1 bg-zinc-800 rounded-full space-x-0.5">
      {options.map((option) => {
        const Icon = option.icon;
        const isSelected = selectedValue === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`
              flex items-center justify-center space-x-1.5 
              px-4 py-1 rounded-full transition-colors duration-150 ease-in-out
              text-sm
              ${isSelected 
                ? 'bg-zinc-900 text-gray-100'
                : 'text-gray-300 hover:text-white'
              }
            `}
            aria-pressed={isSelected}
          >
            <Icon size={16} className="flex-shrink-0" />
            <span className="text-sm">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default SegmentedControl; 