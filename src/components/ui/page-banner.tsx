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
  backgroundImage = '/GYKQBFeXIAAvHRU.jpeg' // Updated to use the new consistent banner image
}: PageBannerProps) {
  return (
    <div 
      className={cn(
        "relative w-full rounded-2xl p-8 mb-6 min-h-[160px] flex items-center justify-start overflow-hidden",
        "bg-gradient-to-br from-primary/90 to-primary/70 shadow-lg", // Enhanced fallback background
        className
      )}
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Enhanced overlay with gradient for better depth */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/30 to-transparent" />
      
      {/* Content wrapper with improved styling */}
      <div className="relative z-10 w-full">
        <div className="banner-content text-white">
          {children}
        </div>
      </div>
      
      {/* Decorative elements */}
      <div className="absolute top-4 right-4 w-16 h-16 bg-white/10 rounded-full blur-2xl" />
      <div className="absolute bottom-4 right-8 w-12 h-12 bg-primary/20 rounded-full blur-xl" />
    </div>
  );
}

// Enhanced typography components for the banner
export function BannerTitle({ 
  children, 
  className 
}: { 
  children: React.ReactNode; 
  className?: string; 
}) {
  return (
    <h1 className={cn(
      "text-2xl md:text-3xl lg:text-4xl font-bold text-white drop-shadow-xl tracking-tight",
      "bg-gradient-to-r from-white to-white/95 bg-clip-text text-transparent",
      "leading-tight mb-2",
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
      "text-lg md:text-xl text-white/95 mt-3 drop-shadow-lg font-medium",
      "leading-relaxed max-w-2xl",
      className
    )}>
      {children}
    </p>
  );
}

// New component for action areas in banners
export function BannerActions({ 
  children, 
  className 
}: { 
  children: React.ReactNode; 
  className?: string; 
}) {
  return (
    <div className={cn(
      "flex flex-wrap gap-3 mt-6 items-center",
      className
    )}>
      {children}
    </div>
  );
} 