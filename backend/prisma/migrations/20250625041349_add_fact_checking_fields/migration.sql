/*
  Warnings:

  - The `verdict` column on the `Claim` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `Source` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ProcessStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "FactCheckVerdict" AS ENUM ('TRUE', 'FALSE', 'MISLEADING', 'UNVERIFIABLE');

-- AlterEnum
ALTER TYPE "Status" ADD VALUE 'FACT_CHECKING';

-- DropForeignKey
ALTER TABLE "Source" DROP CONSTRAINT "Source_claimId_fkey";

-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "factCheckStatus" "ProcessStatus" DEFAULT 'PENDING',
ADD COLUMN     "sources" JSONB,
ADD COLUMN     "verdictReason" TEXT,
DROP COLUMN "verdict",
ADD COLUMN     "verdict" "FactCheckVerdict";

-- DropTable
DROP TABLE "Source";
