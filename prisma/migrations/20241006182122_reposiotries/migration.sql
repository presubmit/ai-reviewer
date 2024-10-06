-- CreateTable
CREATE TABLE "Repository" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "fullName" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "githubId" TEXT NOT NULL,
    "private" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Repository_githubId_key" ON "Repository"("githubId");

-- AddForeignKey
ALTER TABLE "Repository" ADD CONSTRAINT "Repository_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
