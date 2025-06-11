"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type inferRouterOutputs } from '@trpc/server';
import { type AppRouter } from "@/lib/api/root";
import { OrderStatus, OrderType, type Address } from "@prisma/client";
import { api } from "@/lib/trpc/react";
import { toast } from "sonner";
import { QRCodeSVG } from 'qrcode.react';
import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import ClientOnly from "@/components/ClientOnly";
import { FileText, Loader, Factory } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
    case OrderStatus.quote_sent:
    case OrderStatus.quote_accepted:
      return "secondary";
    case OrderStatus.confirmed:
    case OrderStatus.in_production:
      return "default";
    case OrderStatus.shipped:
    case OrderStatus.delivered:
    case OrderStatus.INVOICED:
      return "outline";
    case OrderStatus.cancelled:
    case OrderStatus.quote_rejected:
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

export default function OrderDetail({ order }: OrderDetailProps) {
  const router = useRouter();
  const utils = api.useUtils();
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
    onSuccess: (workOrder) => {
      toast.success(`Order converted to Work Order successfully!`);
      window.location.reload();
    },
    onError: (err) => {
      toast.error(`Failed to convert to Work Order: ${err.message}`);
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

  // Format functions
  const formatDateInternal = (date: Date | string) => {
    return new Date(date).toLocaleDateString('fi-FI', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const formatCurrencyInternal = (amount: number | string | null | undefined) => {
    return new Intl.NumberFormat('fi-FI', {
      style: 'currency', currency: 'EUR',
    }).format(Number(amount ?? 0));
  };

  const canUpdateStatus = () => {
    const validTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
      [OrderStatus.draft]: [OrderStatus.confirmed, OrderStatus.cancelled, OrderStatus.quote_sent],
      [OrderStatus.quote_sent]: [OrderStatus.quote_accepted, OrderStatus.quote_rejected, OrderStatus.cancelled],
      [OrderStatus.quote_accepted]: [OrderStatus.confirmed, OrderStatus.cancelled],
      [OrderStatus.confirmed]: [OrderStatus.in_production, OrderStatus.cancelled, OrderStatus.shipped],
      [OrderStatus.in_production]: [OrderStatus.shipped, OrderStatus.cancelled],
      [OrderStatus.shipped]: [OrderStatus.delivered, OrderStatus.INVOICED, OrderStatus.cancelled],
      [OrderStatus.delivered]: [OrderStatus.INVOICED, OrderStatus.cancelled],
    };
    return (validTransitions[order.status] ?? []).length > 0;
  };

  return (
    <div className="bg-card text-card-foreground rounded-md shadow overflow-hidden">
      {/* Order Header */}
      <div className="px-6 py-4 border-b border-border dark:border-border">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <h2 className="text-xl font-semibold">Order {order.orderNumber}</h2>
          <div className="flex items-center space-x-2">
            <Badge variant="outline">
              {getOrderTypeDisplay(order.orderType)}
            </Badge>
            <Badge variant={getStatusBadgeVariant(order.status)}>
              {order.status.replace('_', ' ').toUpperCase()}
            </Badge>
            {order.status !== OrderStatus.cancelled &&
            order.status !== OrderStatus.INVOICED && (
              <Button 
                onClick={handleCreateInvoice}
                disabled={createInvoiceMutation.isPending}
                className="mt-4 md:mt-0"
              >
                {createInvoiceMutation.isPending ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Creating Invoice...
                  </>
                ) : (
                  <><FileText className="mr-2 h-4 w-4" /> Create Invoice</>
                )}
              </Button>
            )}
            {/* Send to Work Order button for quotations */}
            {order.orderType === OrderType.quotation && 
             (order.status === OrderStatus.quote_accepted || order.status === OrderStatus.draft) && (
              <Button 
                onClick={handleSendToWorkOrder}
                disabled={sendToWorkOrderMutation.isPending}
                variant="secondary"
              >
                {sendToWorkOrderMutation.isPending ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Converting...
                  </>
                ) : (
                  <><Factory className="mr-2 h-4 w-4" /> Send to Work Order</>
                )}
              </Button>
            )}
            {order.status === OrderStatus.draft && (
              <Button asChild size="sm">
                 <Link href={`/orders/${order.id}/edit`}>Edit Order</Link>
              </Button>
            )}
            {canUpdateStatus() && (
                <Button size="sm" onClick={() => setIsStatusUpdateModalOpen(true)}>
                    Update Status
                </Button>
            )}
          </div>
        </div>
      </div>

      {/* Order Details */}
      <CardContent className="px-6 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Customer Information */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Customer Information</h3>
            <div className="space-y-1">
              <p><strong>Customer:</strong> {order.customer?.name}</p>
              <p><strong>Order Date:</strong> {formatDateInternal(order.createdAt)}</p>
              {order.deliveryDate && <p><strong>Delivery Date:</strong> {formatDateInternal(order.deliveryDate)}</p>}
            </div>
          </div>

          {/* Order Summary */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Order Summary</h3>
            <div className="space-y-1">
              <p><strong>Total Amount:</strong> {formatCurrencyInternal(order.totalAmount)}</p>
              <p><strong>Notes:</strong> {order.notes || 'No notes'}</p>
            </div>
          </div>
        </div>

        {/* Order Items */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4">Order Items</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.inventoryItem.name}</TableCell>
                  <TableCell>{item.inventoryItem.sku}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">{formatCurrencyInternal(item.unitPrice)}</TableCell>
                  <TableCell className="text-right">{formatCurrencyInternal(Number(item.quantity) * Number(item.unitPrice))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* QR Code (if exists) */}
        {order.qrIdentifier && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2">QR Code</h3>
            <ClientOnly>
              <QRCodeSVG value={order.qrIdentifier} size={128} />
            </ClientOnly>
          </div>
        )}
      </CardContent>

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