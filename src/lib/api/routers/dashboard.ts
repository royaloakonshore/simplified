import { z } from "zod";
import { createTRPCRouter, companyProtectedProcedure } from "@/lib/api/trpc";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

export const dashboardRouter = createTRPCRouter({
  getStats: companyProtectedProcedure
    .input(
      z.object({
        periodType: z.enum(["month", "quarter", "year"]).default("month"),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { companyId } = ctx;
      const now = new Date();
      
      // Calculate period dates
      let currentPeriodStart: Date;
      let currentPeriodEnd: Date;
      let previousPeriodStart: Date;
      let previousPeriodEnd: Date;

      if (input.startDate && input.endDate) {
        currentPeriodStart = input.startDate;
        currentPeriodEnd = input.endDate;
        const periodDiff = currentPeriodEnd.getTime() - currentPeriodStart.getTime();
        previousPeriodEnd = new Date(currentPeriodStart.getTime() - 1);
        previousPeriodStart = new Date(previousPeriodEnd.getTime() - periodDiff);
      } else {
        // Default to current month
        currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        currentPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        previousPeriodEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      }

      // 1. Shipped Orders Count
      const [currentShippedOrders, previousShippedOrders] = await Promise.all([
        prisma.order.count({
          where: {
            companyId,
            status: OrderStatus.shipped,
            updatedAt: {
              gte: currentPeriodStart,
              lte: currentPeriodEnd,
            },
          },
        }),
        prisma.order.count({
          where: {
            companyId,
            status: OrderStatus.shipped,
            updatedAt: {
              gte: previousPeriodStart,
              lte: previousPeriodEnd,
            },
          },
        }),
      ]);

      // 2. Pending Production Count (confirmed + in_production)
      const pendingProductionCount = await prisma.order.count({
        where: {
          companyId,
          status: {
            in: [OrderStatus.confirmed, OrderStatus.in_production],
          },
        },
      });

      // 3. Late Orders Count (orders past delivery date)
      const lateOrdersCount = await prisma.order.count({
        where: {
          companyId,
          deliveryDate: {
            lt: now,
          },
          status: {
            notIn: ["shipped", "delivered", "cancelled"],
          },
        },
      });

      // 4. Total Revenue (from paid invoices)
      const [currentRevenue, previousRevenue] = await Promise.all([
        prisma.invoice.aggregate({
          where: {
            companyId,
            status: "paid",
            createdAt: {
              gte: currentPeriodStart,
              lte: currentPeriodEnd,
            },
          },
          _sum: {
            totalAmount: true,
          },
        }),
        prisma.invoice.aggregate({
          where: {
            companyId,
            status: "paid",
            createdAt: {
              gte: previousPeriodStart,
              lte: previousPeriodEnd,
            },
          },
          _sum: {
            totalAmount: true,
          },
        }),
      ]);

      // Calculate trends
      const shippedOrdersTrend = previousShippedOrders > 0 
        ? ((currentShippedOrders - previousShippedOrders) / previousShippedOrders) * 100 
        : currentShippedOrders > 0 ? 100 : 0;

      const currentRevenueValue = currentRevenue._sum?.totalAmount?.toNumber() || 0;
      const previousRevenueValue = previousRevenue._sum?.totalAmount?.toNumber() || 0;
      const revenueTrend = previousRevenueValue > 0 
        ? ((currentRevenueValue - previousRevenueValue) / previousRevenueValue) * 100 
        : currentRevenueValue > 0 ? 100 : 0;

      return {
        shippedOrders: {
          current: currentShippedOrders,
          previous: previousShippedOrders,
          trend: shippedOrdersTrend,
        },
        pendingProduction: {
          count: pendingProductionCount,
        },
        lateOrders: {
          count: lateOrdersCount,
        },
        revenue: {
          current: currentRevenueValue,
          previous: previousRevenueValue,
          trend: revenueTrend,
        },
      };
    }),

  getRecentOrders: companyProtectedProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
    .query(async ({ ctx, input }) => {
      const orders = await prisma.order.findMany({
        where: {
          companyId: ctx.companyId,
        },
        select: {
          id: true,
          orderNumber: true,
          orderDate: true,
          status: true,
          customer: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: input.limit,
      });

      return orders;
    }),

  getRevenueChartData: companyProtectedProcedure
    .input(
      z.object({
        type: z.enum(["weekly", "monthly"]).default("monthly"),
        periods: z.number().min(3).max(12).default(6),
      })
    )
    .query(async ({ ctx, input }) => {
      const { companyId } = ctx;
      const now = new Date();
      const data: { period: string; revenue: number }[] = [];

      for (let i = input.periods - 1; i >= 0; i--) {
        let periodStart: Date;
        let periodEnd: Date;
        let periodLabel: string;

        if (input.type === "monthly") {
          periodStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
          periodEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
          periodLabel = periodStart.toLocaleDateString("en-US", { month: "short", year: "numeric" });
        } else {
          // Weekly
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - (i * 7) - now.getDay());
          weekStart.setHours(0, 0, 0, 0);
          
          periodStart = weekStart;
          periodEnd = new Date(weekStart);
          periodEnd.setDate(weekStart.getDate() + 6);
          periodEnd.setHours(23, 59, 59, 999);
          
          periodLabel = `Week of ${periodStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
        }

        const revenueAggregate = await prisma.invoice.aggregate({
          where: {
            companyId,
            status: "paid",
            createdAt: {
              gte: periodStart,
              lte: periodEnd,
            },
          },
          _sum: {
            totalAmount: true,
          },
        });

        data.push({
          period: periodLabel,
          revenue: revenueAggregate._sum?.totalAmount?.toNumber() || 0,
        });
      }

      return data;
    }),
}); 