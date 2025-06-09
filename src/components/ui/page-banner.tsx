import React from 'react';
import { cn } from '@/lib/utils';

interface PageBannerProps {
  children: React.ReactNode;
  className?: string;
  backgroundImage?: string;
}

export function PageBanner({ 
  children, 
  className,
  backgroundImage = '/placeholder-banner.jpg' // Default placeholder
}: PageBannerProps) {
  return (
    <div 
      className={cn(
        "relative w-full rounded-2xl p-8 mb-8 min-h-[200px] flex items-center justify-start overflow-hidden",
        "bg-gradient-to-r from-blue-600 to-blue-800", // Fallback gradient
        className
      )}
      style={{
        backgroundImage: `linear-gradient(to right, rgba(37, 99, 235, 0.8), rgba(29, 78, 216, 0.8)), url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Overlay for better text readability */}
      <div className="absolute inset-0 bg-black/20" />
      
      {/* Content wrapper with white text styling */}
      <div className="relative z-10 w-full">
        <div className="banner-content text-white">
          {children}
        </div>
      </div>
    </div>
  );
}

// Specific styling for H1 elements within the banner
export function BannerTitle({ 
  children, 
  className 
}: { 
  children: React.ReactNode; 
  className?: string; 
}) {
  return (
    <h1 className={cn(
      "text-3xl md:text-4xl lg:text-5xl font-bold text-white drop-shadow-lg tracking-tight",
      className
    )}>
      {children}
    </h1>
  );
}

export function BannerSubtitle({ 
  children, 
  className 
}: { 
  children: React.ReactNode; 
  className?: string; 
}) {
  return (
    <p className={cn(
      "text-lg md:text-xl text-white/90 mt-2 drop-shadow-md",
      className
    )}>
      {children}
    </p>
  );
} 