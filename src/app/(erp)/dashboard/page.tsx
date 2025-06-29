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
import { RevenueChart } from "@/components/dashboard/PlaceholderAreaChart";
import { PageBanner, BannerTitle } from "@/components/ui/page-banner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { useSession } from "next-auth/react";

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
        >{cardContent}</Link>
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
              <Link
                href={`/orders/${order.id}`}
                className="hover:underline"
              >
                {order.orderNumber}
              </Link>
            </TableCell>
            <TableCell className="whitespace-nowrap">
              {order.customer?.name || 'N/A'}
            </TableCell>
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
                  >
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
  // Get session for user info and company context
  const { data: session } = useSession();

  // Chart controls state
  const [chartType, setChartType] = React.useState<"weekly" | "monthly">("monthly");
  const [dateRange, setDateRange] = React.useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: undefined,
    to: undefined,
  });

  // Fetch dashboard statistics with date filter
  const { data: stats, isLoading: statsLoading } = api.dashboard.getStats.useQuery({
    periodType: "month",
    startDate: dateRange.from,
    endDate: dateRange.to,
  });
  
  // Fetch user's member companies to get the active company name
  const { data: memberCompanies } = api.user.getMemberCompanies.useQuery(undefined, {
    enabled: !!session?.user
  });
  
  // Find the active company
  const activeCompany = memberCompanies?.find(
    company => company.id === session?.user?.activeCompanyId
  );
  const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false);

  // Format currency values
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fi-FI', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  // Format trend percentage
  const formatTrend = (trend: number) => {
    const sign = trend >= 0 ? '+' : '';
    return `${sign}${trend.toFixed(1)}%`;
  };

  const resetDateRange = () => {
    setDateRange({ from: undefined, to: undefined });
    setIsDatePickerOpen(false);
  };

  const formatDateRange = () => {
    if (dateRange.from && dateRange.to) {
      return `${format(dateRange.from, "MMM dd")} - ${format(dateRange.to, "MMM dd")}`;
    }
    return "Select Date Range";
  };

  return (
    <div className="w-full flex-1 flex flex-col">
      <PageBanner>
        <BannerTitle>Dashboard</BannerTitle>
      </PageBanner>
      
      {/* Greeting Section */}
      {session?.user && (
        <div className="px-4 py-3 border-b bg-gradient-to-r from-background to-muted/30">
          <div className="max-w-none">
            <h2 className="text-xl font-semibold text-foreground">
              Hello, {session.user.firstName || session.user.name?.split(' ')[0]}! 👋
            </h2>
            {activeCompany && (
              <p className="text-sm text-muted-foreground mt-1">
                {activeCompany.name}
              </p>
            )}
          </div>
        </div>
      )}
      
      <div className="w-full max-w-none flex flex-1 flex-col gap-4 @container/main">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                {formatDateRange()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={(range) => {
                  setDateRange({
                    from: range?.from,
                    to: range?.to,
                  });
                }}
                numberOfMonths={2}
                initialFocus
              />
              <div className="flex gap-2 p-3 border-t">
                <Button size="sm" onClick={resetDateRange}>
                  Clear
                </Button>
                <Button size="sm" onClick={() => setIsDatePickerOpen(false)}>
                  Close
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <span className="text-xs text-muted-foreground">
            {dateRange.from && dateRange.to 
              ? "Custom range selected" 
              : "Current Month vs Previous Month"
            }
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 @5xl/main:grid-cols-4 md:gap-6">
          <StatsCard 
            title="Shipped Orders (Month)" 
            value={statsLoading ? "..." : stats?.shippedOrders.current.toString() || "0"} 
            description="vs. previous month" 
            trend={statsLoading ? "..." : formatTrend(stats?.shippedOrders.trend || 0)} 
            trendDirection={(stats?.shippedOrders.trend ?? 0) >= 0 ? "up" : "down"} 
            href="/orders?status=shipped"
          />
          <StatsCard 
            title="Pending Production" 
            value={statsLoading ? "..." : stats?.pendingProduction.count.toString() || "0"} 
            description="Currently in queue" 
            trend="Active" 
            trendDirection="up" 
            href="/production"
          />
          <StatsCard 
            title="Late Orders" 
            value={statsLoading ? "..." : stats?.lateOrders.count.toString() || "0"} 
            description="Past due date" 
            trend={(stats?.lateOrders.count ?? 0) > 0 ? "Action needed" : "On track"} 
            trendDirection={(stats?.lateOrders.count ?? 0) > 0 ? "down" : "up"} 
            href="/orders?filter=late"
          />
          <StatsCard 
            title="Total Revenue (Month)" 
            value={statsLoading ? "..." : formatCurrency(stats?.revenue.current || 0)} 
            description="vs. previous month" 
            trend={statsLoading ? "..." : formatTrend(stats?.revenue.trend || 0)} 
            trendDirection={(stats?.revenue.trend ?? 0) >= 0 ? "up" : "down"} 
            href="/invoices"
          />
        </div>

        {/* Performance Indicators Row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:gap-6">
          <StatsCard 
            title="Order Fulfillment Rate" 
            value={statsLoading ? "..." : `${(stats?.orderFulfillmentRate.percentage || 0).toFixed(1)}%`} 
            description={`${stats?.orderFulfillmentRate.onTime || 0} of ${stats?.orderFulfillmentRate.total || 0} on time`} 
            trend={(stats?.orderFulfillmentRate.percentage ?? 0) >= 95 ? "Excellent" : (stats?.orderFulfillmentRate.percentage ?? 0) >= 80 ? "Good" : "Needs Improvement"} 
            trendDirection={(stats?.orderFulfillmentRate.percentage ?? 0) >= 95 ? "up" : "down"} 
            href="/orders"
          />
          <StatsCard 
            title="Inventory Turnover" 
            value={statsLoading ? "..." : `${Math.abs(stats?.inventoryTurnover.percentage || 0).toFixed(1)}%`} 
            description="Inventory value change" 
            trend={`${(stats?.inventoryTurnover.percentage ?? 0) > 0 ? "↓" : "↑"} Stock movement`} 
            trendDirection={(stats?.inventoryTurnover.percentage ?? 0) > 0 ? "up" : "down"} 
            href="/inventory"
          />
          <StatsCard 
            title="Customer Growth" 
            value={statsLoading ? "..." : `+${stats?.customerGrowth.current || 0}`} 
            description="New customers this month" 
            trend={statsLoading ? "..." : formatTrend(stats?.customerGrowth.trend || 0)} 
            trendDirection={(stats?.customerGrowth.trend ?? 0) >= 0 ? "up" : "down"} 
            href="/customers"
          />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Revenue Trend</CardTitle>
              <CardDescription>
                {chartType === "monthly" ? "Monthly" : "Weekly"} revenue comparison
              </CardDescription>
            </div>
            <Tabs value={chartType} onValueChange={(value) => setChartType(value as "weekly" | "monthly")} className="space-y-4">
              <TabsList>
                <TabsTrigger value="weekly">Weekly</TabsTrigger>
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            <RevenueChart type={chartType} periods={chartType === "monthly" ? 6 : 8} />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4 md:gap-6">
          <Card className="flex flex-col h-[calc(10rem*2+2rem)]">
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
              <CardDescription>Latest orders and quotations.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0">
              <RecentOrdersTable />
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