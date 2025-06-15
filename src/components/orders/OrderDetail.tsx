"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type inferRouterOutputs } from '@trpc/server';
import { type AppRouter } from "@/lib/api/root";
import { OrderStatus, OrderType, Prisma } from "@prisma/client";
import { api } from "@/lib/trpc/react";
import { toast } from "sonner";
import { QRCodeSVG } from 'qrcode.react';
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ClientOnly from "@/components/ClientOnly";
import { FileText, Loader, Factory, Download, MoreHorizontal } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import OrderStatusUpdateModal from "./OrderStatusUpdateModal";

// Types
type RouterOutput = inferRouterOutputs<AppRouter>;
type OrderDetailData = RouterOutput['order']['getById'];

interface OrderDetailProps {
  order: OrderDetailData;
}

// Helper functions
const getStatusBadgeVariant = (status: OrderStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case OrderStatus.draft:
      return "secondary";
    case OrderStatus.confirmed:
    case OrderStatus.in_production:
      return "default";
    case OrderStatus.shipped:
    case OrderStatus.delivered:
    case OrderStatus.invoiced:
      return "outline";
    case OrderStatus.cancelled:
      return "destructive";
    default:
      return "secondary";
  }
};

const getOrderTypeDisplay = (orderType: OrderType): string => {
  switch (orderType) {
    case OrderType.work_order:
      return "Work Order";
    case OrderType.quotation:
      return "Quotation";
    default:
      return orderType;
  }
};

// Format currency function
const formatCurrency = (amount: number | string | Prisma.Decimal | null | undefined) => {
  return new Intl.NumberFormat('fi-FI', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(amount ?? 0));
};

export default function OrderDetail({ order }: OrderDetailProps) {
  const router = useRouter();
  const [showGoToInvoiceModal, setShowGoToInvoiceModal] = useState(false);
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);
  const [isStatusUpdateModalOpen, setIsStatusUpdateModalOpen] = useState(false);

  // Mutations
  const createInvoiceMutation = api.invoice.createFromOrder.useMutation({
    onSuccess: (invoice) => {
      toast.success(`Invoice ${invoice.invoiceNumber} created successfully!`);
      router.push(`/invoices/${invoice.id}`);
    },
    onError: (err) => {
      toast.error(`Failed to create invoice: ${err.message}`);
    },
  });

  const sendToWorkOrderMutation = api.order.convertToWorkOrder.useMutation({
    onSuccess: (newWorkOrder) => {
      toast.success(`Work Order ${newWorkOrder.orderNumber} created successfully!`);
      router.push(`/orders/${newWorkOrder.id}`);
    },
    onError: (err) => {
      toast.error(`Failed to create Work Order: ${err.message}`);
    },
  });

  // Handlers
  const handleCreateInvoice = () => {
    if (!order.id) {
      toast.error('Order ID is missing');
      return;
    }
    createInvoiceMutation.mutate({
      orderId: order.id,
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });
  };

  const handleSendToWorkOrder = () => {
    if (!order.id) {
      toast.error('Order ID is missing');
      return;
    }
    sendToWorkOrderMutation.mutate({
      orderId: order.id,
    });
  };

  const exportPDFMutation = api.order.exportPDF.useMutation({
    onSuccess: (result) => {
      toast.success(result.message);
    },
    onError: (err) => {
      toast.error(`Failed to export PDF: ${err.message}`);
    },
  });

  const handleExportPDF = () => {
    if (!order.id) {
      toast.error('Order ID is missing');
      return;
    }
    exportPDFMutation.mutate({ id: order.id });
  };

  const canUpdateStatus = () => {
    const validTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
      [OrderStatus.draft]: [OrderStatus.confirmed, OrderStatus.cancelled],
      [OrderStatus.confirmed]: [OrderStatus.in_production, OrderStatus.cancelled, OrderStatus.shipped],
      [OrderStatus.in_production]: [OrderStatus.shipped, OrderStatus.cancelled],
      [OrderStatus.shipped]: [OrderStatus.delivered, OrderStatus.invoiced, OrderStatus.cancelled],
      [OrderStatus.delivered]: [OrderStatus.invoiced, OrderStatus.cancelled],
    };
    return (validTransitions[order.status] ?? []).length > 0;
  };

  return (
    <div className="bg-card text-card-foreground rounded-md shadow overflow-hidden">
      {/* Order Header */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <h2 className="text-xl font-semibold">Order {order.orderNumber}</h2>
          <div className="flex items-center space-x-2">
            <Badge variant="outline">
              {getOrderTypeDisplay(order.orderType)}
            </Badge>
            <Badge variant={getStatusBadgeVariant(order.status)}>
              {order.status.replace('_', ' ').toUpperCase()}
            </Badge>
            
            {/* Actions Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">More actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportPDF}>
                  <Download className="mr-2 h-4 w-4" />
                  Export PDF
                </DropdownMenuItem>
                {canUpdateStatus() && (
                  <DropdownMenuItem onClick={() => setIsStatusUpdateModalOpen(true)}>
                    Update Status
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {order.status === OrderStatus.draft && (
                  <DropdownMenuItem onClick={() => router.push(`/orders/${order.id}/edit`)}>
                    Edit Order
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Primary Action Buttons */}
            {order.status !== OrderStatus.cancelled &&
            order.status !== OrderStatus.invoiced && (
              <Button 
                onClick={handleCreateInvoice}
                disabled={createInvoiceMutation.isPending}
                size="sm"
              >
                {createInvoiceMutation.isPending ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <><FileText className="mr-2 h-4 w-4" /> Create Invoice</>
                )}
              </Button>
            )}
            
            {/* Create Work Order button for quotations */}
            {order.orderType === OrderType.quotation && 
             (order.status === OrderStatus.confirmed || order.status === OrderStatus.draft) && (
              <Button 
                onClick={handleSendToWorkOrder}
                disabled={sendToWorkOrderMutation.isPending}
                variant="secondary"
                size="sm"
              >
                {sendToWorkOrderMutation.isPending ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Converting...
                  </>
                ) : (
                  <><Factory className="mr-2 h-4 w-4" /> Create Work Order</>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Order Details Grid - Restored half-width design */}
      <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Customer Column */}
        <div className="md:col-span-1">
          <h3 className="text-lg font-medium mb-2">Customer</h3>
          <div className="text-sm space-y-1 text-muted-foreground">
            <p className="font-medium text-primary">
              <Link href={`/customers/${order.customer.id}`} className="hover:underline">
                {order.customer?.name}
              </Link>
            </p>
            {order.customer?.email && <p>{order.customer.email}</p>}
            {order.customer?.phone && <p>{order.customer.phone}</p>}
            {order.customer?.vatId && <p>VAT ID: {order.customer.vatId}</p>}
            
            <div className="pt-2 mt-2 border-t">
              <p className="font-medium text-primary">Order Details:</p>
              <p>Order Date: {new Date(order.createdAt).toLocaleDateString('fi-FI')}</p>
              {order.deliveryDate && (
                <p>Delivery Date: {new Date(order.deliveryDate).toLocaleDateString('fi-FI')}</p>
              )}
            </div>
          </div>
        </div>

        {/* Items Column */}
        <div className="md:col-span-2">
          <h3 className="text-lg font-medium mb-2">Order Items</h3>
          <div className="border rounded-md overflow-hidden">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                    Item
                  </th>
                  <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">
                    Qty
                  </th>
                  {order.orderType === OrderType.quotation && (
                    <>
                      <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">
                        Unit Price
                      </th>
                      <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">
                        Line Total
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {order.items.map((orderItem) => {
                  const quantity = new Prisma.Decimal(orderItem.quantity);
                  const unitPrice = new Prisma.Decimal(orderItem.unitPrice);
                  const discountAmount = orderItem.discountAmount ? new Prisma.Decimal(orderItem.discountAmount) : new Prisma.Decimal(0);
                  const lineItemTotal = quantity.mul(unitPrice).sub(discountAmount);

                  return (
                    <tr key={orderItem.id}>
                      <td className="px-4 py-2 text-sm">
                        <Link href={`/inventory/${orderItem.inventoryItem.id}`} className="font-medium text-primary hover:underline">
                          {orderItem.inventoryItem.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">SKU: {orderItem.inventoryItem.sku}</div>
                      </td>
                      <td className="px-4 py-2 text-right text-sm">{quantity.toString()}</td>
                      {order.orderType === OrderType.quotation && (
                        <>
                          <td className="px-4 py-2 text-right text-sm">{formatCurrency(unitPrice)}</td>
                          <td className="px-4 py-2 text-right text-sm">
                            {formatCurrency(lineItemTotal)}
                            {discountAmount.gt(0) && (
                              <div className="text-xs text-red-500">(-{formatCurrency(discountAmount)})</div>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              {order.orderType === OrderType.quotation && (
                <tfoot className="bg-muted/50 border-t">
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-right text-sm font-medium uppercase">Total</td>
                    <td className="px-4 py-2 text-right text-sm font-medium">{formatCurrency(order.totalAmount ?? 0)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          
          {order.notes && (
            <div className="mt-4">
              <h4 className="font-medium mb-1">Notes:</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{order.notes}</p>
            </div>
          )}
        </div>

        {/* QR Code Section */}
        {order.qrIdentifier && (
          <div className="md:col-span-3 mt-6 pt-6 border-t">
            <h3 className="text-lg font-medium mb-2">Order QR Code</h3>
            <div className="flex flex-col items-center md:items-start">
              <ClientOnly>
                <QRCodeSVG value={order.qrIdentifier} size={128} bgColor={"#ffffff"} fgColor={"#000000"} level={"Q"} />
              </ClientOnly>
              <p className="text-sm text-muted-foreground mt-2">Scan to view/update order details.</p>
            </div>
          </div>
        )}
      </div>

      {/* Totals Section - Only for quotations */}
      {order.orderType === OrderType.quotation && (
        <div className="px-6 py-4 border-t border-border">
          <div className="flex justify-end">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Subtotal: {formatCurrency(order.totalAmount ?? 0)}</p>
              <p className="text-lg font-semibold">Total: {formatCurrency(order.totalAmount ?? 0)}</p>
            </div>
          </div>
        </div>
      )}

      {/* OrderStatusUpdateModal */}
      <OrderStatusUpdateModal
        orderId={order.id}
        isOpen={isStatusUpdateModalOpen}
        onOpenChange={setIsStatusUpdateModalOpen}
        onStatusUpdated={() => {
          setIsStatusUpdateModalOpen(false);
          window.location.reload();
        }}
      />

      {/* Modal for navigating to created invoice */}
      <Dialog open={showGoToInvoiceModal} onOpenChange={setShowGoToInvoiceModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invoice Created</DialogTitle>
            <DialogDescription>
              The invoice has been created successfully. Would you like to view it now?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGoToInvoiceModal(false)}>
              Stay Here
            </Button>
            <Button onClick={() => createdInvoiceId && router.push(`/invoices/${createdInvoiceId}`)}>
              View Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 