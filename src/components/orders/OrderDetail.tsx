"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type inferRouterOutputs } from '@trpc/server';
import { type AppRouter } from "@/lib/api/root";
import { OrderStatus, OrderType, type Address } from "@prisma/client";
import { api } from "@/lib/trpc/react"; // Import tRPC hook
import { toast } from "sonner"; // Import sonner toast
import { QRCodeSVG } from 'qrcode.react'; // Import QRCodeSVG
import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge"; // Use Shadcn badge
import ClientOnly from "@/components/ClientOnly"; // Import ClientOnly
import { FileText, Loader } from 'lucide-react'; // Changed Loader2 to Loader, FileTextIcon to FileText (it was already FileText)
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter, // Added DialogFooter
} from "@/components/ui/dialog";
import OrderStatusUpdateModal from "./OrderStatusUpdateModal"; // Changed to default import

// --- Start: New types inferred from tRPC router ---
type RouterOutput = inferRouterOutputs<AppRouter>;
type OrderDetailData = RouterOutput['order']['getById'];
// --- End: New types inferred from tRPC router ---

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

// The specific OrderDetailProps is now replaced
interface OrderDetailProps {
  order: OrderDetailData;
}

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
  const formatDateInternal = (date: Date | string) => {
    return new Date(date).toLocaleDateString('fi-FI', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  // Format currency
  const formatCurrencyInternal = (amount: number | string | null | undefined) => { // Simplified from Prisma.Decimal as it's string now
    return new Intl.NumberFormat('fi-FI', {
      style: 'currency', currency: 'EUR',
    }).format(Number(amount ?? 0));
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
                className="mt-4 md:mt-0" // Adjusted className from original snippet
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
          <p>Created on {formatDateInternal(order.createdAt)}</p>
          <p>Last updated on {formatDateInternal(order.updatedAt)}</p>
        </div>
      </div>

      {/* Modal to ask user if they want to navigate to the new invoice */}
      {createdInvoiceId && (
        <Dialog open={showGoToInvoiceModal} onOpenChange={setShowGoToInvoiceModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invoice Created</DialogTitle>
              <DialogDescription>
                Invoice has been successfully created. Do you want to navigate to it now?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex justify-end space-x-2 pt-4"> {/* Added className for layout */}
              <Button variant="outline" onClick={() => setShowGoToInvoiceModal(false)}>
                Stay Here
              </Button>
              <Button onClick={() => {
                setShowGoToInvoiceModal(false);
                router.push(`/invoices/${createdInvoiceId}`);
              }}>
                Go to Invoice
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Customer and Shipping/Billing Information */}
      <CardContent className="p-6 grid md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-medium mb-2">Customer Information</h3>
          <p><strong>Name:</strong> {order.customer.name}</p>
          <p><strong>Email:</strong> {order.customer.email || 'N/A'}</p>
          <p><strong>Phone:</strong> {order.customer.phone || 'N/A'}</p>
          {order.customer.addresses?.find((addr: Address) => addr.type === 'billing') && (
            <div className="mt-2">
              <p className="font-semibold">Billing Address:</p>
              <p>{order.customer.addresses.find((addr: Address) => addr.type === 'billing')?.streetAddress}</p>
              <p>{order.customer.addresses.find((addr: Address) => addr.type === 'billing')?.postalCode} {order.customer.addresses.find((addr: Address) => addr.type === 'billing')?.city}</p>
              <p>{order.customer.addresses.find((addr: Address) => addr.type === 'billing')?.countryCode}</p>
            </div>
          )}
          {order.customer.addresses?.find((addr: Address) => addr.type === 'shipping') && (
            <div className="mt-2">
              <p className="font-semibold">Shipping Address:</p>
              <p>{order.customer.addresses.find((addr: Address) => addr.type === 'shipping')?.streetAddress}</p>
              <p>{order.customer.addresses.find((addr: Address) => addr.type === 'shipping')?.postalCode} {order.customer.addresses.find((addr: Address) => addr.type === 'shipping')?.city}</p>
              <p>{order.customer.addresses.find((addr: Address) => addr.type === 'shipping')?.countryCode}</p>
            </div>
          )}
        </div>
        <div>
          <h3 className="text-lg font-medium mb-2">Order Details</h3>
          <p><strong>Order Date:</strong> {formatDateInternal(order.orderDate)}</p>
          {order.deliveryDate && <p><strong>Delivery Date:</strong> {formatDateInternal(order.deliveryDate)}</p>}
          {order.notes && <p><strong>Notes:</strong> {order.notes}</p>}
          {order.qrIdentifier && (
            <div className="mt-4">
                <h4 className="font-medium mb-1">QR Code:</h4>
                <ClientOnly>
                    <QRCodeSVG value={order.qrIdentifier} size={128} />
                </ClientOnly>
            </div>
          )}
        </div>
      </CardContent>

      {/* Order Items Table */}
      <div className="px-6 pb-6">
        <h3 className="text-lg font-medium mb-2">Order Items</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Unit Price</TableHead>
              <TableHead className="text-right">Discount</TableHead>
              <TableHead className="text-right">Line Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.items.map((item) => {
              const lineTotal = (Number(item.quantity) * Number(item.unitPrice)) - Number(item.discountAmount ?? 0);
              return (
                <TableRow key={item.id}>
                  <TableCell>{item.inventoryItem.name}</TableCell>
                  <TableCell>{item.inventoryItem.sku || 'N/A'}</TableCell>
                  <TableCell className="text-right">{Number(item.quantity)}</TableCell>
                  <TableCell className="text-right">{formatCurrencyInternal(item.unitPrice)}</TableCell>
                  <TableCell className="text-right">{formatCurrencyInternal(item.discountAmount ?? 0)}</TableCell>
                  <TableCell className="text-right">{formatCurrencyInternal(lineTotal)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Order Totals */}
      <CardFooter className="px-6 py-4 border-t border-border dark:border-border flex justify-end">
        <div className="text-right">
          <p className="text-lg font-semibold">Total Amount: {formatCurrencyInternal(order.totalAmount ?? '0')}</p>
        </div>
      </CardFooter>

      {/* Status Update Modal */}
      {isStatusUpdateModalOpen && (
        <OrderStatusUpdateModal
          orderId={order.id}
          isOpen={isStatusUpdateModalOpen}
          onOpenChange={setIsStatusUpdateModalOpen}
          onStatusUpdated={() => {
            utils.order.getById.invalidate({ id: order.id });
            setIsStatusUpdateModalOpen(false);
          }}
        />
      )}
    </div>
  );
} 