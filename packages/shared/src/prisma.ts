import { PrismaClient } from './generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    'DATABASE_URL is required for PostgreSQL. Set it to postgresql://user:password@host:port/dbname'
  );
}

const adapter = new PrismaPg({ connectionString: url });

export const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export * from './generated/prisma';