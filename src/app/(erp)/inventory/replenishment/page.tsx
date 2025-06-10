import { Suspense } from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { PageBanner, BannerTitle } from '@/components/ui/page-banner';
import { ReplenishmentAlerts } from '@/components/inventory/ReplenishmentAlerts';
import { ReplenishmentTable } from '@/components/inventory/ReplenishmentTable';
import { ReplenishmentActions } from '@/components/inventory/ReplenishmentActions';
import { Button } from '@/components/ui/button';
import { Download, Upload, RefreshCw } from 'lucide-react';

export default async function ReplenishmentPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/auth/signin');
  }

  return (
    <div className="w-full">
      <PageBanner>
        <BannerTitle>Replenishment Management</BannerTitle>
      </PageBanner>

      <div className="space-y-6">
        {/* Action Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Raw Materials Replenishment Dashboard
            </span>
          </div>
          
          <ReplenishmentActions />
        </div>

        {/* Critical Alerts Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Critical Alerts
            </h2>
            <span className="text-xs text-muted-foreground">
              Items requiring immediate attention
            </span>
          </div>
          
          <Suspense fallback={<div className="h-32 bg-muted/20 animate-pulse rounded-lg" />}>
            <ReplenishmentAlerts />
          </Suspense>
        </div>

        {/* Full Replenishment Table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              All Raw Materials
            </h2>
            <span className="text-xs text-muted-foreground">
              Complete replenishment overview
            </span>
          </div>
          
          <Suspense fallback={<div className="h-96 bg-muted/20 animate-pulse rounded-lg" />}>
            <ReplenishmentTable />
          </Suspense>
        </div>
      </div>
    </div>
  );
} 