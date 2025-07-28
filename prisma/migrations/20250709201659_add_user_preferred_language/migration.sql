-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "preferredLanguage" "public"."CustomerLanguage" NOT NULL DEFAULT 'FI';
