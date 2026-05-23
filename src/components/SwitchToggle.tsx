'use client';

import React from 'react';

interface SwitchToggleProps {
  label: string;
  isOn: boolean;
  onToggle: () => void;
}

const SwitchToggle: React.FC<SwitchToggleProps> = ({ label, isOn, onToggle }) => {
  return (
    <label className="flex items-center cursor-pointer">
      <div className="relative">
        <input 
          type="checkbox" 
          className="sr-only" // Hide default checkbox
          checked={isOn}
          onChange={onToggle}
        />
        {/* Background */}
        <div className={`block w-10 h-5 rounded-full transition-colors duration-200 ease-in-out ${isOn ? 'bg-blue-600' : 'bg-gray-600'}`}></div>
        {/* Dot */}
        <div className={`absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 ease-in-out ${isOn ? 'transform translate-x-5' : ''}`}></div>
      </div>
      <div className="ml-3 text-sm text-gray-300">
        {label}
      </div>
    </label>
  );
};

export default SwitchToggle; 