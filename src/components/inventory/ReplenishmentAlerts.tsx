"use client";

import { api } from '@/lib/trpc/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Package, Clock, Truck, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export function ReplenishmentAlerts() {
  const router = useRouter();
  const { data: alerts, isLoading, error } = api.replenishment.getCriticalAlerts.useQuery();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            Loading Critical Alerts...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted/20 animate-pulse rounded-md" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-red-600">
            <AlertTriangle className="h-4 w-4" />
            Error Loading Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Failed to load critical alerts: {error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!alerts || alerts.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-green-600">
            <Package className="h-4 w-4" />
            All Good!
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No critical stock alerts. All raw materials are above reorder levels.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getUrgencyBadgeColor = (score: number) => {
    if (score >= 90) return 'destructive';
    if (score >= 70) return 'secondary';
    if (score >= 50) return 'outline';
    return 'default';
  };

  const getUrgencyLabel = (score: number) => {
    if (score >= 90) return 'CRITICAL';
    if (score >= 70) return 'HIGH';
    if (score >= 50) return 'MEDIUM';
    return 'LOW';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            Critical Alerts ({alerts.length})
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/inventory/replenishment')}
          >
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.slice(0, 5).map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => router.push(`/inventory/${alert.id}`)}
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <Badge variant={getUrgencyBadgeColor(alert.urgencyScore)}>
                      {getUrgencyLabel(alert.urgencyScore)}
                    </Badge>
                    <span className="font-medium text-sm">{alert.name}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      SKU: {alert.sku}
                    </span>
                    {alert.category && (
                      <span>{alert.category}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <div className="text-center">
                  <div className="flex items-center gap-1 text-red-600">
                    <TrendingDown className="h-3 w-3" />
                    <span className="font-medium">{alert.currentStock}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">Current</div>
                </div>

                <div className="text-center">
                  <div className="flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    <span className="font-medium">{alert.reorderLevel}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">Reorder</div>
                </div>

                {alert.leadTimeDays > 0 && (
                  <div className="text-center">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span className="font-medium">{alert.leadTimeDays}d</span>
                    </div>
                    <div className="text-xs text-muted-foreground">Lead</div>
                  </div>
                )}

                {alert.vendorSku && (
                  <div className="text-center">
                    <div className="flex items-center gap-1">
                      <Truck className="h-3 w-3" />
                      <span className="font-medium text-xs">{alert.vendorSku}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">Vendor</div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {alerts.length > 5 && (
            <div className="text-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/inventory/replenishment')}
              >
                View {alerts.length - 5} More Alerts
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 