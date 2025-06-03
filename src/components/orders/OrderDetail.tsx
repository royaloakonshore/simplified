"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type Order, OrderStatus, OrderType, type Customer, type OrderItem, type InventoryItem, type Address, Prisma } from "@prisma/client"; // Import Prisma types
import { api } from "@/lib/trpc/react"; // Import tRPC hook
import type { AppRouter } from "@/lib/api/root";
import type { TRPCClientErrorLike } from "@trpc/client";
import { toast } from "sonner"; // Import sonner toast
import { QRCodeSVG } from 'qrcode.react'; // Import QRCodeSVG
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, FileTextIcon, QrCodeIcon, Loader2 } from 'lucide-react'; // Added QrCodeIcon for potential use
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge"; // Use Shadcn badge
import ClientOnly from "@/components/ClientOnly"; // Import ClientOnly
import OrderStatusUpdateModal from './OrderStatusUpdateModal'; // Import the new modal

// Helper function to get status badge variant
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
      case OrderStatus.INVOICED: // Added INVOICED
        return "outline";
      case OrderStatus.cancelled:
      case OrderStatus.quote_rejected: // Added quote_rejected
        return "destructive";
      default:
        return "secondary";
    }
};

// Define the expected shape of the order prop with includes
// This now reflects that Decimals from the backend are converted to strings
type OrderDetailProps = {
  order: Omit<Order, 'totalAmount' | 'items'> & { // Omit original Decimal fields from base Order
    totalAmount: string | null; // totalAmount is now string
    qrIdentifier?: string | null;
    customer: Customer & {
      addresses?: Address[] | null;
    };
    items: (Omit<OrderItem, 'unitPrice' | 'discountAmount' | 'inventoryItem'> & {
      unitPrice: string; // unitPrice is now string
      discountAmount: string | null; // discountAmount is now string
      inventoryItem: Omit<InventoryItem, 'costPrice' | 'salesPrice' | 'minimumStockLevel' | 'reorderLevel'> & {
        costPrice: string;
        salesPrice: string;
        minimumStockLevel: string;
        reorderLevel: string | null;
        // quantityOnHand is not part of base InventoryItem, so not included here unless explicitly added
      };
    })[];
  };
};

// Helper function to get order type display text
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
  const [showGoToInvoiceModal, setShowGoToInvoiceModal] = useState(false); // New state for the modal
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null); // Store new invoice ID

  // State for the new OrderStatusUpdateModal
  const [isStatusUpdateModalOpen, setIsStatusUpdateModalOpen] = useState(false);

  // --- tRPC Mutation for Creating Invoice from Order ---
  const createInvoiceMutation = api.invoice.createFromOrder.useMutation({
    onSuccess: (newInvoice) => {
      toast.success(`Invoice ${newInvoice.invoiceNumber} created successfully for order ${order.orderNumber}.`); // Sonner toast
      utils.order.getById.invalidate({ id: order.id }); 
      utils.invoice.list.invalidate(); // Invalidate invoice list to show the new one
      setCreatedInvoiceId(newInvoice.id); // Store ID
      setShowGoToInvoiceModal(true); // Show modal instead of navigating directly
    },
    onError: (err) => {
      toast.error(`Failed to create invoice: ${err.message}`); // Sonner toast
    },
  });

  const handleCreateInvoice = () => {
    // For dueDate, we could open a small dialog to ask for it, or use a default.
    // The backend already defaults to invoiceDate + 14 days if not provided.
    // The Zod schema requires dueDate, so we provide a default here.
    const defaultDueDate = new Date();
    defaultDueDate.setDate(defaultDueDate.getDate() + 14); // Default to 14 days from now

    createInvoiceMutation.mutate({ 
      orderId: order.id,
      dueDate: defaultDueDate 
      // invoiceDate, notes, vatReverseCharge can use backend defaults or be added here if needed
    });
  };

  // Format date
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('fi-FI', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  // Format currency
  const formatCurrency = (amount: number | string | Prisma.Decimal) => {
    return new Intl.NumberFormat('fi-FI', {
      style: 'currency', currency: 'EUR',
    }).format(Number(amount));
  };

  // Check if there are any valid transitions to decide if the button should be shown
  // This logic might need to be slightly different if INVOICED is a terminal state from UI perspective
  const canUpdateStatus = () => {
    const validTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
        [OrderStatus.draft]: [OrderStatus.confirmed, OrderStatus.cancelled, OrderStatus.quote_sent],
        [OrderStatus.quote_sent]: [OrderStatus.quote_accepted, OrderStatus.quote_rejected, OrderStatus.cancelled],
        [OrderStatus.quote_accepted]: [OrderStatus.confirmed, OrderStatus.cancelled],
        [OrderStatus.confirmed]: [OrderStatus.in_production, OrderStatus.cancelled, OrderStatus.shipped ],
        [OrderStatus.in_production]: [OrderStatus.shipped, OrderStatus.cancelled],
        [OrderStatus.shipped]: [OrderStatus.delivered, OrderStatus.INVOICED, OrderStatus.cancelled],
        [OrderStatus.delivered]: [OrderStatus.INVOICED, OrderStatus.cancelled],
        // No transitions from INVOICED, CANCELLED via this UI path
    };
    return (validTransitions[order.status] ?? []).length > 0;
  }

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
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Invoice...
                  </>
                ) : (
                  <><FileTextIcon className="mr-2 h-4 w-4" /> Create Invoice</>
                )}
              </Button>
            )}
            {order.status === OrderStatus.draft && (
              <Button asChild size="sm">
                 <Link href={`/orders/${order.id}/edit`}>Edit Order</Link>
              </Button>
            )}
            {/* Show Update Status button if there are available transitions */}
            {canUpdateStatus() && (
                <Button size="sm" onClick={() => setIsStatusUpdateModalOpen(true)}>
                    Update Status
                </Button>
            )}
          </div>
        </div>
        <div className="mt-2 text-sm text-muted-foreground">
          <p>Created on {formatDate(order.createdAt)}</p>
          <p>Last updated on {formatDate(order.updatedAt)}</p>
        </div>
      </div>

      {/* Modal to ask user if they want to navigate to the new invoice */}
      {createdInvoiceId && (
        <ClientOnly>
          <Dialog open={showGoToInvoiceModal} onOpenChange={setShowGoToInvoiceModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invoice Draft Created</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <p>Invoice draft for order {order.orderNumber} has been created. Do you want to go to the draft?</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setShowGoToInvoiceModal(false);
                  setCreatedInvoiceId(null); 
                }}>
                  No
                </Button>
                <Button onClick={() => {
                  setShowGoToInvoiceModal(false);
                  router.push(`/invoices/${createdInvoiceId}`);
                  setCreatedInvoiceId(null); 
                }}>
                  Yes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </ClientOnly>
      )}

      {/* New OrderStatusUpdateModal Integration */}
      <OrderStatusUpdateModal 
        orderId={order.id} // Pass the current order's ID
        isOpen={isStatusUpdateModalOpen}
        onOpenChange={setIsStatusUpdateModalOpen}
        onStatusUpdated={() => {
          // Optional: Callback after status update, e.g. for additional client-side effects
          // router.refresh(); // Could also refresh here if needed, though modal does invalidate
        }}
      />

      {/* Order Details Grid */}
      <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Customer Column */}
        <div className="md:col-span-1">
          <h3 className="text-lg font-medium mb-2">Customer</h3>
          <div className="text-sm space-y-1 text-muted-foreground">
            <p className="font-medium text-primary"><Link href={`/customers/${order.customer.id}`} className="hover:underline">{order.customer.name}</Link></p>
            {order.customer.email && <p>{order.customer.email}</p>}
            {order.customer.phone && <p>{order.customer.phone}</p>}
            {order.customer.vatId && <p>VAT ID: {order.customer.vatId}</p>}
            {order.customer.addresses && order.customer.addresses.length > 0 && (
              <div className="pt-2 mt-2 border-t border-border">
                 <p className="font-medium text-primary">
                  {order.customer.addresses[0].type.charAt(0).toUpperCase() + order.customer.addresses[0].type.slice(1)} Address:
                 </p>
              </div>
            )}
          </div>
        </div>

        {/* Shipping/Billing Column */}
        <div className="md:col-span-1">
          {order.customer.addresses && order.customer.addresses.find(addr => addr.type === "shipping") && (
            <div className="mb-4">
              <h3 className="text-lg font-medium mb-2">Shipping Address</h3>
              <div className="text-sm space-y-1 text-muted-foreground">
                {/* ... shipping address details ... */}
              </div>
            </div>
          )}
          {order.customer.addresses && order.customer.addresses.find(addr => addr.type === "billing") && (
            <div>
              <h3 className="text-lg font-medium mb-2">Billing Address</h3>
              <div className="text-sm space-y-1 text-muted-foreground">
                 {/* ... billing address details ... */}
              </div>
            </div>
          )}
           {!order.customer.addresses?.length && <p className="text-sm text-muted-foreground">No addresses on file.</p>}
        </div>

        {/* Order Summary Column */}
        <div className="md:col-span-1">
          <h3 className="text-lg font-medium mb-2">Summary</h3>
          <div className="text-sm space-y-1 text-muted-foreground">
            <p><strong>Total Amount:</strong> {formatCurrency(order.totalAmount ?? 0)}</p>
            {order.notes && <p className="mt-2"><strong>Notes:</strong> {order.notes}</p>}
            {order.qrIdentifier && (
                <div className="mt-4 pt-4 border-t border-border dark:border-border">
                    <h4 className="text-md font-medium mb-2">QR Code</h4>
                    <ClientOnly fallback={<p>Loading QR Code...</p>}>
                        <QRCodeSVG value={order.qrIdentifier} size={128} />
                    </ClientOnly>
                </div>
            )}
          </div>
        </div>
      </div>

      {/* Order Items Table */}
      <div className="px-6 py-4 border-t border-border dark:border-border">
        <h3 className="text-lg font-medium mb-4">Items</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Item</th>
                <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Qty</th>
                <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Unit Price</th>
                <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background">
              {order.items.map(orderItem => {
                // Ensure values used in Decimal operations are Decimals
                const quantity = new Prisma.Decimal(orderItem.quantity);
                const unitPrice = new Prisma.Decimal(orderItem.unitPrice);
                const discountAmount = orderItem.discountAmount ? new Prisma.Decimal(orderItem.discountAmount) : new Prisma.Decimal(0);
                const discountPercentage = orderItem.discountPercentage ? new Prisma.Decimal(orderItem.discountPercentage) : null;

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
                    <td className="px-4 py-2 text-right text-sm">{formatCurrency(unitPrice)}</td>
                    <td className="px-4 py-2 text-right text-sm">
                      {formatCurrency(lineItemTotal)} 
                      {/* Corrected discount display */}
                      {discountAmount.gt(0) && (
                        <div className="text-xs text-red-500">(-{formatCurrency(discountAmount)})</div>
                      )}
                      {discountPercentage && discountPercentage.gt(0) && (
                        <div className="text-xs text-red-500">(-{discountPercentage.toString()}%)</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/50 border-t">
              <tr>
                <td colSpan={3} className="px-4 py-2 text-right text-sm font-medium uppercase">Total</td>
                <td className="px-4 py-2 text-right text-sm font-medium">{formatCurrency(order.totalAmount ?? 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Totals Section */}
      <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800">
        <div className="flex justify-end">
          <div className="text-right">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Subtotal: {formatCurrency(order.totalAmount ?? 0)}</p>
            {/* TODO: Add VAT and Total if applicable (e.g. if totalAmount is pre-VAT) */}
            <p className="text-lg font-semibold">Total: {formatCurrency(order.totalAmount ?? 0)}</p>
          </div>
        </div>
      </div>
    </div>
  );
} 