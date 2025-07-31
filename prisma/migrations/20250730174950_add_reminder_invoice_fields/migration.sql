-- AlterTable
ALTER TABLE "public"."Invoice" ADD COLUMN     "isReminder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reminderSequence" INTEGER;
