import NextAuth from 'next-auth';
import CredentialsProvider from "next-auth/providers/credentials";
// import EmailProvider from "next-auth/providers/email"; // Temporarily commented out
import { authOptions } from "@/lib/auth"; // Import the centralized authOptions

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
