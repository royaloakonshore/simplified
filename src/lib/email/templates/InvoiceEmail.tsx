import React from "react";
import { Invoice, Customer } from "@prisma/client";

type SupportedLanguage = "EN" | "FI" | "SE";

interface Props {
  invoice: Invoice;
  customer: Customer;
  language?: SupportedLanguage;
}

// Comprehensive copy deck for invoice email body in three languages
const COPY: Record<SupportedLanguage, { 
  greeting: string; 
  intro: string; 
  thanks: string;
  footer: string;
  contact: string;
}> = {
  EN: {
    greeting: "Hello",
    intro: "Please find attached invoice",
    thanks: "Thank you for your business.",
    footer: "If you have any questions about this invoice, please don't hesitate to contact us.",
    contact: "Best regards"
  },
  FI: {
    greeting: "Hei",
    intro: "Liitteenä lasku",
    thanks: "Kiitos yhteistyöstä.",
    footer: "Jos sinulla on kysyttävää tästä laskusta, ota yhteyttä.",
    contact: "Ystävällisin terveisin"
  },
  SE: {
    greeting: "Hej",
    intro: "Vänligen hitta bifogad faktura",
    thanks: "Tack för ert samarbete.",
    footer: "Om du har några frågor om denna faktura, tveka inte att kontakta oss.",
    contact: "Med vänliga hälsningar"
  }
};

export function InvoiceEmail({ invoice, customer, language = "EN" }: Props) {
  const copy = COPY[language] ?? COPY.EN;

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', lineHeight: '1.6' }}>
      <p>{copy.greeting} {customer.name},</p>
      <p>
        {copy.intro} <strong>{invoice.invoiceNumber}</strong>.
      </p>
      <p>{copy.thanks}</p>
      <br />
      <p style={{ fontSize: '14px', color: '#666' }}>{copy.footer}</p>
      <br />
      <p>{copy.contact},</p>
      <p>Your Company Team</p>
    </div>
  );
} 