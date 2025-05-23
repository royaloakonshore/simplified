/*
  Warnings:

  - You are about to drop the column `bankAccountIban` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `bankSwiftBic` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `country` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `finvoiceIntermediator` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `finvoiceIntermediatorId` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `ovtId` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `Settings` table. All the data in the column will be lost.
  - Added the required column `bankAccountBIC` to the `Settings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `bankAccountIBAN` to the `Settings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `countryCode` to the `Settings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `countryName` to the `Settings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `domicile` to the `Settings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Settings` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Settings" DROP COLUMN "bankAccountIban",
DROP COLUMN "bankSwiftBic",
DROP COLUMN "country",
DROP COLUMN "email",
DROP COLUMN "finvoiceIntermediator",
DROP COLUMN "finvoiceIntermediatorId",
DROP COLUMN "ovtId",
DROP COLUMN "phone",
ADD COLUMN     "bankAccountBIC" TEXT NOT NULL,
ADD COLUMN     "bankAccountIBAN" TEXT NOT NULL,
ADD COLUMN     "countryCode" TEXT NOT NULL,
ADD COLUMN     "countryName" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "domicile" TEXT NOT NULL,
ADD COLUMN     "sellerIdentifier" TEXT,
ADD COLUMN     "sellerIntermediatorAddress" TEXT,
ADD COLUMN     "settings_email" TEXT,
ADD COLUMN     "settings_phone" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "website" TEXT;
