// เขียนลงแท็บเดิมของชีท ปพ.5 (Grades / Class Attendance / Desirable Characteristics) ผ่าน Sheets REST API
// เขียนเฉพาะ "ช่องกรอก" เท่านั้น — ช่องที่เป็นสูตร (ยอดรวมหน่วย, เกรด ฯลฯ) ไม่ถูกแตะ ชีทคำนวณเองต่อ
const crypto = require('crypto');
const fs = require('fs');
const { all, settings } = require('./db');
const { CRITICAL, DESIRABLE } = require('./calc');

const b64 = b => Buffer.from(b).toString('base64url');
const cfg = () => ({
  id: process.env.SHEET_ID || '1-Qy835BCZxdrwzJUBN4aGi7jVw8dHX_RSErAIjGfH4o',
  file: process.env.GOOGLE_SA_FILE,
});

// ----- ผังของชีท (อ่านจากไฟล์ต้นแบบ) -----
const GRADES = 'Grades', ATT = 'Class Attendance', DC = 'Desirable Characteristics', LOG_TAB = 'ระบบ-บันทึกการใช้AI';
const FIRST = { grades: 7, att: 5, dc: 9 };          // แถวแรกของนักเรียน
const LAST = { grades: 400, att: 400, dc: 400 };      // อ่านเผื่อไว้ ถึงแถวนี้
const UNIT0 = 7, UNIT_W = 16, UNITS = 6;               // หน่วยที่ 1 เริ่มคอลัมน์ G, กว้างหน่วยละ 16 คอลัมน์
const SLOTS = { K: [0, 5], P: [6, 5], A: [12, 2] };    // [ออฟเซ็ตเริ่ม, จำนวนช่อง] ในแต่ละหน่วย
const SPECIAL = { final: 106, affective: 104, integrated: 103 }; // DB, CZ, CY
const ATT_FIRST_COL = 5, ATT_HOURS = 84, ATT_DATE_ROW = 4, ATT_SYM = { P: '/', S: 'S', A: 'A', L: 'L' };
const CRIT_COL0 = 5, DES_COL0 = 10;                   // E.. และ J..

const colName = n => { let s = ''; for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };
const q = t => `'${t.replace(/'/g, "''")}'`;
const cell = (tab, col, row) => `${q(tab)}!${colName(col)}${row}`;

// ----- Google auth + REST -----
let tok = { v: null, exp: 0 };
// คีย์ service account: GOOGLE_SA_JSON (เนื้อไฟล์ทั้งก้อน — เหมาะกับโฮสต์ออนไลน์) หรือ GOOGLE_SA_FILE (พาธไฟล์ในเครื่อง)
const ready = () => !!(process.env.GOOGLE_SA_JSON || (cfg().file && fs.existsSync(cfg().file)));
async function token() {
  if (tok.v && Date.now() < tok.exp) return tok.v;
  if (!ready()) throw Object.assign(new Error('ยังไม่ได้ตั้งค่า GOOGLE_SA_FILE หรือ GOOGLE_SA_JSON (service account)'), { status: 503 });
  const sa = JSON.parse(process.env.GOOGLE_SA_JSON || fs.readFileSync(cfg().file, 'utf8'));
  const iat = Math.floor(Date.now() / 1000);
  const head = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600,
  }));
  const sig = crypto.sign('RSA-SHA256', Buffer.from(`${head}.${claim}`), sa.private_key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claim}.${sig}` }),
  });
  const j = await r.json();
  if (!r.ok) throw Object.assign(new Error('Google auth: ' + (j.error_description || j.error)), { status: 502 });
  tok = { v: j.access_token, exp: Date.now() + (j.expires_in - 120) * 1000 };
  return tok.v;
}
async function g(path, opt = {}) {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cfg().id}${path}`, {
    ...opt, headers: { authorization: 'Bearer ' + await token(), 'content-type': 'application/json' },
  });
  const j = await r.json();
  if (!r.ok) throw Object.assign(new Error('Sheets: ' + (j.error?.message || r.status)), { status: 502 });
  return j;
}
const getRanges = async ranges => (await g('/values:batchGet?valueRenderOption=UNFORMATTED_VALUE&' +
  ranges.map(r => 'ranges=' + encodeURIComponent(r)).join('&'))).valueRanges.map(v => v.values || []);

const sidKey = v => (v == null || v === '' ? '' : String(typeof v === 'number' ? Math.round(v) : v).trim());
const rowMap = (values, first) => {
  const m = new Map();
  values.forEach((r, i) => { const k = sidKey(r[0]); if (k && !m.has(k)) m.set(k, first + i); });
  return m;
};

// อ่านเลขประจำตัวของนักเรียนจากชีทจริง เพื่อจับคู่แถว
async function readState() {
  const [gv, av, dv] = await getRanges([
    `${q(GRADES)}!D${FIRST.grades}:D${LAST.grades}`, `${q(ATT)}!B${FIRST.att}:B${LAST.att}`, `${q(DC)}!B${FIRST.dc}:B${LAST.dc}`]);
  return { grades: rowMap(gv, FIRST.grades), att: rowMap(av, FIRST.att), dc: rowMap(dv, FIRST.dc) };
}

async function readRoster() {
  const [v] = await getRanges([`${q(GRADES)}!C${FIRST.grades}:E${LAST.grades}`]);
  return v.map((r, i) => ({ no: i + 1, sid: sidKey(r[1]), name: String(r[2] || '').trim() })).filter(x => x.sid && x.name);
}

// ----- แผนการเขียน (ฟังก์ชันล้วน ทดสอบได้โดยไม่ต้องต่อ Google) -----
function mapAssessments(assessments) {
  const slots = new Map(), warnings = [], used = {};
  for (const a of assessments) {
    if (a.category !== 'collect') continue;
    const u = a.unit || 1, d = a.domain || 'K';
    if (u < 1 || u > UNITS || !SLOTS[d]) { warnings.push(`"${a.title}": หน่วย/ด้านไม่ถูกต้อง (หน่วย 1–${UNITS}, K/P/A)`); continue; }
    const key = u + d, n = used[key] = (used[key] || 0) + 1;
    if (n > SLOTS[d][1]) { warnings.push(`"${a.title}": หน่วย ${u} ด้าน ${d} มีช่องกรอกแค่ ${SLOTS[d][1]} ช่อง — เกิน จึงไม่ถูกส่งออก`); continue; }
    slots.set(a.id, UNIT0 + UNIT_W * (u - 1) + SLOTS[d][0] + n - 1);
  }
  return { slots, warnings };
}

function plan({ state, assessments, scores, students, hours, att, traits, weights }) {
  const { slots, warnings } = mapAssessments(assessments);
  const data = [], unmatched = new Set();
  const put = (tab, col, row, v) => data.push({ range: cell(tab, col, row), values: [[v]] });
  const sc = new Map(scores.map(s => [s.student_id + ':' + s.assessment_id, s.score]));
  const hasState = !!state;

  // คะแนนเต็มของแต่ละช่อง (แถว 5)
  for (const a of assessments) if (slots.has(a.id)) put(GRADES, slots.get(a.id), 5, a.max);

  for (const [i, s] of students.entries()) {
    const k = sidKey(s.sid);
    // ไม่มีสถานะชีท (ยังไม่ต่อ Google) → สมมติเรียงแถวตามลำดับ เพื่อแสดงตัวอย่างเท่านั้น
    const gr = hasState ? state.grades.get(k) : FIRST.grades + i;
    const ar = hasState ? state.att.get(k) : FIRST.att + i;
    const dr = hasState ? state.dc.get(k) : FIRST.dc + i;
    if (hasState && !gr) { unmatched.add(`${s.no ?? ''} ${s.name} (${s.sid || 'ไม่มีเลขประจำตัว'})`); continue; }

    for (const a of assessments) {
      const v = sc.get(s.id + ':' + a.id);
      if (v != null && slots.has(a.id)) put(GRADES, slots.get(a.id), gr, v);
    }
    // ช่องรวมพิเศษ: คิดเป็นคะแนนตามน้ำหนักของหมวด (DB = สอบปลายภาค, CZ = คุณลักษณะ, CY = บูรณาการ)
    for (const [cat, col] of Object.entries(SPECIAL)) {
      let got = 0, max = 0;
      for (const a of assessments.filter(x => x.category === cat)) { const v = sc.get(s.id + ':' + a.id); if (v != null) { got += v; max += a.max; } }
      if (max) put(GRADES, col, gr, Math.round((got / max) * weights[cat] * 10) / 10);
    }
    for (const h of hours) {
      const st = att.get(h.id + ':' + s.id);
      if (st && ar && h.seq >= 1 && h.seq <= ATT_HOURS) put(ATT, ATT_FIRST_COL + h.seq - 1, ar, ATT_SYM[st]);
    }
    if (dr) {
      CRITICAL.forEach((t, i) => { const v = traits.get(s.id + ':' + t); if (v != null) put(DC, CRIT_COL0 + i, dr, v); });
      DESIRABLE.forEach((t, i) => { const v = traits.get(s.id + ':' + t); if (v != null) put(DC, DES_COL0 + i, dr, v); });
    }
  }
  for (const h of hours) if (h.date && h.seq >= 1 && h.seq <= ATT_HOURS) put(ATT, ATT_FIRST_COL + h.seq - 1, ATT_DATE_ROW, h.date);

  const mapping = assessments.map(a => ({
    title: a.title, category: a.category,
    to: slots.has(a.id) ? `${GRADES}!${colName(slots.get(a.id))}` : (SPECIAL[a.category] ? `${GRADES}!${colName(SPECIAL[a.category])} (รวมตามน้ำหนัก ${weights[a.category]} คะแนน)` : '—'),
  }));
  if (hasState && !state.att.size) warnings.push('ไม่พบเลขประจำตัวในแท็บ Class Attendance');
  return { data, mapping, warnings, unmatched: [...unmatched], hasState };
}

async function load() {
  const st = await settings();
  return {
    students: await all('SELECT * FROM students ORDER BY no, id'),
    assessments: await all('SELECT * FROM assessments ORDER BY id'),
    scores: await all('SELECT * FROM scores'),
    hours: await all('SELECT * FROM hours ORDER BY seq'),
    att: new Map((await all('SELECT * FROM attendance')).map(a => [a.hour_id + ':' + a.student_id, a.status])),
    traits: new Map((await all('SELECT * FROM traits')).map(t => [t.student_id + ':' + t.trait, t.level])),
    weights: { final: +st.weight_final, affective: +st.weight_affective, integrated: +st.weight_integrated },
  };
}

async function logRows() {
  const logs = await all(`SELECT l.*, s.name, s.no, h.seq FROM ai_logs l JOIN students s ON s.id=l.student_id
    LEFT JOIN hours h ON h.id=l.hour_id ORDER BY l.id`);
  return [['เวลา', 'เลขที่', 'ชื่อ-สกุล', 'ชม.', 'เครื่องมือ', 'Prompt', 'ผลที่ได้', 'วิธีตรวจสอบ', 'สะท้อนคิด'],
    ...logs.map(l => [l.created_at, l.no, l.name, l.seq ?? '', l.tool, l.prompt, l.output, l.verified, l.reflection])];
}

async function exportAll({ dry = false } = {}) {
  const d = await load();
  const state = ready() ? await readState() : null;
  const p = plan({ ...d, state });
  const summary = { mapping: p.mapping, warnings: p.warnings, unmatched: p.unmatched, cells: p.data.length, matchedAgainstSheet: p.hasState };
  if (dry) return { dry: true, sheetId: cfg().id, ...summary, sample: p.data.slice(0, 8) };

  if (!state) throw Object.assign(new Error('ยังไม่ได้ตั้งค่า GOOGLE_SA_FILE หรือ GOOGLE_SA_JSON (service account)'), { status: 503 });
  const meta = await g('?fields=sheets.properties.title');
  if (!meta.sheets.some(s => s.properties.title === LOG_TAB))
    await g(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title: LOG_TAB } } }] }) });
  await g('/values:batchClear', { method: 'POST', body: JSON.stringify({ ranges: [q(LOG_TAB)] }) });
  const data = [...p.data, { range: `${q(LOG_TAB)}!A1`, values: await logRows() }];
  for (let i = 0; i < data.length; i += 500)
    await g('/values:batchUpdate', { method: 'POST', body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: data.slice(i, i + 500) }) });
  return { ok: true, at: new Date().toISOString(), ...summary };
}

module.exports = { exportAll, readRoster, ready, plan, mapAssessments, colName };
