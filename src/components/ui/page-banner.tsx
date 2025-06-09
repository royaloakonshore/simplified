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
  backgroundImage = '/Fluid_7.jpeg' // Updated to use the beautiful fluid design
}: PageBannerProps) {
  return (
    <div 
      className={cn(
        "relative w-full rounded-2xl p-6 mb-4 min-h-[140px] flex items-center justify-start overflow-hidden",
        "bg-gray-900", // Simple fallback background
        className
      )}
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Subtle overlay for better text readability */}
      <div className="absolute inset-0 bg-black/30" />
      
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
      "text-xl md:text-2xl lg:text-3xl font-bold text-white drop-shadow-lg tracking-tight",
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