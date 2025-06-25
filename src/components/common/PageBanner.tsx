import React from 'react';

interface PageBannerProps {
  title: string;
  description?: string;
  image?: string;
  children?: React.ReactNode;
}

export function PageBanner({ title, description, image, children }: PageBannerProps) {
  return (
    <div className="relative w-full">
      {/* Banner with image background */}
      <div 
        className="w-full h-32 md:h-40 bg-gradient-to-r from-primary/10 to-primary/5 border-b flex items-center justify-between px-4 md:px-6 relative overflow-hidden"
        style={{
          backgroundImage: image ? `url(${image})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Overlay for better text readability when using background images */}
        {image && (
          <div className="absolute inset-0 bg-black/20" />
        )}
        
        {/* Content */}
        <div className="relative z-10 flex items-center justify-between w-full">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {title}
            </h1>
            {description && (
              <p className="text-sm md:text-base text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          
          {/* Action buttons or controls */}
          {children && (
            <div className="flex items-center gap-2">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 