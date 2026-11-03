// ทดสอบ flow หลักบนฐานข้อมูลชั่วคราว: node --no-warnings test.js
const os = require('os'), path = require('path'), fs = require('fs'), assert = require('assert');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-'));
process.env.TEACHER_PIN = 'pin';
process.env.ANTHROPIC_API_KEY = ''; process.env.GOOGLE_SA_FILE = ''; process.env.GOOGLE_SA_JSON = ''; // ทดสอบกรณีไม่มีคีย์ แม้เครื่องมี .env
const { server } = require('./server');

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://localhost:' + server.address().port;
  let tok = '';
  const call = async (m, u, b) => {
    const r = await fetch(base + u, { method: m, headers: { 'content-type': 'application/json', 'x-token': tok }, body: b ? JSON.stringify(b) : undefined });
    return { status: r.status, body: await r.json() };
  };
  const ok = async (m, u, b) => { const r = await call(m, u, b); assert.equal(r.status, 200, `${m} ${u} → ${r.status} ${JSON.stringify(r.body)}`); return r.body; };

  assert.equal((await call('GET', '/api/students')).status, 401, 'ต้อง login');
  assert.equal((await call('POST', '/api/login', { pin: 'x' })).status, 401);
  tok = (await ok('POST', '/api/login', { pin: 'pin' })).token;

  // SSE ต้องได้เหตุการณ์คะแนนแบบเรียลไทม์
  const events = [];
  const ctl = new AbortController();
  fetch(`${base}/api/events?t=${tok}`, { signal: ctl.signal }).then(async r => {
    const rd = r.body.getReader(); const dec = new TextDecoder();
    for (;;) { const { value, done } = await rd.read(); if (done) break; events.push(dec.decode(value)); }
  }).catch(() => {});

  await ok('POST', '/api/students/bulk', { text: '1,1001,สมชาย ใจดี\n2,1002,สมหญิง เรียนดี\nbad line' });
  const sts = await ok('GET', '/api/students'); assert.equal(sts.length, 2);
  const h = await ok('POST', '/api/hours', { topic: 'ตรวจสอบคำตอบ AI', ai_focus: 'พิสูจน์ซ้ำ' });
  const a1 = await ok('POST', '/api/assessments', { title: 'ใบงาน 1', category: 'collect', max: 10, hour_id: h.id });
  const a2 = await ok('POST', '/api/assessments', { title: 'ปลายภาค', category: 'final', max: 50 });

  await ok('PUT', '/api/scores', { student_id: sts[0].id, assessment_id: a1.id, score: 8 });
  await ok('PUT', '/api/scores', { student_id: sts[0].id, assessment_id: a2.id, score: 40 });
  assert.equal((await call('PUT', '/api/scores', { student_id: sts[0].id, assessment_id: a1.id, score: 11 })).status, 400, 'เกินคะแนนเต็มต้องถูกปฏิเสธ');
  await ok('PUT', '/api/attendance', { hour_id: h.id, student_id: sts[0].id, status: 'P' });
  await ok('PUT', '/api/attendance', { hour_id: h.id, student_id: sts[1].id, status: 'A' });
  await ok('PUT', '/api/traits', { student_id: sts[0].id, trait: 'มีวินัย', level: 3 });

  // 70% × 0.8 + 30% × 0.8 = 80 → เกรด 4
  const sum = await ok('GET', '/api/summary');
  assert.equal(sum[0].total, 80); assert.equal(sum[0].grade, 4);
  assert.equal(sum[0].attendance.pct, 100); assert.equal(sum[1].attendance.pct, 0);
  assert.equal(sum[1].grade, null, 'ยังไม่มีคะแนน → ไม่มีเกรด');

  // ฝั่งนักเรียน
  const me = await ok('POST', '/api/student/me', { code: sts[0].code.toLowerCase() });
  assert.equal(me.total, 80);
  assert.equal((await call('POST', '/api/student/submit', { code: sts[0].code, assessment_id: a1.id, answer: 'x' })).status, 403, 'งานปิดอยู่');
  await ok('PUT', `/api/assessments/${a1.id}`, { open: true });
  await ok('POST', '/api/student/submit', { code: sts[0].code, assessment_id: a1.id, answer: 'คำตอบ' });
  await ok('POST', '/api/student/log', { code: sts[0].code, hour_id: h.id, tool: 'Claude', prompt: 'ช่วยแก้สมการ', verified: 'แทนค่ากลับ' });
  const subs = await ok('GET', '/api/submissions');
  await ok('POST', `/api/submissions/${subs[0].id}/approve`, { score: 9 });
  assert.equal((await ok('GET', '/api/scores')).find(s => s.assessment_id === a1.id && s.student_id === sts[0].id).score, 9);
  assert.equal((await call('POST', '/api/ai/insights')).status, 503, 'ไม่มี API key ต้องแจ้งชัดเจน');

  // Export: dry-run ไม่ต่อ Google, แผนต้องชี้ไปช่องกรอกของแท็บเดิม
  await ok('PUT', `/api/assessments/${a1.id}`, { unit: 2, domain: 'P' });
  const ex = await ok('POST', '/api/export', { dry: true });
  assert.equal(ex.matchedAgainstSheet, false);
  assert.equal(ex.mapping.find(m => m.title === 'ใบงาน 1').to, 'Grades!AC', 'หน่วย 2 ด้าน P ช่องแรก = AC');
  assert(ex.mapping.find(m => m.title === 'ปลายภาค').to.startsWith('Grades!DB'));
  assert.equal((await call('POST', '/api/export', {})).status, 503, 'ยังไม่ตั้ง service account');
  assert.equal((await call('POST', '/api/assessments', { title: 'x', unit: 9 })).status, 400);

  // ผังช่องของชีท: ตรวจกับโครงสร้างจริง (หน่วย 1: K=G-K, P=M-Q, A=S-T; หน่วย 3 เริ่ม AM)
  const { plan, mapAssessments, colName } = require('./sheets');
  const mk = (id, unit, domain, category = 'collect') => ({ id, title: 't' + id, unit, domain, category, max: 10 });
  const m = mapAssessments([mk(1, 1, 'K'), mk(2, 1, 'K'), mk(3, 1, 'P'), mk(4, 1, 'A'), mk(5, 3, 'K'), mk(6, 1, 'A'), mk(7, 1, 'A')]);
  assert.deepEqual([...m.slots].map(([id, c]) => id + ':' + colName(c)), ['1:G', '2:H', '3:M', '4:S', '5:AM', '6:T']);
  assert.equal(m.warnings.length, 1, 'A มีแค่ 2 ช่อง ช่องที่ 3 ต้องเตือน');
  const state = { grades: new Map([['1001', 9]]), att: new Map([['1001', 6]]), dc: new Map([['1001', 12]]) };
  const p = plan({
    state, assessments: [mk(1, 1, 'K'), mk(2, 1, 'K', 'final')],
    students: [{ id: 1, no: 1, sid: '1001', name: 'ก' }, { id: 2, no: 2, sid: '9999', name: 'ข' }],
    scores: [{ student_id: 1, assessment_id: 1, score: 7 }, { student_id: 1, assessment_id: 2, score: 5 }],
    hours: [{ id: 1, seq: 2, date: '2026-11-03' }], att: new Map([['1:1', 'S']]),
    traits: new Map([['1:การเขียน', 3], ['1:มีวินัย', 2]]), weights: { final: 20, affective: 10, integrated: 0 },
  });
  const at = r => p.data.find(d => d.range === r)?.values[0][0];
  assert.equal(at("'Grades'!G5"), 10, 'คะแนนเต็มลงแถว 5');
  assert.equal(at("'Grades'!G9"), 7);
  assert.equal(at("'Grades'!DB9"), 10, '5/10 × 20 = 10');
  assert.equal(at("'Class Attendance'!F6"), 'S', 'ชม.2 → คอลัมน์ F');
  assert.equal(at("'Class Attendance'!F4"), '2026-11-03');
  assert.equal(at("'Desirable Characteristics'!G12"), 3, 'การเขียน → G');
  assert.equal(at("'Desirable Characteristics'!L12"), 2, 'มีวินัย → L');
  assert.deepEqual(p.unmatched, ['2 ข (9999)'], 'เลขประจำตัวที่ไม่มีในชีทต้องถูกรายงานและข้าม');

  await new Promise(r => setTimeout(r, 100));
  assert(events.join('').includes('"type":"score"'), 'ไม่ได้รับเหตุการณ์เรียลไทม์');
  ctl.abort(); server.close(); server.closeAllConnections?.();
  console.log('ผ่านทั้งหมด ✔');
  process.exit(0);
})().catch(e => { console.error('ล้มเหลว:', e.message); process.exit(1); });
