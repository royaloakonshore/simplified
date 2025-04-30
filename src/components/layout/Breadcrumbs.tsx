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
  const segments = manualSegments ?? generateSegmentsFromPathname(pathname);

  if (!segments || segments.length === 0) {
    return null; // Don't render if no segments
  }

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        {segments.map((segment, index) => (
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
            {index < segments.length - 1 && <BreadcrumbSeparator />}
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
} 