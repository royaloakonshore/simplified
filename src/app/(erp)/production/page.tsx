'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { api } from "@/lib/trpc/react";
import { DragEndEvent, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { KanbanBoard, KanbanCard, KanbanCards, KanbanHeader, KanbanProvider } from '@/components/ui/kanban';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderStatus, OrderType, ItemType } from '@prisma/client';
import type { Customer, InventoryItem, BillOfMaterial, BillOfMaterialItem, User } from '@prisma/client';
import { Prisma as PrismaTypes } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
    getPaginationRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getFacetedRowModel,
    getFacetedUniqueValues,
    type SortingState,
    type ColumnFiltersState,
    type VisibilityState,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PackageSearch, X, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { Checkbox } from "@/components/ui/checkbox";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type { TRPCClientErrorLike } from "@trpc/client";
import type { AppRouter } from "@/lib/api/root";
import { PageBanner } from '@/components/common/PageBanner';

// Define the structure of an order for the Kanban board more specifically
interface KanbanOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  orderType?: OrderType | string;
  notes?: string | null;
  productionStep?: string | null;
  deliveryDate?: Date | null; 
  totalAmount?: PrismaTypes.Decimal | null;
  customer: Pick<Customer, 'id' | 'name'> | null;
  items: (
    {
      inventoryItem: Pick<InventoryItem, 'id' | 'name' | 'sku' | 'itemType'> & {
        bom: (BillOfMaterial & {
          items: (BillOfMaterialItem & {
            componentItem: Pick<InventoryItem, 'id' | 'name' | 'sku'>;
          })[]
        }) | null;
      };
      quantity: PrismaTypes.Decimal;
    }
  )[];
  user: Pick<User, 'id' | 'name' | 'firstName'> | null;
  totalQuantity: PrismaTypes.Decimal;
}

type KanbanColumn = {
  id: OrderStatus;
  name: string;
  color: string;
};

const KANBAN_COLUMNS: KanbanColumn[] = [
  { id: OrderStatus.confirmed, name: 'Confirmed', color: '#fbbf24' }, // amber-400
  { id: OrderStatus.in_production, name: 'In Prod.', color: '#3b82f6' }, // blue-500
  { id: OrderStatus.shipped, name: 'Ready for Shipping/Shipped', color: '#22c55e' }, // green-500 
];

// Status badge variant mapping (consistent with OrderTable)
const getStatusBadgeVariant = (status: OrderStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case OrderStatus.draft:
      return "secondary";
    case OrderStatus.confirmed:
    case OrderStatus.in_production:
      return "default";
    case OrderStatus.shipped:
    case OrderStatus.delivered:
      return "outline";
    case OrderStatus.cancelled:
      return "destructive";
    default:
      return "secondary";
  }
};

// Helper function to get available status transitions
const getAvailableStatusOptions = (currentStatus: OrderStatus) => {
  switch (currentStatus) {
    case OrderStatus.confirmed:
      return [
        { value: OrderStatus.in_production, label: 'Move to Production' },
        { value: OrderStatus.cancelled, label: 'Cancel Order' },
      ];
    case OrderStatus.in_production:
      return [
        { value: OrderStatus.shipped, label: 'Mark as Shipped' },
        { value: OrderStatus.confirmed, label: 'Move Back to Confirmed' },
        { value: OrderStatus.cancelled, label: 'Cancel Order' },
      ];
    case OrderStatus.shipped:
      return [
        { value: OrderStatus.delivered, label: 'Ready to Invoice' },
        { value: OrderStatus.in_production, label: 'Move Back to Production' },
      ];
    default:
      return [];
  }
};

// Helper to render BOM details
const renderBomDetails = (bom: NonNullable<KanbanOrder['items'][number]['inventoryItem']['bom']>, orderItemQuantity: PrismaTypes.Decimal) => {
  return (
    <ScrollArea className="max-h-[400px]">
      <div className="space-y-2">
        <p className="font-semibold">BOM: {bom.name || 'Unnamed BOM'}</p>
        <p className="text-sm text-muted-foreground">
          Required components for {orderItemQuantity.toString()} unit(s) of the final product:
        </p>
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead>Component SKU</TableHead>
              <TableHead>Component Name</TableHead>
              <TableHead className="text-right">Qty / Unit</TableHead>
              <TableHead className="text-right">Total Required</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bom.items.map(bomItem => (
              <TableRow key={bomItem.id}>
                <TableCell>{bomItem.componentItem.sku}</TableCell>
                <TableCell>{bomItem.componentItem.name}</TableCell>
                <TableCell className="text-right">{bomItem.quantity.toString()}</TableCell>
                <TableCell className="text-right">{(() => {
                  // Convert Prisma Decimals to numbers for safe calculation
                  const componentQty = typeof bomItem.quantity === 'object' && bomItem.quantity !== null && 'toNumber' in bomItem.quantity 
                    ? (bomItem.quantity as any).toNumber() 
                    : Number(bomItem.quantity);
                  const orderQty = typeof orderItemQuantity === 'object' && orderItemQuantity !== null && 'toNumber' in orderItemQuantity 
                    ? (orderItemQuantity as any).toNumber() 
                    : Number(orderItemQuantity);
                  return (componentQty * orderQty).toFixed(2);
                })()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ScrollArea>
  );
};

function ProductionPageContent() {
  const [activeView, setActiveView] = useState<string>("kanban");
  const [orders, setOrders] = useState<KanbanOrder[]>([]);
  const [activeOrder, setActiveOrder] = useState<KanbanOrder | null>(null);
  const [shippedModalOpen, setShippedModalOpen] = useState(false);
  const [pendingShippedOrder, setPendingShippedOrder] = useState<KanbanOrder | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { 
        distance: 12, // Increased from 8 to require more intentional movement
        delay: 100,   // Add small delay to prevent accidental drags
      },
    })
  );

  const productionOrdersQuery = api.order.listProductionView.useQuery(
    {},
    {
      refetchOnWindowFocus: true,
    }
  );

  // Query for archived (removed) orders  
  const archivedOrdersQuery = api.order.list.useQuery({
    orderType: 'work_order',
    status: OrderStatus.delivered, // Orders that were archived/removed from board
  }, {
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (productionOrdersQuery.data) {
      const transformedOrders = productionOrdersQuery.data.map(order => ({
        ...order,
        totalQuantity: order.items.reduce((acc, item) => acc.plus(item.quantity), new PrismaTypes.Decimal(0)),
      }));
      setOrders(transformedOrders as KanbanOrder[]);
    } else if (productionOrdersQuery.error) {
      const error = productionOrdersQuery.error as TRPCClientErrorLike<AppRouter>;
      toast.error("Failed to fetch production orders: " + error.message);
      setOrders([]);
    }
  }, [productionOrdersQuery.data, productionOrdersQuery.error]);

  const updateOrderStatusMutation = api.order.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Order status updated!");
      productionOrdersQuery.refetch();
    },
    onError: (error) => {
      const trpcError = error as TRPCClientErrorLike<AppRouter>;
      toast.error("Failed to update order status: " + trpcError.message);
    },
  });

  const createInvoiceMutation = api.invoice.createFromOrder.useMutation({
    onSuccess: (newInvoice) => {
      toast.success(`Invoice ${newInvoice.invoiceNumber} created successfully!`);
    },
    onError: (error) => {
      toast.error(`Failed to create invoice: ${error.message}`);
    },
  });

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const order = orders.find((o: KanbanOrder) => o.id === active.id);
    if (order) setActiveOrder(order);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveOrder(null);
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const orderId = active.id as string;
    const newStatus = over.id as OrderStatus;
    const order = orders.find((o: KanbanOrder) => o.id === orderId);

    if (!order) return;

    // If moving to shipped, show confirmation modal
    if (newStatus === OrderStatus.shipped) {
      setPendingShippedOrder(order);
      setShippedModalOpen(true);
      return;
    }

    // For other status changes, update directly
    updateOrderStatusMutation.mutate({ id: orderId, status: newStatus });
  };

  const handleShippedAction = (action: 'keep' | 'invoice-archive' | 'archive') => {
    if (!pendingShippedOrder) return;

    const orderId = pendingShippedOrder.id;

    switch (action) {
      case 'keep':
        // Update to shipped but keep in board
        updateOrderStatusMutation.mutate({ id: orderId, status: OrderStatus.shipped });
        break;
      case 'invoice-archive':
        // Create invoice and archive (remove from board)
        createInvoiceMutation.mutate(
          { orderId, dueDate: new Date(new Date().setDate(new Date().getDate() + 14)) },
          {
            onSuccess: () => {
              updateOrderStatusMutation.mutate({ id: orderId, status: OrderStatus.delivered });
            }
          }
        );
        break;
      case 'archive':
        // Just archive (remove from board)
        updateOrderStatusMutation.mutate({ id: orderId, status: OrderStatus.delivered });
        break;
    }

    setShippedModalOpen(false);
    setPendingShippedOrder(null);
  };

  const handleRemoveFromBoard = (order: KanbanOrder) => {
    // Remove from board by setting status to delivered (archived)
    updateOrderStatusMutation.mutate({ id: order.id, status: OrderStatus.delivered });
  };

  const handleSendBackToProduction = (orderId: string) => {
    // Send back to production by setting status to confirmed
    updateOrderStatusMutation.mutate({ 
      id: orderId, 
      status: OrderStatus.confirmed 
    }, {
      onSuccess: () => {
        archivedOrdersQuery.refetch(); // Refresh archived orders
      }
    });
  };

  const renderKanbanCardContent = (order: KanbanOrder) => (
    <div className="space-y-1 text-sm pr-8">
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
            <p className="font-semibold text-base truncate">{order.orderNumber}</p>
            <p className="text-muted-foreground truncate">{order.customer?.name || 'N/A'}</p>
        </div>
        <div className="flex items-center gap-1 ml-2">
          {/* Remove from board button */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 shrink-0 hover:bg-destructive/10 hover:text-destructive"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleRemoveFromBoard(order);
            }}
            title="Remove from board"
          >
            <X className="h-3 w-3" />
          </Button>
          {/* BOM Dialog Trigger for the whole order - if any item has a BOM */}
          {order.items.some(item => item.inventoryItem.itemType === ItemType.MANUFACTURED_GOOD && item.inventoryItem.bom) && (
            <Dialog>
                <DialogTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 shrink-0 hover:bg-primary/10"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    >
                        <PackageSearch className="h-3 w-3" />
                        <span className="sr-only">View BOMs</span>
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[900px] max-h-[80vh]">
                    <DialogHeader>
                        <DialogTitle>Production Details - Order {order.orderNumber}</DialogTitle>
                        <DialogDescription>
                            Customer: {order.customer?.name || 'N/A'} • 
                            {order.deliveryDate ? ` Due: ${new Date(order.deliveryDate).toLocaleDateString()}` : ' Due: Not Set'} • 
                            Status: {order.status.replace('_', ' ').toUpperCase()}
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh] pr-3">
                        <div className="space-y-4">
                        {order.items.map(orderItem => (
                            orderItem.inventoryItem.itemType === ItemType.MANUFACTURED_GOOD && orderItem.inventoryItem.bom ? (
                            <Card key={orderItem.inventoryItem.id}>
                                <CardHeader className="pb-2 pt-4">
                                    <CardTitle className="text-md">
                                        {orderItem.inventoryItem.name} (Qty: {orderItem.quantity.toString()})
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                {renderBomDetails(orderItem.inventoryItem.bom, orderItem.quantity)}
                                </CardContent>
                            </Card>
                            ) : null
                        ))}
                        </div>
                    </ScrollArea>
                    <DialogFooter className="sm:justify-between">
                        <div className="text-sm text-muted-foreground">
                            Total Order Quantity: {order.totalQuantity.toString()} items
                        </div>
                        <div className="flex gap-2">
                            <Link href={`/orders/${order.id}`} className="font-medium text-primary hover:underline">
                              View Full Order
                            </Link>
                            <DialogClose asChild>
                                <Button type="button" variant="default" size="sm">
                                    Close
                                </Button>
                            </DialogClose>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
      <p className="text-muted-foreground">Total Items: {order.totalQuantity.toString()}</p>
      {order.deliveryDate ? (
        <p className="text-orange-600 font-medium">Due: {new Date(order.deliveryDate).toLocaleDateString()}</p>
      ) : (
        <p className="text-muted-foreground">Due: Not Set</p>
      )}
      {/* Minimal item type badges below, detailed BOMs in dialog */}
      <div className="mt-1 flex flex-wrap gap-1">
        {order.items.map(item => (
          item.inventoryItem.itemType === ItemType.MANUFACTURED_GOOD ? (
            <Badge key={`${order.id}-${item.inventoryItem.id}-mfd`} variant={item.inventoryItem.bom ? "default" : "outline"} className="text-xs">
              {item.inventoryItem.name} {item.inventoryItem.bom && "• BOM"}
            </Badge>
          ) : (
            <Badge key={`${order.id}-${item.inventoryItem.id}-raw`} variant="secondary" className="text-xs">
              {item.inventoryItem.name}
            </Badge>
          )
        ))}
      </div>
    </div>
  );

  const columns = React.useMemo<ColumnDef<KanbanOrder>[]>(() => [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    { accessorKey: "orderNumber", header: ({ column }) => <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>Order #</Button> },
    { accessorKey: "customer.name", header: "Customer", cell: ({ row }) => row.original.customer?.name || 'N/A' },
    { 
        accessorKey: "items", 
        header: "Manufactured Items", 
        cell: ({row}) => {
            const mfdItems = row.original.items
                .filter(item => item.inventoryItem.itemType === ItemType.MANUFACTURED_GOOD)
                .map(item => `${item.inventoryItem.name} (x${item.quantity.toString()})${item.inventoryItem.bom ? ' - BOM' : ''}`);
            return mfdItems.length > 0 ? mfdItems.join(", ") : "N/A";
        }
    },
    { 
      accessorKey: "status", 
      header: "Status", 
      cell: ({ row }) => (
        <Badge variant={getStatusBadgeVariant(row.original.status)}>
          {row.original.status.replace('_', ' ').toUpperCase()}
        </Badge>
      )
    },
    { accessorKey: "totalQuantity", header: "Total Qty", cell: ({row}) => row.original.totalQuantity.toString() },
    { 
      accessorKey: "deliveryDate", 
      header: "Delivery Date", 
      cell: ({ row }) => {
        const deliveryDate = row.original.deliveryDate;
        return deliveryDate ? new Date(deliveryDate).toLocaleDateString() : 'N/A';
      } 
    },
    {
        id: 'actions',
        header: () => <div className="text-right">Actions</div>,
        cell: ({ row }) => {
            const order = row.original;
            const availableStatuses = getAvailableStatusOptions(order.status);
            
            return (
              <div className="flex items-center gap-2 justify-end">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                      <PackageSearch className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Production Details - {order.orderNumber}</DialogTitle>
                      <DialogDescription>
                        Customer: {order.customer?.name || 'N/A'} | 
                        Status: {order.status.replace('_', ' ').toUpperCase()} |
                        Delivery: {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : 'N/A'}
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {order.items.map((item) => (
                          <Badge key={`${order.id}-${item.inventoryItem.id}`} variant="outline">
                            {item.inventoryItem.name} (x{item.quantity.toString()})
                          </Badge>
                        ))}
                      </div>
                      
                      {order.items
                        .filter(item => item.inventoryItem.itemType === ItemType.MANUFACTURED_GOOD && item.inventoryItem.bom)
                        .map((item) => (
                          <div key={`bom-${order.id}-${item.inventoryItem.id}`}>
                            {renderBomDetails(item.inventoryItem.bom!, item.quantity)}
                          </div>
                        ))}
                    </div>
                    
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Close</Button>
                      </DialogClose>
                      <Link href={`/orders/${order.id}`}>
                        <Button>View Full Order</Button>
                      </Link>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <span className="sr-only">Open menu</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {availableStatuses.map((status) => (
                      <DropdownMenuItem 
                        key={status.value}
                        onClick={() => updateOrderStatusMutation.mutate({ id: order.id, status: status.value })}
                      >
                        {status.label}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleRemoveFromBoard(order)}>
                      Remove from Board
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
        }
    }
  ], []);

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = React.useState<string>("");
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  const table = useReactTable({
    data: orders,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      columnVisibility,
      rowSelection,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  if (productionOrdersQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div className="h-10 w-32 bg-muted animate-pulse rounded-md"></div>
            <div className="flex space-x-2">
              <div className="h-10 w-24 bg-muted animate-pulse rounded-md"></div>
              <div className="h-10 w-24 bg-muted animate-pulse rounded-md"></div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border rounded-md h-64 bg-muted/5 animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <PageBanner 
        title="Production" 
        description="Manage work orders and production workflows"
      />
      
      <div className="p-4 md:p-6">
        <Tabs value={activeView} onValueChange={setActiveView} className="h-full flex flex-col">
      <TabsList className="mb-4 w-full sm:w-auto self-start">
        <TabsTrigger value="kanban">Kanban View</TabsTrigger>
        <TabsTrigger value="table">Table View</TabsTrigger>
        <TabsTrigger value="archived">Archived Orders ({archivedOrdersQuery.data?.items.length || 0})</TabsTrigger>
      </TabsList>
      <TabsContent value="kanban" className="flex-grow overflow-auto">
        <KanbanProvider 
          className="min-h-[600px]" 
          onDragEnd={handleDragEnd}
          onDragStart={handleDragStart}
          sensors={sensors}
          activeId={activeOrder?.id || null}
          renderActiveCard={() => 
            activeOrder ? (
              <KanbanCard id={activeOrder.id} name={activeOrder.orderNumber} index={0} parent={activeOrder.status}>
                {renderKanbanCardContent(activeOrder)}
              </KanbanCard>
            ) : null
          }
        >
          {KANBAN_COLUMNS.map((column) => (
            <KanbanBoard key={column.id} id={column.id} className="min-w-[280px]">
              <KanbanHeader name={column.name} color={column.color} />
              <KanbanCards>
                {orders
                  .filter((order) => order.status === column.id)
                  .map((order, index) => (
                    <KanbanCard key={order.id} id={order.id} name={order.orderNumber} index={index} parent={column.id}>
                      {renderKanbanCardContent(order)}
                    </KanbanCard>
                  ))}
              </KanbanCards>
            </KanbanBoard>
          ))}
        </KanbanProvider>
      </TabsContent>
      <TabsContent value="table" className="flex-grow">
         {/* Enhanced Toolbar for Table View */}
        <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-2">
              <Input
                  placeholder="Filter orders... (e.g., by order number, customer)"
                  value={globalFilter ?? ''}
                  onChange={(event) => setGlobalFilter(event.target.value)}
                  className="max-w-sm"
              />
            </div>
            {table.getFilteredSelectedRowModel().rows.length > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">
                  {table.getFilteredSelectedRowModel().rows.length} of{" "}
                  {table.getFilteredRowModel().rows.length} row(s) selected
                </span>
                <Select onValueChange={(status) => {
                  const selectedOrders = table.getFilteredSelectedRowModel().rows.map(row => row.original);
                  selectedOrders.forEach(order => {
                    updateOrderStatusMutation.mutate({ id: order.id, status: status as OrderStatus });
                  });
                  table.resetRowSelection();
                }}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Change Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={OrderStatus.confirmed}>Confirmed</SelectItem>
                    <SelectItem value={OrderStatus.in_production}>In Production</SelectItem>
                    <SelectItem value={OrderStatus.shipped}>Shipped</SelectItem>
                    <SelectItem value={OrderStatus.delivered}>Ready to Invoice</SelectItem>
                    <SelectItem value={OrderStatus.cancelled}>Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
        </div>
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                        return (
                        <TableHead key={header.id}>
                            {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                                )}
                        </TableHead>
                        );
                    })}
                    </TableRow>
                ))}
                </TableHeader>
                <TableBody>
                {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                    <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && "selected"}
                    >
                        {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                        ))}
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                        No results.
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
        </div>
        <DataTablePagination table={table} />
      </TabsContent>
      <TabsContent value="archived" className="flex-grow">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Archived Orders</h3>
            <p className="text-sm text-muted-foreground">
              Orders that have been removed from the production board
            </p>
          </div>
          
          {archivedOrdersQuery.isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-md"></div>
              ))}
            </div>
          ) : archivedOrdersQuery.data?.items.length === 0 ? (
            <Card className="p-6">
              <div className="text-center">
                <p className="text-muted-foreground">No archived orders found.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Orders that are removed from the production board will appear here.
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-2">
              {archivedOrdersQuery.data?.items.map((order) => (
                <Card key={order.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4">
                        <div>
                          <Link 
                            href={`/orders/${order.id}`} 
                            className="font-medium text-primary hover:underline"
                          >
                            {order.orderNumber}
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            Customer: {order.customer?.name || 'N/A'}
                          </p>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <p>Status: {order.status.replace('_', ' ').toUpperCase()}</p>
                          <p>
                            Delivery: {order.deliveryDate 
                              ? new Date(order.deliveryDate).toLocaleDateString() 
                              : 'Not Set'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSendBackToProduction(order.id)}
                      className="ml-4"
                    >
                      Send Back to Production
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>
    
    {/* Shipped Confirmation Modal */}
    <Dialog open={shippedModalOpen} onOpenChange={setShippedModalOpen}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Order Shipped</DialogTitle>
          <DialogDescription>
            Order {pendingShippedOrder?.orderNumber} has been marked as shipped.
            What would you like to do next?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => handleShippedAction('keep')}
          >
            Keep Order in Board
            <span className="ml-auto text-sm text-muted-foreground">
              Order stays visible in "Shipped" column
            </span>
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => handleShippedAction('invoice-archive')}
          >
            Create Invoice & Archive
            <span className="ml-auto text-sm text-muted-foreground">
              Generate invoice and remove from board
            </span>
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => handleShippedAction('archive')}
          >
            Archive Order
            <span className="ml-auto text-sm text-muted-foreground">
              Remove from board without invoice
            </span>
          </Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setShippedModalOpen(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
      </div>
    </div>
  );
}

export default function ProductionPage() {
  return (
    // Ensure the parent container allows the Tabs component to fill height
    <div className="w-full h-[calc(100vh-var(--header-height)-theme(spacing.12))]">
      <Suspense fallback={<div>Loading production view...</div>}>
       <ProductionPageContent />
      </Suspense>
    </div>
  );
} 