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
import { FileText, Loader, Factory, Download, MoreHorizontal, Send } from 'lucide-react';
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
import { SendConfirmationModal, type SendMethod } from "@/components/common/SendConfirmationModal";

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

const getStatusDisplayText = (status: OrderStatus): string => {
  switch (status) {
    case OrderStatus.draft:
      return "DRAFT";
    case OrderStatus.confirmed:
      return "CONFIRMED";
    case OrderStatus.in_production:
      return "IN PROD.";
    case OrderStatus.shipped:
      return "SHIPPED";
    case OrderStatus.delivered:
      return "READY TO INVOICE";
    case OrderStatus.cancelled:
      return "CANCELLED";
    case OrderStatus.invoiced:
      return "INVOICED";
    default:
      return (status as string).replace('_', ' ').toUpperCase();
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
  const [createdInvoiceNumber, setCreatedInvoiceNumber] = useState<string | null>(null);
  const [isStatusUpdateModalOpen, setIsStatusUpdateModalOpen] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);

  // Mutations
  const createInvoiceMutation = api.invoice.createFromOrder.useMutation({
    onSuccess: (newInvoice) => {
      setCreatedInvoiceId(newInvoice.id);
      setCreatedInvoiceNumber(newInvoice.invoiceNumber);
      setShowGoToInvoiceModal(true);
      toast.success(`Invoice ${newInvoice.invoiceNumber} created successfully!`);
    },
    onError: (error) => {
      toast.error(`Failed to create invoice: ${error.message}`);
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
      if (result.pdfBase64) {
        // Convert base64 to blob and trigger download
        const byteCharacters = atob(result.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = result.filename || `order_${result.orderNumber}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
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

  const handleSendOrder = async (method: SendMethod) => {
    try {
      if (method === "email-pdf") {
        // Check if customer has email
        if (!order.customer.email) {
          toast.error("Customer email is required to send order");
          return;
        }
        // Use the existing send service
        const { sendOrderEmail } = await import("@/lib/services/send.service");
        await sendOrderEmail({
          orderId: order.id,
          method: "email-pdf",
        });
        toast.success("Order sent successfully!");
      } else if (method === "download-pdf") {
        // Use existing PDF export
        handleExportPDF();
      }
    } catch (error) {
      console.error("Send order error:", error);
      toast.error("Failed to send order. Please try again.");
    }
  };

  const canSendOrder = () => {
    // Only allow sending quotations and confirmed orders
    return (order.orderType === OrderType.quotation || order.status === OrderStatus.confirmed) &&
           order.customer.email &&
           order.status !== OrderStatus.cancelled;
  };

  const handleGoToInvoice = () => {
    if (createdInvoiceId) {
      router.push(`/invoices/${createdInvoiceId}`);
    }
    setShowGoToInvoiceModal(false);
  };

  const handleStayOnOrder = () => {
    setShowGoToInvoiceModal(false);
    setCreatedInvoiceId(null);
    setCreatedInvoiceNumber(null);
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
              {getStatusDisplayText(order.status)}
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

            {/* Send Button */}
            {canSendOrder() && (
              <Button 
                onClick={() => setShowSendModal(true)}
                variant="default"
                size="sm"
              >
                <Send className="mr-2 h-4 w-4" />
                Send
              </Button>
            )}

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

      {/* NEW ORDER DETAILS GRID */}
      <div className="px-6 py-6 border-b border-border">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Customer Info */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Customer</h3>
              <div className="text-sm">
                <p className="font-semibold">{order.customer.name}</p>
                <p className="text-muted-foreground">{order.customer.email}</p>
              </div>
            </div>

            {/* Order Specifics */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Details</h3>
              <div className="text-sm grid grid-cols-2 gap-x-4 gap-y-1">
                <span className="text-muted-foreground">Order Date:</span>
                <span>{new Date(order.orderDate).toLocaleDateString('fi-FI')}</span>

                <span className="text-muted-foreground">Delivery Date:</span>
                <span>{order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('fi-FI') : '-'}</span>

                <span className="text-muted-foreground">Our Reference:</span>
                <span>{order.ourReference || '-'}</span>

                <span className="text-muted-foreground">Customer Number:</span>
                <span>{order.customerNumber || '-'}</span>
              </div>
            </div>
        </div>
      </div>
      {/* END NEW ORDER DETAILS GRID */}

      {/* Order Details Grid - Restored half-width design */}
      <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Customer Column */}
        <div className="md:col-span-1">
          <h3 className="text-lg font-medium mb-2">Customer</h3>
          <div className="text-sm space-y-1 text-muted-foreground">
            <p className="font-medium text-primary">
              <Link
                href={`/customers/${order.customer.id}`}
                className="hover:underline">
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
                  let lineItemTotal = quantity.mul(unitPrice).sub(discountAmount);
                  
                  // Apply discount percentage if exists
                  if (orderItem.discountPercentage) {
                    const discountPercent = new Prisma.Decimal(orderItem.discountPercentage);
                    lineItemTotal = lineItemTotal.mul(new Prisma.Decimal(1).sub(discountPercent.div(100)));
                  }

                  return (
                    <tr key={orderItem.id}>
                      <td className="px-4 py-2 text-sm">
                        <Link
                          href={`/inventory/${orderItem.inventoryItem.id}`}
                          className="font-medium text-primary hover:underline">
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
                            {(discountAmount.gt(0) || orderItem.discountPercentage) && (
                              <div className="text-xs text-red-500">
                                {discountAmount.gt(0) && `-${formatCurrency(discountAmount)}`}
                                {discountAmount.gt(0) && orderItem.discountPercentage && <br />}
                                {orderItem.discountPercentage && `-${Number(orderItem.discountPercentage).toFixed(1)}%`}
                              </div>
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
            <div className="w-full max-w-xs space-y-2">
              {(() => {
                // Calculate subtotal (excluding VAT), VAT, and grand total
                let subtotal = new Prisma.Decimal(0);
                let totalVat = new Prisma.Decimal(0);
                
                order.items.forEach((orderItem) => {
                  const quantity = new Prisma.Decimal(orderItem.quantity);
                  const unitPrice = new Prisma.Decimal(orderItem.unitPrice);
                  const discountAmount = orderItem.discountAmount ? new Prisma.Decimal(orderItem.discountAmount) : new Prisma.Decimal(0);
                  const vatRate = new Prisma.Decimal(orderItem.vatRatePercent || 25.5);
                  
                  // Calculate line total before VAT
                  let lineSubtotal = quantity.mul(unitPrice).sub(discountAmount);
                  
                  // Apply discount percentage if exists
                  if (orderItem.discountPercentage) {
                    const discountPercent = new Prisma.Decimal(orderItem.discountPercentage);
                    lineSubtotal = lineSubtotal.mul(new Prisma.Decimal(1).sub(discountPercent.div(100)));
                  }
                  
                  // Calculate VAT for this line
                  const lineVat = lineSubtotal.mul(vatRate.div(100));
                  
                  subtotal = subtotal.add(lineSubtotal);
                  totalVat = totalVat.add(lineVat);
                });
                
                const grandTotal = subtotal.add(totalVat);
                
                return (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Subtotal (excl. VAT)</span>
                      <span className="text-sm">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">VAT</span>
                      <span className="text-sm">{formatCurrency(totalVat)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-lg border-t pt-2">
                      <span>Total (incl. VAT)</span>
                      <span>{formatCurrency(grandTotal)}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
      {/* Send Modal */}
      <SendConfirmationModal
        target="order"
        open={showSendModal}
        onOpenChange={setShowSendModal}
        onConfirm={handleSendOrder}
      />

      {/* Go to Invoice Modal */}
      <Dialog open={showGoToInvoiceModal} onOpenChange={setShowGoToInvoiceModal}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Invoice Created Successfully</DialogTitle>
            <DialogDescription>
              Invoice {createdInvoiceNumber} has been created from order {order.orderNumber}.
              What would you like to do next?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleGoToInvoice}
            >
              Go to Invoice
              <span className="ml-auto text-sm text-muted-foreground">
                View the new invoice
              </span>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleStayOnOrder}
            >
              Stay on Order
              <span className="ml-auto text-sm text-muted-foreground">
                Continue working with this order
              </span>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowGoToInvoiceModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Status Update Modal */}
      <OrderStatusUpdateModal
        orderId={order.id}
        isOpen={isStatusUpdateModalOpen}
        onOpenChange={setIsStatusUpdateModalOpen}
        onStatusUpdated={() => {
          setIsStatusUpdateModalOpen(false);
          window.location.reload();
        }}
      />
    </div>
  );
} 