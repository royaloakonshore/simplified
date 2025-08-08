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
import DeferredLoader from "@/components/common/DeferredLoader";
import { PageBanner, BannerTitle } from "@/components/ui/page-banner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, FileText } from "lucide-react";
import { format, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import { subDays, subYears } from "date-fns";
import { useSession } from "next-auth/react";
import SalesFunnel from "@/components/orders/SalesFunnel";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
          {value}
        </CardTitle>
          </div>
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
  const [chartType, setChartType] = React.useState<"weekly" | "monthly" | "customers">("monthly");
  const [comparisonType, setComparisonType] = React.useState<"previous" | "yearOverYear">("previous");
  const [dateRange, setDateRange] = React.useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });



  // Fetch dashboard statistics with date filter and comparison type
  const { data: stats, isLoading: statsLoading } = api.dashboard.getStats.useQuery({
    periodType: "month",
    startDate: dateRange.from,
    endDate: dateRange.to,
    comparisonType: comparisonType,
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

  // Calculate comparison period for backend
  const getComparisonPeriod = React.useCallback(() => {
    if (!dateRange.from || !dateRange.to) return { from: undefined, to: undefined };

    const daysDiff = differenceInDays(dateRange.to, dateRange.from);
    
    if (comparisonType === "yearOverYear") {
      return {
        from: subYears(dateRange.from, 1),
        to: subYears(dateRange.to, 1),
      };
    } else {
      // Previous period with same length
      const comparisonEnd = subDays(dateRange.from, 1);
      const comparisonStart = subDays(comparisonEnd, daysDiff);
      return {
        from: comparisonStart,
        to: comparisonEnd,
      };
    }
  }, [dateRange, comparisonType]);

  const resetDateRange = () => {
    setDateRange({ 
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    });
    setIsDatePickerOpen(false);
  };

  const formatDateRange = () => {
    if (dateRange.from && dateRange.to) {
      return `${format(dateRange.from, "MMM dd")} - ${format(dateRange.to, "MMM dd")}`;
    }
    return "Select Date Range";
  };

  // Get comparison period description
  const getComparisonDescription = () => {
    if (!dateRange.from || !dateRange.to) return "";
    
    if (comparisonType === "yearOverYear") {
      return "vs. same period last year";
    } else {
      const daysDiff = differenceInDays(dateRange.to, dateRange.from);
      if (daysDiff <= 31) {
        return "vs. previous period";
      } else {
        return "vs. previous period";
      }
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col">
      <PageBanner>
        <BannerTitle>Dashboard</BannerTitle>
      </PageBanner>
      
      {/* Greeting Section */}
      {session?.user && (
        <div className="px-4 py-3 bg-gradient-to-r from-background to-muted/30">
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
      
      <div className="w-full max-w-none flex flex-1 flex-col gap-4 @container/main" id="dashboard-content">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
          {/* Period Comparison Toggle */}
          <ToggleGroup type="single" value={comparisonType} onValueChange={(value) => value && setComparisonType(value as "previous" | "yearOverYear")}>
            <ToggleGroupItem value="previous" aria-label="Previous Period">
              Previous Period
            </ToggleGroupItem>
            <ToggleGroupItem value="yearOverYear" aria-label="Year over Year">
              Year over Year
            </ToggleGroupItem>
          </ToggleGroup>

          {/* Date Range Picker and Export */}
          <div className="flex items-center gap-2">
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
                    Current Month
                </Button>
                <Button size="sm" onClick={() => setIsDatePickerOpen(false)}>
                  Close
                </Button>
              </div>
            </PopoverContent>
          </Popover>
            
            {/* Export to PDF Button */}
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-2"
              onClick={async () => {
                // Create a dedicated print-friendly view
                const printWindow = window.open('', '_blank');
                if (!printWindow) return;
                
                // Get the dashboard content (excluding sidebar)
                const dashboardContent = document.getElementById('dashboard-content');
                if (!dashboardContent) return;
                
                const clonedContent = dashboardContent.cloneNode(true) as HTMLElement;
                
                // Create a complete HTML document for printing
                printWindow.document.write(`
                  <!DOCTYPE html>
                  <html>
                    <head>
                      <title>Dashboard - ${formatDateRange()}</title>
                      <meta charset="utf-8">
                      <style>
                        * { box-sizing: border-box; margin: 0; padding: 0; }
                        body { 
                          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                          line-height: 1.5;
                          color: #333;
                          background: white;
                          padding: 20px;
                        }
                        @media print {
                          body { padding: 10px; }
                          @page { 
                            size: landscape;
                            margin: 0.5in; 
                          }
                        }
                        .w-full { width: 100% !important; }
                        .grid { display: grid; }
                        .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
                        .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                        .gap-4 { gap: 1rem; }
                        .gap-6 { gap: 1.5rem; }
                        .xl\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                        .sm\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                        .p-4 { padding: 1rem; }
                        .p-6 { padding: 1.5rem; }
                        .rounded-lg { border-radius: 0.5rem; }
                        .border { border: 1px solid #e5e7eb; }
                        .bg-card { background-color: #ffffff; }
                        .shadow-sm { box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); }
                        .text-sm { font-size: 0.875rem; }
                        .text-lg { font-size: 1.125rem; }
                        .text-xl { font-size: 1.25rem; }
                        .text-2xl { font-size: 1.5rem; }
                        .text-3xl { font-size: 1.875rem; }
                        .font-medium { font-weight: 500; }
                        .font-semibold { font-weight: 600; }
                        .font-bold { font-weight: 700; }
                        .text-foreground { color: #0f172a; }
                        .text-muted-foreground { color: #64748b; }
                        .text-green-600 { color: #16a34a; }
                        .text-red-600 { color: #dc2626; }
                        .h-fit { height: fit-content; }
                        .mb-2 { margin-bottom: 0.5rem; }
                        .mb-4 { margin-bottom: 1rem; }
                        .mt-2 { margin-top: 0.5rem; }
                        .flex { display: flex; }
                        .items-center { align-items: center; }
                        .justify-between { justify-content: space-between; }
                        .space-y-2 > * + * { margin-top: 0.5rem; }
                        h1, h2, h3 { margin-bottom: 0.5rem; }
                        .chart-container { 
                          width: 100%; 
                          height: 300px; 
                          display: flex; 
                          align-items: center; 
                          justify-content: center; 
                          border: 2px dashed #e5e7eb; 
                          border-radius: 0.5rem;
                          background-color: #f9fafb;
                        }
                      </style>
                    </head>
                    <body>
                      <div style="margin-bottom: 2rem;">
                        <h1 style="font-size: 2rem; font-weight: bold; margin-bottom: 0.5rem;">Dashboard</h1>
                        <p style="color: #64748b;">Period: ${formatDateRange()} (${getComparisonDescription()})</p>
                      </div>
                      ${clonedContent.innerHTML}
                    </body>
                  </html>
                `);
                
                printWindow.document.close();
                
                // Wait for content to load, then print
                setTimeout(() => {
                  printWindow.focus();
                  printWindow.print();
                  printWindow.close();
                }, 500);
              }}
            >
              <FileText className="h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Top analytics row: Sales funnel (left) + key stats (right) */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
          {/* Funnel on the left */}
          <SalesFunnel
            startDate={dateRange.from}
            endDate={dateRange.to}
            disableControls
          />

          {/* Remaining KPI cards on the right */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-fit">
            {/* Late Orders */}
            <StatsCard 
              title="Late Orders" 
              value={statsLoading ? "..." : stats?.lateOrders.count.toString() || "0"} 
              description="Past due date" 
              trend={(stats?.lateOrders.count ?? 0) > 0 ? "Action needed" : "On track"} 
              trendDirection={(stats?.lateOrders.count ?? 0) > 0 ? "down" : "up"} 
              href="/orders?filter=late"
            />

            {/* Total Revenue */}
            <StatsCard 
              title="Total Revenue" 
              value={statsLoading ? "..." : formatCurrency(stats?.revenue.current || 0)} 
              description={getComparisonDescription()} 
              trend={statsLoading ? "..." : formatTrend(stats?.revenue.trend || 0)} 
              trendDirection={(stats?.revenue.trend ?? 0) >= 0 ? "up" : "down"} 
              href="/invoices"
            />

            {/* Order Fulfillment Rate */}
          <StatsCard 
            title="Order Fulfillment Rate" 
            value={statsLoading ? "..." : `${(stats?.orderFulfillmentRate.percentage || 0).toFixed(1)}%`} 
            description={`${stats?.orderFulfillmentRate.onTime || 0} of ${stats?.orderFulfillmentRate.total || 0} on time`} 
            trend={(stats?.orderFulfillmentRate.percentage ?? 0) >= 95 ? "Excellent" : (stats?.orderFulfillmentRate.percentage ?? 0) >= 80 ? "Good" : "Needs Improvement"} 
            trendDirection={(stats?.orderFulfillmentRate.percentage ?? 0) >= 95 ? "up" : "down"} 
            href="/orders"
          />

            {/* Inventory Turnover */}
          <StatsCard 
            title="Inventory Turnover" 
            value={statsLoading ? "..." : `${Math.abs(stats?.inventoryTurnover.percentage || 0).toFixed(1)}%`} 
            description="Inventory value change" 
            trend={`${(stats?.inventoryTurnover.percentage ?? 0) > 0 ? "↓" : "↑"} Stock movement`} 
            trendDirection={(stats?.inventoryTurnover.percentage ?? 0) > 0 ? "up" : "down"} 
            href="/inventory"
          />

            {/* Customer Growth */}
          <StatsCard 
            title="Customer Growth" 
            value={statsLoading ? "..." : `+${stats?.customerGrowth.current || 0}`} 
              description={`New customers ${getComparisonDescription()}`} 
            trend={statsLoading ? "..." : formatTrend(stats?.customerGrowth.trend || 0)} 
            trendDirection={(stats?.customerGrowth.trend ?? 0) >= 0 ? "up" : "down"} 
            href="/customers"
          />
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{chartType === "customers" ? "Top Customers" : "Revenue Trend"}</CardTitle>
              <CardDescription>
                {chartType === "customers" 
                  ? "Revenue and margin by customer (from paid invoices)" 
                  : chartType === "monthly" 
                    ? "Monthly revenue comparison" 
                    : "Weekly revenue comparison"
                }
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {/* Chart View Toggle */}
              <ToggleGroup type="single" value={chartType === "customers" ? "customers" : "revenue"} onValueChange={(value) => {
                if (value === "customers") {
                  setChartType("customers");
                } else if (value === "revenue") {
                  // Default back to monthly when switching from customers
                  setChartType("monthly");
                }
              }}>
                <ToggleGroupItem value="revenue" aria-label="Revenue Chart">
                  Revenue Chart
                </ToggleGroupItem>
                <ToggleGroupItem value="customers" aria-label="Top Customers">
                  Top Customers
                </ToggleGroupItem>
              </ToggleGroup>
              
              {/* Revenue Chart Period Controls - only show when not on customers view */}
              {chartType !== "customers" && (
            <Tabs value={chartType} onValueChange={(value) => setChartType(value as "weekly" | "monthly")} className="space-y-4">
              <TabsList>
                <TabsTrigger value="weekly">Weekly</TabsTrigger>
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
              </TabsList>
            </Tabs>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <DeferredLoader label={chartType === "customers" ? "Load Top Customers" : "Load Revenue Chart"}>
              <RevenueChart 
                type={chartType} 
                periods={chartType === "monthly" ? 6 : 8} 
                startDate={dateRange.from}
                endDate={dateRange.to}
              />
            </DeferredLoader>
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
              <DeferredLoader label="Load Alerts">
                <ReplenishmentAlertsTable />
              </DeferredLoader>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}