"use client";

import { useEffect } from "react";

import { VisitReportSection } from "@/components/orders/VisitReportSection";
import { BannerSubtitle, BannerTitle, PageBanner } from "@/components/ui/page-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { useBreadcrumbs, type BreadcrumbSegment } from "@/contexts/BreadcrumbContext";
import { api } from "@/lib/trpc/react";

export default function VisitReportsPage() {
  const { setBreadcrumbSegments, clearBreadcrumbSegments } = useBreadcrumbs();
  const { data, error, isLoading } = api.visitReport.list.useQuery();

  useEffect(() => {
    const segments: BreadcrumbSegment[] = [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Visit reports" },
    ];
    setBreadcrumbSegments(segments);
    return () => {
      clearBreadcrumbSegments();
    };
  }, [setBreadcrumbSegments, clearBreadcrumbSegments]);

  return (
    <div className="space-y-6 p-6">
      <PageBanner>
        <BannerTitle>Visit reports</BannerTitle>
        <BannerSubtitle>
          What Scheduling sends when a visit is marked done: hours, lines, the material note, and the comment.
        </BannerSubtitle>
      </PageBanner>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : error ? (
        <p className="text-sm text-red-600">Visit reports could not be loaded. {error.message}</p>
      ) : (
        <VisitReportSection reports={data ?? []} showOrderLink />
      )}
    </div>
  );
}
