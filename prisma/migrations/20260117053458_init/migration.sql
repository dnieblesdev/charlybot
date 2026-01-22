-- CreateTable
CREATE TABLE "tipoClase" (
    "rolId" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "classes" (
    "rolId" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "tipoId" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "classes_tipoId_fkey" FOREIGN KEY ("tipoId") REFERENCES "tipoClase" ("rolId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "subclass" (
    "rolId" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "claseId" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "subclass_claseId_fkey" FOREIGN KEY ("claseId") REFERENCES "classes" ("rolId") ON DELETE RESTRICT ON UPDATE CASCADE
);
