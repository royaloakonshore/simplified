-- AlterTable
ALTER TABLE "public"."Company" ADD COLUMN     "bankAccount" TEXT,
ADD COLUMN     "businessId" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "streetAddress" TEXT,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "public"."Invoice" ADD COLUMN     "bankBarcode" TEXT,
ADD COLUMN     "paymentReference" TEXT;

-- AlterTable
ALTER TABLE "public"."Order" ADD COLUMN     "paymentTerms" TEXT,
ADD COLUMN     "totalVatAmount" DECIMAL(10,2);
