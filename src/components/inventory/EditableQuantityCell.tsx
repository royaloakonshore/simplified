'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CheckIcon, XIcon, Loader2 } from 'lucide-react';
import { api } from '@/lib/trpc/react';
import { toast } from 'react-toastify';
import type { InventoryItem, ItemType } from '@prisma/client';

interface CellItemData extends Omit<InventoryItem, 'costPrice' | 'salesPrice' | 'quantityOnHand' | 'minimumStockLevel' | 'reorderLevel'> {
  costPrice: string;
  salesPrice: string;
  quantityOnHand: string;
  minimumStockLevel: string;
  reorderLevel: string | null;
}

interface EditableQuantityCellProps {
  item: CellItemData;
  onUpdate: (newValue: number) => void;
}

export default function EditableQuantityCell({ item, onUpdate }: EditableQuantityCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const initialQuantityNum = parseFloat(item.quantityOnHand) || 0;
  const [currentQuantity, setCurrentQuantity] = useState<number>(initialQuantityNum);
  const [originalQuantity, setOriginalQuantity] = useState<number>(initialQuantityNum);

  const utils = api.useUtils();
  const quickAdjustStockMutation = api.inventory.quickAdjustStock.useMutation({
    onSuccess: (updatedItem) => {
      toast.success(`Stock for ${updatedItem.name} updated to ${updatedItem.quantityOnHand}`);
      utils.inventory.list.invalidate();
      setIsEditing(false);
      const newQty = typeof updatedItem.quantityOnHand === 'string' ? parseFloat(updatedItem.quantityOnHand) : updatedItem.quantityOnHand;
      onUpdate(newQty ?? originalQuantity);
    },
    onError: (error) => {
      toast.error(`Failed to update stock: ${error.message}`);
      setCurrentQuantity(originalQuantity);
      setIsEditing(false);
    },
  });

  useEffect(() => {
    const newQtyNum = parseFloat(item.quantityOnHand) || 0;
    if (!isEditing) {
        setCurrentQuantity(newQtyNum);
    }
    setOriginalQuantity(newQtyNum);
  }, [item.quantityOnHand, isEditing]);

  const handleSave = () => {
    if (isNaN(currentQuantity)) {
      toast.error('Invalid quantity entered.');
      return;
    }
    if (currentQuantity === originalQuantity) {
      setIsEditing(false);
      onUpdate(currentQuantity);
      return;
    }
    quickAdjustStockMutation.mutate({
      itemId: item.id,
      newQuantityOnHand: currentQuantity,
      originalQuantityOnHand: originalQuantity,
    });
  };

  const handleCancel = () => {
    setCurrentQuantity(originalQuantity);
    setIsEditing(false);
  };

  if (quickAdjustStockMutation.isPending) {
    return (
      <div className="flex items-center justify-end space-x-1">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="flex items-center justify-end space-x-1">
        <Input
          type="number"
          value={currentQuantity.toString()}
          onChange={(e) => {
            const val = e.target.value;
            setCurrentQuantity(val === '' ? 0 : parseFloat(val) || 0);
          }}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
          className="h-8 w-20 text-right"
          autoFocus
        />
        <Button variant="ghost" size="icon" onClick={handleSave} className="h-8 w-8">
          <CheckIcon className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleCancel} className="h-8 w-8">
          <XIcon className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div 
      className="text-right font-medium cursor-pointer hover:bg-muted/50 p-2 rounded-md"
      onClick={() => {
        const currentVal = parseFloat(item.quantityOnHand) || 0;
        setOriginalQuantity(currentVal);
        setCurrentQuantity(currentVal);
        setIsEditing(true);
      }}
    >
      {currentQuantity}
    </div>
  );
} 