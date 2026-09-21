CREATE TYPE "DatabaseEnvironmentName" AS ENUM ('DEVELOPMENT', 'PREVIEW', 'PRODUCTION');

CREATE TABLE "DatabaseEnvironment" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "name" "DatabaseEnvironmentName" NOT NULL,
    "configuredAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatabaseEnvironment_pkey" PRIMARY KEY ("id")
);
