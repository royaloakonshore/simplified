'use server';

import { prisma } from '@/lib/db';
import { PrismaClient, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { revalidatePath } from 'next/cache';
import { 
  createInvoiceFromOrderSchema,
  CreateInvoiceSchema,
  updateInvoiceStatusSchema,
  recordPaymentSchema,
  invoiceFilterSchema,
  invoicePaginationSchema,
  InvoiceItemInput
} from '@/lib/schemas/invoice.schema';
import { InvoiceStatus, Invoice, InvoiceItem } from '@/lib/types/invoice.types';
import { OrderStatus } from '@/lib/types/order.types';
import { generateFinvoiceXml } from '@/lib/services/finvoice.service';
import { Customer, Address, AddressType } from '@/lib/types/customer.types';
import { UUID, createUUID, createDecimal } from '@/lib/types/branded';
import { CreateInvoiceSchema as CorrectCreateInvoiceSchema } from "@/lib/schemas/invoice.schema";
import { z } from 'zod';
import { OrderStatus as PrismaOrderStatus, InvoiceStatus as PrismaInvoiceStatus, InventoryItem } from '@prisma/client';

// Define the return type for actions that return success/data/error
type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

// --- Top-level Mapping Function for Invoice (shared by actions) ---
const mapPrismaInvoiceToLocal = (prismaInvoice: any): Invoice => {
  // Assume structure based on Prisma schema and includes
  const mapPrismaAddressToLocal = (addr: any): Address => ({
    ...addr,
    id: addr.id, 
    type: addr.type as AddressType,
  });

  const mapPrismaCustomerToLocal = (cust: any): Customer => ({
    ...cust,
    id: createUUID(cust.id ?? ''), 
    addresses: cust.addresses ? cust.addresses.map(mapPrismaAddressToLocal) : [], 
  });

  const mapPrismaInvoiceItemToLocal = (item: any): InvoiceItem => ({
    ...item,
    id: createUUID(item.id),
    invoiceId: createUUID(item.invoiceId),
    quantity: item.quantity as Decimal,
    unitPrice: item.unitPrice as Decimal,
    vatRatePercent: item.vatRatePercent as Decimal,
    description: item.description ?? '', 
  });

  const customer = prismaInvoice.customer ? mapPrismaCustomerToLocal(prismaInvoice.customer) : null;
  const items = prismaInvoice.items ? prismaInvoice.items.map(mapPrismaInvoiceItemToLocal) : [];

  if (!customer) {
      throw new Error(`Customer data missing for invoice ${prismaInvoice.id}`);
  }

  return {
      ...(prismaInvoice as any),
      id: createUUID(prismaInvoice.id),
      customerId: createUUID(prismaInvoice.customerId ?? ''),
      orderId: prismaInvoice.orderId ? createUUID(prismaInvoice.orderId) : undefined,
      status: prismaInvoice.status as InvoiceStatus, 
      notes: prismaInvoice.notes ?? undefined, 
      totalAmount: prismaInvoice.totalAmount as Decimal,
      totalVatAmount: prismaInvoice.totalVatAmount as Decimal,
      customer: customer, 
      items: items, 
      originalInvoiceId: prismaInvoice.originalInvoiceId ? createUUID(prismaInvoice.originalInvoiceId) : undefined,
      creditNoteId: prismaInvoice.creditNoteId ? createUUID(prismaInvoice.creditNoteId) : undefined,
      order: undefined, 
      originalInvoice: undefined, 
      creditNote: undefined,    
  };
};
// --- End Mapping Function ---

/**
 * Helper function to generate a unique invoice number
 */
async function generateInvoiceNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear().toString().substring(2);
  const invoiceCount = await tx.invoice.count({
    where: {
      invoiceNumber: {
        startsWith: `INV-${year}-`,
      },
    },
  });
  const sequenceNumber = (invoiceCount + 1).toString().padStart(5, '0');
  return `INV-${year}-${sequenceNumber}`;
}

/**
 * Calculate total VAT amount for invoice items
 */
function calculateTotalVat(items: { quantity: number | Decimal, unitPrice: number | Decimal, vatRatePercent: number | Decimal }[]): Decimal {
  const totalVat = items.reduce((sum, item) => {
    const lineTotal = new Decimal(item.quantity.toString()).times(new Decimal(item.unitPrice.toString()));
    const vatAmount = lineTotal.times(new Decimal(item.vatRatePercent.toString()).div(100));
    return new Decimal(sum.toString()).plus(vatAmount);
  }, new Decimal(0));
  return totalVat;
}

/**
 * Calculate total amount including VAT
 */
function calculateTotalWithVat(items: { quantity: number | Decimal, unitPrice: number | Decimal, vatRatePercent: number | Decimal }[]): Decimal {
  const subTotal = items.reduce((sum, item) => {
    const lineTotal = new Decimal(item.quantity.toString()).times(new Decimal(item.unitPrice.toString()));
    return new Decimal(sum.toString()).plus(lineTotal);
  }, new Decimal(0));
  const totalVat = calculateTotalVat(items);
  return subTotal.plus(totalVat);
}

/**
 * Create an invoice from an existing order
 */
export async function createInvoiceFromOrder(orderId: string, companyId: string) {
  return await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId }, 
      include: {
        items: { include: { inventoryItem: true } }, // Changed item to inventoryItem
        customer: true,
      },
    });

    if (!order) {
      throw new Error("Order not found");
    }
    if (order.status !== OrderStatus.CONFIRMED && order.status !== OrderStatus.SHIPPED && order.status !== OrderStatus.DELIVERED) {
      throw new Error("Invoice can only be created for confirmed, shipped or delivered orders.");
    }

    const invoiceNumber = await generateInvoiceNumber(tx);

    const invoiceItemsData = order.items.map((orderItem) => ({
      inventoryItemId: orderItem.inventoryItemId, // Use new FK name
      description: orderItem.inventoryItem.name,    // Use new relation name
      quantity: orderItem.quantity,
      unitPrice: orderItem.unitPrice,
      vatRatePercent: new Decimal(24), 
      discountAmount: orderItem.discountAmount,
      discountPercentage: orderItem.discountPercentage, // Use new field name
    }));

    const itemsForCalc = invoiceItemsData.map(item => ({ 
        ...item, 
        vatRatePercent: item.vatRatePercent 
    }));

    const totalAmount = calculateTotalWithVat(itemsForCalc);
    const totalVatAmount = calculateTotalVat(itemsForCalc);

    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        customerId: order.customerId,
        orderId: order.id,
        invoiceDate: new Date(),
        dueDate: new Date(new Date().setDate(new Date().getDate() + 14)), 
        status: "draft", // Prisma schema InvoiceStatus enum
        notes: order.notes,
        totalAmount: totalAmount,
        totalVatAmount: totalVatAmount,
        items: {
          create: invoiceItemsData.map(item => ({
            inventoryItemId: item.inventoryItemId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            vatRatePercent: item.vatRatePercent,
            discountAmount: item.discountAmount,
            discountPercentage: item.discountPercentage,
          })),
        },
      },
      include: { customer: true, items: { include: { inventoryItem: true } } }, // Changed item to inventoryItem
    });
    return invoice;
  });
}

/**
 * Create a manual invoice
 */
export async function createManualInvoice(data: z.infer<typeof CreateInvoiceSchema>, companyId: string) {
  const validatedData = CreateInvoiceSchema.parse(data);

  return await prisma.$transaction(async (tx) => {
    const invoiceNumber = await generateInvoiceNumber(tx);

    const itemsForCreation = validatedData.items.map(itemInput => ({
      inventoryItemId: itemInput.itemId, // Map Zod itemId to Prisma inventoryItemId
      description: itemInput.description ?? undefined,
      quantity: new Decimal(itemInput.quantity),
      unitPrice: new Decimal(itemInput.unitPrice),
      vatRatePercent: new Decimal(itemInput.vatRatePercent),
      discountAmount: itemInput.discountAmount ? new Decimal(itemInput.discountAmount) : undefined,
      discountPercentage: itemInput.discountPercent ? new Decimal(itemInput.discountPercent) : undefined, // Map Zod discountPercent
    }));
    
    const itemsForCalc = itemsForCreation.map(item => ({...item})); // Already has Prisma model field names

    const totalAmount = calculateTotalWithVat(itemsForCalc);
    const totalVatAmount = calculateTotalVat(itemsForCalc);
    
    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        customerId: validatedData.customerId,
        invoiceDate: validatedData.invoiceDate,
        dueDate: validatedData.dueDate,
        status: "draft", // Default to draft as CreateInvoiceSchema doesn't define it.
        notes: validatedData.notes,
        vatReverseCharge: validatedData.vatReverseCharge,
        totalAmount: totalAmount, 
        totalVatAmount: totalVatAmount,
        items: {
          create: itemsForCreation, // Already mapped
        },
      },
      include: { customer: true, items: { include: { inventoryItem: true } } }, // Changed item to inventoryItem
    });
    return invoice;
  });
}

/**
 * Get a single invoice by ID
 */
export async function getInvoiceById(id: string): Promise<ActionResult<Invoice>> {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: { include: { addresses: true } },
        items: true,
        order: true, // Include related order if exists
      },
    });
    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }
    const mappedInvoice = mapPrismaInvoiceToLocal(invoice);
    return { success: true, data: mappedInvoice };
  } catch (error) {
     console.error('Failed to get invoice:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * List invoices with filtering and pagination
 */
export async function listInvoices(params: unknown) {
   try {
    const filters = invoiceFilterSchema.parse(params);
    const pagination = invoicePaginationSchema.parse(params);
    const { page, perPage, sortBy, sortDirection } = pagination;

    // Let Prisma infer the 'where' type
    const where: any = {}; // Use 'any' to avoid WhereInput type issues for now
    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.status) where.status = filters.status as any; 
    
    // Simplified date filtering logic
    if (filters.fromDate) {
      where.invoiceDate = { ...(where.invoiceDate || {}), gte: filters.fromDate };
    }
    if (filters.toDate) {
      where.invoiceDate = { ...(where.invoiceDate || {}), lte: filters.toDate };
    }

    if (filters.searchTerm) { 
       where.OR = [
        { invoiceNumber: { contains: filters.searchTerm, mode: 'insensitive' } },
        { notes: { contains: filters.searchTerm, mode: 'insensitive' } },
        { customer: { name: { contains: filters.searchTerm, mode: 'insensitive' } } },
      ];
     }

    const totalCount = await prisma.invoice.count({ where });
    const invoices = await prisma.invoice.findMany({ 
      where,
      include: { customer: true }, // Keep includes simple for now
      orderBy: { [sortBy]: sortDirection },
      skip: (page - 1) * perPage,
      take: perPage,
     });

    return {
      success: true,
      data: {
        items: invoices,
        meta: {
          page, perPage, totalCount, totalPages: Math.ceil(totalCount / perPage),
        },
      },
    };

  } catch (error) {
    console.error('Failed to list invoices:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Update invoice status (e.g., Draft -> Sent, Sent -> Paid)
 */
export async function updateInvoiceStatus(invoiceId: string, data: unknown): Promise<ActionResult<Invoice>> {
  try {
    const validatedData = updateInvoiceStatusSchema.parse(data);

    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: validatedData.status as any, // Use status from validated data
      },
       include: { // Ensure includes match mapping function
        customer: { include: { addresses: true } },
        items: true, 
        order: true, 
      },
    });

    // Map before returning
    const mappedInvoice = mapPrismaInvoiceToLocal(updatedInvoice);

    revalidatePath('/invoices');
    revalidatePath(`/invoices/${invoiceId}`);
    return { success: true, data: mappedInvoice };

  } catch (error) {
    console.error('Failed to update invoice status:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Update failed' };
  }
}

/**
 * Record payment for an invoice
 */
export async function recordPayment(invoiceId: string, data: unknown): Promise<ActionResult<Invoice>> {
  try {
    const validatedData = recordPaymentSchema.parse(data);

    // Logic to record payment and potentially update status to PAID
    // For now, just update status to PAID as an example
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: InvoiceStatus.PAID as any, // Assuming payment means PAID
        // TODO: Actually record payment details in Payment model
      },
      include: { // Ensure includes match mapping function
        customer: { include: { addresses: true } },
        items: true, 
        order: true, 
      },
    });

    // Map before returning
    const mappedInvoice = mapPrismaInvoiceToLocal(updatedInvoice);

    revalidatePath('/invoices');
    revalidatePath(`/invoices/${invoiceId}`);
    return { success: true, data: mappedInvoice };

  } catch (error) {
    console.error('Failed to record payment:', error);
     return { success: false, error: error instanceof Error ? error.message : 'Payment recording failed' };
  }
}

/**
 * Generate Finvoice XML for an invoice and return it for download
 */
export async function generateAndDownloadFinvoice(invoiceId: string) {
  try {
    // 1. Fetch the invoice with necessary relations
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: { include: { addresses: true } }, // Include addresses for buyer details
        items: { include: { inventoryItem: true } },      // Include item for potential details
        order: true, // Include order for OrderIdentifier
      },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // 2. --- FETCH SELLER SETTINGS --- 
    // IMPORTANT TODO: Replace placeholder settings below with actual data retrieval.
    // This should ideally query a dedicated 'Settings' table or user profile 
    // containing the seller's official company information required for Finvoice.
    // Using environment variables is generally NOT recommended for sensitive 
    // or frequently changing data like IBAN/BIC. 
    const sellerSettings = {
      // Example using env vars (less ideal) or defaults:
      companyName: process.env.SELLER_COMPANY_NAME || 'My Company Oy', 
      vatId: process.env.SELLER_VAT_ID || 'FI12345678',
      domicile: process.env.SELLER_DOMICILE || 'Helsinki',
      sellerIdentifier: process.env.SELLER_OVT_ID, // Optional OVT
      sellerIntermediatorAddress: process.env.SELLER_INTERMEDIATOR, // Optional
      bankAccountIBAN: process.env.SELLER_IBAN || 'FI0012345678901234', 
      bankAccountBIC: process.env.SELLER_BIC || 'NDEAFIHH',
      bankName: process.env.SELLER_BANK_NAME || 'Nordea',
      streetAddress: process.env.SELLER_STREET || 'Seller Street 1',
      postalCode: process.env.SELLER_POSTAL_CODE || '00100',
      city: process.env.SELLER_CITY || 'Helsinki',
      countryCode: process.env.SELLER_COUNTRY_CODE || 'FI',
      countryName: process.env.SELLER_COUNTRY_NAME || 'Finland',
    };
    // --- END FETCH SELLER SETTINGS --- 

    // Basic validation for required settings
    if (!sellerSettings.vatId || !sellerSettings.bankAccountIBAN || !sellerSettings.bankAccountBIC) {
        throw new Error('Missing required seller settings (VAT ID, IBAN, BIC) for Finvoice generation.');
    }

    // 3. Generate XML using the service
    // We need to map the Prisma Invoice type to the expected Invoice type for the service
    // Using 'as any' for now to bypass deep type checking, but proper mapping is recommended
    const finvoiceXml = generateFinvoiceXml(invoice as any, sellerSettings);

    // 4. Return XML content for download
    // In a real app, might return headers for direct download, 
    // but for Server Action -> Client Component, returning the string is often easier.
    return { success: true, data: { xml: finvoiceXml, filename: `finvoice_${invoice.invoiceNumber}.xml` } };

  } catch (error) {
    console.error('Failed to generate Finvoice XML:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error generating Finvoice' };
  }
}

/**
 * Create a Credit Note for an existing invoice
 */
export async function createCreditNote(originalInvoiceId: string): Promise<ActionResult<Invoice>> {
  return prisma.$transaction(async (tx) => {
    const originalInvoice = await tx.invoice.findUnique({
      where: { id: originalInvoiceId },
      include: { // Reverted to include
        items: { 
          include: { inventoryItem: true } // Ensure all necessary fields of InventoryItem are included by default or add select here if needed
        },
        customer: true, // Include full customer if needed downstream, otherwise select specific fields or remove
      },
    });

    if (!originalInvoice) {
      throw new Error("Original invoice not found");
    }
    if (originalInvoice.isCreditNote) {
      throw new Error("Cannot create a credit note from another credit note.");
    }
    if (originalInvoice.creditNoteId) { // Check if a credit note already exists for this invoice
        const existingCreditNote = await tx.invoice.findUnique({ where: { id: originalInvoice.creditNoteId }});
        if (existingCreditNote) {
            throw new Error(`Invoice ${originalInvoice.invoiceNumber} has already been credited by ${existingCreditNote.invoiceNumber}.`);
        }
    }

    const creditNoteNumber = await generateInvoiceNumber(tx);

    // Explicitly define the type for clarity and to ensure all fields are recognized
    // type ItemForCreditMap = InvoiceItem & { 
    //     inventoryItem: InventoryItem; 
    //     vatRatePercent: Prisma.Decimal; 
    //     discountAmount: Prisma.Decimal | null;
    //     discountPercentage: Prisma.Decimal | null;
    // };

    const creditedInvoiceItems = originalInvoice.items.map((item) => ({
      inventoryItemId: item.inventoryItemId,      
      description: item.description ?? item.inventoryItem.name, 
      quantity: item.quantity.negated(),           // Negate quantity for credit
      unitPrice: item.unitPrice,
      vatRatePercent: item.vatRatePercent,
      discountAmount: item.discountAmount,         
      discountPercentage: item.discountPercentage, 
    }));

    const totalVatAmount = calculateTotalVat(creditedInvoiceItems.map(item => ({...item, quantity: item.quantity.abs() })));
    const totalAmount = calculateTotalWithVat(creditedInvoiceItems.map(item => ({...item, quantity: item.quantity.abs() })));

    const newCreditNote = await tx.invoice.create({
      data: {
        invoiceNumber: creditNoteNumber,
        customerId: originalInvoice.customerId, 
        invoiceDate: new Date(),
        dueDate: new Date(), 
        status: PrismaInvoiceStatus.draft, // Corrected enum usage
        notes: `Credit note for invoice ${originalInvoice.invoiceNumber}`,
        isCreditNote: true,
        originalInvoiceId: originalInvoice.id,
        totalAmount: totalAmount.negated(), // Store as negative for credit note
        totalVatAmount: totalVatAmount.negated(), // Store as negative for credit note
        items: {
          create: creditedInvoiceItems.map(cnItem => ({ // map again to ensure no extra fields from ItemForCreditMap
            inventoryItemId: cnItem.inventoryItemId,
            description: cnItem.description,
            quantity: cnItem.quantity, // Already negated
            unitPrice: cnItem.unitPrice,
            vatRatePercent: cnItem.vatRatePercent,
            discountAmount: cnItem.discountAmount,
            discountPercentage: cnItem.discountPercentage,
          })),
        },
      },
      include: { customer: true, items: { include: { inventoryItem: true } } }, 
    });

    await tx.invoice.update({
      where: { id: originalInvoiceId },
      data: {
        status: PrismaInvoiceStatus.credited, // Corrected enum usage
        creditNoteId: newCreditNote.id, 
      },
    });

    revalidatePath('/invoices');
    revalidatePath(`/invoices/${originalInvoiceId}`);
    revalidatePath(`/invoices/${newCreditNote.id}`);
    
    // Instead of mapPrismaInvoiceToLocal, just return the Prisma object for now if map is complex
    return newCreditNote as any; // Cast to any to simplify return type for now
  });
}

// Finvoice generation action will be added later 
// Finvoice generation action will be added later 
