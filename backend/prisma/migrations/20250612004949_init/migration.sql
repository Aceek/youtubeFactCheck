-- CreateTable
CREATE TABLE "Video" (
    "id" SERIAL NOT NULL,
    "youtubeUrl" TEXT NOT NULL,
    "transcript" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Video_youtubeUrl_key" ON "Video"("youtubeUrl");
