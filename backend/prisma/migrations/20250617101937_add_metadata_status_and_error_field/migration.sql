-- AlterEnum
ALTER TYPE "Status" ADD VALUE 'FETCHING_METADATA';

-- AlterTable
ALTER TABLE "Analysis" ADD COLUMN     "errorMessage" TEXT;
