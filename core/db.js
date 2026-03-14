// darwin/core/db.js
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const log = createLogger('db');
let db = null;

/**
 * Initialize the database. Creates file if needed, enables WAL,
 * and runs pending migrations from data/migrations/.
 * @param {string} dbPath — path to SQLite file
 * @returns {import('better-sqlite3').Database}
 */
export function initDb(dbPath = 'data/darwin.db') {
  // Ensure directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Run pending migrations
  runMigrations();

  log.info({ dbPath }, 'Database initialized');
  return db;
}

/**
 * Get the active database connection. Throws if not initialized.
 * @returns {import('better-sqlite3').Database}
 */
export function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

/**
 * Close the database connection.
 */
export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Run all pending migrations from data/migrations/ in order.
 */
function runMigrations() {
  const migrationsDir = path.join(__dirname, '..', 'data', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    log.warn('No migrations directory found');
    return;
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const applied = new Set(
    db.prepare('SELECT name FROM migrations').all().map(r => r.name)
  );

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    log.info({ migration: file }, 'Applying migration');

    db.exec(sql);
    db.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);
  }
}
