import { createCallerFactory, createTRPCRouter } from "@/lib/api/trpc";
import { customerRouter } from './routers/customer';
import { orderRouter } from './routers/order';
import { invoiceRouter } from './routers/invoice';
import { inventoryRouter } from './routers/inventory';
import { bomRouter } from './routers/bom';
import { settingsRouter } from './routers/settings';
import { userRouter } from './routers/user';
import { companyRouter } from './routers/company';
import { inventoryCategoryRouter } from "./routers/inventoryCategory";
import { dashboardRouter } from "./routers/dashboard";
import { type inferRouterOutputs } from "@trpc/server";
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
  settings: settingsRouter,
  bom: bomRouter,
  inventoryCategory: inventoryCategoryRouter, // Add the new router here
  company: companyRouter, // Add the company router
  dashboard: dashboardRouter, // Add the dashboard router
  // add routers here
});

// export type definition of API
export type AppRouter = typeof appRouter;

export type RouterOutputs = inferRouterOutputs<AppRouter>;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext());
 * const res = await trpc.post.all();
 *       ^? RouterOutputs['post']['all']
 */
export const createAppCaller = createCallerFactory(appRouter); // Renamed from createCaller
