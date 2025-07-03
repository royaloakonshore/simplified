import React from "react";
import { Invoice, Customer } from "@prisma/client";

type SupportedLanguage = "EN" | "FI" | "SE";

interface Props {
  invoice: Invoice;
  customer: Customer;
  language?: SupportedLanguage;
}

// Simple copy deck for invoice email body in three languages
const COPY: Record<SupportedLanguage, { greeting: string; intro: string; thanks: string }> = {
  EN: {
    greeting: "Hello",
    intro: "Please find attached invoice",
    thanks: "Thank you for your business."
  },
  FI: {
    greeting: "Hei",
    intro: "Liitteenä lasku",
    thanks: "Kiitos yhteistyöstä."
  },
  SE: {
    greeting: "Hej",
    intro: "Vänligen hitta bifogad faktura",
    thanks: "Tack för ert samarbete."
  }
};

export function InvoiceEmail({ invoice, customer, language = "EN" }: Props) {
  const copy = COPY[language] ?? COPY.EN;

  return (
    <div>
      <p>{copy.greeting} {customer.name},</p>
      <p>
        {copy.intro} <strong>{invoice.invoiceNumber}</strong>.
      </p>
      <p>{copy.thanks}</p>
    </div>
  );
} 