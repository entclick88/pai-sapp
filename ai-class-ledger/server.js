require('./env');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ready, now, all, get, run, batch, settings } = require('./db');
const { summary, TRAITS } = require('./calc');
const ai = require('./ai');
const sheets = require('./sheets');

const PORT = +process.env.PORT || 3100;
const PIN = process.env.TEACHER_PIN || '1234';
const PROD = process.env.NODE_ENV === 'production';
if (PROD && (PIN === '1234' || PIN.length < 6)) { console.error('production: ตั้ง TEACHER_PIN ให้ยาวอย่างน้อย 6 ตัวและไม่ใช่ 1234'); process.exit(1); }
const PUB = path.join(__dirname, 'public');
const CATS = ['collect', 'final', 'affective', 'integrated'];

// ---------- โทเค็นครูแบบไม่เก็บสถานะ (ใช้ได้บน serverless: ลงนามด้วย HMAC, หมดอายุใน 12 ชม.) ----------
const SECRET = process.env.SESSION_SECRET || crypto.createHash('sha256').update('ledger:' + PIN).digest('hex');
const sign = p => crypto.createHmac('sha256', SECRET).update(p).digest('base64url');
const newToken = () => { const p = Buffer.from(JSON.stringify({ exp: Date.now() + 12 * 3600e3, n: crypto.randomBytes(6).toString('hex') })).toString('base64url'); return p + '.' + sign(p); };
function validToken(t) {
  const [p, sig] = String(t || '').split('.');
  if (!p || !sig) return false;
  const want = sign(p);
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return false;
  try { return JSON.parse(Buffer.from(p, 'base64url')).exp > Date.now(); } catch { return false; }
}

// ---------- เรียลไทม์: บันทึกเหตุการณ์ลงตาราง แล้วให้ทุกเครื่องถามเป็นระยะ (ดู /api/events) ----------
async function broadcast(type, data = {}) {
  const r = await run('INSERT INTO events (type, data, at) VALUES (?,?,?)', type, JSON.stringify(data), now());
  run('DELETE FROM events WHERE id < ?', r.lastInsertRowid - 500).catch(() => {});
}

// ---------- จำกัดการเดา PIN / รหัสนักเรียน (ต่อ IP ต่อนาที; ทำงานต่อ instance แบบ best-effort) ----------
const hits = new Map();
const clientIp = req => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim();
function limit(req, key, max) {
  const k = key + clientIp(req), t = Date.now(), a = (hits.get(k) || []).filter(x => t - x < 60000);
  a.push(t); hits.set(k, a);
  if (hits.size > 5000) hits.clear();
  if (a.length > max) throw Object.assign(new Error('ลองบ่อยเกินไป รอสักครู่แล้วลองใหม่'), { status: 429 });
}

// ---------- helpers ----------
const err = (status, message) => Object.assign(new Error(message), { status });
const readBody = req => new Promise((ok, bad) => {
  if (req.body !== undefined && typeof req.body === 'object') return ok(req.body || {}); // Vercel แปลงให้แล้ว
  let b = '';
  req.on('data', d => { b += d; if (b.length > 2e6) { bad(err(413, 'ข้อมูลใหญ่เกินไป')); req.destroy(); } });
  req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch { bad(err(400, 'JSON ไม่ถูกต้อง')); } });
});
const num = (v, d = null) => (v === '' || v == null || isNaN(+v) ? d : +v);
const newCode = () => crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
const isTeacher = req => validToken(req.headers['x-token']);
// ตัวที่พิมพ์สับสนกันง่าย (O/0, I/L/1) ถือว่าเท่ากัน — รหัสจริงเป็นเลขฐาน 16 อยู่แล้ว ส่วนรหัสสาธิต DEMO01 มีตัว O
const fold = c => String(c || '').trim().toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1');
const studentByCode = async code => (await all('SELECT * FROM students')).find(s => fold(s.code) === fold(code));
const setSetting = (k, v) => run('INSERT INTO settings (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v', k, String(v));

// ---------- routes: [method, regex, auth, handler] ----------
const routes = [];
const on = (m, p, auth, fn) => routes.push([m, new RegExp('^' + p + '$'), auth, fn]);

// NO_PIN=1: ข้าม PIN เฉพาะเมื่อเปิดจากเครื่องนี้เอง (loopback) — ใช้ทดลองในเครื่อง ปิดเสมอเมื่อ production
const localNoPin = req => !PROD && process.env.NO_PIN === '1' && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)
  && !req.headers['x-forwarded-for'];
on('GET', '/api/health', 'open', () => ({ ok: true }));
on('GET', '/api/auth-mode', 'open', req => ({ noPin: localNoPin(req) }));
on('POST', '/api/login', 'open', async (req, res, b) => {
  limit(req, 'login', 10);
  if (b.pin !== PIN && !localNoPin(req)) throw err(401, 'PIN ไม่ถูกต้อง');
  return { token: newToken() };
});
on('GET', '/api/config', 'teacher', async () => ({
  settings: await settings(), traits: TRAITS, aiEnabled: ai.enabled(),
  sheetsReady: sheets.ready(), autoExport: process.env.AUTO_EXPORT === '1',
  lastExport: JSON.parse((await settings()).last_export || 'null'),
}));
on('PUT', '/api/settings', 'teacher', async (req, res, b) => {
  const allowed = ['course', 'term', 'teacher', 'weight_collect', 'weight_final', 'weight_affective', 'weight_integrated', 'grade_cuts'];
  for (const k of allowed) if (k in b) await setSetting(k, b[k]);
  await broadcast('summary');
  return settings();
});

// นักเรียน
on('GET', '/api/students', 'teacher', () => all('SELECT * FROM students ORDER BY no, id'));
on('POST', '/api/students/bulk', 'teacher', async (req, res, b) => {
  // บรรทัดละคน: เลขที่,เลขประจำตัว,ชื่อ-สกุล[,ห้อง] (คั่นด้วย , หรือ Tab)
  const stmts = [];
  for (const line of String(b.text || '').split(/\r?\n/)) {
    const p = line.split(/[,\t]/).map(s => s.trim());
    if (p.length < 3 || !p[2]) continue;
    stmts.push(['INSERT INTO students (no,sid,name,section,code) VALUES (?,?,?,?,?)', num(p[0]), p[1], p[2], p[3] || '', newCode()]);
  }
  if (stmts.length) await batch(stmts);
  await broadcast('students');
  return { added: stmts.length };
});
on('POST', '/api/students/sync-from-sheet', 'teacher', async () => {
  // ดึงรายชื่อ (เลขประจำตัว+ชื่อ) จากแท็บ Grades ของชีทจริง — ปรับชื่อ/เลขที่ถ้ามีอยู่แล้ว ไม่ลบใคร
  const roster = await sheets.readRoster();
  const have = new Map((await all('SELECT id, sid FROM students')).map(s => [s.sid, s.id]));
  const stmts = [];
  let added = 0, updated = 0;
  for (const r of roster) {
    if (have.has(r.sid)) { stmts.push(['UPDATE students SET no=?, name=? WHERE id=?', r.no, r.name, have.get(r.sid)]); updated++; }
    else { stmts.push(['INSERT INTO students (no,sid,name,section,code) VALUES (?,?,?,?,?)', r.no, r.sid, r.name, '', newCode()]); added++; }
  }
  if (stmts.length) await batch(stmts);
  await broadcast('students');
  return { added, updated };
});
on('DELETE', '/api/students/(\\d+)', 'teacher', async (req, res, b, m) => {
  const id = +m[1];
  await batch(['scores', 'attendance', 'traits', 'submissions', 'ai_logs'].map(t => [`DELETE FROM ${t} WHERE student_id=?`, id]).concat([['DELETE FROM students WHERE id=?', id]]));
  await broadcast('students');
  return { ok: true };
});

// ชั่วโมงเรียน
on('GET', '/api/hours', 'teacher', () => all('SELECT * FROM hours ORDER BY seq'));
on('POST', '/api/hours', 'teacher', async (req, res, b) => {
  if (!b.topic) throw err(400, 'ต้องระบุหัวข้อ');
  const seq = num(b.seq) ?? (((await get('SELECT MAX(seq) m FROM hours')).m || 0) + 1);
  const r = await run('INSERT INTO hours (seq,date,topic,indicator,ai_focus) VALUES (?,?,?,?,?)',
    seq, b.date || new Date().toISOString().slice(0, 10), b.topic, b.indicator || '', b.ai_focus || '');
  await broadcast('hours');
  return get('SELECT * FROM hours WHERE id=?', r.lastInsertRowid);
});
on('PUT', '/api/hours/(\\d+)', 'teacher', async (req, res, b, m) => {
  for (const k of ['date', 'topic', 'indicator', 'ai_focus', 'plan', 'record'])
    if (k in b) await run(`UPDATE hours SET ${k}=? WHERE id=?`, String(b[k]), +m[1]);
  await broadcast('hours');
  return get('SELECT * FROM hours WHERE id=?', +m[1]);
});
on('DELETE', '/api/hours/(\\d+)', 'teacher', async (req, res, b, m) => {
  const id = +m[1];
  await batch([['DELETE FROM attendance WHERE hour_id=?', id], ['UPDATE assessments SET hour_id=NULL WHERE hour_id=?', id],
    ['UPDATE ai_logs SET hour_id=NULL WHERE hour_id=?', id], ['DELETE FROM hours WHERE id=?', id]]);
  await broadcast('hours');
  return { ok: true };
});

// งาน/การประเมิน
on('GET', '/api/assessments', 'teacher', () => all('SELECT * FROM assessments ORDER BY id'));
on('POST', '/api/assessments', 'teacher', async (req, res, b) => {
  if (!b.title) throw err(400, 'ต้องระบุชื่องาน');
  if (!CATS.includes(b.category || 'collect')) throw err(400, 'หมวดไม่ถูกต้อง');
  const unit = num(b.unit, 1), domain = b.domain || 'K';
  if (!(unit >= 1 && unit <= 6) || !['K', 'P', 'A'].includes(domain)) throw err(400, 'หน่วยต้อง 1–6 และด้านต้องเป็น K/P/A');
  const r = await run('INSERT INTO assessments (hour_id,title,category,unit,domain,max,rubric,open) VALUES (?,?,?,?,?,?,?,?)',
    num(b.hour_id), b.title, b.category || 'collect', unit, domain, num(b.max, 10), b.rubric || '', b.open ? 1 : 0);
  await broadcast('assessments');
  return get('SELECT * FROM assessments WHERE id=?', r.lastInsertRowid);
});
on('PUT', '/api/assessments/(\\d+)', 'teacher', async (req, res, b, m) => {
  const id = +m[1];
  if ('title' in b) await run('UPDATE assessments SET title=? WHERE id=?', b.title, id);
  if ('rubric' in b) await run('UPDATE assessments SET rubric=? WHERE id=?', b.rubric, id);
  if ('max' in b) await run('UPDATE assessments SET max=? WHERE id=?', num(b.max, 10), id);
  if ('category' in b && CATS.includes(b.category)) await run('UPDATE assessments SET category=? WHERE id=?', b.category, id);
  if ('unit' in b && num(b.unit) >= 1 && num(b.unit) <= 6) await run('UPDATE assessments SET unit=? WHERE id=?', num(b.unit), id);
  if ('domain' in b && ['K', 'P', 'A'].includes(b.domain)) await run('UPDATE assessments SET domain=? WHERE id=?', b.domain, id);
  if ('open' in b) await run('UPDATE assessments SET open=? WHERE id=?', b.open ? 1 : 0, id);
  await broadcast('assessments'); await broadcast('summary');
  return get('SELECT * FROM assessments WHERE id=?', id);
});
on('DELETE', '/api/assessments/(\\d+)', 'teacher', async (req, res, b, m) => {
  const id = +m[1];
  await batch([['DELETE FROM scores WHERE assessment_id=?', id], ['DELETE FROM submissions WHERE assessment_id=?', id], ['DELETE FROM assessments WHERE id=?', id]]);
  await broadcast('assessments'); await broadcast('summary');
  return { ok: true };
});

// คะแนน (บันทึกทีละช่อง แล้วกระจายให้ทุกเครื่อง)
async function saveScore(student_id, assessment_id, score, note, source) {
  const a = await get('SELECT max FROM assessments WHERE id=?', assessment_id);
  if (!a || !(await get('SELECT 1 x FROM students WHERE id=?', student_id))) throw err(404, 'ไม่พบนักเรียนหรืองาน');
  if (score != null && (score < 0 || score > a.max)) throw err(400, `คะแนนต้องอยู่ระหว่าง 0–${a.max}`);
  await run(`INSERT INTO scores (student_id,assessment_id,score,note,source,updated_at) VALUES (?,?,?,?,?,?)
       ON CONFLICT(student_id,assessment_id) DO UPDATE SET score=excluded.score, note=excluded.note, source=excluded.source, updated_at=excluded.updated_at`,
    student_id, assessment_id, score, note || '', source, now());
  await broadcast('score', { student_id, assessment_id, score });
}
on('GET', '/api/scores', 'teacher', () => all('SELECT * FROM scores'));
on('PUT', '/api/scores', 'teacher', async (req, res, b) => {
  await saveScore(+b.student_id, +b.assessment_id, num(b.score), b.note, 'teacher');
  return { ok: true };
});
on('GET', '/api/summary', 'teacher', () => summary());

// เช็คชื่อ
on('GET', '/api/attendance', 'teacher', () => all('SELECT * FROM attendance'));
on('PUT', '/api/attendance', 'teacher', async (req, res, b) => {
  if (b.status && !['P', 'S', 'A', 'L'].includes(b.status)) throw err(400, 'สถานะไม่ถูกต้อง');
  if (!b.status) await run('DELETE FROM attendance WHERE hour_id=? AND student_id=?', +b.hour_id, +b.student_id);
  else await run(`INSERT INTO attendance (hour_id,student_id,status,updated_at) VALUES (?,?,?,?)
    ON CONFLICT(hour_id,student_id) DO UPDATE SET status=excluded.status, updated_at=excluded.updated_at`,
    +b.hour_id, +b.student_id, b.status, now());
  await broadcast('attendance', { hour_id: +b.hour_id, student_id: +b.student_id, status: b.status || '' });
  return { ok: true };
});
on('POST', '/api/attendance/all', 'teacher', async (req, res, b) => {
  const st = b.status || 'P';
  await batch((await all('SELECT id FROM students')).map(s => ['INSERT OR IGNORE INTO attendance (hour_id,student_id,status,updated_at) VALUES (?,?,?,?)', +b.hour_id, s.id, st, now()]));
  await broadcast('attendance');
  return { ok: true };
});

// คุณลักษณะ
on('GET', '/api/traits', 'teacher', () => all('SELECT * FROM traits'));
on('PUT', '/api/traits', 'teacher', async (req, res, b) => {
  if (!TRAITS.includes(b.trait)) throw err(400, 'คุณลักษณะไม่ถูกต้อง');
  if (b.level == null || b.level === '') await run('DELETE FROM traits WHERE student_id=? AND trait=?', +b.student_id, b.trait);
  else await run(`INSERT INTO traits (student_id,trait,level) VALUES (?,?,?)
    ON CONFLICT(student_id,trait) DO UPDATE SET level=excluded.level`, +b.student_id, b.trait, Math.max(0, Math.min(3, +b.level)));
  await broadcast('traits');
  return { ok: true };
});

// บันทึกการใช้ AI + งานที่ส่ง
on('GET', '/api/ailogs', 'teacher', () => all(`SELECT l.*, s.name, s.no FROM ai_logs l JOIN students s ON s.id=l.student_id ORDER BY l.id DESC LIMIT 500`));
on('GET', '/api/submissions', 'teacher', () => all(`SELECT x.*, s.name, s.no, a.title, a.max FROM submissions x
  JOIN students s ON s.id=x.student_id JOIN assessments a ON a.id=x.assessment_id ORDER BY x.id DESC LIMIT 500`));
on('POST', '/api/submissions/(\\d+)/ai-grade', 'teacher', async (req, res, b, m) => {
  const x = await get(`SELECT x.*, a.title, a.rubric, a.max FROM submissions x JOIN assessments a ON a.id=x.assessment_id WHERE x.id=?`, +m[1]);
  if (!x) throw err(404, 'ไม่พบงาน');
  const r = await ai.grade({ title: x.title, rubric: x.rubric, max: x.max, answer: x.answer });
  await run(`UPDATE submissions SET ai_score=?, ai_feedback=?, status='ai_graded' WHERE id=?`, r.score, r.feedback || '', x.id);
  await broadcast('submissions');
  return r;
});
on('POST', '/api/submissions/(\\d+)/approve', 'teacher', async (req, res, b, m) => {
  const x = await get('SELECT * FROM submissions WHERE id=?', +m[1]);
  if (!x) throw err(404, 'ไม่พบงาน');
  const score = num(b.score, x.ai_score);
  if (score == null) throw err(400, 'ยังไม่มีคะแนน');
  await saveScore(x.student_id, x.assessment_id, score, b.note ?? x.ai_feedback, x.ai_score === score ? 'ai' : 'teacher');
  await run(`UPDATE submissions SET status='approved' WHERE id=?`, x.id);
  await broadcast('submissions');
  return { ok: true };
});

// AI ช่วยครู
on('POST', '/api/ai/plan', 'teacher', async (req, res, b) => {
  const h = await get('SELECT * FROM hours WHERE id=?', +b.hour_id);
  if (!h) throw err(404, 'ไม่พบชั่วโมง');
  const text = await ai.plan({ ...h, course: (await settings()).course });
  await run('UPDATE hours SET plan=? WHERE id=?', text, h.id);
  await broadcast('hours');
  return { plan: text };
});
on('POST', '/api/ai/insights', 'teacher', async () => {
  const rows = [];
  for (const r of await summary()) {
    rows.push({
      no: r.student.no, name: r.student.name, total: r.total, grade: r.grade, attendance: r.attendance,
      ai_logs: (await get('SELECT COUNT(*) n FROM ai_logs WHERE student_id=?', r.student.id)).n,
      missing: (await get(`SELECT COUNT(*) n FROM assessments a WHERE NOT EXISTS (SELECT 1 FROM scores s WHERE s.assessment_id=a.id AND s.student_id=? AND s.score IS NOT NULL)`, r.student.id)).n,
    });
  }
  return { text: await ai.insights({ course: (await settings()).course, students: rows }) };
});

// Export
on('POST', '/api/export', 'teacher', async (req, res, b) => {
  try {
    const r = await sheets.exportAll({ dry: !!b.dry });
    if (!b.dry) { await setSetting('last_export', JSON.stringify(r)); await broadcast('export', { at: r.at, cells: r.cells }); }
    return r;
  } catch (e) {
    if (!b.dry) await setSetting('last_export', JSON.stringify({ error: e.message, at: now() }));
    throw e;
  }
});

// เหตุการณ์เรียลไทม์: since=0 → ขอ id ล่าสุดเพื่อเริ่มติดตาม; ไม่งั้นคืนเหตุการณ์ที่ใหม่กว่า
on('GET', '/api/events', 'teacher', async req => {
  const since = num(new URL(req.url, 'http://x').searchParams.get('since'), 0);
  if (!since) return { events: [], last: (await get('SELECT COALESCE(MAX(id),0) m FROM events')).m };
  const ev = await all('SELECT id, type, data FROM events WHERE id > ? ORDER BY id LIMIT 200', since);
  return { events: ev.map(e => ({ type: e.type, ...JSON.parse(e.data) })), last: ev.length ? ev[ev.length - 1].id : since };
});

// ---------- ฝั่งนักเรียน (ใช้รหัสส่วนตัว) ----------
on('POST', '/api/student/me', 'open', async (req, res, b) => {
  limit(req, 'code', 60);
  const s = await studentByCode(b.code);
  if (!s) throw err(404, 'ไม่พบรหัสนี้');
  const row = (await summary()).find(r => r.student.id === s.id);
  return {
    name: s.name, no: s.no, course: (await settings()).course,
    total: row.total, grade: row.grade, attendance: row.attendance,
    hours: await all('SELECT id,seq,date,topic,ai_focus FROM hours ORDER BY seq'),
    assessments: await all(`SELECT a.id,a.title,a.category,a.max,a.open,a.hour_id,s.score,s.note FROM assessments a
      LEFT JOIN scores s ON s.assessment_id=a.id AND s.student_id=? ORDER BY a.id`, s.id),
    logs: await all('SELECT * FROM ai_logs WHERE student_id=? ORDER BY id DESC LIMIT 50', s.id),
  };
});
on('POST', '/api/student/log', 'open', async (req, res, b) => {
  limit(req, 'code', 60);
  const s = await studentByCode(b.code);
  if (!s) throw err(404, 'ไม่พบรหัสนี้');
  if (!b.prompt || String(b.prompt).trim().length < 3) throw err(400, 'ต้องใส่ prompt ที่ใช้');
  await run(`INSERT INTO ai_logs (student_id,hour_id,tool,prompt,output,verified,reflection,created_at) VALUES (?,?,?,?,?,?,?,?)`,
    s.id, num(b.hour_id), String(b.tool || '').slice(0, 80), String(b.prompt).slice(0, 4000),
    String(b.output || '').slice(0, 8000), String(b.verified || '').slice(0, 2000), String(b.reflection || '').slice(0, 2000), now());
  await broadcast('ailogs');
  return { ok: true };
});
on('POST', '/api/student/submit', 'open', async (req, res, b) => {
  limit(req, 'code', 60);
  const s = await studentByCode(b.code);
  const a = await get('SELECT * FROM assessments WHERE id=?', +b.assessment_id);
  if (!s || !a) throw err(404, 'ไม่พบข้อมูล');
  if (!a.open) throw err(403, 'งานนี้ปิดรับการส่งแล้ว');
  if (!b.answer || !String(b.answer).trim()) throw err(400, 'ยังไม่ได้เขียนคำตอบ');
  await run('INSERT INTO submissions (student_id,assessment_id,answer,created_at) VALUES (?,?,?,?)',
    s.id, a.id, String(b.answer).slice(0, 10000), now());
  await broadcast('submissions');
  return { ok: true };
});

// ---------- HTTP handler (ใช้ทั้งเซิร์ฟเวอร์ในเครื่องและ Vercel function) ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const send = (status, body, type = 'application/json; charset=utf-8') => { res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' }); res.end(body); };
  try {
    if (url.pathname === '/health') return send(200, 'ok', 'text/plain');
    if (url.pathname.startsWith('/api/')) {
      await ready;
      for (const [method, re, auth, fn] of routes) {
        const m = url.pathname.match(re);
        if (req.method !== method || !m) continue;
        if (auth === 'teacher' && !isTeacher(req)) throw err(401, 'ต้องเข้าสู่ระบบ');
        const body = method === 'GET' || method === 'DELETE' ? {} : await readBody(req);
        return send(200, JSON.stringify(await fn(req, res, body, m)));
      }
      throw err(404, 'ไม่พบ API');
    }
    const file = url.pathname === '/' ? '/index.html' : url.pathname === '/student' ? '/student.html' : url.pathname;
    const full = path.join(PUB, path.normalize(file));
    if (!full.startsWith(PUB) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) throw err(404, 'ไม่พบหน้า');
    res.writeHead(200, { 'content-type': MIME[path.extname(full)] || 'application/octet-stream' });
    fs.createReadStream(full).pipe(res);
  } catch (e) {
    if (res.headersSent) return res.end();
    send(e.status || 500, JSON.stringify({ error: e.status ? e.message : 'เกิดข้อผิดพลาดในระบบ' }));
    if (!e.status) console.error(e);
  }
}

const server = http.createServer(handle);
if (require.main === module) server.listen(PORT, '0.0.0.0', () => console.log(`AI Class Ledger  http://localhost:${PORT}  (PIN ครู: ${PIN === '1234' ? '1234 — เปลี่ยนด้วย TEACHER_PIN' : '***'})`));
module.exports = { server, handle };
