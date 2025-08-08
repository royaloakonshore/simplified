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
        comparisonType: z.enum(["previous", "yearOverYear"]).default("previous"),
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
        
        if (input.comparisonType === "yearOverYear") {
          // Year over year comparison
          previousPeriodStart = new Date(currentPeriodStart.getFullYear() - 1, currentPeriodStart.getMonth(), currentPeriodStart.getDate());
          previousPeriodEnd = new Date(currentPeriodEnd.getFullYear() - 1, currentPeriodEnd.getMonth(), currentPeriodEnd.getDate());
        } else {
          // Previous period with same length
          const periodDiff = currentPeriodEnd.getTime() - currentPeriodStart.getTime();
          previousPeriodEnd = new Date(currentPeriodStart.getTime() - 1);
          previousPeriodStart = new Date(previousPeriodEnd.getTime() - periodDiff);
        }
      } else {
        // Default to current month
        currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        currentPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        
        if (input.comparisonType === "yearOverYear") {
          previousPeriodStart = new Date(now.getFullYear() - 1, now.getMonth(), 1);
          previousPeriodEnd = new Date(now.getFullYear() - 1, now.getMonth() + 1, 0, 23, 59, 59, 999);
        } else {
          previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          previousPeriodEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        }
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

      // 5. Order Fulfillment Rate (percentage of on-time deliveries)
      // Get all shipped orders in the current period
      const currentShippedOrdersWithDates = await prisma.order.findMany({
        where: {
          companyId,
          status: OrderStatus.shipped,
          updatedAt: {
            gte: currentPeriodStart,
            lte: currentPeriodEnd,
          },
          deliveryDate: {
            not: null,
          },
        },
        select: {
          id: true,
          deliveryDate: true,
          updatedAt: true,
        },
      });

      const currentOrdersTotal = currentShippedOrdersWithDates.length;
      
      // Calculate on-time deliveries (shipped before or on delivery date)
      const currentOrdersOnTime = currentShippedOrdersWithDates.filter(order => 
        order.deliveryDate && order.updatedAt <= order.deliveryDate
      ).length;

      const fulfillmentRate = currentOrdersTotal > 0 ? (currentOrdersOnTime / currentOrdersTotal) * 100 : 0;

      // 6. Inventory Turnover (simplified version - inventory value change)
      const [currentInventoryValue, previousInventoryValue] = await Promise.all([
        prisma.inventoryItem.aggregate({
          where: {
            companyId,
            updatedAt: {
              lte: currentPeriodEnd,
            },
          },
          _sum: {
            costPrice: true,
          },
        }),
        prisma.inventoryItem.aggregate({
          where: {
            companyId,
            updatedAt: {
              lte: previousPeriodEnd,
            },
          },
          _sum: {
            costPrice: true,
          },
        }),
      ]);

      const currentInventoryVal = currentInventoryValue._sum?.costPrice?.toNumber() || 0;
      const previousInventoryVal = previousInventoryValue._sum?.costPrice?.toNumber() || 0;
      const inventoryTurnover = previousInventoryVal > 0 
        ? ((previousInventoryVal - currentInventoryVal) / previousInventoryVal) * 100 
        : 0;

      // 7. Customer Growth (new customers this period vs previous period)
      const [currentNewCustomers, previousNewCustomers] = await Promise.all([
        prisma.customer.count({
          where: {
            companyId,
            createdAt: {
              gte: currentPeriodStart,
              lte: currentPeriodEnd,
            },
          },
        }),
        prisma.customer.count({
          where: {
            companyId,
            createdAt: {
              gte: previousPeriodStart,
              lte: previousPeriodEnd,
            },
          },
        }),
      ]);

      const customerGrowthTrend = previousNewCustomers > 0 
        ? ((currentNewCustomers - previousNewCustomers) / previousNewCustomers) * 100 
        : currentNewCustomers > 0 ? 100 : 0;

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
        orderFulfillmentRate: {
          percentage: fulfillmentRate,
          onTime: currentOrdersOnTime,
          total: currentOrdersTotal,
        },
        inventoryTurnover: {
          percentage: inventoryTurnover,
          current: currentInventoryVal,
          previous: previousInventoryVal,
        },
        customerGrowth: {
          current: currentNewCustomers,
          previous: previousNewCustomers,
          trend: customerGrowthTrend,
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

      // Prepare all periods first
      const periods = Array.from({ length: input.periods }, (_, idx) => input.periods - 1 - idx).map((i) => {
        if (input.type === "monthly") {
          const periodStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const periodEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
          const periodLabel = periodStart.toLocaleDateString("en-US", { month: "short", year: "numeric" });
          return { periodStart, periodEnd, periodLabel };
        } else {
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - (i * 7) - now.getDay());
          weekStart.setHours(0, 0, 0, 0);
          const periodStart = weekStart;
          const periodEnd = new Date(weekStart);
          periodEnd.setDate(weekStart.getDate() + 6);
          periodEnd.setHours(23, 59, 59, 999);
          const weekNumber = Math.ceil((periodStart.getTime() - new Date(periodStart.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
          const periodLabel = `w. ${weekNumber}`;
          return { periodStart, periodEnd, periodLabel };
        }
      });

      // Run all aggregates in parallel
      const aggregates = await Promise.all(
        periods.map(({ periodStart, periodEnd }) =>
          prisma.invoice.aggregate({
            where: {
              companyId,
              status: "paid",
              createdAt: { gte: periodStart, lte: periodEnd },
            },
            _sum: { totalAmount: true },
          })
        )
      );

      return periods.map((p, idx) => ({
        period: p.periodLabel,
        revenue: aggregates[idx]._sum?.totalAmount?.toNumber() || 0,
      }));
    }),

  getTopCustomers: companyProtectedProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const { companyId } = ctx;
      const { startDate, endDate, limit } = input;
      
      // Build where clause for date filtering
      const whereClause: any = {
        companyId,
        status: "paid", // Only include paid invoices
      };
      
      if (startDate || endDate) {
        whereClause.invoiceDate = {};
        if (startDate) whereClause.invoiceDate.gte = startDate;
        if (endDate) whereClause.invoiceDate.lte = endDate;
      }

      // Get invoices with customer data and items for margin calculation
      const invoices = await prisma.invoice.findMany({
        where: whereClause,
        select: {
          id: true,
          totalAmount: true,
          customer: { select: { id: true, name: true } },
          items: {
            select: {
              quantity: true,
              inventoryItem: {
                select: {
                  itemType: true,
                  costPrice: true,
                  bom: {
                    select: {
                      manualLaborCost: true,
                      items: {
                        select: {
                          quantity: true,
                          componentItem: { select: { costPrice: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      // Calculate customer metrics
      const customerMetrics = new Map<string, {
        customerId: string;
        customerName: string;
        totalRevenue: number;
        totalCost: number;
        invoiceCount: number;
      }>();

      for (const invoice of invoices) {
        const customerId = invoice.customer.id;
        const customerName = invoice.customer.name;
        
        if (!customerMetrics.has(customerId)) {
          customerMetrics.set(customerId, {
            customerId,
            customerName,
            totalRevenue: 0,
            totalCost: 0,
            invoiceCount: 0,
          });
        }

        const metric = customerMetrics.get(customerId)!;
        
        // Add invoice revenue
        metric.totalRevenue += invoice.totalAmount ? Number(invoice.totalAmount.toString()) : 0;
        metric.invoiceCount += 1;

        // Calculate cost for each line item
        for (const item of invoice.items) {
          const quantity = Number(item.quantity.toString());
          let unitCost = 0;

          if (item.inventoryItem.itemType === 'RAW_MATERIAL') {
            unitCost = Number(item.inventoryItem.costPrice.toString());
          } else if (item.inventoryItem.itemType === 'MANUFACTURED_GOOD' && item.inventoryItem.bom) {
            // Add manual labor cost
            if (item.inventoryItem.bom.manualLaborCost) {
              unitCost += Number(item.inventoryItem.bom.manualLaborCost.toString());
            }
            
            // Add BOM component costs
            for (const bomItem of item.inventoryItem.bom.items) {
              const componentCost = Number(bomItem.componentItem.costPrice.toString());
              const componentQuantity = Number(bomItem.quantity.toString());
              unitCost += componentCost * componentQuantity;
            }
          } else {
            // Fallback to cost price
            unitCost = Number(item.inventoryItem.costPrice.toString());
          }

          metric.totalCost += unitCost * quantity;
        }
      }

      // Convert to array and calculate margins
      const customers = Array.from(customerMetrics.values()).map(metric => {
        const totalMargin = metric.totalRevenue - metric.totalCost;
        const marginPercentage = metric.totalRevenue > 0 ? (totalMargin / metric.totalRevenue) * 100 : 0;
        
        return {
          ...metric,
          totalMargin,
          marginPercentage,
        };
      });

      // Sort by revenue (highest first) and limit
      return customers
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, limit);
    }),

  getSalesFunnelData: companyProtectedProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { companyId } = ctx;
      // Base where clause
      const baseWhere = { companyId };
      
      // Add date filtering if provided
      const whereClause = input.startDate && input.endDate 
        ? {
            ...baseWhere,
            createdAt: {
              gte: input.startDate,
              lte: input.endDate,
            }
          }
        : baseWhere;

      // Get orders by status and type
      const [quotations, workOrders, inProduction, shipped, invoiced] = await Promise.all([
        // Quotations
        prisma.order.findMany({
          where: {
            ...whereClause,
            orderType: "quotation",
            status: {
              in: ["draft", "confirmed"]
            }
          },
          select: {
            totalAmount: true,
            createdAt: true,
          },
        }),
        
        // Work Orders (confirmed, not yet in production)
        prisma.order.findMany({
          where: {
            ...whereClause,
            orderType: "work_order",
            status: "confirmed"
          },
          select: {
            totalAmount: true,
            createdAt: true,
          },
        }),
        
        // In Production
        prisma.order.findMany({
          where: {
            ...whereClause,
            orderType: "work_order",
            status: "in_production"
          },
          select: {
            totalAmount: true,
            createdAt: true,
          },
        }),
        
        // Shipped (ready to invoice)
        prisma.order.findMany({
          where: {
            ...whereClause,
            orderType: "work_order",
            status: {
              in: ["shipped", "delivered"]
            }
          },
          select: {
            totalAmount: true,
            createdAt: true,
          },
        }),
        
        // Invoiced
        prisma.order.findMany({
          where: {
            ...whereClause,
            orderType: "work_order",
            status: "invoiced"
          },
          select: {
            totalAmount: true,
            createdAt: true,
          },
        }),
      ]);

      // Calculate totals and format for funnel
      const calculateStageData = (orders: any[], stage: string, color: string) => {
        const totalValue = orders.reduce((sum, order) => sum + (order.totalAmount?.toNumber() || 0), 0);
        const count = orders.length;
        return {
          stage,
          value: totalValue,
          count,
          color,
          orders: orders.map(order => ({
            value: order.totalAmount?.toNumber() || 0,
            date: order.createdAt.toISOString().split('T')[0]
          }))
        };
      };

      return [
        calculateStageData(quotations, "Quotations", "#10b981"), // emerald-500
        calculateStageData(workOrders, "Work Orders", "#059669"), // emerald-600
        calculateStageData(inProduction, "In Production", "#047857"), // emerald-700
        calculateStageData(shipped, "Ready to Invoice", "#065f46"), // emerald-800
        calculateStageData(invoiced, "Invoiced", "#064e3b"), // emerald-900
      ];
    }),
}); 