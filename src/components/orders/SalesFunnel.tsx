'use client';

import React from 'react';
import { api } from "@/lib/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { OrderStatus } from "@prisma/client";
import { TrendingUp, FileText, Wrench, Package, CheckCircle } from "lucide-react";

interface FunnelStage {
  id: string;
  name: string;
  status: OrderStatus[];
  count: number;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

export function SalesFunnel() {
  const { data: funnelStats, isLoading } = api.order.getFunnelStats.useQuery();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Sales Funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!funnelStats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Sales Funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Unable to load funnel data</p>
        </CardContent>
      </Card>
    );
  }

  const stages: FunnelStage[] = [
    {
      id: 'quotations',
      name: 'Quotations',
      status: [OrderStatus.draft],
      count: funnelStats.quotations.count,
      value: funnelStats.quotations.value,
      icon: FileText,
      color: 'bg-blue-100 text-blue-700 border-blue-200'
    },
    {
      id: 'pending',
      name: 'Work Orders (Pending)',
      status: [OrderStatus.confirmed],
      count: funnelStats.pending.count,
      value: funnelStats.pending.value,
      icon: Wrench,
      color: 'bg-yellow-100 text-yellow-700 border-yellow-200'
    },
    {
      id: 'production',
      name: 'In Production',
      status: [OrderStatus.in_production],
      count: funnelStats.production.count,
      value: funnelStats.production.value,
      icon: Package,
      color: 'bg-orange-100 text-orange-700 border-orange-200'
    },
    {
      id: 'completed',
      name: 'Completed/Invoiced',
      status: [OrderStatus.shipped, OrderStatus.delivered],
      count: funnelStats.completed.count,
      value: funnelStats.completed.value,
      icon: CheckCircle,
      color: 'bg-green-100 text-green-700 border-green-200'
    }
  ];

  const totalValue = stages.reduce((sum, stage) => sum + stage.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Sales Funnel
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {stages.map((stage, index) => {
            const widthPercentage = totalValue > 0 ? (stage.value / totalValue) * 100 : 0;
            const Icon = stage.icon;
            
            return (
              <div key={stage.id} className="relative">
                <div className={`flex items-center justify-between p-4 rounded-lg border ${stage.color} transition-all hover:shadow-md`}>
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5" />
                    <div>
                      <h4 className="font-medium">{stage.name}</h4>
                      <p className="text-sm opacity-80">{stage.count} order{stage.count !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(stage.value)}</p>
                    <p className="text-xs opacity-80">{widthPercentage.toFixed(1)}%</p>
                  </div>
                </div>
                
                {/* Funnel visual indicator */}
                <div className="mt-2 mb-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-primary/60 to-primary transition-all duration-500"
                    style={{ width: `${widthPercentage}%` }}
                  />
                </div>
                
                {/* Connecting line */}
                {index < stages.length - 1 && (
                  <div className="flex justify-center py-2">
                    <div className="w-0.5 h-4 bg-border"></div>
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Summary */}
          <div className="mt-6 p-4 bg-muted/50 rounded-lg border-2 border-dashed">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-foreground">Total Pipeline Value</h4>
              <p className="text-lg font-bold text-primary">{formatCurrency(totalValue)}</p>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Across {stages.reduce((sum, stage) => sum + stage.count, 0)} total orders
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 