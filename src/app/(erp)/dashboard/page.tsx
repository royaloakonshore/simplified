"use client";

import * as React from "react";
import { api } from "@/lib/trpc/react"; 
import { Badge } from "@/components/ui/badge"; 
import { Skeleton } from "@/components/ui/skeleton"; 
import { AlertTriangle, Info, TrendingDownIcon, TrendingUpIcon, CalendarIcon, FileText } from "lucide-react"; 
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PageBanner, BannerTitle } from "@/components/ui/page-banner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { useSession } from "next-auth/react";
import SalesFunnel from "@/components/orders/SalesFunnel";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { differenceInDays } from "date-fns";

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
  trend?: string;
  trendDirection?: "up" | "down";
  href?: string; 
}) {
  const cardContent = (
    <Card className="@container/card shadow-xs bg-card dark:bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardDescription>{title}</CardDescription>
            <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
              {value}
            </CardTitle>
          </div>
          {trend && trendDirection && (
            <div className="flex items-center gap-1 rounded-lg border bg-background px-2 py-1 text-xs ml-2 flex-shrink-0">
              {trendDirection === "up" ? (
                <TrendingUpIcon className="size-3 text-green-500" />
              ) : (
                <TrendingDownIcon className="size-3 text-red-500" />
              )}
              <span className={trendDirection === "up" ? "text-green-600" : "text-red-600"}>
                {trend}
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardFooter className="pt-0">
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardFooter>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block hover:shadow-md transition-shadow">
        {cardContent}
      </Link>
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
}

function RecentOrdersTable() {
  const { data: orders, isLoading, error } = api.dashboard.getRecentOrders.useQuery({ limit: 10 });

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-600 flex items-center">
        <AlertTriangle className="h-4 w-4 mr-2" /> Error loading orders: {error.message}
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground flex items-center">
        <Info className="h-4 w-4 mr-2" /> No recent orders found.
      </div>
    );
  }

  return (
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
        {orders.map((order) => (
          <TableRow 
            key={order.id}
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => window.location.href = `/orders/${order.id}`}
          >
            <TableCell className="font-medium px-4 whitespace-nowrap">
              <Link href={`/orders/${order.id}`} className="hover:underline">
                {order.orderNumber}
              </Link>
            </TableCell>
            <TableCell className="whitespace-nowrap">{order.customer?.name || 'N/A'}</TableCell>
            <TableCell>
              <Badge variant={order.status === 'draft' ? 'secondary' : 'default'}>
                {order.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </TableCell>
            <TableCell className="text-right px-4 whitespace-nowrap">
              {order.orderDate ? new Date(order.orderDate).toLocaleDateString() : 'N/A'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ReplenishmentAlertsTable() {
  const { data: alerts, isLoading, error } = api.inventory.getReplenishmentAlerts.useQuery(undefined, {
    refetchOnWindowFocus: false,
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
        </TableRow>
      </TableHeader>
      <TableBody>
        {alerts.map((item: ReplenishmentAlertItem) => (
           <TableRow key={item.id}>
             <TableCell className="font-medium px-4 whitespace-nowrap">
               <Link href={`/inventory/${item.id}/edit`} className="hover:underline">
                 {item.sku || "N/A"}
               </Link>
             </TableCell>
             <TableCell className="whitespace-nowrap">{item.name}</TableCell>
             <TableCell className="text-right whitespace-nowrap">
                <Badge variant={parseFloat(item.quantityOnHand) < parseFloat(item.minimumStockLevel) ? "destructive" : "secondary"}>
                  {item.quantityOnHand}
                </Badge>
             </TableCell>
             <TableCell className="text-right whitespace-nowrap">{item.reorderLevel || "-"}</TableCell>
           </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });
  const [comparisonType, setComparisonType] = React.useState<"previous" | "yearOverYear">("previous");

  const { data: stats, isLoading: statsLoading } = api.dashboard.getStats.useQuery({
    startDate: dateRange?.from,
    endDate: dateRange?.to,
    comparisonType,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fi-FI", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const getComparisonDescription = () => {
    if (!dateRange?.from || !dateRange?.to) return "";
    const days = differenceInDays(dateRange.to, dateRange.from) + 1;
    if (comparisonType === 'yearOverYear') {
      return `vs. same ${days}-day period last year`;
    }
    return `vs. previous ${days} days`;
  };

  return (
    <div className="@container/main_dashboard w-full space-y-6">
      <PageBanner>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <BannerTitle>
            Welcome back, {session?.user?.firstName || session?.user?.name || "User"}!
          </BannerTitle>
          <div className="flex items-center gap-2 mt-4 sm:mt-0">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[280px] justify-start text-left font-normal")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
            <select
              value={comparisonType}
              onChange={(e) => setComparisonType(e.target.value as "previous" | "yearOverYear")}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="previous">vs. Previous Period</option>
              <option value="yearOverYear">vs. Last Year</option>
            </select>
          </div>
        </div>
      </PageBanner>

      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 gap-4 @[640px]/main:grid-cols-2 @[1024px]/main:grid-cols-4">
            <StatsCard
              title="Revenue"
              value={statsLoading ? "..." : formatCurrency(stats?.revenue.current || 0)}
              description={getComparisonDescription()}
              trend={`${Math.abs(stats?.revenue.trend || 0).toFixed(1)}%`}
              trendDirection={(stats?.revenue.trend ?? 0) >= 0 ? "up" : "down"}
            />
            <StatsCard
              title="Shipped Orders"
              value={statsLoading ? "..." : (stats?.shippedOrders.current || 0).toString()}
              description={getComparisonDescription()}
              trend={`${Math.abs(stats?.shippedOrders.trend || 0).toFixed(1)}%`}
              trendDirection={(stats?.shippedOrders.trend ?? 0) >= 0 ? "up" : "down"}
              href="/orders"
            />
            <StatsCard
              title="Inventory Turnover"
              value={statsLoading ? "..." : (stats?.inventory.turnover || 0).toFixed(2)}
              description="Cost of goods sold / average inventory"
              href="/inventory"
            />
            <StatsCard
              title="New Customers"
              value={statsLoading ? "..." : (stats?.customerGrowth.current || 0).toString()}
              description={getComparisonDescription()}
              trend={`${Math.abs(stats?.customerGrowth.trend || 0).toFixed(1)}%`}
              trendDirection={(stats?.customerGrowth.trend ?? 0) >= 0 ? "up" : "down"}
              href="/customers"
            />
          </div>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
            <SalesFunnel 
              startDate={dateRange?.from} 
              endDate={dateRange?.to} 
              disableControls={true} 
            />
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Replenishment Alerts</CardTitle>
              <CardDescription>Items that need your attention.</CardDescription>
            </CardHeader>
            <CardContent>
              <ReplenishmentAlertsTable />
            </CardContent>
          </Card>
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>Your 10 most recent orders.</CardDescription>
          </CardHeader>
          <CardContent>
            <RecentOrdersTable />
          </CardContent>
        </Card>
      </div>

    </div>
  );
}