'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CheckIcon, XIcon, Loader2 } from 'lucide-react';
import { api } from '@/lib/trpc/react';
import type { InventoryItem, ItemType, InventoryTransaction } from '@prisma/client';
import { toast as sonnerToast } from "sonner";

export interface CellItemData extends Omit<InventoryItem, 'costPrice' | 'salesPrice' | 'quantityOnHand' | 'minimumStockLevel' | 'reorderLevel' | 'defaultVatRatePercent'> {
  costPrice: string;
  salesPrice: string;
  quantityOnHand: string;
  minimumStockLevel: string;
  reorderLevel: string | null;
  defaultVatRatePercent: string | null;
}

interface EditableQuantityCellProps {
  item: CellItemData;
  onUpdate: (itemId: string, newQuantity: number) => void;
}

export default function EditableQuantityCell({ item, onUpdate }: EditableQuantityCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const initialQuantityNum = parseFloat(item.quantityOnHand) || 0;
  const [currentQuantity, setCurrentQuantity] = useState<number>(initialQuantityNum);
  const [originalQuantity, setOriginalQuantity] = useState<number>(initialQuantityNum);

  const utils = api.useUtils();
  const updateStockMutation = api.inventory.adjustStock.useMutation({
    onSuccess: (data: InventoryTransaction) => {
      sonnerToast.success(`Stock for "${item.name}" updated. Change: ${data.quantity.toString()}.`);
      utils.inventory.list.invalidate();
      utils.inventory.getById.invalidate({ id: item.id });
      setIsEditing(false);
      onUpdate(item.id, currentQuantity);
    },
    onError: (error) => {
      sonnerToast.error(`Failed to update stock: ${error.message}`);
      setCurrentQuantity(originalQuantity);
      setIsEditing(false);
      console.error("Stock update error:", error);
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
      sonnerToast.error('Invalid quantity entered.');
      setCurrentQuantity(originalQuantity);
      setIsEditing(false);
      return;
    }
    const quantityChange = currentQuantity - originalQuantity;
    if (quantityChange === 0) {
      setIsEditing(false);
      return;
    }
    updateStockMutation.mutate({
      itemId: item.id,
      quantityChange: quantityChange,
      note: `Manual adjustment from table for ${item.name}`
    });
  };

  const handleCancel = () => {
    setCurrentQuantity(originalQuantity);
    setIsEditing(false);
  };

  if (updateStockMutation.isPending) {
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