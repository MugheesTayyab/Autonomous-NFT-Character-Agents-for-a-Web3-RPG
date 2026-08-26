import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { SCHEMA_SQL } from './schema';
import config from '../config';

let dbInstance: Database.Database | null = null;

export function getDatabase(dbPath?: string): Database.Database {
  if (!dbInstance) {
    const targetPath = dbPath || config.dbPath;
    if (targetPath !== ':memory:') {
      const dir = path.dirname(path.resolve(targetPath));
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    dbInstance = new Database(targetPath);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    dbInstance.exec(SCHEMA_SQL);
  }
  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function resetDatabase(dbPath?: string): Database.Database {
  closeDatabase();
  return getDatabase(dbPath);
}
