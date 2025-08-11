import React from "react";
import { Order, Customer } from "@prisma/client";

// Supported languages for email copy
export type SupportedLanguage = "EN" | "FI" | "SE";

interface Props {
  order: Order;
  customer: Customer;
  language?: SupportedLanguage;
}

const COPY: Record<SupportedLanguage, { 
  greeting: string; 
  intro: string; 
  outro: string;
  footer: string;
  contact: string;
  validity: string;
}> = {
  EN: {
    greeting: "Hello",
    intro: "Please find attached quotation",
    outro: "If you have any questions, feel free to contact us.",
    footer: "This quotation is valid for 30 days from the date of issue.",
    contact: "Best regards",
    validity: "Valid until"
  },
  FI: {
    greeting: "Hei",
    intro: "Liitteenä tarjous",
    outro: "Mikäli sinulla on kysyttävää, otathan yhteyttä.",
    footer: "Tämä tarjous on voimassa 30 päivää tarjouksen päivämäärästä.",
    contact: "Ystävällisin terveisin",
    validity: "Voimassa asti"
  },
  SE: {
    greeting: "Hej",
    intro: "Vänligen hitta bifogad offert",
    outro: "Om du har några frågor är du välkommen att kontakta oss.",
    footer: "Denna offert är giltig i 30 dagar från utfärdandedatum.",
    contact: "Med vänliga hälsningar",
    validity: "Giltig till"
  }
};

export function OrderEmail({ order, customer, language = "EN" }: Props) {
  const copy = COPY[language] ?? COPY.EN;
  
  // Calculate validity date (30 days from order date)
  const orderDate = new Date(order.orderDate);
  const validityDate = new Date(orderDate);
  validityDate.setDate(orderDate.getDate() + 30);
  
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', lineHeight: '1.6' }}>
      <p>
        {copy.greeting} {customer.name},
      </p>
      <p>
        {copy.intro} <strong>{order.orderNumber}</strong>.
      </p>
      <p>{copy.outro}</p>
      <br />
      <p style={{ fontSize: '14px', color: '#666' }}>
        {copy.validity}: {validityDate.toLocaleDateString()}
      </p>
      <p style={{ fontSize: '14px', color: '#666' }}>{copy.footer}</p>
      <br />
      <p>{copy.contact},</p>
      <p>Your Company Team</p>
    </div>
  );
}
