// ฐานข้อมูล libSQL: ไฟล์ในเครื่อง (file:) ตอนพัฒนา / Turso (libsql://) ตอนขึ้น Vercel — โค้ดชุดเดียวกัน
const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');

function url() {
  if (process.env.TURSO_DATABASE_URL) return process.env.TURSO_DATABASE_URL;
  const dir = process.env.DATA_DIR || path.join(__dirname, 'data');
  fs.mkdirSync(dir, { recursive: true });
  return 'file:' + path.resolve(process.env.DB_FILE || path.join(dir, 'ledger.db')).replace(/\\/g, '/');
}
const client = createClient({ url: url(), authToken: process.env.TURSO_AUTH_TOKEN });

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  no INTEGER, sid TEXT, name TEXT NOT NULL,
  section TEXT DEFAULT '',
  code TEXT UNIQUE NOT NULL
);
CREATE TABLE IF NOT EXISTS hours (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seq INTEGER NOT NULL, date TEXT, topic TEXT NOT NULL,
  indicator TEXT DEFAULT '', ai_focus TEXT DEFAULT '',
  plan TEXT DEFAULT '', record TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS assessments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hour_id INTEGER,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'collect', -- collect | final | affective | integrated
  unit INTEGER NOT NULL DEFAULT 1,          -- หน่วยการเรียนรู้ 1-6 (ใช้กับ collect)
  domain TEXT NOT NULL DEFAULT 'K',         -- K ความรู้ | P กระบวนการ | A เจตคติ
  max REAL NOT NULL DEFAULT 10,
  rubric TEXT DEFAULT '',
  open INTEGER NOT NULL DEFAULT 0           -- 1 = นักเรียนส่งงานได้
);
CREATE TABLE IF NOT EXISTS scores (
  student_id INTEGER NOT NULL,
  assessment_id INTEGER NOT NULL,
  score REAL, note TEXT DEFAULT '',
  source TEXT DEFAULT 'teacher',            -- teacher | ai
  updated_at TEXT NOT NULL,
  PRIMARY KEY (student_id, assessment_id)
);
CREATE TABLE IF NOT EXISTS attendance (
  hour_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  status TEXT NOT NULL,                     -- P | S ขาด | A ลา | L สาย
  updated_at TEXT NOT NULL,
  PRIMARY KEY (hour_id, student_id)
);
CREATE TABLE IF NOT EXISTS traits (
  student_id INTEGER NOT NULL,
  trait TEXT NOT NULL, level INTEGER NOT NULL,
  PRIMARY KEY (student_id, trait)
);
CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  assessment_id INTEGER NOT NULL,
  answer TEXT NOT NULL, ai_score REAL, ai_feedback TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'submitted', -- submitted | ai_graded | approved
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ai_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  hour_id INTEGER,
  tool TEXT DEFAULT '', prompt TEXT NOT NULL, output TEXT DEFAULT '',
  verified TEXT DEFAULT '', reflection TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
-- คิวเหตุการณ์สำหรับเรียลไทม์: ทุกเครื่องถามเฉพาะเหตุการณ์ที่ใหม่กว่า id ที่เคยเห็น (ใช้ได้บน serverless)
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL, data TEXT NOT NULL DEFAULT '{}', at TEXT NOT NULL
);
`;

const DEFAULTS = {
  course: 'ค30202 คณิตศาสตร์และการประมวลผล 1',
  term: '', teacher: '',
  weight_collect: '70', weight_final: '20', weight_affective: '10', weight_integrated: '0',
  grade_cuts: '80,75,70,65,60,55,50',
};

const plain = res => res.rows.map(r => Object.fromEntries(res.columns.map((c, i) => [c, r[i]])));
const norm = (sql, args) => ({ sql, args: args.map(a => (a === undefined ? null : a)) });

const all = async (sql, ...a) => plain(await client.execute(norm(sql, a)));
const get = async (sql, ...a) => (await all(sql, ...a))[0];
const run = async (sql, ...a) => {
  const r = await client.execute(norm(sql, a));
  return { lastInsertRowid: Number(r.lastInsertRowid), changes: r.rowsAffected };
};
// หลายคำสั่งใน transaction เดียว: [[sql, ...args], ...]
const batch = stmts => client.batch(stmts.map(([sql, ...a]) => norm(sql, a)), 'write');

const ready = (async () => {
  await client.executeMultiple(SCHEMA);
  const cols = (await all('PRAGMA table_info(assessments)')).map(c => c.name);
  for (const [col, ddl] of [['unit', 'INTEGER NOT NULL DEFAULT 1'], ['domain', "TEXT NOT NULL DEFAULT 'K'"]])
    if (!cols.includes(col)) await client.execute(`ALTER TABLE assessments ADD COLUMN ${col} ${ddl}`);
  await batch(Object.entries(DEFAULTS).map(([k, v]) => ['INSERT OR IGNORE INTO settings (k, v) VALUES (?, ?)', k, v]));
})();

const now = () => new Date().toISOString();
const settings = async () => Object.fromEntries((await all('SELECT k, v FROM settings')).map(r => [r.k, r.v]));

module.exports = { client, ready, now, all, get, run, batch, settings };
