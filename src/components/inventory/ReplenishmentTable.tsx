"use client";

import { useState } from 'react';
import { api } from '@/lib/trpc/react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Search, 
  Package, 
  Clock, 
  Truck, 
  Edit, 
  AlertTriangle 
} from 'lucide-react';
import { toast } from 'react-toastify';

export function ReplenishmentTable() {
  const [search, setSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'sku' | 'quantityOnHand' | 'reorderLevel' | 'leadTimeDays'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  
  const { data, isLoading, error } = api.replenishment.getRawMaterials.useQuery({
    search: search,
    sortBy,
    sortOrder,
    page,
    limit: 50,
  });

  const utils = api.useUtils();
  const { mutate: bulkUpdate, isPending: isUpdating } = api.replenishment.bulkUpdate.useMutation({
    onSuccess: (result: { message: string }) => {
      toast.success(result.message);
      setSelectedItems([]);
      utils.replenishment.getRawMaterials.invalidate();
      utils.replenishment.getCriticalAlerts.invalidate();
    },
    onError: (error: { message: string }) => {
      toast.error(error.message);
    },
  });

  const items = data?.items ?? [];
  const pagination = data?.pagination;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(items.map((item: { id: string }) => item.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (itemId: string, checked: boolean) => {
    if (checked) {
      setSelectedItems(prev => [...prev, itemId]);
    } else {
      setSelectedItems(prev => prev.filter(id => id !== itemId));
    }
  };

  const handleBulkUpdate = (updates: { leadTimeDays?: number; reorderLevel?: number }) => {
    if (selectedItems.length === 0) {
      toast.error('Please select items to update');
      return;
    }
    
    bulkUpdate({
      itemIds: selectedItems,
      updates,
    });
  };

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-muted/20 animate-pulse rounded-md" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-muted/20 animate-pulse rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Error loading replenishment data: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search materials..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {selectedItems.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedItems.length} selected
            </span>
            <BulkEditActions 
              onUpdate={handleBulkUpdate}
              isLoading={isUpdating}
            />
          </div>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedItems.length === items.length && items.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('name')}>
                  Name {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('sku')}>
                  SKU {sortBy === 'sku' && (sortOrder === 'asc' ? '↑' : '↓')}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('quantityOnHand')}>
                  Current Stock {sortBy === 'quantityOnHand' && (sortOrder === 'asc' ? '↑' : '↓')}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('reorderLevel')}>
                  Reorder Level {sortBy === 'reorderLevel' && (sortOrder === 'asc' ? '↑' : '↓')}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('leadTimeDays')}>
                  Lead Time {sortBy === 'leadTimeDays' && (sortOrder === 'asc' ? '↑' : '↓')}
                </Button>
              </TableHead>
              <TableHead>Vendor Info</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item: any) => (
              <TableRow key={item.id} className={item.isLowStock ? 'bg-red-50' : ''}>
                <TableCell>
                  <Checkbox
                    checked={selectedItems.includes(item.id)}
                    onCheckedChange={(checked) => handleSelectItem(item.id, !!checked)}
                  />
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{item.name}</div>
                    {item.category && (
                      <Badge variant="outline" className="text-xs">
                        {item.category}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-sm">{item.sku}</span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className={item.isLowStock ? 'text-red-600 font-medium' : ''}>
                      {Number(item.quantityOnHand)}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <span>{item.reorderLevel || '-'}</span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{item.leadTimeDays} days</span>
                  </div>
                </TableCell>
                <TableCell>
                  {item.vendorSku || item.vendorItemName ? (
                    <div className="text-sm">
                      {item.vendorSku && (
                        <div className="flex items-center gap-1">
                          <Truck className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono">{item.vendorSku}</span>
                        </div>
                      )}
                      {item.vendorItemName && (
                        <div className="text-muted-foreground">{item.vendorItemName}</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {item.isLowStock && (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Low Stock
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {items.length} of {pagination.total} items
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page >= pagination.totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Bulk Edit Actions Component
function BulkEditActions({ 
  onUpdate, 
  isLoading 
}: { 
  onUpdate: (updates: { leadTimeDays?: number; reorderLevel?: number }) => void;
  isLoading: boolean;
}) {
  const [leadTimeDays, setLeadTimeDays] = useState<string>('');
  const [reorderLevel, setReorderLevel] = useState<string>('');

  const handleUpdate = () => {
    const updates: { leadTimeDays?: number; reorderLevel?: number } = {};
    
    if (leadTimeDays && !isNaN(Number(leadTimeDays))) {
      updates.leadTimeDays = Number(leadTimeDays);
    }
    
    if (reorderLevel && !isNaN(Number(reorderLevel))) {
      updates.reorderLevel = Number(reorderLevel);
    }
    
    if (Object.keys(updates).length === 0) {
      toast.error('Please enter valid values to update');
      return;
    }
    
    onUpdate(updates);
    setLeadTimeDays('');
    setReorderLevel('');
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        placeholder="Lead Days"
        value={leadTimeDays}
        onChange={(e) => setLeadTimeDays(e.target.value)}
        className="w-24"
      />
      <Input
        type="number"
        placeholder="Reorder Level"
        value={reorderLevel}
        onChange={(e) => setReorderLevel(e.target.value)}
        className="w-28"
      />
      <Button
        onClick={handleUpdate}
        disabled={isLoading}
        size="sm"
      >
        <Edit className="h-4 w-4 mr-1" />
        {isLoading ? 'Updating...' : 'Update'}
      </Button>
    </div>
  );
} 