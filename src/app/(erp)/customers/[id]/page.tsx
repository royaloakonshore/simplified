"use client";

import { useParams } from 'next/navigation';
import { api } from '@/lib/trpc/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, TrendingUp, Receipt, Calendar, TrendingDown } from 'lucide-react';
import { OrderHistoryTable } from '@/components/customers/OrderHistoryTable';
import { InvoiceHistoryTable } from '@/components/customers/InvoiceHistoryTable';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/utils';
import { formatMarginPercentage, getMarginStatusColor } from '@/lib/utils/margin-calculation';
import React from 'react';

export default function CustomerDetailPage() {
  const params = useParams();
  const customerId = params.id as string;

  const { data: customer, isLoading: isLoadingCustomer, error: customerError } = api.customer.getById.useQuery(
    { id: customerId },
    { enabled: !!customerId }
  );

  const { data: ordersData, isLoading: isLoadingOrders, error: ordersError } = api.order.list.useQuery(
    { customerId },
    { enabled: !!customerId }
  );
  
  const { data: invoicesData, isLoading: isLoadingInvoices, error: invoicesError } = api.invoice.list.useQuery(
    { customerId },
    { enabled: !!customerId }
  );

  const { data: revenueData, isLoading: isLoadingRevenue, error: revenueError } = api.customer.getRevenue.useQuery(
    { customerId },
    { enabled: !!customerId }
  );

  const { data: marginData, isLoading: isLoadingMargin, error: marginError } = api.customer.getMarginData.useQuery(
    { customerId, months: 12 },
    { enabled: !!customerId }
  );
  
  const isLoading = isLoadingCustomer || isLoadingOrders || isLoadingInvoices || isLoadingRevenue || isLoadingMargin;
  const error = customerError || ordersError || invoicesError || revenueError || marginError;

  if (isLoading) {
    return (
      <div className="w-full space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-6 w-1/4" />
        <Separator />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full">
        <Alert variant="destructive">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error loading customer data</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="w-full">
        <Alert variant="destructive">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Customer Not Found</AlertTitle>
          <AlertDescription>The customer you are looking for could not be found.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{customer.name}</h1>
        <p className="text-muted-foreground">{customer.email}</p>
      </div>
      <Separator />

      {/* Revenue & Margin Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(revenueData?.totalRevenue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Lifetime value from paid invoices
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Invoices</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {revenueData?.paidInvoiceCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Successfully completed transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Activity</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {revenueData?.lastInvoiceDate 
                ? new Date(revenueData.lastInvoiceDate).toLocaleDateString()
                : 'N/A'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              {revenueData?.lastInvoiceStatus 
                ? `Status: ${revenueData.lastInvoiceStatus}`
                : 'No invoices found'
              }
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Margin (12m)</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">
                {formatMarginPercentage(marginData?.marginPercentage || 0)}
              </div>
              <Badge variant={getMarginStatusColor(marginData?.marginPercentage || 0)}>
                {marginData?.marginPercentage && marginData.marginPercentage >= 0 ? 'Positive' : 'Negative'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              From {marginData?.invoiceCount || 0} sent invoices
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Order History</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderHistoryTable orders={ordersData?.items ?? []} />
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Invoice History</CardTitle>
        </CardHeader>
        <CardContent>
          <InvoiceHistoryTable invoices={invoicesData?.data ?? []} />
        </CardContent>
      </Card>

    </div>
  );
} 