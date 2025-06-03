import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/db";
import {
  getServerSession,
  type NextAuthOptions,
  type DefaultSession,
} from "next-auth";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

export enum UserRole {
  user = "user",
  admin = "admin",
}

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth/adapters" {
  interface AdapterUser {
    login?: string;
    role?: UserRole;
    dashboardEnabled?: boolean;
    isTeamAdmin?: boolean;
    companyId?: string | null;
  }
}

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      firstName?: string | null;
      login?: string;
      role?: UserRole;
      dashboardEnabled?: boolean;
      isAdmin?: boolean;
      expires?: string;
      isTeamAdmin?: boolean;
      companyId?: string | null;
    };
    accessToken?: string;
  }

  export interface Profile {
    login: string;
  }

  interface User {
    role?: UserRole;
    login?: string;
    firstName?: string | null;
    expires?: string;
    isTeamAdmin?: boolean;
    isAdmin?: boolean;
    companyId?: string | null;
  }
}

const debugLog = (location: string, data: any) => {
  console.log(`[Auth Debug] ${location}:`, JSON.stringify(data, null, 2));
};

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "jsmith@example.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, req) {
        debugLog("authorize:entry", { email: credentials?.email });
        
        if (!credentials?.email || !credentials.password) {
          debugLog("authorize:missing_credentials", { email: credentials?.email });
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        debugLog("authorize:user_found", { 
          userId: user?.id,
          hasPassword: !!user?.hashedPassword 
        });

        if (!user) {
          return null;
        }

        if (!user.hashedPassword) {
          return null;
        }

        const isValidPassword = await bcrypt.compare(
          credentials.password,
          user.hashedPassword
        );

        if (!isValidPassword) {
          return null;
        }

        // Return type must match the User interface from next-auth
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: user.image,
          isAdmin: user.isAdmin,
        } as any; // Cast to any to bypass complex type issues between Prisma User and NextAuth User
      }
    }),
    EmailProvider({
      server: {
        host: "smtp.resend.com",
        port: 465,
        auth: {
          user: "resend",
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM || "onboarding@resend.dev",
    }),
  ],
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user, account, profile, email, credentials }) {
      debugLog("signIn:entry", {
        userFromArg: user ? JSON.parse(JSON.stringify(user)) : null,
        accountFromArg: account ? JSON.parse(JSON.stringify(account)) : null,
      });
      try {
        const userEmail = user?.email;
        if (!userEmail) {
           console.error("SignIn callback: No email found for user.");
           return false; // Cannot proceed without email
        }

        // Check if user exists (adapter might have already created one via email link)
        let existingUser = await prisma.user.findUnique({ where: { email: userEmail } });
        
        // If user doesn't exist yet (e.g., first time sign in with OAuth? Less likely with Email provider)
        // This check might be redundant if adapter always creates user before signIn
        if (!existingUser) {
            console.warn("SignIn callback: User not found by email, adapter should have created one.");
            // Optionally try finding by user.id if available from OAuth provider
            if (user.id) {
                existingUser = await prisma.user.findUnique({ where: { id: user.id }});
            }
            if (!existingUser) {
                 console.error("SignIn callback: Cannot find or verify user.");
                 return false;
            }
        }

        // Check if this is the very first user
        const userCount = await prisma.user.count();
        if (userCount === 1 && existingUser.role !== UserRole.admin) {
          console.log(`First user detected (${userEmail}). Promoting to admin.`);
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { role: UserRole.admin },
          });
        }

        return true; // Allow sign in
      } catch (error) {
        console.error("SignIn callback error:", error);
        return false;
      }
    },
    async jwt({ token, user, account, profile, trigger, isNewUser }) {
      debugLog("jwt:entry", {
        tokenIN: JSON.parse(JSON.stringify(token)),
        userIN: user ? JSON.parse(JSON.stringify(user)) : null,
        accountIN: account ? JSON.parse(JSON.stringify(account)) : null,
        triggerIN: trigger,
        isNewUserIN: isNewUser
      });

      // Handle initial sign-in or when user object is passed (e.g. after update)
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.email = user.email;
        // Fetch companyId if user object is present (e.g., on sign-in or update)
        // The 'user' object here might be from the provider or from a database refresh.
        // It's safer to re-fetch from DB to ensure we have the latest companyId.
        if (user.id) {
            const dbUser = await prisma.user.findUnique({
                where: { id: user.id },
                select: { companyId: true }
            });
            token.companyId = dbUser?.companyId;
        } else {
            // If user.id is not available, we cannot fetch companyId.
            // This case should be rare if user object is present.
            token.companyId = (user as any).companyId || null; 
        }
      }
      
      // If trigger is "update" and session data is passed
      if (trigger === "update" && profile) { // Assuming 'profile' might carry update data. Adjust if session data is passed differently.
        // Re-fetch user from DB to get potentially updated companyId
        if (token.id) {
            const dbUser = await prisma.user.findUnique({
                where: { id: token.id as string },
                select: { companyId: true, role: true, email: true } // Fetch other fields if they can be updated
            });
            if (dbUser) {
                token.companyId = dbUser.companyId;
                token.role = dbUser.role; // Example: also update role if it can change
                token.email = dbUser.email;
            }
        }
      }

      debugLog("jwt:exit_returning_token", { tokenOUT: JSON.parse(JSON.stringify(token)) });
      return token;
    },
    async session({ session, token }) { // For JWT strategy, 'token' is the decoded JWT
      debugLog("session:entry", {
        sessionIN: JSON.parse(JSON.stringify(session)),
        tokenIN: JSON.parse(JSON.stringify(token))
      });

      if (session?.user) {
        if (token?.id) session.user.id = token.id as string;
        if (token?.role) session.user.role = token.role as UserRole;
        if (token?.email) session.user.email = token.email as string;
        // Add companyId to session user
        session.user.companyId = token.companyId as string | null;
      } else {
        debugLog("session:warning_cannot_enrich_session_user", { 
          tokenExists: !!token, 
          tokenId: token?.id, 
          sessionUserExists: !!session?.user 
        });
      }

      debugLog("session:exit_returning_session", { sessionOUT: JSON.parse(JSON.stringify(session)) });
      return session;
    },
  },
  events: {
    async signOut({ session, token }) {
      debugLog("events:signOut", {
        sessionIN: session ? JSON.parse(JSON.stringify(session)) : null,
        tokenIN: token ? JSON.parse(JSON.stringify(token)) : null,
      });
    },
    // You can add other events like signIn, createUser, updateUser, linkAccount if needed for debugging
  },
  pages: {
    signIn: "/auth/signin",
    // signOut: "/auth/logout", // Removed for simplification
    error: "/auth/error",
    verifyRequest: "/auth/verify",
  },
};

export const getServerAuthSession = () => getServerSession(authOptions);
