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

// Configuration
const SQLITE_PATH = 'packages/shared/dev.db';
const PG_CONFIG = {
  user: 'charlybot',
  host: '127.0.0.1',
  port: 5432,
  database: 'charlybot',
};

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

async function readSQLiteData(): Promise<Record<string, Row[]>> {
  console.log('📖 Reading SQLite database...');
  const SQL = await initSqlJs();
  const db = new SQL.Database(readFileSync(join(process.cwd(), SQLITE_PATH)));

  const result: Record<string, Row[]> = {};

  for (const table of TABLE_ORDER) {
    if (SKIP_TABLES.includes(table)) continue;

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
  return result;
}

function convertValue(key: string, value: unknown): unknown {
  if (value === null || value === undefined) return null;

  // Handle SQLite boolean (0/1) → PostgreSQL boolean
  if (typeof value === 'number' && (key.includes('Enabled') || key.includes('is') || key === 'active')) {
    return value !== 0;
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
    // SQLite stores dates as ISO strings, PostgreSQL TIMESTAMPTZ accepts them
    return value;
  }

  return value;
}

function rowToColumns(row: Row): { columns: string[]; values: unknown[]; paramPlaceholders: string } {
  const columns = Object.keys(row);
  const values = columns.map(col => convertValue(col, row[col]));
  const paramPlaceholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  return { columns, values, paramPlaceholders };
}

async function migrateToPostgres(data: Record<string, Row[]>): Promise<void> {
  console.log('\n📤 Migrating to PostgreSQL...');

  const client = new Client(PG_CONFIG);
  await client.connect();

  let totalMigrated = 0;

  for (const table of TABLE_ORDER) {
    if (SKIP_TABLES.includes(table)) continue;

    const rows = data[table] || [];
    if (rows.length === 0) {
      console.log(`  ○ ${table}: skipped (no data)`);
      continue;
    }

    try {
      // Clear existing data in table (in case of re-run)
      await client.query(`DELETE FROM "${table}"`);

      // Insert all rows
      for (const row of rows) {
        const { columns, values, paramPlaceholders } = rowToColumns(row);
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

  await client.end();
  console.log(`\n✅ Total rows migrated: ${totalMigrated}`);
}

async function verifyCounts(data: Record<string, Row[]>): Promise<boolean> {
  console.log('\n🔍 Verifying row counts...');

  const client = new Client(PG_CONFIG);
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

  const client = new Client(PG_CONFIG);
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
    const data = await readSQLiteData();

    // Step 2: Migrate to PostgreSQL
    await migrateToPostgres(data);

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