import { PrismaClient } from './generated/prisma';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname (Node.js doesn't provide it like Bun does)
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Default to absolute path relative to this file's directory
const defaultDbPath = path.resolve(__dirname, '../dev.db');
const url = process.env.DATABASE_URL || `file:${defaultDbPath}`;

const adapter = new PrismaLibSql({
  url: url.startsWith('file:') ? url : `file:${url}`,
});

export const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export * from './generated/prisma';
