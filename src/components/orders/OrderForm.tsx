"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Order, OrderItem, OrderItemInput, OrderStatus } from '@/lib/types/order.types';
import { Customer } from '@/lib/types/customer.types';
import { InventoryItem } from '@/lib/types/inventory.types';
import { createOrder, updateOrder, addOrderItem, updateOrderItem, removeOrderItem } from '@/lib/actions/order.actions';
import { MaterialType } from '@/lib/types/inventory.types';
import { UUID, Decimal, createUUID, createDecimal } from '@/lib/types/branded';

type OrderFormProps = {
  customers: Customer[];
  inventoryItems: InventoryItem[];
  order?: Order; // Included for edit mode
  isEditMode?: boolean;
};

export default function OrderForm({
  customers,
  inventoryItems,
  order,
  isEditMode = false,
}: OrderFormProps) {
  const router = useRouter();
  
  // Form state
  const [customerId, setCustomerId] = useState(order?.customerId.toString() || '');
  const [notes, setNotes] = useState(order?.notes || '');
  const [orderItems, setOrderItems] = useState<(OrderItem | OrderItemInput)[]>(order?.items || []);
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  
  // New item form state
  const [newItemId, setNewItemId] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [newItemUnitPrice, setNewItemUnitPrice] = useState<number | undefined>(undefined);
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    
    try {
      if (isEditMode && order) {
        // Update existing order
        const result = await updateOrder(order.id.toString(), {
          notes,
        });
        
        if (!result.success) {
          throw new Error(result.error);
        }
        
        router.push(`/orders/${order.id}`);
        router.refresh();
      } else {
        // Create new order
        if (!customerId) {
          setError('Please select a customer');
          setIsSubmitting(false);
          return;
        }
        
        // Prepare order items for createOrder (expecting OrderItemInput structure)
        const items = orderItems.map((item) => {
          // Assume item has itemId (string) and quantity (number | Decimal)
          // If item is OrderItem from edit mode, its id/orderId are irrelevant for create
          const inputItem: OrderItemInput = {
             itemId: ('itemId' in item ? item.itemId : (item as any).id)?.toString() ?? '', // Get ID string (handle both cases)
             quantity: Number(item.quantity), // Ensure quantity is number
             unitPrice: item.unitPrice ? Number(item.unitPrice) : undefined // Ensure unitPrice is number or undefined
          };
          // Add validation? Ensure itemId is not empty?
          if (!inputItem.itemId) {
             console.error("Item with missing ID found in orderItems:", item);
             // Handle error appropriately - skip item, throw error?
          }
          return inputItem;
        }).filter(item => !!item.itemId); // Filter out items that couldn't be mapped properly
        
        const result = await createOrder({
          customerId,
          notes,
          items,
        });
        
        if (!result.success) {
          throw new Error(result.error);
        }
        
        if (!result.data) {
            throw new Error("Order created successfully, but no data returned.");
        }
        
        router.push(`/orders/${result.data.id}`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle adding a new item to the order
  const handleAddItem = async () => {
    if (!newItemId) {
      setError('Please select an item');
      return;
    }
    
    if (newItemQuantity <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }
    
    if (isEditMode && order) {
      // Add item to existing order via server action
      setIsSubmitting(true);
      
      try {
        const result = await addOrderItem(order.id.toString(), {
          itemId: newItemId,
          quantity: newItemQuantity,
          unitPrice: newItemUnitPrice,
        });
        
        if (!result.success) {
          throw new Error(result.error);
        }
        
        if (!result.data) {
           throw new Error("Item added successfully, but no item data returned.");
        }

        // --- Map the returned OrderItem (Prisma types) to local FormOrderItem ---
        const mapPrismaOrderItemToForm = (prismaItem: typeof result.data): OrderItem => {
             // Map nested InventoryItem
             const mapPrismaInventoryItem = (nestedPrismaItem: typeof result.data.item): InventoryItem => ({
                ...nestedPrismaItem,
                id: nestedPrismaItem.id,
                costPrice: nestedPrismaItem.costPrice.toNumber(),
                salesPrice: nestedPrismaItem.salesPrice.toNumber(),
                minimumStockLevel: nestedPrismaItem.minimumStockLevel.toNumber(),
                reorderLevel: nestedPrismaItem.reorderLevel.toNumber(),
                materialType: nestedPrismaItem.materialType as MaterialType,
             });

             return {
                ...prismaItem,
                id: createUUID(prismaItem.id),
                orderId: createUUID(prismaItem.orderId),
                itemId: createUUID(prismaItem.itemId),
                quantity: createDecimal(prismaItem.quantity.toNumber()),
                unitPrice: createDecimal(prismaItem.unitPrice.toNumber()),
                item: mapPrismaInventoryItem(prismaItem.item)
             };
        };

        const newItemForState = mapPrismaOrderItemToForm(result.data);
        // --- End Mapping ---

        // Update local state with the mapped item
        setOrderItems((prevItems) => [...prevItems, newItemForState]);
        
        // Reset form
        setNewItemId('');
        setNewItemQuantity(1);
        setNewItemUnitPrice(undefined);
        setShowAddItemModal(false);
        
        // Refresh the page to show updated data
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Add item to local state (for new order creation)
      const selectedItem = inventoryItems.find((item) => item.id === newItemId);
      
      if (!selectedItem) {
        setError('Selected item not found');
        return;
      }
      
      const price = newItemUnitPrice !== undefined 
        ? newItemUnitPrice 
        : selectedItem.salesPrice;
      
      const newItem: OrderItemInput = {
        itemId: newItemId,
        quantity: newItemQuantity,
        unitPrice: price,
      };
      
      setOrderItems((prevItems) => [...prevItems, newItem]);
      
      // Reset form
      setNewItemId('');
      setNewItemQuantity(1);
      setNewItemUnitPrice(undefined);
      setShowAddItemModal(false);
    }
  };
  
  // Handle updating an item in the order
  const handleUpdateItem = async (itemId: string, quantity: number, unitPrice?: number) => {
    if (isEditMode && order) {
      // Update item in existing order via server action
      setIsSubmitting(true);
      
      try {
        const result = await updateOrderItem(order.id.toString(), itemId, {
          quantity,
          unitPrice,
        });
        
        if (!result.success) {
          throw new Error(result.error);
        }
        
        // Ensure data exists before updating state
        if (!result.data) {
           throw new Error("Item updated successfully, but no item data returned.");
        }

        // --- Reuse mapping function from handleAddItem ---
        // (Assuming mapPrismaOrderItemToForm is defined in the component scope or copied here)
        const mapPrismaOrderItemToForm = (prismaItem: typeof result.data): OrderItem => {
             const mapPrismaInventoryItem = (nestedPrismaItem: typeof result.data.item): InventoryItem => ({
                 ...nestedPrismaItem,
                 id: nestedPrismaItem.id,
                 costPrice: nestedPrismaItem.costPrice.toNumber(),
                 salesPrice: nestedPrismaItem.salesPrice.toNumber(),
                 minimumStockLevel: nestedPrismaItem.minimumStockLevel.toNumber(),
                 reorderLevel: nestedPrismaItem.reorderLevel.toNumber(),
                 materialType: nestedPrismaItem.materialType as MaterialType,
             });
             return {
                 ...prismaItem,
                 id: createUUID(prismaItem.id),
                 orderId: createUUID(prismaItem.orderId),
                 itemId: createUUID(prismaItem.itemId),
                 quantity: createDecimal(prismaItem.quantity.toNumber()),
                 unitPrice: createDecimal(prismaItem.unitPrice.toNumber()),
                 item: mapPrismaInventoryItem(prismaItem.item)
             };
        };
        const updatedItemForState = mapPrismaOrderItemToForm(result.data);
        // --- End Mapping ---
        
        // Update local state with the mapped updated item
        setOrderItems((prevItems) => 
          prevItems.map((item) => 
            ('id' in item && item.id.toString() === itemId) ? updatedItemForState : item
          )
        );
        
        // Refresh the page to show updated data
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Update item in local state (for new order creation)
      setOrderItems((prevItems) => 
        prevItems.map((item) => {
          if ('itemId' in item && item.itemId === itemId) {
            return { ...item, quantity, unitPrice };
          }
          return item;
        })
      );
    }
  };
  
  // Handle removing an item from the order
  const handleRemoveItem = async (itemId: string) => {
    if (isEditMode && order) {
      // Remove item from existing order via server action
      setIsSubmitting(true);
      
      try {
        const result = await removeOrderItem(order.id.toString(), itemId);
        
        if (!result.success) {
          throw new Error(result.error);
        }
        
        // Update local state to remove the item
        setOrderItems((prevItems) => 
          prevItems.filter((item) => !('id' in item) || item.id.toString() !== itemId)
        );
        
        // Refresh the page to show updated data
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Remove item from local state (for new order creation)
      setOrderItems((prevItems) => 
        prevItems.filter((item) => 
          !('itemId' in item) || item.itemId !== itemId
        )
      );
    }
  };
  
  // Calculate total
  const calculateTotal = () => {
    return orderItems.reduce((total, item) => {
      const quantity = 'quantity' in item && typeof item.quantity === 'number'
        ? item.quantity
        : Number(item.quantity);
      
      const unitPrice = 'unitPrice' in item && typeof item.unitPrice === 'number'
        ? item.unitPrice
        : item.unitPrice ? Number(item.unitPrice) : 0;
      
      return total + (quantity * unitPrice);
    }, 0);
  };
  
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fi-FI', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };
  
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-md shadow p-4">
      <h2 className="text-xl font-semibold mb-6 text-neutral-900 dark:text-white">
        {isEditMode ? 'Edit Order' : 'Create New Order'}
      </h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        {/* Customer Selection */}
        <div className="mb-6">
          <label className="block mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Customer
          </label>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            disabled={isEditMode || isSubmitting}
            className="block w-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-neutral-900 dark:text-white disabled:opacity-60"
            required
          >
            <option value="">Select a customer</option>
            {customers
              .filter(customer => !!customer.id)
              .map((customer) => (
              <option key={customer.id!.toString()} value={customer.id!.toString()}>
                {customer.name}
              </option>
            ))}
          </select>
        </div>
        
        {/* Order Items */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Order Items
            </label>
            <button
              type="button"
              onClick={() => setShowAddItemModal(true)}
              disabled={isSubmitting}
              className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60"
            >
              Add Item
            </button>
          </div>
          
          {orderItems.length === 0 ? (
            <div className="text-sm text-neutral-500 dark:text-neutral-400 py-4 text-center border border-neutral-200 dark:border-neutral-700 rounded-md">
              No items added to this order
            </div>
          ) : (
            <div className="border border-neutral-200 dark:border-neutral-700 rounded-md overflow-hidden">
              <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-700">
                <thead className="bg-neutral-50 dark:bg-neutral-800">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      Item
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      Unit Price
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      Total
                    </th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-neutral-900 divide-y divide-neutral-200 dark:divide-neutral-700">
                  {orderItems.map((item, index) => {
                    // Find inventory item
                    const inventoryItem = 'item' in item 
                      ? item.item 
                      : inventoryItems.find((i) => i.id === item.itemId);
                    
                    if (!inventoryItem) return null;
                    
                    const quantity = 'quantity' in item && typeof item.quantity === 'number'
                      ? item.quantity
                      : Number(item.quantity);
                    
                    const unitPrice = 'unitPrice' in item && typeof item.unitPrice === 'number'
                      ? item.unitPrice
                      : item.unitPrice ? Number(item.unitPrice) : inventoryItem.salesPrice;
                    
                    const itemTotal = quantity * unitPrice;
                    
                    return (
                      <tr key={index} className="hover:bg-neutral-50 dark:hover:bg-neutral-800">
                        <td className="px-4 py-4 text-sm text-neutral-900 dark:text-neutral-100">
                          {inventoryItem.name} <span className="text-neutral-500">({inventoryItem.sku})</span>
                        </td>
                        <td className="px-4 py-4 text-sm text-neutral-500 dark:text-neutral-400 text-right">
                          {quantity} {inventoryItem.unitOfMeasure}
                        </td>
                        <td className="px-4 py-4 text-sm text-neutral-500 dark:text-neutral-400 text-right">
                          {formatCurrency(unitPrice)}
                        </td>
                        <td className="px-4 py-4 text-sm text-neutral-900 dark:text-neutral-100 text-right font-medium">
                          {formatCurrency(itemTotal)}
                        </td>
                        <td className="px-4 py-4 text-sm text-right">
                          <button
                            type="button"
                            onClick={() => {
                              const itemId = 'id' in item ? item.id.toString() : item.itemId;
                              handleRemoveItem(itemId);
                            }}
                            disabled={isSubmitting}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 focus:outline-none disabled:opacity-60"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-neutral-50 dark:bg-neutral-800">
                    <td colSpan={3} className="px-4 py-3 text-sm text-neutral-900 dark:text-neutral-100 font-medium text-right">
                      Total
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-900 dark:text-neutral-100 font-medium text-right">
                      {formatCurrency(calculateTotal())}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        {/* Notes */}
        <div className="mb-6">
          <label className="block mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Notes
          </label>
          <textarea
            value={notes || ''}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isSubmitting}
            rows={3}
            className="block w-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-neutral-900 dark:text-white disabled:opacity-60"
          ></textarea>
        </div>
        
        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || orderItems.length === 0}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60"
          >
            {isSubmitting ? 'Saving...' : isEditMode ? 'Update Order' : 'Create Order'}
          </button>
        </div>
      </form>
      
      {/* Add Item Modal */}
      {showAddItemModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg w-full max-w-md mx-4">
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
              <h3 className="text-lg font-medium text-neutral-900 dark:text-white">
                Add Item to Order
              </h3>
            </div>
            
            <div className="p-4">
              {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                  {error}
                </div>
              )}
              
              <div className="mb-4">
                <label className="block mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Item
                </label>
                <select
                  value={newItemId}
                  onChange={(e) => {
                    setNewItemId(e.target.value);
                    // Set default price from selected item
                    const selectedItem = inventoryItems.find((item) => item.id === e.target.value);
                    if (selectedItem) {
                      setNewItemUnitPrice(selectedItem.salesPrice);
                    }
                  }}
                  disabled={isSubmitting}
                  className="block w-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-neutral-900 dark:text-white disabled:opacity-60"
                  required
                >
                  <option value="">Select an item</option>
                  {inventoryItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.sku}) - {formatCurrency(item.salesPrice)}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="mb-4">
                <label className="block mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={newItemQuantity}
                  onChange={(e) => setNewItemQuantity(parseInt(e.target.value))}
                  disabled={isSubmitting}
                  className="block w-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-neutral-900 dark:text-white disabled:opacity-60"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label className="block mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Unit Price (optional, defaults to item's sales price)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newItemUnitPrice !== undefined ? newItemUnitPrice : ''}
                  onChange={(e) => setNewItemUnitPrice(e.target.value ? parseFloat(e.target.value) : undefined)}
                  disabled={isSubmitting}
                  className="block w-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-neutral-900 dark:text-white disabled:opacity-60"
                />
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddItemModal(false);
                    setError(null);
                  }}
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={isSubmitting || !newItemId || newItemQuantity <= 0}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60"
                >
                  {isSubmitting ? 'Adding...' : 'Add Item'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 