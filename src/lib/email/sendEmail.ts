import { Resend } from "resend";
import { WelcomeEmail } from "./templates/WelcomeEmail";
import { createElement } from "react";
import { SupportedLanguage } from "./templates/OrderEmail";

const resend = new Resend(process.env.RESEND_API_KEY || "");

export async function sendWelcomeEmail(
  to: string, 
  name: string, 
  language: SupportedLanguage = "EN"
) {
  const subjectMap = {
    FI: "Tervetuloa!",
    SE: "Välkommen!",
    EN: "Welcome!"
  } as const;

  await resend.emails.send({
    from: process.env.EMAIL_FROM || "no-reply@yourdomain.com",
    to,
    subject: subjectMap[language],
    react: createElement(WelcomeEmail, { name, language }),
  });
}
