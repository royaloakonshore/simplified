/**
 * Localization utilities for invoice and document output
 * Provides translations for Finnish, Swedish, and English languages
 */

export type SupportedLanguage = 'FI' | 'SE' | 'EN';

interface InvoiceTranslations {
  vat: string;
  vatAmount: string;
  total: string;
  subtotal: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  paymentTerms: string;
  deliveryTerms: string;
  quantity: string;
  unitPrice: string;
  description: string;
  reference: string;
  buyerReference: string;
  sellerReference: string;
  customer: string;
  supplier: string;
  taxExempt: string;
  vatReverseCharge: string;
  quotation: string;
  workOrder: string;
  orderNumber: string;
  orderDate: string;
  deliveryDate: string;
  discount: string;
  discountPercent: string;
  discountAmount: string;
  netAmount: string;
  grossAmount: string;
  paymentDue: string;
  immediatePayment: string;
  netDays: string;
}

const translations: Record<SupportedLanguage, InvoiceTranslations> = {
  FI: {
    vat: 'ALV',
    vatAmount: 'ALV määrä',
    total: 'Yhteensä',
    subtotal: 'Välisumma',
    invoiceNumber: 'Laskunumero',
    invoiceDate: 'Laskun päiväys',
    dueDate: 'Eräpäivä',
    paymentTerms: 'Maksuehto',
    deliveryTerms: 'Toimitusehdot',
    quantity: 'Määrä',
    unitPrice: 'Yksikköhinta',
    description: 'Kuvaus',
    reference: 'Viite',
    buyerReference: 'Ostajan viite',
    sellerReference: 'Myyjän viite',
    customer: 'Asiakas',
    supplier: 'Toimittaja',
    taxExempt: 'Veroton',
    vatReverseCharge: 'Käännetty verovelvollisuus',
    quotation: 'Tarjous',
    workOrder: 'Työtilaus',
    orderNumber: 'Tilausnumero',
    orderDate: 'Tilauspäivä',
    deliveryDate: 'Toimituspäivä',
    discount: 'Alennus',
    discountPercent: 'Alennus %',
    discountAmount: 'Alennus €',
    netAmount: 'Nettomäärä',
    grossAmount: 'Bruttomäärä',
    paymentDue: 'Maksuaika',
    immediatePayment: 'Heti',
    netDays: 'päivää'
  },
  SE: {
    vat: 'Moms',
    vatAmount: 'Momsbelopp',
    total: 'Totalt',
    subtotal: 'Delsumma',
    invoiceNumber: 'Fakturanummer',
    invoiceDate: 'Fakturadatum',
    dueDate: 'Förfallodatum',
    paymentTerms: 'Betalningsvillkor',
    deliveryTerms: 'Leveransvillkor',
    quantity: 'Antal',
    unitPrice: 'Enhetspris',
    description: 'Beskrivning',
    reference: 'Referens',
    buyerReference: 'Köparens referens',
    sellerReference: 'Säljarens referens',
    customer: 'Kund',
    supplier: 'Leverantör',
    taxExempt: 'Skattefri',
    vatReverseCharge: 'Omvänd moms',
    quotation: 'Offert',
    workOrder: 'Arbetsorder',
    orderNumber: 'Ordernummer',
    orderDate: 'Orderdatum',
    deliveryDate: 'Leveransdatum',
    discount: 'Rabatt',
    discountPercent: 'Rabatt %',
    discountAmount: 'Rabatt belopp',
    netAmount: 'Nettobelopp',
    grossAmount: 'Bruttobelopp',
    paymentDue: 'Betalning förfaller',
    immediatePayment: 'Omedelbart',
    netDays: 'dagar'
  },
  EN: {
    vat: 'VAT',
    vatAmount: 'VAT Amount',
    total: 'Total',
    subtotal: 'Subtotal',
    invoiceNumber: 'Invoice Number',
    invoiceDate: 'Invoice Date',
    dueDate: 'Due Date',
    paymentTerms: 'Payment Terms',
    deliveryTerms: 'Delivery Terms',
    quantity: 'Quantity',
    unitPrice: 'Unit Price',
    description: 'Description',
    reference: 'Reference',
    buyerReference: 'Buyer Reference',
    sellerReference: 'Seller Reference',
    customer: 'Customer',
    supplier: 'Supplier',
    taxExempt: 'Tax Exempt',
    vatReverseCharge: 'VAT Reverse Charge',
    quotation: 'Quotation',
    workOrder: 'Work Order',
    orderNumber: 'Order Number',
    orderDate: 'Order Date',
    deliveryDate: 'Delivery Date',
    discount: 'Discount',
    discountPercent: 'Discount %',
    discountAmount: 'Discount Amount',
    netAmount: 'Net Amount',
    grossAmount: 'Gross Amount',
    paymentDue: 'Payment Due',
    immediatePayment: 'Immediate',
    netDays: 'days'
  }
};

/**
 * Get translation for a specific key and language
 */
export function getTranslation(language: SupportedLanguage, key: keyof InvoiceTranslations): string {
  return translations[language][key];
}

/**
 * Get all translations for a specific language
 */
export function getTranslations(language: SupportedLanguage): InvoiceTranslations {
  return translations[language];
}

/**
 * Format payment terms based on language and days
 */
export function formatPaymentTerms(language: SupportedLanguage, days: number | null): string {
  const t = getTranslations(language);
  
  if (days === null || days === 0) {
    return t.immediatePayment;
  }
  
  if (language === 'FI') {
    return `${days} ${t.netDays}`;
  } else if (language === 'SE') {
    return `${days} ${t.netDays}`;
  } else {
    return `Net ${days} ${t.netDays}`;
  }
}

/**
 * Format VAT reverse charge notice based on language
 */
export function formatVatReverseChargeNotice(language: SupportedLanguage): string {
  if (language === 'FI') {
    return 'Käännetty verovelvollisuus / VAT Reverse Charge';
  } else if (language === 'SE') {
    return 'Omvänd moms / VAT Reverse Charge';
  } else {
    return 'VAT Reverse Charge';
  }
}

/**
 * Format currency amount based on language preferences
 */
export function formatCurrency(amount: number | string, language: SupportedLanguage): string {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (language === 'FI') {
    return new Intl.NumberFormat('fi-FI', {
      style: 'currency',
      currency: 'EUR'
    }).format(numericAmount);
  } else if (language === 'SE') {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'EUR'
    }).format(numericAmount);
  } else {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(numericAmount);
  }
}

/**
 * Format date based on language preferences
 */
export function formatDate(date: Date | string, language: SupportedLanguage): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (language === 'FI') {
    return dateObj.toLocaleDateString('fi-FI');
  } else if (language === 'SE') {
    return dateObj.toLocaleDateString('sv-SE');
  } else {
    return dateObj.toLocaleDateString('en-US');
  }
}

/**
 * Get document type translation (invoice, quotation, work order)
 */
export function getDocumentTypeTranslation(
  language: SupportedLanguage, 
  documentType: 'invoice' | 'quotation' | 'work_order'
): string {
  const t = getTranslations(language);
  
  switch (documentType) {
    case 'invoice':
      return language === 'FI' ? 'Lasku' : language === 'SE' ? 'Faktura' : 'Invoice';
    case 'quotation':
      return t.quotation;
    case 'work_order':
      return t.workOrder;
    default:
      return '';
  }
}

/**
 * Determine appropriate language fallback
 */
export function getLanguageWithFallback(language: string | null | undefined): SupportedLanguage {
  if (language === 'FI' || language === 'SE' || language === 'EN') {
    return language;
  }
  return 'FI'; // Default to Finnish
} 