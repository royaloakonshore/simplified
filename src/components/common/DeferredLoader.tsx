"use client";

import React from "react";
import { Button } from "@/components/ui/button";

interface DeferredLoaderProps {
  children: React.ReactNode;
  label?: string;
}

export function DeferredLoader({ children, label = "Load" }: DeferredLoaderProps) {
  const [loaded, setLoaded] = React.useState(false);

  if (!loaded) {
    return (
      <div className="relative w-full">
        <div className="absolute inset-0 backdrop-blur-sm bg-background/40 rounded-md flex items-center justify-center z-10 min-h-[140px]">
          <Button onClick={() => setLoaded(true)} size="sm" variant="default">
            {label}
          </Button>
        </div>
        {/* Reserve space so layout is stable */}
        <div className="opacity-0 select-none pointer-events-none" aria-hidden>
          {children}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default DeferredLoader;


