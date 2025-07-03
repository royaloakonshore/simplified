import React from "react";
import { Order, Customer } from "@prisma/client";

// Supported languages for email copy
export type SupportedLanguage = "EN" | "FI" | "SE";

interface Props {
  order: Order;
  customer: Customer;
  language?: SupportedLanguage;
}

const COPY: Record<SupportedLanguage, { greeting: string; intro: string; outro: string }> = {
  EN: {
    greeting: "Hello",
    intro: "Please find attached quotation",
    outro: "If you have any questions, feel free to contact us."
  },
  FI: {
    greeting: "Hei",
    intro: "Liitteenä tarjous",
    outro: "Mikäli sinulla on kysyttävää, otathan yhteyttä."
  },
  SE: {
    greeting: "Hej",
    intro: "Vänligen hitta bifogad offert",
    outro: "Om du har några frågor är du välkommen att kontakta oss."
  }
};

export function OrderEmail({ order, customer, language = "EN" }: Props) {
  const copy = COPY[language] ?? COPY.EN;
  return (
    <div>
      <p>
        {copy.greeting} {customer.name},
      </p>
      <p>
        {copy.intro} <strong>{order.orderNumber}</strong>.
      </p>
      <p>{copy.outro}</p>
    </div>
  );
}
