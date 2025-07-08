/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */
import { initTRPC, TRPCError, type inferAsyncReturnType } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import { getServerAuthSession } from "../auth";
import { prisma } from "../db";
// No direct import from './root' here to avoid potential circular dependencies at init time.

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await getServerAuthSession();
  return {
    db: prisma,
    session,
    ...opts,
  };
};

// Context type used by tRPC initialization
export type CreateContextReturn = inferAsyncReturnType<typeof createTRPCContext>;

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<CreateContextReturn>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Export reusable router and procedure creators.
 */
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory; // Export createCallerFactory

/**
 * Create a server-side caller factory for the `appRouter`.
 * This is used to create a caller instance that can invoke procedures programmatically.
 */
// REMOVED: import { appRouter } from './root'; 

// REMOVED: const createCallerInner = createCallerFactory(appRouter); 

// REMOVED: type TrpcCaller = ReturnType<typeof createCallerInner>;

// REMOVED: export type ContextWithCaller = CreateContextReturn & {
// REMOVED:   caller: TrpcCaller;
// REMOVED: };

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure;

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Session or user information is missing",
    });
  }
  return next({
    ctx: {
      // Provide the session and user to the procedure context
      session: { ...ctx.session, user: ctx.session.user },
      headers: ctx.headers, // Pass along headers if needed
      db: ctx.db,
    },
  });
});

/**
 * Company Protected (authenticated and company-scoped) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users
 * with an active company selected, use this. It verifies:
 * 1. The session is valid and `ctx.session.user` is not null.
 * 2. `ctx.session.user.id` (userId) is present.
 * 3. `ctx.session.user.companyId` is present and non-empty.
 *
 * It guarantees `ctx.session.user`, `ctx.userId`, and `ctx.companyId` are available.
 *
 * @see https://trpc.io/docs/procedures
 */
export const companyProtectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User session is missing or invalid.",
    });
  }

  const userId = ctx.session.user.id;
  if (!userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User ID is missing from session.",
    });
  }

  const companyId = ctx.session.user.activeCompanyId;
  if (!companyId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No active company selected. Please select a company.",
    });
  }

  return next({
    ctx: {
      session: { ...ctx.session, user: ctx.session.user },
      headers: ctx.headers,
      userId,
      user: ctx.session.user,
      companyId,
      db: ctx.db,
    },
  });
});

// /**
//  * Protected (authenticated) procedure
//  *
//  * If you want a query or mutation to ONLY be accessible to logged in admins, use this. It verifies
//  * the session is valid and guarantees `ctx.session.user` has admin privileges.
//  *
//  * @see https://trpc.io/docs/procedures
//  */
// export const adminProcedure = t.procedure.use(({ ctx, next }) => {
//   if (!ctx.session?.user?.isAdmin) {
//     throw new TRPCError({
//       code: "UNAUTHORIZED",
//       message: "Admin privileges required",
//     });
//   }

//   return next({
//     ctx: {
//       session: { ...ctx.session, user: ctx.session.user },
//     },
//   });
// });
