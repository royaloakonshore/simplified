import { z } from "zod";
import { createTRPCRouter, companyProtectedProcedure } from "@/lib/api/trpc";
import { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import Decimal from "decimal.js";

// Utility function for safe Prisma.Decimal to number conversion
const toSafeNumber = (value: Prisma.Decimal | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  const num = new Decimal(value.toString()).toNumber();
  return isFinite(num) ? num : 0;
};

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

      const currentRevenueValue = toSafeNumber(currentRevenue._sum?.totalAmount);
      const previousRevenueValue = toSafeNumber(previousRevenue._sum?.totalAmount);
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

      // 6. Inventory Turnover & Value (Corrected Calculation)
      const allInventoryItems = await prisma.inventoryItem.findMany({
        where: {
          companyId,
        },
        select: {
          costPrice: true,
          quantityOnHand: true,
        },
      });

      const totalInventoryValue = allInventoryItems.reduce((acc, item) => {
        const itemValue = new Decimal(item.costPrice.toString()).times(new Decimal(item.quantityOnHand.toString()));
        return acc.plus(itemValue);
      }, new Decimal(0));
      
      const inventoryTurnover = 0; // Placeholder, as simple value change is not representative.

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
        inventory: {
          turnover: inventoryTurnover,
          totalValue: totalInventoryValue.toNumber(),
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
          
          // Get week number from start date
          const weekNumber = Math.ceil((periodStart.getTime() - new Date(periodStart.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
          periodLabel = `w. ${weekNumber}`;
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
        include: {
          customer: {
            select: {
              id: true,
              name: true,
            },
          },
          items: {
            include: {
              inventoryItem: {
                include: {
                  bom: {
                    include: {
                      items: {
                        include: {
                          componentItem: true,
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
      const { startDate, endDate } = input;

      const whereClause: Prisma.OrderWhereInput = {
        companyId,
        orderType: "work_order", // Funnel for work orders
      };

      if (startDate && endDate) {
        whereClause.createdAt = {
          gte: startDate,
          lte: endDate,
        };
      }

      const orders = await prisma.order.findMany({
        where: whereClause,
        select: {
          status: true,
          totalAmount: true,
        },
      });

      const calculateStageData = (filteredOrders: typeof orders, stage: string, color: string) => {
        const totalValue = filteredOrders.reduce((sum, order) => {
            const orderTotal = new Decimal(order.totalAmount?.toString() || "0");
            return sum.plus(orderTotal);
        }, new Decimal(0));

        return {
          name: stage,
          value: totalValue.toNumber(),
          count: filteredOrders.length,
          color: color,
        };
      };

      const quotationOrders = await prisma.order.findMany({
        where: {
          companyId,
          orderType: 'quotation',
          createdAt: startDate && endDate ? { gte: startDate, lte: endDate } : undefined
        },
        select: { totalAmount: true, status: true }
      });

      const confirmedQuotations = quotationOrders.filter(o => o.status === 'confirmed');
      const draftQuotations = quotationOrders.filter(o => o.status === 'draft');

      const funnelData = [
        calculateStageData(draftQuotations, 'Quotations (Draft)', '#84cc16'), // lime-500
        calculateStageData(confirmedQuotations, 'Quotations (Confirmed)', '#22c55e'), // green-500
        calculateStageData(
          orders.filter((o) => o.status === OrderStatus.in_production),
          'In Production',
          '#10b981' // emerald-500
        ),
        calculateStageData(
          orders.filter((o) => o.status === OrderStatus.shipped),
          'Shipped',
          '#06b6d4' // cyan-500
        ),
        calculateStageData(
          orders.filter((o) => o.status === OrderStatus.invoiced),
          'Invoiced',
          '#3b82f6' // blue-500
        ),
      ];
      
      return funnelData;
    }),
}); 