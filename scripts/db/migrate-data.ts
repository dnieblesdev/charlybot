#!/usr/bin/env tsx
/**
 * Data Migration Script: SQLite (dev.db) → PostgreSQL
 *
 * Reads all data from SQLite dev.db and migrates it to PostgreSQL.
 * Handles:
 * - DateTime conversion (ISO8601 → TIMESTAMPTZ)
 * - Boolean conversion (0/1 → true/false)
 * - Auto-increment reseeding
 * - Foreign key order (parent tables first)
 *
 * Usage: tsx scripts/db/migrate-data.ts
 */

import initSqlJs from 'sql.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

import { parsePostgresUrl } from './provider.js';

// Configuration
const SQLITE_PATH = 'packages/shared/dev.db';

function getPgConnectionString(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for PostgreSQL migration.');
  }
  const parsed = parsePostgresUrl(databaseUrl);
  if (!parsed) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection string (postgresql:// or postgres://).');
  }
  return databaseUrl;
}

// Migration order matters - parent tables first due to foreign keys
const TABLE_ORDER = [
  'tipoClase',      // No FKs
  'classes',        // FK to tipoClase
  'subclass',       // FK to classes
  'Guild',          // No FKs
  'GuildConfig',    // FK to Guild
  'UserEconomy',    // No FKs (but RouletteBet FKs to it)
  'GlobalBank',     // No FKs
  'RouletteGame',   // No FKs
  'RouletteBet',    // FK to RouletteGame, UserEconomy
  'EconomyConfig', // No FKs
  'Leaderboard',    // No FKs
  'AutoRole',       // No FKs
  'RoleMapping',    // FK to AutoRole
  'VerificationRequest', // No FKs
  'MusicQueue',     // No FKs
  'MusicQueueItem', // FK to MusicQueue
  'GuildMusicConfig', // No FKs
  'UserXP',         // No FKs
  'XPConfig',       // No FKs
  'LevelRole',      // No FKs
  'SocialLink',     // FK to Guild
  'WelcomeCustomVar', // No FKs
  'ModCase',        // No FKs
  'WarnThreshold',  // No FKs
  'AntiSpamConfig', // FK to Guild
  'AntiSpamHistory', // No FKs
];

// Tables to SKIP (system tables, no data to migrate)
const SKIP_TABLES = ['_prisma_migrations', 'sqlite_sequence'];

interface Row {
  [key: string]: unknown;
}

type SqlJsExecResult = { columns: string[]; values: unknown[][] };
type SqlJsDatabase = { exec: (sql: string) => SqlJsExecResult[]; close: () => void };

function readPrismaBooleanColumnsByModel(): Record<string, Set<string>> {
  const schemaPath = join(process.cwd(), 'packages/shared/prisma/schema.prisma');
  const schemaText = readFileSync(schemaPath, 'utf8');

  const result: Record<string, Set<string>> = {};

  const modelRe = /\bmodel\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  for (const match of schemaText.matchAll(modelRe)) {
    const modelName = match[1];
    const body = match[2] ?? '';

    const cols = new Set<string>();
    for (const rawLine of body.split(/\r?\n/)) {
      const line = rawLine.replace(/\/\/.*$/, '').trim();
      if (!line) continue;
      if (line.startsWith('@@')) continue;
      if (line.startsWith('@')) continue;

      const fieldMatch = /^([A-Za-z_]\w*)\s+Boolean\b/.exec(line);
      if (fieldMatch) cols.add(fieldMatch[1]);
    }

    result[modelName] = cols;
  }

  return result;
}

function readSQLiteBooleanColumns(db: SqlJsDatabase, table: string): Set<string> {
  const res = db.exec(`PRAGMA table_info("${table}")`);
  if (res.length === 0) return new Set();

  const cols = res[0].columns;
  const nameIdx = cols.indexOf('name');
  const typeIdx = cols.indexOf('type');
  if (nameIdx === -1 || typeIdx === -1) return new Set();

  const out = new Set<string>();
  for (const row of res[0].values) {
    const name = row[nameIdx];
    const type = row[typeIdx];
    if (typeof name === 'string' && typeof type === 'string' && /bool/i.test(type)) {
      out.add(name);
    }
  }
  return out;
}

function unionSets<T>(a: Set<T>, b: Set<T>): Set<T> {
  const out = new Set<T>(a);
  for (const item of b) out.add(item);
  return out;
}

async function readSQLiteData(): Promise<{
  data: Record<string, Row[]>;
  booleanColumnsByTable: Record<string, Set<string>>;
}> {
  console.log('📖 Reading SQLite database...');
  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync(join(process.cwd(), SQLITE_PATH))) as unknown as SqlJsDatabase;

  const prismaBoolByModel = readPrismaBooleanColumnsByModel();

  const result: Record<string, Row[]> = {};
  const booleanColumnsByTable: Record<string, Set<string>> = {};

  for (const table of TABLE_ORDER) {
    if (SKIP_TABLES.includes(table)) continue;

    // SQLite stores booleans as 0/1 integers, but PostgreSQL BOOLEAN rejects integer bindings.
    // Use schema-driven boolean column detection (SQLite PRAGMA + Prisma schema) instead of name heuristics.
    const sqliteBoolCols = readSQLiteBooleanColumns(db, table);
    const prismaBoolCols = prismaBoolByModel[table] ?? new Set<string>();
    booleanColumnsByTable[table] = unionSets(sqliteBoolCols, prismaBoolCols);

    try {
      const rows = db.exec(`SELECT * FROM "${table}"`);
      if (rows.length > 0 && rows[0].values.length > 0) {
        const columns = rows[0].columns;
        result[table] = rows[0].values.map(row => {
          const obj: Row = {};
          columns.forEach((col, i) => {
            obj[col] = row[i];
          });
          return obj;
        });
        console.log(`  ✓ ${table}: ${result[table].length} rows`);
      } else {
        result[table] = [];
        console.log(`  ○ ${table}: 0 rows`);
      }
    } catch (e) {
      console.log(`  ✗ ${table}: Error reading - ${e}`);
      result[table] = [];
    }
  }

  db.close();
  return { data: result, booleanColumnsByTable };
}

function convertValue(key: string, value: unknown, opts: { isBooleanColumn: boolean }): unknown {
  if (value === null || value === undefined) return null;

  if (opts.isBooleanColumn) {
    // Handle SQLite boolean storage (0/1 or "0"/"1") → PostgreSQL boolean
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (value === 0) return false;
      if (value === 1) return true;
    }
    if (typeof value === 'string') {
      if (value === '0') return false;
      if (value === '1') return true;
    }
  }

  // Handle DateTime strings (ISO8601) → PostgreSQL TIMESTAMPTZ
  if (typeof value === 'string' && (
    key === 'created_at' || key === 'updated_at' ||
    key === 'createdAt' || key === 'updatedAt' ||
    key === 'lastWork' || key === 'lastCrime' || key === 'lastRob' ||
    key === 'jailReleaseAt' || key === 'startTime' ||
    key === 'spinTime' || key === 'endTime' ||
    key === 'lastMessageAt' || key === 'joinedServerAt' ||
    key === 'requestedAt' || key === 'reviewedAt'
  )) {
    // SQLite stores dates as ISO strings; baseline schema uses TIMESTAMPTZ so absolute instants are preserved.
    return value;
  }

  return value;
}

function rowToColumns(
  table: string,
  row: Row,
  booleanColumnsByTable: Record<string, Set<string>>
): { columns: string[]; values: unknown[]; paramPlaceholders: string } {
  const columns = Object.keys(row);
  const boolCols = booleanColumnsByTable[table] ?? new Set<string>();
  const values = columns.map((col) => convertValue(col, row[col], { isBooleanColumn: boolCols.has(col) }));
  const paramPlaceholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  return { columns, values, paramPlaceholders };
}

async function migrateToPostgres(
  data: Record<string, Row[]>,
  booleanColumnsByTable: Record<string, Set<string>>
): Promise<void> {
  console.log('\n📤 Migrating to PostgreSQL...');

  const client = new Client({ connectionString: getPgConnectionString() });
  await client.connect();

  let totalMigrated = 0;

  try {
    await client.query('BEGIN');

    // Clear existing data in a FK-safe way (and in the same transaction)
    const tablesToTruncate = TABLE_ORDER.filter((t) => !SKIP_TABLES.includes(t));
    try {
      await client.query(`TRUNCATE ${tablesToTruncate.map((t) => `"${t}"`).join(', ')} CASCADE`);
    } catch (err: any) {
      if (err.message?.includes('does not exist')) {
        throw new Error(
          `❌ TRUNCATE failed: ${err.message}\n` +
          `   Ensure the baseline migration was applied first: pnpm db:migrate deploy`
        );
      }
      throw err;
    }

    for (const table of TABLE_ORDER) {
      if (SKIP_TABLES.includes(table)) continue;

      const rows = data[table] || [];
      if (rows.length === 0) {
        console.log(`  ○ ${table}: skipped (no data)`);
        continue;
      }

      try {
        // Insert all rows
        for (const row of rows) {
          const { columns, values, paramPlaceholders } = rowToColumns(table, row, booleanColumnsByTable);
          const query = `INSERT INTO "${table}" ("${columns.join('", "')}") VALUES (${paramPlaceholders})`;
          await client.query(query, values);
        }

        console.log(`  ✓ ${table}: ${rows.length} rows migrated`);
        totalMigrated += rows.length;
      } catch (e: unknown) {
        const error = e as Error;
        console.log(`  ✗ ${table}: Error - ${error.message}`);
        throw e;
      }
    }

    await client.query('COMMIT');
    console.log(`\n✅ Total rows migrated: ${totalMigrated}`);
  } catch (e: unknown) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback failures
    }
    throw e;
  } finally {
    await client.end();
  }
}

async function verifyCounts(data: Record<string, Row[]>): Promise<boolean> {
  console.log('\n🔍 Verifying row counts...');

  const client = new Client({ connectionString: getPgConnectionString() });
  await client.connect();

  let allMatch = true;

  for (const table of TABLE_ORDER) {
    if (SKIP_TABLES.includes(table)) continue;

    const expected = (data[table] || []).length;

    try {
      const result = await client.query(`SELECT COUNT(*) as c FROM "${table}"`);
      const actual = parseInt(result.rows[0].c as string, 10);

      if (actual === expected) {
        console.log(`  ✓ ${table}: ${actual}/${expected} rows match`);
      } else {
        console.log(`  ✗ ${table}: ${actual}/${expected} rows - MISMATCH!`);
        allMatch = false;
      }
    } catch (e: unknown) {
      const error = e as Error;
      console.log(`  ✗ ${table}: Error reading - ${error.message}`);
      allMatch = false;
    }
  }

  await client.end();
  return allMatch;
}

async function reseedAutoincrement(): Promise<void> {
  console.log('\n🔄 Reseeding auto-increment sequences...');

  const client = new Client({ connectionString: getPgConnectionString() });
  await client.connect();

  const tablesWithAutoincrement = [
    'Guild', 'GuildConfig', 'UserEconomy', 'GlobalBank',
    'RouletteGame', 'RouletteBet', 'EconomyConfig', 'Leaderboard',
    'AutoRole', 'RoleMapping', 'UserXP', 'XPConfig', 'LevelRole',
    'WelcomeCustomVar', 'ModCase', 'WarnThreshold', 'AntiSpamConfig', 'AntiSpamHistory'
  ];

  for (const table of tablesWithAutoincrement) {
    try {
      // Get the highest ID in the table
      const result = await client.query(`SELECT MAX(id) as max_id FROM "${table}"`);
      const maxId = result.rows[0]?.max_id;

      if (maxId !== null && maxId !== undefined) {
        // Reset the sequence to max+1
        await client.query(`SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), ${maxId} + 1, false)`);
        console.log(`  ✓ ${table}: sequence reseeded to ${maxId + 1}`);
      } else {
        console.log(`  ○ ${table}: no data, skipping sequence`);
      }
    } catch (e) {
      // Table might not have an id column with serial
      console.log(`  ○ ${table}: no auto-increment sequence`);
    }
  }

  await client.end();
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('     SQLite → PostgreSQL Data Migration');
  console.log('═══════════════════════════════════════════════════\n');

  try {
    // Step 1: Read from SQLite
    const { data, booleanColumnsByTable } = await readSQLiteData();

    // Step 2: Migrate to PostgreSQL
    await migrateToPostgres(data, booleanColumnsByTable);

    // Step 3: Verify counts
    const countsMatch = await verifyCounts(data);

    // Step 4: Reseed autoincrement sequences
    await reseedAutoincrement();

    console.log('\n═══════════════════════════════════════════════════');
    if (countsMatch) {
      console.log('✅ Migration completed successfully!');
      console.log('   All row counts verified.');
    } else {
      console.log('⚠️ Migration completed with warnings.');
      console.log('   Some row counts do not match.');
    }
    console.log('═══════════════════════════════════════════════════');

    process.exit(countsMatch ? 0 : 1);
  } catch (e: unknown) {
    const error = e as Error;
    console.error(`\n❌ Migration failed: ${error.message}`);
    process.exit(1);
  }
}

main().catch(console.error);
