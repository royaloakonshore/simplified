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

      // Handle initial sign-in: if 'account' and 'user' are present, it's a sign-in event.
      if (account && user) {
        debugLog("jwt:initial_signin_event_processing", { userId: user.id, userRole: user.role, userEmail: user.email });
        return {
          ...token, // Preserve existing token properties (like sub, iat, exp)
          id: user.id,
          role: user.role,
          email: user.email,
          // name: user.name, // Default token might already have name
          // picture: user.image, // Default token might already have picture (image)
        };
      }

      // For subsequent requests, 'token' is passed. 'user' and 'account' are undefined.
      // If token needs refreshing (e.g., access token expiry), do it here.
      // For now, just return the token.
      debugLog("jwt:exit_returning_token", { tokenOUT: JSON.parse(JSON.stringify(token)) });
      return token;
    },
    async session({ session, token }) { // For JWT strategy, 'token' is the decoded JWT
      debugLog("session:entry", {
        sessionIN: JSON.parse(JSON.stringify(session)),
        tokenIN: JSON.parse(JSON.stringify(token))
      });

      if (session?.user && token?.id) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        if (token.email) {
          session.user.email = token.email as string;
        }
        // session.user.name = token.name as string; // if you add name to token
        // session.user.image = token.picture as string; // if you add picture to token
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
