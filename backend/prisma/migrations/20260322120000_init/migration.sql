-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('UNPAIRED', 'AUTO_REJECTED', 'PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SpanType" AS ENUM ('NUMBER', 'FORMATTING_COMMAND', 'SPELLED_OUT', 'NAMED_ENTITY', 'MEDICAL_TERM', 'MEASUREMENT');

-- CreateTable
CREATE TABLE "AnnotationItem" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storagePath" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "durationSeconds" DOUBLE PRECISION,
    "sampleRate" INTEGER,
    "channels" INTEGER,
    "bitDepth" INTEGER,
    "headerMetadata" JSONB,
    "status" "ItemStatus" NOT NULL DEFAULT 'UNPAIRED',
    "annotator" TEXT,
    "originalTranscript" TEXT,
    "correctedTranscript" TEXT,
    "speechRateWpmSuggested" DOUBLE PRECISION,
    "speechRateWpmOverride" DOUBLE PRECISION,
    "distanceEstimateSuggested" DOUBLE PRECISION,
    "distanceEstimateOverride" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnotationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnotationSpan" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" "SpanType" NOT NULL,
    "startOffset" INTEGER NOT NULL,
    "endOffset" INTEGER NOT NULL,
    "attributes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnotationSpan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnnotationItem_filename_key" ON "AnnotationItem"("filename");

-- CreateIndex
CREATE INDEX "AnnotationItem_status_index" ON "AnnotationItem"("status");

-- CreateIndex
CREATE INDEX "AnnotationItem_durationSeconds_index" ON "AnnotationItem"("durationSeconds");

-- CreateIndex
CREATE INDEX "AnnotationSpan_itemId_index" ON "AnnotationSpan"("itemId");

-- AddForeignKey
ALTER TABLE "AnnotationSpan" ADD CONSTRAINT "AnnotationSpan_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AnnotationItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
