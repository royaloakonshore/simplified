"use client";

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

export function GlobalLoadingIndicator() {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');

  useEffect(() => {
    // Listen for navigation start
    const handleStart = () => {
      setIsLoading(true);
      setLoadingMessage('Loading...');
    };

    // Listen for navigation complete
    const handleComplete = () => {
      setIsLoading(false);
    };

    // Listen for form submissions
    const handleFormSubmit = () => {
      setIsLoading(true);
      setLoadingMessage('Processing...');
    };

    // Listen for button clicks that might trigger actions
    const handleButtonClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const button = target.closest('button');
      
      if (button && !button.disabled && button.type !== 'button') {
        // Check if it's a submit button or has loading state
        if (button.type === 'submit' || button.textContent?.includes('...')) {
          setIsLoading(true);
          setLoadingMessage('Processing...');
        }
      }
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleStart);
    window.addEventListener('load', handleComplete);
    document.addEventListener('submit', handleFormSubmit);
    document.addEventListener('click', handleButtonClick);
    
    // Listen for custom events for tRPC mutations
    const handleTRPCMutation = () => {
      setIsLoading(true);
      setLoadingMessage('Processing...');
    };

    window.addEventListener('trpc-mutation-start', handleTRPCMutation);
    window.addEventListener('trpc-mutation-end', handleComplete);

    // Auto-hide after 5 seconds to prevent stuck loading state
    let autoHideTimer: NodeJS.Timeout;
    if (isLoading) {
      autoHideTimer = setTimeout(() => {
        setIsLoading(false);
      }, 5000);
    }

    return () => {
      window.removeEventListener('beforeunload', handleStart);
      window.removeEventListener('load', handleComplete);
      document.removeEventListener('submit', handleFormSubmit);
      document.removeEventListener('click', handleButtonClick);
      window.removeEventListener('trpc-mutation-start', handleTRPCMutation);
      window.removeEventListener('trpc-mutation-end', handleComplete);
      if (autoHideTimer) clearTimeout(autoHideTimer);
    };
  }, [isLoading]);

  if (!isLoading) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2 shadow-lg">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-sm font-medium text-foreground">{loadingMessage}</span>
      </div>
    </div>
  );
}
