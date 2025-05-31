'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

// Re-define or import if already defined elsewhere and accessible
export interface BreadcrumbSegment {
  label: string;
  href?: string; // If missing, it's the current page
}

interface BreadcrumbContextType {
  breadcrumbSegments: BreadcrumbSegment[];
  setBreadcrumbSegments: (segments: BreadcrumbSegment[]) => void;
  clearBreadcrumbSegments: () => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextType | undefined>(undefined);

export const BreadcrumbProvider = ({ children }: { children: ReactNode }) => {
  const [breadcrumbSegments, setBreadcrumbSegmentsState] = useState<BreadcrumbSegment[]>([]);

  const setBreadcrumbSegments = useCallback((segments: BreadcrumbSegment[]) => {
    setBreadcrumbSegmentsState(segments);
  }, [setBreadcrumbSegmentsState]);

  const clearBreadcrumbSegments = useCallback(() => {
    setBreadcrumbSegmentsState([]);
  }, [setBreadcrumbSegmentsState]);

  return (
    <BreadcrumbContext.Provider value={{ breadcrumbSegments, setBreadcrumbSegments, clearBreadcrumbSegments }}>
      {children}
    </BreadcrumbContext.Provider>
  );
};

export const useBreadcrumbs = () => {
  const context = useContext(BreadcrumbContext);
  if (context === undefined) {
    throw new Error('useBreadcrumbs must be used within a BreadcrumbProvider');
  }
  return context;
}; 