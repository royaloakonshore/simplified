'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { 
  createInventoryItemSchema, 
  updateInventoryItemSchema, 
  stockAdjustmentSchema,
  bulkStockAdjustmentSchema,
  listInventoryItemsSchema,
  type CreateInventoryItemInput,
  type UpdateInventoryItemInput,
  type StockAdjustmentInput,
  type BulkStockAdjustmentInput,
  type ListInventoryItemsInput,
} from '@/lib/schemas/inventory.schema';
import { QuantityStatus, TransactionType } from '@/lib/types/inventory.types';
import type { Prisma } from '@prisma/client';

// Create a new inventory item
export async function createItem(data: CreateInventoryItemInput) {
  try {
    // Validate input
    const validatedData = createInventoryItemSchema.parse(data);
    
    // Create the item in the database
    const item = await prisma.inventoryItem.create({
      data: validatedData,
    });
    
    revalidatePath('/inventory');
    return { success: true, data: item };
  } catch (error) {
    console.error('Failed to create inventory item:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    };
  }
}

// Get a single inventory item by ID with calculated quantity on hand
export async function getItemById(id: string) {
  try {
    // Get the item
    const item = await prisma.inventoryItem.findUnique({
      where: { id },
    });
    
    if (!item) {
      return { success: false, error: 'Inventory item not found' };
    }

    // Calculate quantity on hand from transactions
    const transactions = await prisma.inventoryTransaction.findMany({
      where: { itemId: id },
    });
    
    // Sum up quantities (positive for purchases/adjustments, negative for sales)
    const quantityOnHand = transactions.reduce((total: number, transaction: any) => {
      const quantity = Number(transaction.quantity);
      
      if (transaction.type === 'sale') {
        return total - quantity;
      }
      
      return total + quantity;
    }, 0);
    
    // Determine quantity status
    let quantityStatus: QuantityStatus;
    const minimumStockLevel = Number(item.minimumStockLevel);
    const reorderLevel = Number(item.reorderLevel);
    
    if (quantityOnHand <= minimumStockLevel) {
      quantityStatus = QuantityStatus.Critical;
    } else if (quantityOnHand <= reorderLevel) {
      quantityStatus = QuantityStatus.Low;
    } else {
      quantityStatus = QuantityStatus.Normal;
    }

    // Return item with calculated fields
    return { 
      success: true, 
      data: {
        ...item, 
        quantityOnHand,
        quantityStatus,
      } 
    };
  } catch (error) {
    console.error('Failed to get inventory item:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    };
  }
}

// List inventory items with pagination, filtering, and sorting
export async function listItems(params: ListInventoryItemsInput) {
  try {
    // Validate input
    const validatedParams = listInventoryItemsSchema.parse(params);
    const { 
      page, 
      perPage, 
      search, 
      materialType, 
      sortBy,
      sortDirection,
    } = validatedParams;
    
    // Build query filters
    const where: any = {};
    
    if (search) {
      where.OR = [
        { sku: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    if (materialType) {
      where.materialType = materialType;
    }
    
    // Get total count
    const totalCount = await prisma.inventoryItem.count({ where });
    
    // Get paginated items
    const items = await prisma.inventoryItem.findMany({
      where,
      orderBy: {
        [sortBy === 'quantityOnHand' ? 'name' : sortBy]: sortDirection,
      },
      skip: (page - 1) * perPage,
      take: perPage,
    });
    
    // Calculate quantity on hand for each item
    const itemsWithStock = await Promise.all(
      items.map(async (item: any) => {
        const transactions = await prisma.inventoryTransaction.findMany({
          where: { itemId: item.id },
        });
        
        // Sum up quantities
        const quantityOnHand = transactions.reduce((total: number, transaction: any) => {
          const quantity = Number(transaction.quantity);
          
          if (transaction.type === 'sale') {
            return total - quantity;
          }
          
          return total + quantity;
        }, 0);
        
        // Determine quantity status
        let quantityStatus: QuantityStatus;
        const minimumStockLevel = Number(item.minimumStockLevel);
        const reorderLevel = Number(item.reorderLevel);
        
        if (quantityOnHand <= minimumStockLevel) {
          quantityStatus = QuantityStatus.Critical;
        } else if (quantityOnHand <= reorderLevel) {
          quantityStatus = QuantityStatus.Low;
        } else {
          quantityStatus = QuantityStatus.Normal;
        }
        
        return {
          ...item,
          quantityOnHand,
          quantityStatus,
        };
      })
    );
    
    // Sort by quantityOnHand if that was the requested sort field
    if (sortBy === 'quantityOnHand') {
      itemsWithStock.sort((a: any, b: any) => {
        return sortDirection === 'asc' 
          ? a.quantityOnHand - b.quantityOnHand
          : b.quantityOnHand - a.quantityOnHand;
      });
    }
    
    return {
      success: true,
      data: {
        items: itemsWithStock,
        meta: {
          page,
          perPage,
          totalCount,
          totalPages: Math.ceil(totalCount / perPage),
        },
      },
    };
  } catch (error) {
    console.error('Failed to list inventory items:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    };
  }
}

// Update an inventory item
export async function updateItem(data: UpdateInventoryItemInput) {
  try {
    // Validate input
    const validatedData = updateInventoryItemSchema.parse(data);
    const { id, ...updateData } = validatedData;
    
    // Update the item
    const item = await prisma.inventoryItem.update({
      where: { id },
      data: updateData,
    });
    
    revalidatePath('/inventory');
    return { success: true, data: item };
  } catch (error) {
    console.error('Failed to update inventory item:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    };
  }
}

// Delete an inventory item
export async function deleteItem(id: string) {
  try {
    // Check if item exists
    const item = await prisma.inventoryItem.findUnique({
      where: { id },
      include: { 
        transactions: true,
        orderItems: true,
        invoiceItems: true,
      },
    });
    
    if (!item) {
      return { success: false, error: 'Inventory item not found' };
    }
    
    // Check for associated records
    if (item.transactions.length > 0) {
      return { success: false, error: 'Cannot delete item with existing transactions' };
    }
    
    if (item.orderItems.length > 0) {
      return { success: false, error: 'Cannot delete item with existing order items' };
    }
    
    if (item.invoiceItems.length > 0) {
      return { success: false, error: 'Cannot delete item with existing invoice items' };
    }
    
    // Delete the item
    await prisma.inventoryItem.delete({
      where: { id },
    });
    
    revalidatePath('/inventory');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete inventory item:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    };
  }
}

// Adjust stock for a single item
export async function adjustStock(data: StockAdjustmentInput) {
  try {
    // Validate input
    const validatedData = stockAdjustmentSchema.parse(data);
    
    // Create the transaction
    const transaction = await prisma.inventoryTransaction.create({
      data: {
        itemId: validatedData.itemId,
        quantity: validatedData.quantity,
        type: TransactionType.Adjustment,
        note: validatedData.note,
      },
    });
    
    revalidatePath('/inventory');
    return { success: true, data: transaction };
  } catch (error) {
    console.error('Failed to adjust stock:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    };
  }
}

// Adjust stock for multiple items (bulk adjustment)
export async function bulkAdjustStock(data: BulkStockAdjustmentInput) {
  try {
    // Validate input
    const validatedData = bulkStockAdjustmentSchema.parse(data);
    
    // Create transactions in a transaction to ensure atomicity
    const transactions = await prisma.$transaction(
      validatedData.map((adjustment) => 
        prisma.inventoryTransaction.create({
          data: {
            itemId: adjustment.itemId,
            quantity: adjustment.quantity,
            type: TransactionType.Adjustment,
            note: adjustment.note,
          },
        })
      )
    );
    
    revalidatePath('/inventory');
    return { success: true, data: transactions };
  } catch (error) {
    console.error('Failed to perform bulk stock adjustment:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    };
  }
}

// Get inventory transactions for an item
export async function getItemTransactions(itemId: string) {
  try {
    const transactions = await prisma.inventoryTransaction.findMany({
      where: { itemId },
      orderBy: { createdAt: 'desc' },
    });
    
    return { success: true, data: transactions };
  } catch (error) {
    console.error('Failed to get inventory transactions:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    };
  }
} 