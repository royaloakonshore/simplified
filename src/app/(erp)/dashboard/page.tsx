"use client";

import * as React from "react";
import { api } from "@/lib/trpc/react"; 
import { Badge } from "@/components/ui/badge"; 
import { Skeleton } from "@/components/ui/skeleton"; 
import { AlertTriangle, Info } from "lucide-react"; 
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { PlaceholderAreaChart } from "@/components/dashboard/PlaceholderAreaChart";
import { DashboardSiteHeader } from "@/components/dashboard/DashboardSiteHeader";
import { Button } from "@/components/ui/button";

// StatsCard component (can be moved to its own file later if preferred)
function StatsCard({
  title,
  value,
  description,
  trend,
  trendDirection,
  href, 
}: {
  title: string;
  value: string;
  description: string;
  trend: string;
  trendDirection: "up" | "down";
  href?: string; 
}) {
  const cardContent = (
    <Card className="@container/card shadow-xs bg-card dark:bg-card">
      <CardHeader className="relative pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
          {value}
        </CardTitle>
        <div className="absolute right-4 top-4">
          <div className="flex items-center gap-1 rounded-lg border bg-background px-2 py-1 text-xs">
            {trendDirection === "up" ? (
              <TrendingUpIcon className="size-3 text-green-500" />
            ) : (
              <TrendingDownIcon className="size-3 text-red-500" />
            )}
            <span className={trendDirection === "up" ? "text-green-600" : "text-red-600"}>
              {trend}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardFooter className="pt-0">
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardFooter>
    </Card>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block hover:shadow-md transition-shadow"
        legacyBehavior>{cardContent}</Link>
    );
  }
  return cardContent;
}

interface ReplenishmentAlertItem {
  id: string;
  sku: string | null;
  name: string;
  quantityOnHand: string; 
  reorderLevel: string | null; 
  minimumStockLevel: string; 
  leadTimeDays: number | null;
  vendorSku: string | null;
  vendorItemName: string | null;
  unitOfMeasure: string | null;
}

function ReplenishmentAlertsTable() {
  const { data: alerts, isLoading, error } = api.inventory.getReplenishmentAlerts.useQuery(undefined, {
    refetchOnWindowFocus: false, // Prevent excessive refetching on window focus
  });

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-600 flex items-center">
        <AlertTriangle className="h-4 w-4 mr-2" /> Error loading alerts: {error.message}
      </div>
    );
  }

  if (!alerts || alerts.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground flex items-center">
        <Info className="h-4 w-4 mr-2" /> No items currently need replenishment.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="px-4">SKU</TableHead>
          <TableHead>Name</TableHead>
          <TableHead className="text-right">Stock</TableHead>
          <TableHead className="text-right">Reorder Lvl</TableHead>
          <TableHead className="text-right">Min. Stock</TableHead>
          <TableHead className="text-right">Lead Time</TableHead>
          <TableHead>Vendor SKU</TableHead>
          <TableHead>Vendor Name</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {alerts.map((item: ReplenishmentAlertItem) => {
          const qtyOnHand = parseFloat(item.quantityOnHand);
          const reorderLvl = item.reorderLevel ? parseFloat(item.reorderLevel) : null;
          const minStockLvl = parseFloat(item.minimumStockLevel);
          let stockStatus: "critical" | "low" | "ok" = "ok";
          if (qtyOnHand < minStockLvl) stockStatus = "critical";
          else if (reorderLvl !== null && qtyOnHand < reorderLvl) stockStatus = "low";

          return (
            <TableRow key={item.id}>
              <TableCell className="font-medium px-4 whitespace-nowrap">
                <Link
                  href={`/inventory/${item.id}/edit`}
                  className="hover:underline"
                  legacyBehavior>
                  {item.sku || "N/A"}
                </Link>
              </TableCell>
              <TableCell className="whitespace-nowrap">{item.name}</TableCell>
              <TableCell className="text-right whitespace-nowrap">
                <Badge variant={stockStatus === "critical" ? "destructive" : stockStatus === "low" ? "secondary" : "outline"}>
                  {item.quantityOnHand} {item.unitOfMeasure || ''}
                </Badge>
              </TableCell>
              <TableCell className="text-right whitespace-nowrap">{item.reorderLevel || "-"}</TableCell>
              <TableCell className="text-right whitespace-nowrap">{item.minimumStockLevel}</TableCell>
              <TableCell className="text-right whitespace-nowrap">{item.leadTimeDays !== null ? `${item.leadTimeDays} d` : "-"}</TableCell>
              <TableCell className="whitespace-nowrap">{item.vendorSku || "-"}</TableCell>
              <TableCell className="whitespace-nowrap">{item.vendorItemName || "-"}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default function DashboardPage() {

  return (
    <div className="flex flex-1 flex-col">
      <DashboardSiteHeader title="Dashboard" />
      <div className="w-full flex flex-1 flex-col gap-4 @container/main">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button variant="outline" size="sm" disabled>
            Date Range (TODO)
          </Button>
          <span className="text-xs text-muted-foreground">Real-time: N/A (TODO)</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 @5xl/main:grid-cols-4 md:gap-6">
          <StatsCard 
            title="Shipped Orders (Period)" 
            value="0" 
            description="vs. previous period" 
            trend="+0%" 
            trendDirection="up" 
            href="/orders?status=shipped"
          />
          <StatsCard 
            title="Pending Production" 
            value="0" 
            description="Currently in queue" 
            trend="-0%" 
            trendDirection="down" 
            href="/production"
          />
          <StatsCard 
            title="Late Orders" 
            value="0" 
            description="Past due date" 
            trend="+0%" 
            trendDirection="up" 
            href="/orders?status=late"
          />
          <StatsCard 
            title="Total Revenue (Period)" 
            value="€0.00" 
            description="vs. previous period" 
            trend="+0%" 
            trendDirection="up" 
            href="/invoices"
          />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Revenue Trend</CardTitle>
              <CardDescription>Comparison with previous period (TODO)</CardDescription>
            </div>
            <Tabs defaultValue="monthly" className="space-y-4">
              <TabsList>
                <TabsTrigger value="weekly">Weekly</TabsTrigger>
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            <PlaceholderAreaChart />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4 md:gap-6">
          <Card className="flex flex-col h-[calc(10rem*2+2rem)]">
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
              <CardDescription>Last 10 quotations.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4">Order ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right px-4">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(10)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium px-4">{`ORD-00${123 + i}`}</TableCell>
                      <TableCell>{`Customer ${String.fromCharCode(65 + i)}`}</TableCell>
                      <TableCell>Draft</TableCell>
                      <TableCell className="text-right px-4">2024-05-23</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="flex flex-col h-[calc(10rem*2+2rem)]"> 
            <CardHeader>
              <CardTitle>Replenishment Alerts</CardTitle>
              <CardDescription>Items needing reorder.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0">
              <ReplenishmentAlertsTable />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}