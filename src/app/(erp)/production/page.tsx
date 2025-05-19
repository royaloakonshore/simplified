'use client';

import React, { Suspense, useState, useEffect } from 'react';
import { api } from "@/lib/trpc/react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, rectIntersection } from '@dnd-kit/core';
import { KanbanBoard, KanbanCard, KanbanCards, KanbanHeader, KanbanProvider } from '@/components/ui/kanban';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderStatus, OrderType } from '@prisma/client';
import type { Customer, InventoryItem, BillOfMaterial, BillOfMaterialItem, User, Prisma as PrismaTypes } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { DataTableToolbar } from "@/components/ui/data-table/data-table-toolbar";
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
import { toast } from 'react-toastify';

// Define the structure of an order for the Kanban board more specifically
interface KanbanOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  orderType?: OrderType | string;
  notes?: string | null;
  productionStep?: string | null;
  // deliveryDate is intentionally made optional here as it's temporarily excluded from backend payload
  deliveryDate?: Date | null; 
  // totalAmount is intentionally made optional here as it's excluded from backend payload for production view
  totalAmount?: PrismaTypes.Decimal | null;

  customer: Pick<Customer, 'id' | 'name'> | null;
  items: (
    {
      inventoryItem: Pick<InventoryItem, 'id' | 'name' | 'sku' | 'materialType'> & {
        billOfMaterial: (BillOfMaterial & {
          items: (BillOfMaterialItem & {
            rawMaterialItem: Pick<InventoryItem, 'id' | 'name' | 'sku'>;
          })[]
        }) | null;
      };
      quantity: PrismaTypes.Decimal;
    }
  )[];
  user: Pick<User, 'id' | 'name' | 'firstName'> | null;
  totalQuantity: PrismaTypes.Decimal; // This is calculated and added in the backend
}

type KanbanColumn = {
  id: OrderStatus;
  name: string;
  color: string;
};

const KANBAN_COLUMNS: KanbanColumn[] = [
  { id: OrderStatus.confirmed, name: 'Confirmed', color: '#fbbf24' }, // amber-400
  { id: OrderStatus.in_production, name: 'In Production', color: '#3b82f6' }, // blue-500
  { id: OrderStatus.shipped, name: 'Ready for Shipping/Shipped', color: '#22c55e' }, // green-500 
];

function ProductionPageContent() {
  const [activeView, setActiveView] = useState<string>("kanban");
  const [orders, setOrders] = useState<KanbanOrder[]>([]);
  const [activeOrder, setActiveOrder] = useState<KanbanOrder | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const productionOrdersQuery = api.order.listProductionView.useQuery(
    {},
    {
      refetchOnWindowFocus: true,
    }
  );

  useEffect(() => {
    if (productionOrdersQuery.data) {
      setOrders(productionOrdersQuery.data as KanbanOrder[]);
    }
    if (productionOrdersQuery.error) {
      toast.error("Failed to fetch production orders: " + productionOrdersQuery.error.message);
      setOrders([]);
    }
  }, [productionOrdersQuery.data, productionOrdersQuery.error]);

  const updateOrderStatusMutation = api.order.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Order status updated!");
      productionOrdersQuery.refetch(); 
    },
    onError: (error) => {
      toast.error("Failed to update order status: " + error.message);
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

    if (over && active.id !== over.id) {
      const orderId = active.id as string;
      const newStatus = over.id as OrderStatus;
      const originalOrder = orders.find(o => o.id === orderId);

      if (originalOrder && originalOrder.status !== newStatus) {
        updateOrderStatusMutation.mutate({ id: orderId, status: newStatus });
      }
    }
  };

  const renderKanbanCardContent = (order: KanbanOrder) => (
    <div className="space-y-1 text-sm">
      <p className="font-semibold text-base truncate">{order.orderNumber}</p>
      <p className="text-muted-foreground truncate">{order.customer?.name || 'N/A'}</p>
      <p className="text-muted-foreground">Qty: {order.totalQuantity.toString()}</p>
      {order.deliveryDate && <p className="text-muted-foreground">Due: {new Date(order.deliveryDate).toLocaleDateString()}</p>}
      <div className="mt-1 flex flex-wrap gap-1">
        {order.items.map(item => (
          item.inventoryItem.billOfMaterial ? (
            <Badge key={`${order.id}-${item.inventoryItem.id}-bom`} variant="secondary" className="text-xs">
              BOM: {item.inventoryItem.billOfMaterial.name || item.inventoryItem.name}
            </Badge>
          ) : item.inventoryItem.materialType === 'manufactured' ? (
            <Badge key={`${order.id}-${item.inventoryItem.id}-mfd`} variant="outline" className="text-xs">
              Mfd: {item.inventoryItem.name}
            </Badge>
          ) : null
        ))}
      </div>
    </div>
  );

  const columns = React.useMemo<ColumnDef<KanbanOrder>[]>(() => [
    { accessorKey: "orderNumber", header: ({ column }) => <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>Order #</Button> },
    { accessorKey: "customer.name", header: "Customer", cell: ({ row }) => row.original.customer?.name || 'N/A' },
    { accessorKey: "status", header: "Status" },
    { accessorKey: "totalQuantity", header: "Total Qty", cell: ({row}) => row.original.totalQuantity.toString() },
    { 
      accessorKey: "deliveryDate", 
      header: "Delivery Date", 
      cell: ({ row }) => {
        const deliveryDate = row.original.deliveryDate;
        return deliveryDate ? new Date(deliveryDate).toLocaleDateString() : 'N/A';
      } 
    },
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
    return <div>Loading production orders...</div>; 
  }

  return (
    <Tabs value={activeView} onValueChange={setActiveView} className="h-full flex flex-col">
      <TabsList className="mb-4 w-full sm:w-auto self-start">
        <TabsTrigger value="kanban">Kanban View</TabsTrigger>
        <TabsTrigger value="table">Table View</TabsTrigger>
      </TabsList>
      <TabsContent value="kanban" className="flex-grow overflow-auto">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={rectIntersection}>
          <KanbanProvider className="min-h-[600px]" onDragEnd={handleDragEnd}>
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
          <DragOverlay>
            {activeOrder ? (
              <KanbanCard id={activeOrder.id} name={activeOrder.orderNumber} index={0} parent={activeOrder.status}>
                {renderKanbanCardContent(activeOrder)}
              </KanbanCard>
            ) : null}
          </DragOverlay>
        </DndContext>
      </TabsContent>
      <TabsContent value="table" className="flex-grow">
         <Card>
            <CardHeader>
                <CardTitle>Production Orders</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <DataTableToolbar 
                    table={table}
                    globalFilter={globalFilter}
                    setGlobalFilter={setGlobalFilter}
                />
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                <TableHead key={header.id} style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}>
                                    {header.isPlaceholder
                                    ? null
                                    : flexRender(
                                        header.column.columnDef.header,
                                        header.getContext()
                                        )}
                                </TableHead>
                                ))}
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
                                No production orders found.
                                </TableCell>
                            </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                <DataTablePagination table={table} />
            </CardContent>
         </Card>
      </TabsContent>
    </Tabs>
  );
}

export default function ProductionPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ProductionPageContent />
    </Suspense>
  );
} 