'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import React from 'react';
import { useBreadcrumbs } from '@/contexts/BreadcrumbContext';

interface BreadcrumbSegment {
  label: string;
  href?: string; // If missing, it's the current page
}

interface BreadcrumbsProps {
  segments?: BreadcrumbSegment[]; // Allow manual segments override
  className?: string;
}

// Helper to generate segments from pathname
function generateSegmentsFromPathname(pathname: string): BreadcrumbSegment[] {
  const pathParts = pathname.split('/').filter(part => part);
  let currentHref = '';
  const segments: BreadcrumbSegment[] = [{ label: 'Dashboard', href: '/dashboard' }];

  pathParts.forEach((part, index) => {
    // Skip the group segment like '(erp)' if present
    if (part.startsWith('(') && part.endsWith(')')) {
      return;
    }
    currentHref += `/${part}`;
    const isLast = index === pathParts.length - 1;

    // Basic capitalization, can be improved
    const label = part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, ' ');

    segments.push({
      label: label,
      href: isLast ? undefined : currentHref,
    });
  });

  // Handle root case or dashboard explicitly
  if (segments.length === 1 && pathname !== '/dashboard') {
     return []; // Don't show just dashboard if not on dashboard
  }
  if (pathname === '/dashboard') {
      return [{ label: 'Dashboard' }];
  }

  return segments;
}

export function Breadcrumbs({ segments: manualSegments, className }: BreadcrumbsProps) {
  const pathname = usePathname();
  const { breadcrumbSegments: contextSegments } = useBreadcrumbs();

  let segmentsToRender: BreadcrumbSegment[];

  if (contextSegments && contextSegments.length > 0) {
    segmentsToRender = contextSegments;
  } else if (manualSegments && manualSegments.length > 0) {
    segmentsToRender = manualSegments;
  } else {
    segmentsToRender = generateSegmentsFromPathname(pathname);
  }

  if (!segmentsToRender || segmentsToRender.length === 0) {
    return null; // Don't render if no segments
  }

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        {segmentsToRender.map((segment, index) => (
          <React.Fragment key={segment.label + index}>
            <BreadcrumbItem>
              {segment.href ? (
                <BreadcrumbLink asChild>
                  <Link href={segment.href}>{segment.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{segment.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
            {index < segmentsToRender.length - 1 && <BreadcrumbSeparator />}
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
} 