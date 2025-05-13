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
  invoicePaginationSchema
} from '@/lib/schemas/invoice.schema';
import { InvoiceStatus, Invoice } from '@/lib/types/invoice.types';
import { OrderStatus } from '@/lib/types/order.types';
import { generateFinvoiceXml } from '@/lib/services/finvoice.service';
import { Customer, Address, AddressType } from '@/lib/types/customer.types';
import { InvoiceItem } from '@/lib/types/invoice.types';
import { UUID, createUUID, createDecimal } from '@/lib/types/branded';

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
    quantity: item.quantity.toNumber() as Decimal, 
    unitPrice: item.unitPrice.toNumber() as Decimal,
    vatRatePercent: item.vatRatePercent.toNumber() as Decimal,
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
      totalAmount: prismaInvoice.totalAmount.toNumber() as Decimal,
      totalVatAmount: prismaInvoice.totalVatAmount.toNumber() as Decimal,
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
async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear().toString().substring(2);
  const invoiceCount = await prisma.invoice.count({
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
export async function createInvoiceFromOrder(data: unknown): Promise<ActionResult<Invoice>> {
  try {
    const validatedData = createInvoiceFromOrderSchema.parse(data);
    
    const order = await prisma.order.findUnique({
      where: { id: validatedData.orderId },
      include: { items: { include: { item: true } }, customer: true },
    });

    if (!order) {
      throw new Error('Order not found');
    }
    if (order.status !== OrderStatus.SHIPPED) {
      throw new Error('Invoice can only be created from shipped orders');
    }
    
    const invoiceNumber = await generateInvoiceNumber();
    
    const invoiceItemsData = order.items.map((orderItem: typeof order.items[0]) => ({
      description: orderItem.item.name,
      quantity: orderItem.quantity,
      unitPrice: orderItem.unitPrice,
      vatRatePercent: new Decimal(24),
      item: {
        connect: { id: orderItem.itemId }
      }
    }));

    const totalVatAmount = calculateTotalVat(invoiceItemsData);
    const totalAmount = calculateTotalWithVat(invoiceItemsData);

    const invoice = await prisma.invoice.create({
      data: {
        customerId: order.customerId,
        orderId: order.id,
        invoiceNumber,
        invoiceDate: validatedData.invoiceDate,
        dueDate: validatedData.dueDate,
        status: InvoiceStatus.DRAFT as any,
        notes: validatedData.notes,
        totalAmount,
        totalVatAmount,
        items: {
          create: invoiceItemsData,
        },
      },
      include: {
        customer: true,
        items: true,
      },
    });

    // Map the created invoice before returning
    const mappedInvoice = mapPrismaInvoiceToLocal(invoice);

    revalidatePath('/invoices');
    revalidatePath(`/orders/${order.id}`);
    return { success: true, data: mappedInvoice };

  } catch (error) {
    console.error('Failed to create invoice from order:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Create a manual invoice
 */
export async function createManualInvoice(data: unknown): Promise<ActionResult<Invoice>> {
  try {
    const validatedData = CreateInvoiceSchema.parse(data);
    const invoiceNumber = await generateInvoiceNumber();

    const invoiceItemsData = validatedData.items.map(item => ({
      itemId: item.itemId,
      description: item.description,
      quantity: new Decimal(item.quantity),
      unitPrice: new Decimal(item.unitPrice),
      vatRatePercent: new Decimal(item.vatRatePercent),
    }));
    
    const totalVatAmount = calculateTotalVat(invoiceItemsData);
    const totalAmount = calculateTotalWithVat(invoiceItemsData);

    const invoice = await prisma.invoice.create({
      data: {
        customerId: validatedData.customerId,
        invoiceNumber,
        invoiceDate: validatedData.invoiceDate,
        dueDate: validatedData.dueDate,
        notes: validatedData.notes,
        totalAmount,
        totalVatAmount,
        items: {
          create: invoiceItemsData,
        },
      },
       include: {
        customer: true,
        items: { include: { item: true } },
      },
    });

    // Map the created invoice before returning
    const mappedInvoice = mapPrismaInvoiceToLocal(invoice);

    revalidatePath('/invoices');
    return { success: true, data: mappedInvoice };

  } catch (error) {
    console.error('Failed to create manual invoice:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
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
        items: { include: { item: true } },      // Include item for potential details
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
  try {
    // Use try/catch, double cast, and explicit Prisma.TransactionClient for tx type
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient): Promise<ActionResult<Invoice>> => {
      const originalInvoice = await tx.invoice.findUnique({
        where: { id: originalInvoiceId },
        include: {
          items: true,
          customer: true,
        },
      });

      if (!originalInvoice) {
        // Throw error inside transaction to cause rollback
        throw new Error('Original invoice not found');
      }
      if (originalInvoice.creditNoteId) {
        // Throw error inside transaction
        throw new Error('Invoice already credited');
      }

      const creditNoteNumber = await generateInvoiceNumber();

      // Define a simple inline type for the item based on usage
      type ItemForCreditMap = { 
          itemId: string; 
          description: string | null; 
          quantity: Decimal; 
          unitPrice: Decimal; 
          vatRatePercent: Decimal; 
      };

      // Create credit note items (negative quantities/amounts)
      const creditNoteItemsData = originalInvoice.items.map((item: ItemForCreditMap) => ({ // Use inline type
        itemId: item.itemId,
        description: `Credit: ${item.description ?? 'Item'}`,
        quantity: new Decimal(item.quantity).negated(),
        unitPrice: new Decimal(item.unitPrice),
        vatRatePercent: new Decimal(item.vatRatePercent),
      }));

      const totalVatAmount = calculateTotalVat(creditNoteItemsData);
      const totalAmount = calculateTotalWithVat(creditNoteItemsData);

      const creditNote = await tx.invoice.create({
        data: {
          customerId: originalInvoice.customerId,
          invoiceNumber: creditNoteNumber,
          invoiceDate: new Date(),
          dueDate: new Date(),
          status: 'credited' as any,
          notes: `Credit note for invoice ${originalInvoice.invoiceNumber}`,
          totalAmount,
          totalVatAmount,
          items: {
            create: creditNoteItemsData,
          },
          originalInvoiceId: originalInvoiceId,
        },
         include: {
          customer: { include: { addresses: true } }, // Include necessary relations for mapping
          items: true, 
          // No need to include order, originalInvoice, creditNote relations in the returned object
        },
      });

      await tx.invoice.update({
        where: { id: originalInvoiceId },
        data: {
          creditNote: {
            connect: { id: creditNote.id }
          },
          status: 'credited' as any,
        }
      });

      // Map the Prisma-typed creditNote to the local Invoice type before returning
      const mappedCreditNote = mapPrismaInvoiceToLocal(creditNote);

      // Return the success result from the transaction
      return { success: true, data: mappedCreditNote }; 
    }) as unknown as ActionResult<Invoice>; // Double cast: as unknown as ActionResult<Invoice>

    // If transaction was successful, revalidate paths and return the result
    if (result.success) {
        revalidatePath('/invoices');
        revalidatePath(`/invoices/${originalInvoiceId}`);
        // Assuming result.data contains the created credit note with its ID
        revalidatePath(`/invoices/${result.data.id}`); 
    }

    return result;

  } catch (error) {
    console.error('Failed to create credit note:', error);
    // Catch errors from the transaction (or setup before it)
    return { success: false, error: error instanceof Error ? error.message : 'Transaction failed' }; 
  }
}

// Finvoice generation action will be added later 