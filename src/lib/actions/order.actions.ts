'use server';

import { prisma as prismaClient } from '@/lib/db';
import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { 
  createOrderSchema,
  updateOrderSchema,
  orderStatusSchema,
  addOrderItemSchema,
  updateOrderItemSchema,
  orderFilterSchema,
  orderPaginationSchema
} from '@/lib/schemas/order.schema';
import { OrderStatus } from '@/lib/types/order.types';
import { createUUID, createDecimal } from '@/lib/types/branded';
import { TransactionType } from '@/lib/types/inventory.types';

// Explicitly type the client instance
const prisma: PrismaClient = prismaClient;

/**
 * Helper function to generate a unique order number
 */
async function generateOrderNumber(): Promise<string> {
  // Get the current year
  const year = new Date().getFullYear().toString().substring(2); // e.g., '23' for 2023
  
  // Count orders from current year to determine the next sequence number
  const orderCount = await prisma.order.count({
    where: {
      orderNumber: {
        startsWith: `ORD-${year}-`,
      },
    },
  });
  
  // Create order number with format ORD-YY-XXXXX (padded with leading zeros)
  const sequenceNumber = (orderCount + 1).toString().padStart(5, '0');
  return `ORD-${year}-${sequenceNumber}`;
}

/**
 * Calculate the total amount for an order based on its items
 */
export async function calculateOrderTotal(orderId: string): Promise<number> {
  const orderItems = await prisma.orderItem.findMany({
    where: { orderId },
    select: { quantity: true, unitPrice: true },
  });
  
  const total = orderItems.reduce((sum, item) => {
    return sum + (Number(item.quantity) * Number(item.unitPrice));
  }, 0);
  
  return total;
}

/**
 * Helper function to check if an order has sufficient stock for all items
 * Returns information about stock status
 */
async function checkStockAvailability(orderId: string) {
  // Get all items in the order
  const orderItems = await prisma.orderItem.findMany({
    where: { orderId },
    include: { item: true },
  });
  
  const outOfStockItems = [];
  
  // Check each item's available quantity
  for (const orderItem of orderItems) {
    // Calculate current quantity on hand
    const transactions = await prisma.inventoryTransaction.findMany({
      where: { itemId: orderItem.itemId },
    });
    
    // Sum up quantities (positive for purchases/adjustments, negative for sales)
    const quantityOnHand = transactions.reduce((total, transaction) => {
      const quantity = Number(transaction.quantity);
      
      if (transaction.type === 'sale') {
        return total - quantity;
      }
      
      return total + quantity;
    }, 0);
    
    // Check if we have enough stock
    if (quantityOnHand < Number(orderItem.quantity)) {
      outOfStockItems.push({
        itemId: createUUID(orderItem.itemId),
        name: orderItem.item.name,
        quantityRequested: createDecimal(Number(orderItem.quantity)),
        quantityAvailable: createDecimal(quantityOnHand),
      });
    }
  }
  
  return {
    hasInsufficientStock: outOfStockItems.length > 0,
    outOfStockItems: outOfStockItems.length > 0 ? outOfStockItems : undefined,
  };
}

/**
 * Create a new order
 */
export async function createOrder(data: unknown) {
  try {
    // Validate input
    const validatedData = createOrderSchema.parse(data);
    
    // Generate a unique order number
    const orderNumber = await generateOrderNumber();
    
    // Start a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the order
      const order = await tx.order.create({
        data: {
          customerId: validatedData.customerId,
          orderNumber,
          status: OrderStatus.DRAFT,
          totalAmount: 0, // Will update after adding items
          notes: validatedData.notes,
        },
      });
      
      // Add order items if provided
      if (validatedData.items && validatedData.items.length > 0) {
        for (const item of validatedData.items) {
          // Fetch the inventory item to get current price
          const inventoryItem = await tx.inventoryItem.findUnique({
            where: { id: item.itemId },
          });
          
          if (!inventoryItem) {
            throw new Error(`Inventory item not found: ${item.itemId}`);
          }
          
          // Use provided unit price or default to item's sales price
          const unitPrice = item.unitPrice !== undefined 
            ? item.unitPrice 
            : Number(inventoryItem.salesPrice);
          
          // Create order item
          await tx.orderItem.create({
            data: {
              orderId: order.id,
              itemId: item.itemId,
              quantity: item.quantity,
              unitPrice,
            },
          });
        }
        
        // Calculate and update total amount
        const totalAmount = await calculateOrderTotal(order.id);
        await tx.order.update({
          where: { id: order.id },
          data: { totalAmount },
        });
      }
      
      // Get the complete order with items and customer
      const completeOrder = await tx.order.findUnique({
        where: { id: order.id },
        include: {
          items: {
            include: {
              item: true,
            },
          },
          customer: true,
        },
      });
      
      return completeOrder;
    });
    
    revalidatePath('/orders');
    return { success: true, data: result };
  } catch (error) {
    console.error('Failed to create order:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    };
  }
}

/**
 * Get a single order by ID with all related data
 */
export async function getOrderById(id: string) {
  try {
    // Get the order with all related data
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            item: true,
          },
        },
        customer: {
          include: {
            addresses: true,
          },
        },
      },
    });
    
    if (!order) {
      return { success: false, error: 'Order not found' };
    }
    
    // Check stock availability for items
    const stockStatus = await checkStockAvailability(id);
    
    // Return order with stock status
    return { 
      success: true,
      data: {
        ...order,
        ...stockStatus,
      },
    };
  } catch (error) {
    console.error('Failed to get order:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    };
  }
}

/**
 * List orders with filtering, pagination, and sorting
 */
export async function listOrders(params: unknown) {
  try {
    // Parse and validate filter and pagination
    const filters = orderFilterSchema.parse(params);
    const pagination = orderPaginationSchema.parse(params);
    
    const { page, perPage, sortBy, sortDirection } = pagination;
    
    // Build query filters
    const where: any = {};
    
    if (filters.customerId) {
      where.customerId = filters.customerId;
    }
    
    if (filters.status) {
      where.status = filters.status;
    }
    
    if (filters.fromDate) {
      where.createdAt = {
        ...(where.createdAt || {}),
        gte: filters.fromDate,
      };
    }
    
    if (filters.toDate) {
      where.createdAt = {
        ...(where.createdAt || {}),
        lte: filters.toDate,
      };
    }
    
    if (filters.searchTerm) {
      where.OR = [
        { orderNumber: { contains: filters.searchTerm, mode: 'insensitive' } },
        { notes: { contains: filters.searchTerm, mode: 'insensitive' } },
        { customer: { name: { contains: filters.searchTerm, mode: 'insensitive' } } },
      ];
    }
    
    // Get total count
    const totalCount = await prisma.order.count({ where });
    
    // Get paginated orders
    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: true,
        items: {
          include: {
            item: true,
          },
        },
      },
      orderBy: {
        [sortBy]: sortDirection,
      },
      skip: (page - 1) * perPage,
      take: perPage,
    });
    
    return {
      success: true,
      data: {
        items: orders,
        meta: {
          page,
          perPage,
          totalCount,
          totalPages: Math.ceil(totalCount / perPage),
        },
      },
    };
  } catch (error) {
    console.error('Failed to list orders:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    };
  }
}

/**
 * Update an existing order
 */
export async function updateOrder(id: string, data: unknown) {
  try {
    // Validate input
    const validatedData = updateOrderSchema.parse(data);
    
    // Check if order exists
    const order = await prisma.order.findUnique({ where: { id } });
    
    if (!order) {
      return { success: false, error: 'Order not found' };
    }
    
    // Only allow updates to DRAFT orders
    if (order.status !== OrderStatus.DRAFT) {
      return { 
        success: false, 
        error: 'Only draft orders can be updated' 
      };
    }
    
    // Update the order
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: validatedData,
      include: {
        items: {
          include: {
            item: true,
          },
        },
        customer: true,
      },
    });
    
    revalidatePath(`/orders/${id}`);
    revalidatePath('/orders');
    
    return { success: true, data: updatedOrder };
  } catch (error) {
    console.error('Failed to update order:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    };
  }
}

/**
 * Add a new item to an order
 */
export async function addOrderItem(orderId: string, data: unknown) {
  try {
    // Validate input
    const validatedData = addOrderItemSchema.parse(data);
    
    // Check if order exists and is in DRAFT status
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    
    if (!order) {
      return { success: false, error: 'Order not found' };
    }
    
    if (order.status !== OrderStatus.DRAFT) {
      return { 
        success: false, 
        error: 'Items can only be added to draft orders' 
      };
    }
    
    // Check if inventory item exists
    const inventoryItem = await prisma.inventoryItem.findUnique({
      where: { id: validatedData.itemId },
    });
    
    if (!inventoryItem) {
      return { success: false, error: 'Inventory item not found' };
    }
    
    // Start a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Use provided unit price or default to item's sales price
      const unitPrice = validatedData.unitPrice !== undefined 
        ? validatedData.unitPrice 
        : Number(inventoryItem.salesPrice);
      
      // Create order item
      const orderItem = await tx.orderItem.create({
        data: {
          orderId,
          itemId: validatedData.itemId,
          quantity: validatedData.quantity,
          unitPrice,
        },
        include: {
          item: true,
        },
      });
      
      // Update order total
      const totalAmount = await calculateOrderTotal(orderId);
      await tx.order.update({
        where: { id: orderId },
        data: { totalAmount },
      });
      
      return orderItem;
    });
    
    revalidatePath(`/orders/${orderId}`);
    revalidatePath('/orders');
    
    return { success: true, data: result };
  } catch (error) {
    console.error('Failed to add order item:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    };
  }
}

/**
 * Update an existing order item
 */
export async function updateOrderItem(orderId: string, itemId: string, data: unknown) {
  try {
    // Validate input
    const validatedData = updateOrderItemSchema.parse(data);
    
    // Check if order exists and is in DRAFT status
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    
    if (!order) {
      return { success: false, error: 'Order not found' };
    }
    
    if (order.status !== OrderStatus.DRAFT) {
      return { 
        success: false, 
        error: 'Items can only be updated in draft orders' 
      };
    }
    
    // Check if order item exists
    const orderItem = await prisma.orderItem.findUnique({
      where: { id: itemId },
    });
    
    if (!orderItem || orderItem.orderId !== orderId) {
      return { success: false, error: 'Order item not found' };
    }
    
    // Start a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update order item
      const updatedItem = await tx.orderItem.update({
        where: { id: itemId },
        data: validatedData,
        include: {
          item: true,
        },
      });
      
      // Update order total
      const totalAmount = await calculateOrderTotal(orderId);
      await tx.order.update({
        where: { id: orderId },
        data: { totalAmount },
      });
      
      return updatedItem;
    });
    
    revalidatePath(`/orders/${orderId}`);
    revalidatePath('/orders');
    
    return { success: true, data: result };
  } catch (error) {
    console.error('Failed to update order item:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    };
  }
}

/**
 * Remove an item from an order
 */
export async function removeOrderItem(orderId: string, itemId: string) {
  try {
    // Check if order exists and is in DRAFT status
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    
    if (!order) {
      return { success: false, error: 'Order not found' };
    }
    
    if (order.status !== OrderStatus.DRAFT) {
      return { 
        success: false, 
        error: 'Items can only be removed from draft orders' 
      };
    }
    
    // Check if order item exists
    const orderItem = await prisma.orderItem.findUnique({
      where: { id: itemId },
    });
    
    if (!orderItem || orderItem.orderId !== orderId) {
      return { success: false, error: 'Order item not found' };
    }
    
    // Start a transaction
    await prisma.$transaction(async (tx) => {
      // Delete the order item
      await tx.orderItem.delete({
        where: { id: itemId },
      });
      
      // Update order total
      const totalAmount = await calculateOrderTotal(orderId);
      await tx.order.update({
        where: { id: orderId },
        data: { totalAmount },
      });
    });
    
    revalidatePath(`/orders/${orderId}`);
    revalidatePath('/orders');
    
    return { success: true };
  } catch (error) {
    console.error('Failed to remove order item:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    };
  }
}

/**
 * Update an order's status
 * This is a critical function that enforces the order lifecycle rules
 * and manages inventory changes
 */
export async function updateOrderStatus(orderId: string, data: unknown) {
  try {
    const validatedData = orderStatusSchema.parse(data);
    const newStatusLocal = validatedData.status;
    
    const order = await prisma.order.findUnique({ 
      where: { id: orderId },
      // Need include items for inventory transaction logic
      include: { items: true } 
    });
    if (!order) {
      return { success: false, error: 'Order not found' };
    }
    
    const currentStatusLocal = order.status as OrderStatus;
    
    if (!isValidStatusTransition(currentStatusLocal, newStatusLocal)) {
      return { 
        success: false, 
        error: `Invalid status transition from ${currentStatusLocal} to ${newStatusLocal}` 
      };
    }
    
    // Cast to any for Prisma update, as enum type resolution is problematic
    const newStatusForDb = newStatusLocal as any;

    if (newStatusLocal === OrderStatus.CONFIRMED) {
      const stockStatus = await checkStockAvailability(orderId);
      
      if (stockStatus.hasInsufficientStock) {
        return { 
          success: false, 
          error: 'Insufficient stock for one or more items',
          data: stockStatus,
        };
      }
      
      // If stock is sufficient, perform the transition and deduct inventory
      return await prisma.$transaction(async (tx) => {
        const typedTx = tx as PrismaClient; // Type the transaction client
        const updatedOrder = await typedTx.order.update({
          where: { id: orderId },
          data: { status: newStatusForDb },
          include: {
            items: {
              include: {
                item: true,
              },
            },
            customer: true,
          },
        });
        
        // Type transaction client here too
        for (const item of order.items) {
          await typedTx.inventoryTransaction.create({
            data: {
              itemId: item.itemId,
              quantity: Number(item.quantity),
              type: TransactionType.Sale,
              reference: `Order #${order.orderNumber}`,
              note: `Stock allocated for order confirmation`,
            },
          });
        }
        return { success: true, data: updatedOrder };
      });
    }
    
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: newStatusForDb },
      include: {
        items: {
          include: {
            item: true,
          },
        },
        customer: true,
      },
    });
    
    revalidatePath(`/orders/${orderId}`);
    revalidatePath('/orders');
    revalidatePath('/fulfillment');
    
    return { success: true, data: updatedOrder };
  } catch (error) {
    console.error('Failed to update order status:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    };
  }
}

/**
 * Helper function to check if a status transition is valid
 */
function isValidStatusTransition(currentStatus: string, newStatus: string): boolean {
  // Define valid transitions for each status
  const validTransitions: Record<string, string[]> = {
    [OrderStatus.DRAFT]: [
      OrderStatus.CONFIRMED,
      OrderStatus.CANCELLED,
    ],
    [OrderStatus.CONFIRMED]: [
      OrderStatus.IN_PRODUCTION,
      OrderStatus.CANCELLED,
    ],
    [OrderStatus.IN_PRODUCTION]: [
      OrderStatus.SHIPPED,
      OrderStatus.CANCELLED,
    ],
    [OrderStatus.SHIPPED]: [
      OrderStatus.DELIVERED,
      OrderStatus.CANCELLED,
    ],
    [OrderStatus.DELIVERED]: [
      // Terminal state, no further transitions
    ],
    [OrderStatus.CANCELLED]: [
      // Terminal state, no further transitions
    ],
  };
  
  // Check if transition is valid
  return validTransitions[currentStatus]?.includes(newStatus) || false;
} 