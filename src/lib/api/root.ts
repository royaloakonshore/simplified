import { createCallerFactory, createTRPCRouter } from "@/lib/api/trpc";
import { customerRouter } from "./routers/customer";
import { inventoryRouter } from "./routers/inventory";
import { orderRouter } from "./routers/order";
import { invoiceRouter } from "./routers/invoice";
import { userRouter } from "./routers/user";
// import all routers here

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  customer: customerRouter, // Add customer router here
  inventory: inventoryRouter, // Add inventory router
  order: orderRouter,
  invoice: invoiceRouter, // Add invoice router
  user: userRouter,
  // add routers here
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext());
 * const res = await trpc.post.all();
 *       ^? RouterOutputs['post']['all']
 */
export const createCaller = createCallerFactory(appRouter);
