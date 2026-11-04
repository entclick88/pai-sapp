// ข้อมูลสมมติสำหรับทดลองใช้: node seed-demo.js  (ค่าเริ่มต้นลง data-demo/; ตั้ง TURSO_DATABASE_URL เพื่อลงฐานออนไลน์)
process.env.DATA_DIR = process.env.DATA_DIR || require('path').join(__dirname, 'data-demo');
const { ready, run, get, now } = require('./db');

(async () => {
  await ready;
  if (await get('SELECT 1 x FROM students')) return console.log('มีข้อมูลอยู่แล้ว ข้าม');
  const names = ['สมชาย ใจดี', 'สมหญิง เรียนดี', 'ณัฐ คิดไว', 'พิมพ์ชนก รักเรียน', 'ภูริ มั่นคง', 'กานดา ขยันยิ่ง'];
  const ids = [];
  for (const [i, n] of names.entries()) ids.push((await run('INSERT INTO students (no,sid,name,code) VALUES (?,?,?,?)', i + 1, String(9001 + i), n, 'DEMO0' + (i + 1))).lastInsertRowid);
  const topics = ['ทำไมต้องรู้ Google Sheet?', 'ฟังก์ชันคณิตศาสตร์พื้นฐาน', 'ตรวจสอบคำตอบของ AI ด้วยสูตร'];
  const hs = [];
  for (const [i, t] of topics.entries()) hs.push((await run('INSERT INTO hours (seq,date,topic,indicator,ai_focus) VALUES (?,?,?,?,?)', i + 1, `2026-11-0${i + 3}`, t, 'ตัวชี้วัดที่ ' + (i + 1), i === 2 ? 'ให้ AI ช่วยเขียนสูตร แล้วพิสูจน์ซ้ำ' : '')).lastInsertRowid);
  const as = [];
  for (const [i, [t, c, u, d, m]] of [['ใบงาน 1 รู้จัก Google Sheet', 'collect', 1, 'K', 10], ['ใบงาน 2 ฟังก์ชัน SUM/AVERAGE', 'collect', 2, 'K', 10], ['ใบงาน 3 ตรวจสูตรที่ AI เขียน', 'collect', 2, 'P', 10], ['สอบปลายภาค', 'final', 1, 'K', 50]].entries())
    as.push((await run('INSERT INTO assessments (hour_id,title,category,unit,domain,max,rubric,open) VALUES (?,?,?,?,?,?,?,?)', hs[Math.min(i, 2)], t, c, u, d, m,
      '4 = สูตรถูก+อธิบายเหตุผล+ตรวจผล AI ด้วยวิธีอื่น; 2 = สูตรถูกแต่ไม่ตรวจสอบ; 0 = ผิด/ไม่ส่ง', i === 2 ? 1 : 0)).lastInsertRowid);
  for (const [i, s] of ids.entries()) {
    await run('INSERT INTO scores VALUES (?,?,?,?,?,?)', s, as[0], [9, 8, 7, 6, 10, 5][i], '', 'teacher', now());
    if (i < 4) await run('INSERT INTO scores VALUES (?,?,?,?,?,?)', s, as[1], [8, 9, 6, 7][i], '', 'teacher', now());
    for (const [k, h] of hs.entries()) await run('INSERT INTO attendance VALUES (?,?,?,?)', h, s, (i === 5 && k === 1) ? 'S' : (i === 2 && k === 0) ? 'L' : 'P', now());
  }
  await run('INSERT INTO ai_logs (student_id,hour_id,tool,prompt,output,verified,reflection,created_at) VALUES (?,?,?,?,?,?,?,?)', ids[0], hs[2], 'Claude', 'ช่วยเขียนสูตรหาค่าเฉลี่ยของ B2:B20 ที่ไม่นับช่องว่าง', '=AVERAGE(B2:B20)', 'ลองใส่ข้อมูลตัวอย่าง 3 ค่า คำนวณมือแล้วตรงกัน', 'AI ไม่ถามว่าช่องว่างนับเป็น 0 ไหม ต้องระบุเอง', now());
  await run('INSERT INTO submissions (student_id,assessment_id,answer,created_at) VALUES (?,?,?,?)', ids[1], as[2], 'สูตรที่ AI ให้คือ =SUM(A1:A5)/5 แต่ถ้ามีช่องว่างจะหารผิด จึงเปลี่ยนเป็น =AVERAGE(A1:A5) แล้วทดสอบกับข้อมูล 4 ค่า ได้ 2.5 ตรงกับคิดมือ', now());
  console.log('สร้างข้อมูลสมมติแล้ว: นักเรียน', ids.length, 'รหัสเข้าระบบ DEMO01–DEMO06');
  process.exit(0);
})();
