# Netvisor Finvoice XML Import Integration

## Overview

This document outlines the research findings for integrating our ERP system's invoice export with Netvisor's Finvoice XML import functionality. Netvisor supports importing sales invoices in Finvoice XML format, which can streamline accounting workflows.

## Current Status

✅ **Invoice Detail Fields Verification**: All Finnish invoice detail fields are properly implemented and displaying correctly:
- **Viitteenne** (Your Reference) → `invoice.customer.buyerReference`
- **Asiakasnumero** (Customer Number) → `invoice.customerNumber`
- **Viitteemme** (Our Reference) → `invoice.ourReference`
- **Toimituspäivä** (Delivery Date) → `invoice.deliveryDate`
- **Toimitustapa** (Delivery Method) → `invoice.deliveryMethod`
- **Maksuehdot** (Payment Terms) → `invoice.paymentTermsDays`
- **Huomautusaika** (Complaint Period) → `invoice.complaintPeriod`
- **Viivästyskorko** (Penalty Interest) → `invoice.penaltyInterest`

✅ **Existing Finvoice Export**: We have a comprehensive Finvoice 3.0 XML generation service in `src/lib/services/finvoice.service.ts`

## Netvisor Requirements Research

### Prerequisites for Netvisor Import

1. **Software Interface Service Activation**:
   - Must activate "Netvisor invoice data import (Finvoice)" integration
   - Enable Software interface service in Company menu > API > Api identifiers
   - Each user must create their own API identifiers

2. **Required API Resources**:
   - `Customer.nv` - Customer management
   - `Customerlist.nv` - Customer listing
   - `Product.nv` - Product management
   - `Productlist.nv` - Product listing
   - `Salesinvoice.nv` - Sales invoice operations

3. **Supported Finvoice Versions**:
   - Minimum: Finvoice 1.2
   - Our implementation: Finvoice 3.0 ✅

### Import Process

1. Navigate to Company menu > Data import
2. Choose "Invoice/payment XML"
3. Upload Finvoice XML file
4. System automatically creates customers and products if not found
5. Invoices are imported and linked to existing/new customers and products

### Data Mapping Analysis

#### Minimum Required Fields (Netvisor)
```xml
<Finvoice>
  <SellerPartyDetails>
    <SellerOrganisationTaxCode>FI12345678</SellerOrganisationTaxCode>
  </SellerPartyDetails>
  <BuyerPartyDetails>
    <BuyerOrganisationName>Customer Name</BuyerOrganisationName>
  </BuyerPartyDetails>
  <InvoiceDetails>
    <InvoiceNumber>100</InvoiceNumber>
    <InvoiceDate Format="CCYYMMDD">20230124</InvoiceDate>
    <InvoiceDueDate Format="CCYYMMDD">20230207</InvoiceDueDate>
  </InvoiceDetails>
  <InvoiceRow>
    <ArticleName>Product Name</ArticleName>
    <DeliveredQuantity QuantityUnitCode="pcs">10,00</DeliveredQuantity>
    <RowAmount AmountCurrencyIdentifier="EUR">100,00</RowAmount>
  </InvoiceRow>
</Finvoice>
```

#### Our Current Implementation Coverage

✅ **Covered Fields**:
- SellerOrganisationTaxCode
- BuyerOrganisationName
- InvoiceNumber
- InvoiceDate
- InvoiceDueDate
- ArticleName (from item description)
- DeliveredQuantity
- RowAmount

✅ **Enhanced Fields We Support**:
- MessageTransmissionDetails
- SellerPostalAddressDetails
- BuyerPostalAddressDetails
- InvoiceRecipientDetails
- RowDiscountPercent/RowDiscountAmount
- RowVatRatePercent
- EpiDetails (Finnish payment reference)

### Compatibility Assessment

#### ✅ Compatible Elements
- **XML Structure**: Our Finvoice 3.0 structure is compatible with Netvisor
- **Required Fields**: All minimum required fields are present
- **Date Formats**: Using correct CCYYMMDD format
- **Currency**: EUR currency properly specified
- **VAT Handling**: Proper VAT rate and reverse charge support

#### ⚠️ Areas Requiring Review

1. **Numeric Formatting**:
   - **Current Issue**: Our implementation has commented out `formatDecimal` calls
   - **Required**: Netvisor expects proper decimal formatting (e.g., "10,00" not "10.00")
   - **Action**: Uncomment and fix decimal formatting in finvoice.service.ts

2. **Quantity Unit Codes**:
   - **Current**: Hardcoded to 'PCE'
   - **Improvement**: Map from inventory item unit of measure
   - **Netvisor Example**: Uses 'kpl' (Finnish) or 'pcs' (English)

3. **Customer Identification**:
   - **Current**: Uses VAT ID for customer matching
   - **Netvisor**: Prefers consistent customer codes between systems
   - **Recommendation**: Ensure customer codes are synchronized

4. **Product Codes**:
   - **Current**: Uses item description only
   - **Enhancement**: Include ArticleIdentifier (SKU) for better product matching

### Implementation Recommendations

#### High Priority Fixes

1. **Fix Decimal Formatting**:
```typescript
// Replace commented formatDecimal calls with proper Finnish number formatting
const formatDecimal = (value: string | number | Decimal | null | undefined, places: number = 2): string => {
  if (value === null || value === undefined) return new Decimal(0).toFixed(places).replace('.', ',');
  return new Decimal(value).toFixed(places).replace('.', ',');
};
```

2. **Add Product SKU Support**:
```xml
<InvoiceRow>
  <ArticleIdentifier>SKU123</ArticleIdentifier>
  <ArticleName>Product Name</ArticleName>
  <!-- ... -->
</InvoiceRow>
```

3. **Improve Unit Code Mapping**:
```typescript
// Map from inventory item unit of measure
const unitCode = item.inventoryItem?.unitOfMeasure || 'PCE';
row.ele('DeliveredQuantity', { QuantityUnitCode: unitCode })
```

#### Medium Priority Enhancements

1. **Customer Code Synchronization**:
   - Add customer code field to Customer model
   - Use consistent codes between ERP and Netvisor

2. **Enhanced Error Handling**:
   - Validate required fields before XML generation
   - Provide clear error messages for missing data

3. **Testing Framework**:
   - Create test cases with Netvisor minimum/maximum examples
   - Validate XML against Netvisor import requirements

### Testing Strategy

1. **Unit Tests**:
   - Test XML generation with minimum required fields
   - Test with maximum field coverage
   - Validate decimal formatting and date formats

2. **Integration Testing**:
   - Test actual import into Netvisor test environment
   - Verify customer and product creation
   - Validate invoice data accuracy

3. **Regression Testing**:
   - Ensure existing PDF generation still works
   - Verify email sending functionality remains intact

## Next Steps

1. **Immediate** (1-2 hours):
   - Fix decimal formatting in finvoice.service.ts
   - Add product SKU support
   - Improve unit code mapping

2. **Short Term** (4-6 hours):
   - Create comprehensive test suite
   - Add validation for required fields
   - Document customer code synchronization process

3. **Medium Term** (8-12 hours):
   - Implement customer code synchronization
   - Add Netvisor import testing
   - Create user documentation for Netvisor workflow

## Conclusion

Our current Finvoice implementation provides a solid foundation for Netvisor integration. With minor adjustments to decimal formatting and enhanced product identification, we can achieve full compatibility with Netvisor's import requirements. The existing XML structure and field coverage already meet or exceed Netvisor's minimum requirements.

## References

- [Netvisor Finvoice Import Guide](https://support.netvisor.fi/en/support/solutions/articles/77000498451-finvoice-import)
- [Finvoice Standard Documentation](https://www.finanssiala.fi/en/topics/finvoice/)
- Current Implementation: `src/lib/services/finvoice.service.ts`
