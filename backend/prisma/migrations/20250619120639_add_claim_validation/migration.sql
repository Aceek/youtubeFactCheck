-- CreateEnum
CREATE TYPE "ClaimValidationStatus" AS ENUM ('VALID', 'INACCURATE', 'OUT_OF_CONTEXT', 'HALLUCINATION', 'UNVERIFIED');

-- AlterEnum
ALTER TYPE "Status" ADD VALUE 'VALIDATING_CLAIMS';

-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "validationExplanation" TEXT,
ADD COLUMN     "validationScore" DOUBLE PRECISION,
ADD COLUMN     "validationStatus" "ClaimValidationStatus" NOT NULL DEFAULT 'UNVERIFIED';
