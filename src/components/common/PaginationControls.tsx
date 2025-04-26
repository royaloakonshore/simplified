"use client";

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  searchParams: { [key: string]: string | string[] | undefined };
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  searchParams,
  hasNextPage,
  hasPrevPage,
}) => {
  const router = useRouter();
  const pathname = usePathname();

  const handlePageChange = (newPage: number) => {
    const current = new URLSearchParams(Array.from(Object.entries(searchParams)).flatMap(([key, value]) => 
      Array.isArray(value) ? value.map(v => [key, v]) : [[key, value as string]]
    ));
    current.set('page', String(newPage));
    const search = current.toString();
    const query = search ? `?${search}` : '';
    router.push(`${pathname}${query}`);
  };

  return (
    <div className="flex items-center justify-between mt-4">
      <button
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={!hasPrevPage}
        className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300"
        aria-label="Previous Page"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <span className="text-sm text-gray-700 dark:text-gray-300">
        Page {currentPage} of {totalPages}
      </span>
      <button
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={!hasNextPage}
        className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300"
        aria-label="Next Page"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
};

export default PaginationControls; 