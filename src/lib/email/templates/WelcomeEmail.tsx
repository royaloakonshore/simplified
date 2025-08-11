import React from 'react';
import { SupportedLanguage } from './OrderEmail';

interface WelcomeEmailProps {
  name: string;
  language?: SupportedLanguage;
}

const COPY: Record<SupportedLanguage, { greeting: string; thanks: string }> = {
  EN: {
    greeting: "Welcome",
    thanks: "Thanks for joining us!"
  },
  FI: {
    greeting: "Tervetuloa",
    thanks: "Kiitos liittymisestä!"
  },
  SE: {
    greeting: "Välkommen",
    thanks: "Tack för att du anslöt dig!"
  }
};

export function WelcomeEmail({ name, language = "EN" }: WelcomeEmailProps) {
  const copy = COPY[language] ?? COPY.EN;
  
  return (
    <div>
      <h1>{copy.greeting}, {name}!</h1>
      <p>{copy.thanks}</p>
    </div>
  );
}
