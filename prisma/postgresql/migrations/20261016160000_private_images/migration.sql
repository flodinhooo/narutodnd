CREATE TABLE "PrivateImage" (
  "key" TEXT NOT NULL,
  "namespace" TEXT NOT NULL,
  "data" BYTEA NOT NULL,
  CONSTRAINT "PrivateImage_pkey" PRIMARY KEY ("key")
);
