// libSQL: ไฟล์ในเครื่องตอนพัฒนา / Turso (libsql://) ตอนขึ้น Vercel
import { createClient } from '@libsql/client';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
function url() {
  if (process.env.TURSO_DATABASE_URL) return process.env.TURSO_DATABASE_URL;
  const dir = process.env.DATA_DIR || path.join(__dir, 'data');
  fs.mkdirSync(dir, { recursive: true });
  return 'file:' + path.resolve(dir, 'needs.db').split(path.sep).join('/');
}
export const db = createClient({ url: url(), authToken: process.env.TURSO_AUTH_TOKEN });
let ready;
export const init = () => ready ||= db.execute(`CREATE TABLE IF NOT EXISTS needs (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new', ts INTEGER NOT NULL)`);
