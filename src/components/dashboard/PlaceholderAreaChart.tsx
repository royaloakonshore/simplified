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
import { CHART_COLORS } from '@/lib/utils/chart-colors';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface RevenueChartProps {
  type?: "weekly" | "monthly" | "customers";
  periods?: number;
  startDate?: Date;
  endDate?: Date;
}

export function RevenueChart({ type = "monthly", periods = 6, startDate, endDate }: RevenueChartProps) {
  const { data: chartData, isLoading: isLoadingChart, error: chartError } = api.dashboard.getRevenueChartData.useQuery({
    type: type === "customers" ? "monthly" : type,
    periods,
  }, {
    enabled: type !== "customers"
  });

  const { data: customersData, isLoading: isLoadingCustomers, error: customersError } = api.dashboard.getTopCustomers.useQuery({
    startDate,
    endDate,
    limit: 10,
  }, {
    enabled: type === "customers"
  });

  const isLoading = type === "customers" ? isLoadingCustomers : isLoadingChart;
  const error = type === "customers" ? customersError : chartError;

  if (isLoading) {
    return (
      <div className="aspect-[16/5] w-full">
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  if (error || (type !== "customers" && !chartData) || (type === "customers" && !customersData)) {
    return (
      <div className="aspect-[16/5] w-full rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-6 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          {error ? `Error loading data: ${error.message}` : 'No data available'}
        </p>
      </div>
    );
  }

  // Render customers table
  if (type === "customers" && customersData) {
    return (
      <div className="w-full">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Margin</TableHead>
              <TableHead className="text-right">Margin %</TableHead>
              <TableHead className="text-center">Invoices</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customersData.map((customer) => (
              <TableRow key={customer.customerId}>
                <TableCell className="font-medium">
                  {customer.customerName}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(customer.totalRevenue)}
                </TableCell>
                <TableCell className="text-right">
                  <span className={customer.totalMargin >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {formatCurrency(customer.totalMargin)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Badge 
                    variant={customer.marginPercentage >= 0 ? "default" : "destructive"}
                    className="font-mono"
                  >
                    {customer.marginPercentage.toFixed(1)}%
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  {customer.invoiceCount}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {customersData.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            No customer data available for the selected period
          </div>
        )}
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
              <stop offset="5%" stopColor={CHART_COLORS.emerald[500]} stopOpacity={0.4} />
              <stop offset="95%" stopColor={CHART_COLORS.emerald[500]} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.emerald[200]} className="opacity-40 dark:opacity-20" />
          <XAxis 
            dataKey="period" 
            tickFormatter={formatXAxisLabel}
            fontSize={12}
            tickMargin={8}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: CHART_COLORS.emerald[300] }}
            tickLine={{ stroke: CHART_COLORS.emerald[300] }}
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
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            axisLine={{ stroke: CHART_COLORS.emerald[300] }}
            tickLine={{ stroke: CHART_COLORS.emerald[300] }}
          />
          <Tooltip 
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-background p-3 shadow-lg">
                    <div className="text-sm font-medium text-foreground">{label}</div>
                    <div className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold">
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
            stroke={CHART_COLORS.emerald[600]}
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorRevenue)"
            dot={{ fill: CHART_COLORS.emerald[600], strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: CHART_COLORS.emerald[600], strokeWidth: 2, fill: CHART_COLORS.emerald[500] }}
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