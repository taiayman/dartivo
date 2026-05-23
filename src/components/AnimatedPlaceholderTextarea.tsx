'use client';

import React, { forwardRef, useState, useEffect, useRef, useCallback } from 'react';
import TextareaAutosize from 'react-textarea-autosize';

interface VerticalSlidePlaceholderProps {
  currentHintText: string; 
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  isFocused?: boolean; 
  animationDuration?: number;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

const VerticalSlidePlaceholder = forwardRef<HTMLTextAreaElement, VerticalSlidePlaceholderProps>((
  { 
    currentHintText, 
    value = '',
    onChange,
    onFocus,
    onBlur,
    isFocused,
    animationDuration = 300,
    onKeyDown,
  }, 
  ref
) => {
  const isInputEmpty = value === '';
  const [displayedHintText, setDisplayedHintText] = useState(currentHintText);
  const [isSlidingUp, setIsSlidingUp] = useState(false);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isScrollable, setIsScrollable] = useState(false);

  const internalRef = useRef<HTMLTextAreaElement>(null);
  React.useImperativeHandle(ref, () => internalRef.current as HTMLTextAreaElement);

  const checkScrollable = useCallback(() => {
    const textarea = internalRef.current;
    if (textarea) {
      setIsScrollable(textarea.scrollHeight > textarea.clientHeight);
    }
  }, []);

  useEffect(() => {
    checkScrollable();
  }, [value, checkScrollable]);

  // Effect to automatically scroll to bottom on value change
  useEffect(() => {
    const textarea = internalRef.current;
    if (textarea) {
      // Scroll to the bottom whenever the value changes
      textarea.scrollTop = textarea.scrollHeight;
    }
    // Only run when the value changes
  }, [value]);

  useEffect(() => {
    const cleanup = () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }
    };

    if (currentHintText !== displayedHintText && isInputEmpty && !isFocused) {
      cleanup();
      setIsSlidingUp(true);
      animationTimeoutRef.current = setTimeout(() => {
        setDisplayedHintText(currentHintText);
        setIsSlidingUp(false);
        animationTimeoutRef.current = null;
      }, animationDuration);
    } else if (!isInputEmpty || isFocused) {
        cleanup();
        setIsSlidingUp(false);
        if (displayedHintText !== currentHintText) {
           setDisplayedHintText(currentHintText); 
        }
    } else if (displayedHintText !== currentHintText) {
        setDisplayedHintText(currentHintText);
    }

    return cleanup;

  }, [currentHintText, isInputEmpty, isFocused, displayedHintText, animationDuration]);

  return (
    <div className="relative w-full min-h-[6rem] group">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          key={displayedHintText}
          className={`
            absolute inset-0 flex items-baseline p-4 text-lg text-gray-500
            pointer-events-none whitespace-nowrap 
            transition-transform ease-in-out duration-${animationDuration}
            ${isSlidingUp ? '-translate-y-full' : 'translate-y-0'}
            ${!isInputEmpty ? 'opacity-0 transition-opacity duration-200' : 'opacity-100 transition-opacity duration-200'}
          `}
        >
          <span 
            className="overflow-hidden text-ellipsis" 
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"' }}
          >
            {displayedHintText}
          </span> 
          <span 
            className={`
              ml-2 bg-black text-gray-400
              px-3 py-0.5 rounded-md text-xs flex-shrink-0
              ${isInputEmpty ? 'opacity-100' : 'opacity-0'}
            `}
          >
            TAB
          </span>
        </div>
      </div>
      
      <TextareaAutosize
        ref={internalRef}
        minRows={1}
        maxRows={6}
        onHeightChange={checkScrollable}
        className={`
          block w-full p-4 pb-6 bg-transparent resize-none 
          outline-none focus:outline-none text-white text-lg
          placeholder-transparent overflow-auto custom-scrollbar
          leading-tight
          ${isFocused ? 'cursor-text' : 'cursor-dartivo'}
          ${isScrollable ? '[mask-image:linear-gradient(to_bottom,black_calc(100%-72px),transparent)]' : ''}
        `}
        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol" !important' }}
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder={displayedHintText}
        aria-placeholder={displayedHintText}
      />
    </div>
  );
});

VerticalSlidePlaceholder.displayName = 'VerticalSlidePlaceholder';

export default VerticalSlidePlaceholder; 