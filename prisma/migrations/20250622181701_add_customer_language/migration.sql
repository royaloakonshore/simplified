-- CreateEnum
CREATE TYPE "public"."CustomerLanguage" AS ENUM ('EN', 'FI', 'SE');

-- AlterTable
ALTER TABLE "public"."Customer" ADD COLUMN     "language" "public"."CustomerLanguage" NOT NULL DEFAULT 'EN';
