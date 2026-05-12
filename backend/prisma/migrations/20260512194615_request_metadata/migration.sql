-- AlterTable
ALTER TABLE "service_requests" ADD COLUMN     "locationAccuracy" DOUBLE PRECISION,
ADD COLUMN     "locationLabel" TEXT,
ADD COLUMN     "locationLat" DOUBLE PRECISION,
ADD COLUMN     "locationLng" DOUBLE PRECISION,
ADD COLUMN     "preferredDateTime" TIMESTAMP(3),
ADD COLUMN     "preferredSchedule" TEXT;
