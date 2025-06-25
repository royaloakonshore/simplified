import { create } from 'xmlbuilder2';
import { Invoice } from '@/lib/types/invoice.types';
import Decimal from 'decimal.js';
import { 
  getLanguageWithFallback, 
  formatPaymentTerms, 
  formatVatReverseChargeNotice,
  type SupportedLanguage 
} from '@/lib/utils/localization';

// TODO: Replace with actual settings retrieval (from DB or config)
export interface SellerSettings {
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
// const formatDecimal = (value: string | number | Decimal | null | undefined, places: number = 2): string => {
//   if (value === null || value === undefined) return new Decimal(0).toFixed(places);
//   return new Decimal(value).toFixed(places);
// };

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
  const customerLanguage = getLanguageWithFallback(buyer.language);
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
  invoiceDetails.ele('InvoiceTotalVatExcludedAmount').txt('0.00'/*formatDecimal(Number(invoice.totalAmount) - Number(invoice.totalVatAmount))*/).up();
  invoiceDetails.ele('InvoiceTotalVatAmount').txt('0.00'/*formatDecimal(invoice.totalVatAmount)*/).up();
  invoiceDetails.ele('InvoiceTotalVatIncludedAmount').txt('0.00'/*formatDecimal(invoice.totalAmount)*/).up();
  invoiceDetails.ele('VatPointDate', { Format: 'CCYYMMDD' }).txt(formatDate(invoice.invoiceDate).replace(/-/g, '')).up(); // Usually invoice date
  invoiceDetails.ele('PaymentOverDueFinePercent').txt('0.00').up(); // TODO: Make configurable?
  invoiceDetails.ele('InvoiceVatAmountCurrencyIdentifier').txt('EUR').up(); // Assuming EUR
  invoiceDetails.ele('InvoiceTotalVatIncludedAmountCurrencyIdentifier').txt('EUR').up();

  // Payment Terms Details
  const paymentTerms = root.ele('PaymentTermsDetails');
  
  // Calculate payment days from invoice date to due date
  const paymentDays = Math.max(0, Math.ceil((new Date(invoice.dueDate).getTime() - new Date(invoice.invoiceDate).getTime()) / (1000 * 60 * 60 * 24)));
  const localizedPaymentTerms = formatPaymentTerms(customerLanguage, paymentDays);
  
  paymentTerms.ele('PaymentTermsCode').txt(paymentDays > 0 ? paymentDays.toString() : '0').up();
  paymentTerms.ele('PaymentTermsFreeText').txt(localizedPaymentTerms).up();
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

    // Calculate net unit price and line total considering discounts
    const unitPrice = new Decimal(item.unitPrice || 0);
    const quantity = new Decimal(item.quantity || 0);
    const lineSubTotalBeforeDiscount = unitPrice.times(quantity);
    let lineNetSubTotal = lineSubTotalBeforeDiscount; // This is RowVatExcludedAmount

    if (item.discountPercent && new Decimal(item.discountPercent).gt(0)) {
      const discountMultiplier = new Decimal(1).minus(new Decimal(item.discountPercent).div(100));
      lineNetSubTotal = lineSubTotalBeforeDiscount.times(discountMultiplier);
    } else if (item.discountAmount && new Decimal(item.discountAmount).gt(0)) {
      lineNetSubTotal = lineSubTotalBeforeDiscount.minus(new Decimal(item.discountAmount));
      if (lineNetSubTotal.lt(0)) lineNetSubTotal = new Decimal(0); // Ensure not negative
    }

    const currentVatRate = new Decimal(item.vatRatePercent || 0);

    row.ele('RowPositionIdentifier').txt(rowNumber.toString()).up();
    // ArticleIdentifier can be added if available (e.g., item.sku)
    row.ele('ArticleName').txt(item.description || 'N/A').up();
    // TODO: Get UnitCode from item if available, default to 'PCE' (piece) or 'kpl' if appropriate
    row.ele('DeliveredQuantity', { QuantityUnitCode: 'PCE' }).txt('0.000'/*formatDecimal(quantity, 3)*/).up();
    row.ele('UnitPriceAmount').txt('0.00'/*formatDecimal(unitPrice)*/).up(); // Original unit price

    // Add discount information if present
    if (item.discountPercent && new Decimal(item.discountPercent).gt(0)) {
      row.ele('RowDiscountPercent').txt('0.00'/*formatDecimal(item.discountPercent)*/).up();
      // Optionally: Add RowDiscountBaseAmount (lineSubTotalBeforeDiscount) and RowDiscountAmountCalculated if needed by recipient system
    }
    if (item.discountAmount && new Decimal(item.discountAmount).gt(0) && !(item.discountPercent && new Decimal(item.discountPercent).gt(0))) {
      // Only add fixed discount amount if percentage discount was not applied (to avoid double listing if both exist but % took precedence)
      row.ele('RowDiscountAmount').txt('0.00'/*formatDecimal(item.discountAmount)*/).up();
    }

    row.ele('RowVatExcludedAmount').txt('0.00'/*formatDecimal(lineNetSubTotal)*/).up(); // Net amount after discount

    if (invoice.vatReverseCharge) {
      row.ele('RowVatRatePercent').txt('0').up();
      row.ele('RowVatCode').txt('AE').up(); // AE = VAT Reverse Charge
      row.ele('RowVatCategoryCode').txt('AE').up(); // Or standard specific code like 'VATEX-EU-AE' if available
      // Add localized free text for reverse charge
      row.ele('RowFreeText').txt(formatVatReverseChargeNotice(customerLanguage)).up();
      // rowVatAmountValue remains 0
    } else {
      row.ele('RowVatRatePercent').txt('0'/*formatDecimal(currentVatRate, 0)*/).up();
      const rowVatAmount = lineNetSubTotal.times(currentVatRate.div(100));
      // Determine RowVatCategoryCode based on actual VAT rate
      if (currentVatRate.equals(0)) {
        row.ele('RowVatCategoryCode').txt('Z').up(); // Zero-rated goods
      } else {
        row.ele('RowVatCategoryCode').txt('S').up(); // Standard VAT rate applied
      }
      row.ele('RowVatAmount').txt('0.00'/*formatDecimal(rowVatAmount)*/).up();
      row.ele('RowAmount').txt('0.00'/*formatDecimal(lineNetSubTotal.plus(rowVatAmount))*/).up(); // Total for the row including VAT
    }
    
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
    .ele('EpiInstructedAmount', { AmountCurrencyIdentifier: 'EUR' }).txt('0.00'/*formatDecimal(invoice.totalAmount)*/).up()
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
  // Using BigInt for potentially long numbers, as standard number type might lose precision.
  const num = BigInt(checkInput);
  const checksumDigit = 98 - Number(num % 97n); // Modulo 97 for checksum calculation

  // If checksum is 1 or 0, it should be 01 or 00.
  const checksumString = checksumDigit < 10 ? `0${checksumDigit}` : checksumDigit.toString();

  return `RF${checksumString}${base}`;
} 