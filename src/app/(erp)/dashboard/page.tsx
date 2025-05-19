"use client";

import * as React from "react";
// import { AppSidebar } from "@/components/AppSidebar"; // AppSidebar is already part of ERPLayoutClient
// import {
//   Breadcrumb,
//   BreadcrumbItem,
//   BreadcrumbLink,
//   BreadcrumbList,
//   BreadcrumbPage,
//   BreadcrumbSeparator,
// } from "@/components/ui/breadcrumb"; // Not used here, ERPLayoutClient has main breadcrumbs
// import { Separator } from "@/components/ui/separator"; // Not directly used here
// import {
//   SidebarTrigger, // This is in ERPLayoutClient header
// } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { PlaceholderAreaChart } from "@/components/dashboard/PlaceholderAreaChart";
import { PlaceholderRecentOrdersTable } from "@/components/dashboard/PlaceholderRecentOrdersTable";
import { PlaceholderReplenishmentTable } from "@/components/dashboard/PlaceholderReplenishmentTable";
import { DashboardSiteHeader } from "@/components/dashboard/DashboardSiteHeader"; // Import the new header

// StatsCard component (can be moved to its own file later if preferred)
function StatsCard({
  title,
  value,
  description,
  trend,
  trendDirection,
}: {
  title: string;
  value: string;
  description: string;
  trend: string;
  trendDirection: "up" | "down";
}) {
  return (
    <Card className="@container/card shadow-xs bg-gradient-to-t from-primary/5 to-card dark:bg-card">
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
}

export default function DashboardPage() {
  // const [dateRange, setDateRange] = React.useState<DateRange | undefined>({
  //   from: new Date(new Date().setDate(new Date().getDate() - 30)),
  //   to: new Date(),
  // });

  return (
    // The main layout (SidebarProvider, AppSidebar, SidebarInset) is handled by ERPLayoutClient.tsx
    // This component renders *inside* the SidebarInset's children area.
    <div className="flex flex-1 flex-col">
      <DashboardSiteHeader title="Dashboard" />
      <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6 @container/main">
        {/* Date Range Selectors and Real-time update status - Placeholder */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          {/* <DateRangePicker range={dateRange} onRangeChange={setDateRange} /> */}
          <Button variant="outline" size="sm" disabled>Date Range (TODO)</Button>
          <span className="text-xs text-muted-foreground">Real-time: N/A (TODO)</span>
        </div>

        {/* Stats Cards Section */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 @5xl/main:grid-cols-4 md:gap-6">
          <StatsCard 
            title="Shipped Orders (Period)" 
            value="0" 
            description="vs. previous period" 
            trend="+0%" 
            trendDirection="up" 
          />
          <StatsCard 
            title="Pending Production" 
            value="0" 
            description="Currently in queue" 
            trend="-0%" 
            trendDirection="down" 
          />
          <StatsCard 
            title="Late Orders" 
            value="0" 
            description="Past due date" 
            trend="+0%" 
            trendDirection="up" 
          />
          <StatsCard 
            title="Total Revenue (Period)" 
            value="€0.00" 
            description="vs. previous period" 
            trend="+0%" 
            trendDirection="up" 
          />
        </div>

        {/* Revenue Trend Area Chart */}
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
            {/* <ChartAreaInteractive /> */}
          </CardContent>
        </Card>

        {/* Bottom Tables Section - Stacked vertically */}
        <div className="flex flex-col gap-4 md:gap-6">
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
              <CardDescription>Last 10 orders placed.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow overflow-hidden">
              <PlaceholderRecentOrdersTable />
            </CardContent>
          </Card>
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Replenishment Alerts</CardTitle>
              <CardDescription>Items needing reorder based on stock levels.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow overflow-hidden">
              <PlaceholderReplenishmentTable />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}