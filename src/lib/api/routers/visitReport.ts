import { createTRPCRouter, companyProtectedProcedure } from "@/lib/api/trpc";

export const visitReportRouter = createTRPCRouter({
  list: companyProtectedProcedure.query(async ({ ctx }) => {
    return ctx.db.visitReport.findMany({
      where: { companyId: ctx.companyId },
      orderBy: [{ markedDoneAt: "desc" }, { receivedAt: "desc" }],
      take: 100,
      include: {
        lines: { orderBy: { position: "asc" } },
        invoice: {
          select: { id: true, invoiceNumber: true, status: true },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            customer: { select: { name: true } },
          },
        },
      },
    });
  }),
});
