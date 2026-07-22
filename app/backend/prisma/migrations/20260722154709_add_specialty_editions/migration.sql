-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Edition" ADD VALUE 'DERMATOLOGY';
ALTER TYPE "Edition" ADD VALUE 'DENTAL';
ALTER TYPE "Edition" ADD VALUE 'OBGYN';
ALTER TYPE "Edition" ADD VALUE 'PEDIATRICS';
ALTER TYPE "Edition" ADD VALUE 'OPHTHALMOLOGY';
ALTER TYPE "Edition" ADD VALUE 'PHYSIOTHERAPY';
