import { create } from 'xmlbuilder2';
import { XMLBuilder } from 'xmlbuilder2/lib/interfaces';
import { Invoice, InvoiceItem } from '@/lib/types/invoice.types';
import { Customer, Address } from '@/lib/types/customer.types';
import { Prisma } from '@prisma/client'; // For Decimal type usage

// TODO: Replace with actual settings retrieval (from DB or config)
interface SellerSettings {
  companyName: string;
  vatId: string; // Y-tunnus
  domicile: string; // Kotipaikka
  website?: string;
  sellerIdentifier?: string; // E.g., OVT-tunnus
  sellerIntermediatorAddress?: string; // Välittäjän OVT
  bankName?: string;
  bankAccountIBAN: string;
  bankAccountBIC: string;
  // Address details
  streetAddress: string;
  postalCode: string;
  city: string;
  countryCode: string; // e.g., 'FI'
  countryName: string; // e.g., 'Finland'
}

// Helper function to format dates as YYYY-MM-DD
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Helper function to format numbers to required decimal places (e.g., 2 for currency)
const formatDecimal = (value: number | Prisma.Decimal | null | undefined, places: number = 2): string => {
  if (value === null || value === undefined) return '0.00';
  const num = typeof value === 'number' ? value : Number(value);
  return num.toFixed(places);
};

/**
 * Generates a Finvoice 3.0 XML string compatible with Netvisor
 * 
 * @param invoice - The internal Invoice object with relations (Customer, Items)
 * @param settings - Seller party details
 * @returns The generated Finvoice XML as a string
 */
export function generateFinvoiceXml(invoice: Invoice, settings: SellerSettings): string {

  const finvoiceVersion = "3.0";
  const generationDate = new Date();

  const buyer = invoice.customer;
  const billingAddress = buyer.addresses?.find(a => a.type === 'billing');
  // TODO: Add better error handling if billing address is missing
  if (!billingAddress) {
    throw new Error(`Billing address not found for customer ${buyer.id}`);
  }

  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('Finvoice', { Version: finvoiceVersion });

  // Message Transmission Details (Optional, can be minimal)
  root.ele('MessageTransmissionDetails')
    .ele('MessageSenderDetails')
      .ele('FromIdentifier').txt(settings.sellerIdentifier || settings.vatId).up()
      .ele('FromIntermediator').txt(settings.sellerIntermediatorAddress || 'PSPBFIHH').up() // Default to bank network
    .up()
    .ele('MessageReceiverDetails')
      .ele('ToIdentifier').txt(buyer.ovtIdentifier || buyer.vatId || '').up()
      .ele('ToIntermediator').txt(buyer.intermediatorAddress || 'PSPBFIHH').up()
    .up()
    .ele('MessageDetails')
      .ele('MessageIdentifier').txt(`${invoice.invoiceNumber}-msg`).up() // Unique message ID
      .ele('MessageTimeStamp').txt(generationDate.toISOString()).up()
    .up();

  // Seller Party Details
  const sellerParty = root.ele('SellerPartyDetails');
  sellerParty.ele('SellerPartyIdentifier').txt(settings.vatId).up();
  sellerParty.ele('SellerOrganisationName').txt(settings.companyName).up();
  sellerParty.ele('SellerOrganisationTaxCode').txt(settings.vatId).up(); // Repeat VAT ID
  if (settings.sellerIdentifier) {
    sellerParty.ele('SellerCode', { CodeListAgencyIdentifier: 'OVT' }).txt(settings.sellerIdentifier).up();
  }

  // Seller Postal Address
  sellerParty.ele('SellerPostalAddressDetails')
    .ele('SellerStreetName').txt(settings.streetAddress).up()
    .ele('SellerTownName').txt(settings.city).up()
    .ele('SellerPostCodeIdentifier').txt(settings.postalCode).up()
    .ele('CountryCode').txt(settings.countryCode).up()
    .ele('CountryName').txt(settings.countryName).up();

  // Buyer Party Details
  const buyerParty = root.ele('BuyerPartyDetails');
  if (buyer.vatId) {
      buyerParty.ele('BuyerPartyIdentifier').txt(buyer.vatId).up();
      buyerParty.ele('BuyerOrganisationTaxCode').txt(buyer.vatId).up();
  }
  buyerParty.ele('BuyerOrganisationName').txt(buyer.name).up();
  if (buyer.ovtIdentifier) {
      buyerParty.ele('BuyerCode', { CodeListAgencyIdentifier: 'OVT' }).txt(buyer.ovtIdentifier).up();
  }

  // Buyer Postal Address
  buyerParty.ele('BuyerPostalAddressDetails')
    .ele('BuyerStreetName').txt(billingAddress.streetAddress).up()
    .ele('BuyerTownName').txt(billingAddress.city).up()
    .ele('BuyerPostCodeIdentifier').txt(billingAddress.postalCode).up()
    .ele('CountryCode').txt(billingAddress.countryCode).up()
    .ele('CountryName').txt('').up(); // Country Name often optional if Code provided

  // Invoice Details
  const invoiceDetails = root.ele('InvoiceDetails');
  invoiceDetails.ele('InvoiceTypeCode').txt('380').up(); // Standard Invoice
  invoiceDetails.ele('InvoiceNumber').txt(invoice.invoiceNumber).up();
  invoiceDetails.ele('InvoiceDate', { Format: 'CCYYMMDD' }).txt(formatDate(invoice.invoiceDate).replace(/-/g, '')).up();
  if (invoice.orderId) {
    invoiceDetails.ele('OrderIdentifier').txt(invoice.order?.orderNumber || invoice.orderId.toString()).up();
  }
  invoiceDetails.ele('InvoiceTotalVatExcludedAmount').txt(formatDecimal(Number(invoice.totalAmount) - Number(invoice.totalVatAmount))).up();
  invoiceDetails.ele('InvoiceTotalVatAmount').txt(formatDecimal(invoice.totalVatAmount)).up();
  invoiceDetails.ele('InvoiceTotalVatIncludedAmount').txt(formatDecimal(invoice.totalAmount)).up();
  invoiceDetails.ele('VatPointDate', { Format: 'CCYYMMDD' }).txt(formatDate(invoice.invoiceDate).replace(/-/g, '')).up(); // Usually invoice date
  invoiceDetails.ele('PaymentOverDueFinePercent').txt('0.00').up(); // TODO: Make configurable?
  invoiceDetails.ele('InvoiceVatAmountCurrencyIdentifier').txt('EUR').up(); // Assuming EUR
  invoiceDetails.ele('InvoiceTotalVatIncludedAmountCurrencyIdentifier').txt('EUR').up();

  // Payment Terms Details
  const paymentTerms = root.ele('PaymentTermsDetails');
  paymentTerms.ele('PaymentTermsCode').txt('14').up(); // TODO: Map from terms? Default: Net days
  paymentTerms.ele('PaymentTermsFreeText').txt('Maksuaika 14 päivää').up(); // TODO: Generate based on due date
  paymentTerms.ele('InvoiceDueDate', { Format: 'CCYYMMDD' }).txt(formatDate(invoice.dueDate).replace(/-/g, '')).up();

  // Seller Account Details (for payment)
  const sellerAccount = root.ele('SellerAccountDetails');
  sellerAccount.ele('SellerAccountID', { IdentificationSchemeName: 'IBAN' }).txt(settings.bankAccountIBAN).up();
  sellerAccount.ele('SellerBic', { IdentificationSchemeName: 'BIC' }).txt(settings.bankAccountBIC).up();
  if (settings.bankName) {
    sellerAccount.ele('SellerBankName').txt(settings.bankName).up();
  }

  // Invoice Recipient Details (often same as Buyer)
  // Minimal version: just provide BuyerPartyIdentifier
  root.ele('InvoiceRecipientDetails')
      .ele('InvoiceRecipientPartyIdentifier').txt(buyer.vatId || '').up();

  // Invoice Row Details
  invoice.items.forEach((item, index) => {
    const row = root.ele('InvoiceRow');
    const rowNumber = index + 1;
    const rowSubTotal = Number(item.quantity) * Number(item.unitPrice);
    const rowVatAmount = rowSubTotal * (Number(item.vatRatePercent) / 100);

    row.ele('RowPositionIdentifier').txt(rowNumber.toString()).up();
    row.ele('ArticleName').txt(item.description).up();
    row.ele('DeliveredQuantity', { QuantityUnitCode: 'kpl' }).txt(formatDecimal(item.quantity, 3)).up(); // TODO: Get UnitCode from item
    row.ele('UnitPriceAmount').txt(formatDecimal(item.unitPrice)).up();
    row.ele('RowVatRatePercent').txt(formatDecimal(item.vatRatePercent, 0)).up(); // VAT Rate as integer or 0 decimal
    row.ele('RowVatAmount').txt(formatDecimal(rowVatAmount)).up();
    row.ele('RowVatExcludedAmount').txt(formatDecimal(rowSubTotal)).up();
    row.ele('RowAmount').txt(formatDecimal(rowSubTotal + rowVatAmount)).up(); // Total for the row including VAT
    row.ele('RowVatCategoryCode').txt('S').up(); // TODO: Determine VAT category code (S=Standard, AE=Exempt, etc.)
  });

  // Epi Details (Electronic Payment Information - Finnish specific)
  const epi = root.ele('EpiDetails');
  epi.ele('EpiIdentificationDetails')
    .ele('EpiDate', { Format: 'CCYYMMDD' }).txt(formatDate(generationDate).replace(/-/g, '')).up();
  epi.ele('EpiPartyDetails') // Payer details (usually the Buyer)
    .ele('EpiBeneficiaryPartyDetails') // Payee details (Seller)
      .ele('EpiNameAddressDetails').txt(settings.companyName).up()
      .ele('EpiAccountID', { IdentificationSchemeName: 'IBAN' }).txt(settings.bankAccountIBAN).up()
      .ele('EpiBei', { IdentificationSchemeName: 'BIC' }).txt(settings.bankAccountBIC).up()
    .up();
  epi.ele('EpiPaymentInstructionDetails')
    .ele('EpiReference').txt(generateFinnishReference(invoice.invoiceNumber)).up() // Generate Finnish RF reference
    .ele('EpiRemittanceInfoIdentifier', { IdentificationSchemeName: 'ISO' }).txt(generateFinnishReference(invoice.invoiceNumber)).up() // Repeat reference
    .ele('EpiInstructedAmount', { AmountCurrencyIdentifier: 'EUR' }).txt(formatDecimal(invoice.totalAmount)).up()
    .ele('EpiCharge', { ChargeOption: 'SHA' }).up() // Shared charges
    .ele('EpiDateOptionDate', { Format: 'CCYYMMDD' }).txt(formatDate(invoice.dueDate).replace(/-/g, '')).up();

  return root.end({ prettyPrint: true });
}

/**
 * Generates a Finnish bank reference number (viitenumero) using RF format.
 * Based on ISO 11649 standard.
 * Basic implementation - assumes invoice number is numeric or can be prefixed.
 */
function generateFinnishReference(invoiceNumber: string): string {
  // Clean the base number: Remove non-digits, limit length if necessary
  const base = invoiceNumber.replace(/\D/g, '').slice(0, 20); // Max length for RF base
  
  if (!base) {
      return 'RF000'; // Fallback if invoice number has no digits
  }

  // Calculate checksum for the base number (Modulo 97)
  // Add RF00 (R=27, F=15) prefix shifted number representation
  const checkInput = `${base}271500`; 
  let checksum = 98 - bigIntModulo(checkInput, 97);
  const checksumStr = checksum.toString().padStart(2, '0');

  return `RF${checksumStr}${base}`;
}

// Helper for BigInt modulo operation as standard % doesn't work directly for large strings
function bigIntModulo(dividendStr: string, divisor: number): number {
    let remainder = 0;
    for (let i = 0; i < dividendStr.length; i++) {
        remainder = (remainder * 10 + parseInt(dividendStr[i], 10)) % divisor;
    }
    return remainder;
} 