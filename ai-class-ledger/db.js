const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dir = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(dir, { recursive: true });
const db = new DatabaseSync(process.env.DB_FILE || path.join(dir, 'ledger.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
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
  hour_id INTEGER REFERENCES hours(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'collect', -- collect | final | affective | integrated
  unit INTEGER NOT NULL DEFAULT 1,          -- หน่วยการเรียนรู้ 1-6 (ใช้กับ collect)
  domain TEXT NOT NULL DEFAULT 'K',         -- K ความรู้ | P กระบวนการ | A เจตคติ
  max REAL NOT NULL DEFAULT 10,
  rubric TEXT DEFAULT '',
  open INTEGER NOT NULL DEFAULT 0          -- 1 = นักเรียนส่งงานได้
);
CREATE TABLE IF NOT EXISTS scores (
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  score REAL, note TEXT DEFAULT '',
  source TEXT DEFAULT 'teacher',           -- teacher | ai
  updated_at TEXT NOT NULL,
  PRIMARY KEY (student_id, assessment_id)
);
CREATE TABLE IF NOT EXISTS attendance (
  hour_id INTEGER NOT NULL REFERENCES hours(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status TEXT NOT NULL,                    -- P | S | A | L
  updated_at TEXT NOT NULL,
  PRIMARY KEY (hour_id, student_id)
);
CREATE TABLE IF NOT EXISTS traits (
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  trait TEXT NOT NULL, level INTEGER NOT NULL,
  PRIMARY KEY (student_id, trait)
);
CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  answer TEXT NOT NULL, ai_score REAL, ai_feedback TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'submitted', -- submitted | ai_graded | approved
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ai_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  hour_id INTEGER REFERENCES hours(id) ON DELETE SET NULL,
  tool TEXT DEFAULT '', prompt TEXT NOT NULL, output TEXT DEFAULT '',
  verified TEXT DEFAULT '', reflection TEXT DEFAULT '',
  created_at TEXT NOT NULL
);
`);

// ฐานข้อมูลเดิมที่สร้างก่อนเพิ่มคอลัมน์หน่วย/ด้าน
for (const [col, ddl] of [['unit', 'INTEGER NOT NULL DEFAULT 1'], ['domain', "TEXT NOT NULL DEFAULT 'K'"]])
  if (!db.prepare('PRAGMA table_info(assessments)').all().some(c => c.name === col)) db.exec(`ALTER TABLE assessments ADD COLUMN ${col} ${ddl}`);

const DEFAULTS = {
  course: 'ค30202 คณิตศาสตร์และการประมวลผล 1',
  term: '', teacher: '',
  weight_collect: '70', weight_final: '20', weight_affective: '10', weight_integrated: '0',
  grade_cuts: '80,75,70,65,60,55,50',
};
for (const [k, v] of Object.entries(DEFAULTS))
  db.prepare('INSERT OR IGNORE INTO settings (k, v) VALUES (?, ?)').run(k, v);

const now = () => new Date().toISOString();
const all = (sql, ...a) => db.prepare(sql).all(...a);
const get = (sql, ...a) => db.prepare(sql).get(...a);
const run = (sql, ...a) => db.prepare(sql).run(...a);
const settings = () => Object.fromEntries(all('SELECT k, v FROM settings').map(r => [r.k, r.v]));

module.exports = { db, now, all, get, run, settings };
