'use client';

import { useState } from 'react';
import { api } from '@/lib/trpc/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Package, Search, Filter, Download, Upload, Edit3, Save, X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { ItemType } from '@prisma/client';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';

interface ReplenishmentItem {
  id: string;
  name: string;
  sku: string | null;
  quantityOnHand: string;
  reorderLevel: string | null;
  leadTimeDays: number | null;
  vendorSku: string | null;
  vendorItemName: string | null;
  costPrice: string;
  unitOfMeasure: string | null;
  inventoryCategory?: {
    name: string;
  } | null;
}

const ReplenishmentAlerts = ({ items }: { items: ReplenishmentItem[] }) => {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, { quantity: string; reorderLevel: string }>>({});
  
  const utils = api.useUtils();
  const updateInventoryMutation = api.inventory.update.useMutation({
    onSuccess: () => {
      toast.success('Inventory item updated successfully');
      utils.inventory.getReplenishmentAlerts.invalidate();
      setEditingItem(null);
    },
    onError: (error: any) => {
      toast.error(`Failed to update item: ${error.message}`);
    }
  });

  const criticalItems = items.filter(item => {
    const reorderLevel = Number(item.reorderLevel || 0);
    return Number(item.quantityOnHand) <= reorderLevel;
  });

  const outOfStockItems = criticalItems.filter(item => Number(item.quantityOnHand) <= 0);
  const lowStockItems = criticalItems.filter(item => Number(item.quantityOnHand) > 0);

  // Bulk action handlers
  const handleSelectAll = () => {
    if (selectedItems.size === criticalItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(criticalItems.map(item => item.id)));
    }
  };

  const handleSelectItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleBulkExport = () => {
    if (selectedItems.size === 0) {
      toast.error('Please select items to export');
      return;
    }
    // TODO: Implement bulk export
    toast.success(`Exporting ${selectedItems.size} items...`);
  };

  const handleBulkReorder = () => {
    if (selectedItems.size === 0) {
      toast.error('Please select items to reorder');
      return;
    }
    // TODO: Implement bulk reorder
    toast.success(`Creating reorder for ${selectedItems.size} items...`);
  };

  // Editing handlers
  const handleStartEdit = (item: ReplenishmentItem) => {
    setEditingItem(item.id);
    setEditValues({
      [item.id]: {
        quantity: item.quantityOnHand,
        reorderLevel: item.reorderLevel || '0'
      }
    });
  };

  const handleSaveEdit = async (itemId: string) => {
    const values = editValues[itemId];
    if (!values) return;

    try {
      await updateInventoryMutation.mutateAsync({
        id: itemId,
        quantityOnHand: parseFloat(values.quantity),
        reorderLevel: parseFloat(values.reorderLevel)
      });
    } catch (error) {
      console.error('Failed to update item:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setEditValues({});
  };

  if (criticalItems.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-600">
            <Package className="h-5 w-5" />
            Stock Status: All Good
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">All raw materials are above their reorder levels.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-red-200 bg-red-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-600">
          <AlertTriangle className="h-5 w-5" />
          Critical Replenishment Alerts ({criticalItems.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Bulk Actions Toolbar */}
        {criticalItems.length > 0 && (
          <div className="mb-4 p-3 bg-white rounded border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={selectedItems.size === criticalItems.length}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm text-muted-foreground">
                  {selectedItems.size} of {criticalItems.length} items selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkExport}
                  disabled={selectedItems.size === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Selected
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkReorder}
                  disabled={selectedItems.size === 0}
                >
                  <Package className="h-4 w-4 mr-2" />
                  Bulk Reorder
                </Button>
              </div>
            </div>
          </div>
        )}
        
        <div className="space-y-4">
          {outOfStockItems.length > 0 && (
            <div>
              <Badge variant="destructive" className="mb-2">
                Out of Stock ({outOfStockItems.length})
              </Badge>
              <div className="grid gap-2">
                {outOfStockItems.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-sm bg-white p-2 rounded border">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedItems.has(item.id)}
                        onCheckedChange={() => handleSelectItem(item.id)}
                      />
                      <div>
                        <span className="font-medium">{item.name}</span>
                        <span className="text-muted-foreground ml-2">({item.sku})</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-red-600 font-semibold">0 {item.unitOfMeasure}</div>
                        {item.leadTimeDays && (
                          <div className="text-xs text-muted-foreground">{item.leadTimeDays}d lead time</div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStartEdit(item)}
                        disabled={editingItem === item.id}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {outOfStockItems.length > 3 && (
                  <div className="text-sm text-muted-foreground">
                    +{outOfStockItems.length - 3} more out of stock items
                  </div>
                )}
              </div>
            </div>
          )}

          {lowStockItems.length > 0 && (
            <div>
              <Badge variant="secondary" className="mb-2 bg-yellow-100 text-yellow-800">
                Low Stock ({lowStockItems.length})
              </Badge>
              <div className="grid gap-2">
                {lowStockItems.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-sm bg-white p-2 rounded border">
                    <div>
                      <span className="font-medium">{item.name}</span>
                      <span className="text-muted-foreground ml-2">({item.sku})</span>
                    </div>
                    <div className="text-right">
                      <div className="text-yellow-600 font-semibold">
                        {item.quantityOnHand} {item.unitOfMeasure}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Reorder at: {item.reorderLevel || 0}
                      </div>
                    </div>
                  </div>
                ))}
                {lowStockItems.length > 3 && (
                  <div className="text-sm text-muted-foreground">
                    +{lowStockItems.length - 3} more low stock items
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
      
      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit Inventory Item</h3>
              <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Quantity on Hand</label>
                <Input
                  type="number"
                  step="0.01"
                  value={editValues[editingItem]?.quantity || ''}
                  onChange={(e) => setEditValues({
                    ...editValues,
                    [editingItem]: {
                      ...editValues[editingItem],
                      quantity: e.target.value
                    }
                  })}
                  placeholder="Enter quantity"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Reorder Level</label>
                <Input
                  type="number"
                  step="0.01"
                  value={editValues[editingItem]?.reorderLevel || ''}
                  onChange={(e) => setEditValues({
                    ...editValues,
                    [editingItem]: {
                      ...editValues[editingItem],
                      reorderLevel: e.target.value
                    }
                  })}
                  placeholder="Enter reorder level"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={handleCancelEdit}>
                Cancel
              </Button>
              <Button 
                onClick={() => handleSaveEdit(editingItem)}
                disabled={updateInventoryMutation.isPending}
              >
                {updateInventoryMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default function ReplenishmentPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: inventoryData, isLoading, error } = api.inventory.list.useQuery({
    itemType: ItemType.RAW_MATERIAL,
    search: searchTerm,
  });

  const filteredItems = inventoryData?.items?.map(item => ({
    ...item,
    quantityOnHand: item.quantityOnHand.toString(),
    reorderLevel: item.reorderLevel?.toString() || null,
    costPrice: item.costPrice.toString(),
  })) || [];

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <Skeleton className="h-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Error Loading Replenishment Data</h1>
          <p className="text-muted-foreground">
            There was an error loading the replenishment information. Please try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Raw Material Replenishment</h1>
          <p className="text-muted-foreground">
            Manage raw material procurement and monitor stock levels
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Import Excel
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Critical Alerts */}
      <ReplenishmentAlerts items={filteredItems} />

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Raw Materials ({filteredItems.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search materials..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </Button>
          </div>

          {/* Main Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Reorder Level</TableHead>
                  <TableHead className="text-right">Lead Time</TableHead>
                  <TableHead>Vendor SKU</TableHead>
                  <TableHead className="text-right">Cost Price</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      {searchTerm ? 'No materials found matching your search.' : 'No raw materials found.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => {
                    const isOutOfStock = Number(item.quantityOnHand) <= 0;
                    const isLowStock = !isOutOfStock && item.reorderLevel && Number(item.quantityOnHand) <= Number(item.reorderLevel);
                    const stockStatus = isOutOfStock ? 'out' : isLowStock ? 'low' : 'good';

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{item.name}</div>
                            {item.vendorItemName && (
                              <div className="text-sm text-muted-foreground">{item.vendorItemName}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                        <TableCell>
                          {item.inventoryCategory ? (
                            <Badge variant="outline">{item.inventoryCategory.name}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className={`font-semibold ${isOutOfStock ? 'text-red-600' : isLowStock ? 'text-yellow-600' : ''}`}>
                            {Number(item.quantityOnHand)} {item.unitOfMeasure}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {item.reorderLevel ? `${Number(item.reorderLevel)} ${item.unitOfMeasure}` : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.leadTimeDays ? `${item.leadTimeDays} days` : '-'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {item.vendorSku || '-'}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(Number(item.costPrice))}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            variant={stockStatus === 'out' ? 'destructive' : stockStatus === 'low' ? 'secondary' : 'default'}
                            className={stockStatus === 'low' ? 'bg-yellow-100 text-yellow-800' : ''}
                          >
                            {stockStatus === 'out' ? 'Out of Stock' : stockStatus === 'low' ? 'Low Stock' : 'In Stock'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 