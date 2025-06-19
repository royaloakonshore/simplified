"use client";

import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  XAxis,
  YAxis,
  Area,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { api } from '@/lib/trpc/react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';

interface RevenueChartProps {
  type?: "weekly" | "monthly";
  periods?: number;
}

export function RevenueChart({ type = "monthly", periods = 6 }: RevenueChartProps) {
  const { data: chartData, isLoading, error } = api.dashboard.getRevenueChartData.useQuery({
    type,
    periods,
  });

  if (isLoading) {
    return (
      <div className="aspect-[16/5] w-full">
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  if (error || !chartData) {
    return (
      <div className="aspect-[16/5] w-full rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-6 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          {error ? `Error loading chart data: ${error.message}` : 'No chart data available'}
        </p>
      </div>
    );
  }

  const formatTooltipValue = (value: number) => {
    return formatCurrency(value);
  };

  const formatXAxisLabel = (label: string) => {
    // Truncate long labels for better display
    return label.length > 10 ? label.substring(0, 10) + '...' : label;
  };

  return (
    <div className="aspect-[16/5] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{
            top: 10,
            right: 30,
            left: 0,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey="period" 
            tickFormatter={formatXAxisLabel}
            fontSize={12}
            tickMargin={8}
          />
          <YAxis 
            tickFormatter={(value) => {
              // Format as K, M for large numbers
              if (value >= 1000000) {
                return `€${(value / 1000000).toFixed(1)}M`;
              } else if (value >= 1000) {
                return `€${(value / 1000).toFixed(0)}K`;
              }
              return `€${value}`;
            }}
            fontSize={12}
            tickMargin={8}
          />
          <Tooltip 
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="rounded-lg border bg-background p-2 shadow-md">
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-sm text-muted-foreground">
                      Revenue: {formatTooltipValue(payload[0]?.value as number || 0)}
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorRevenue)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Keep backward compatibility
export function PlaceholderAreaChart() {
  return <RevenueChart />;
} 