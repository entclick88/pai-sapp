const { all, settings } = require('./db');

// ลำดับตรงกับคอลัมน์ในแท็บ Desirable Characteristics (E-G, J-R); ตัวสุดท้ายใช้ในระบบเท่านั้น ไม่ส่งออก
const CRITICAL = ['การอ่าน', 'การคิดวิเคราะห์', 'การเขียน'];
const DESIRABLE = ['รักชาติ ศาสน์ กษัตริย์', 'ซื่อสัตย์สุจริต', 'มีวินัย', 'ใฝ่เรียนรู้', 'อยู่อย่างพอเพียง',
  'มุ่งมั่นในการทำงาน', 'รักความเป็นไทย', 'มีจิตสาธารณะ', 'Humankind (ข้อ 9)'];
const TRAITS = [...CRITICAL, ...DESIRABLE, 'ใช้ AI อย่างมีจริยธรรม'];
const TRAIT_LEVELS = { 3: 'ดีเยี่ยม', 2: 'ดี', 1: 'ผ่าน', 0: 'ไม่ผ่าน' };

function gradeOf(total, cuts) {
  const c = cuts.split(',').map(Number);
  const g = [4, 3.5, 3, 2.5, 2, 1.5, 1];
  for (let i = 0; i < c.length; i++) if (total >= c[i]) return g[i];
  return 0;
}

// สรุปคะแนนต่อนักเรียน: แต่ละหมวด = (คะแนนที่ได้ / เต็ม) × น้ำหนัก (นับเฉพาะงานที่มีคะแนนแล้ว)
async function summary() {
  const st = await settings();
  const w = { collect: +st.weight_collect, final: +st.weight_final, affective: +st.weight_affective, integrated: +st.weight_integrated };
  const students = await all('SELECT * FROM students ORDER BY no, id');
  const assessments = await all('SELECT * FROM assessments ORDER BY id');
  const scores = await all('SELECT * FROM scores');
  const att = await all('SELECT * FROM attendance');
  const hours = (await all('SELECT id FROM hours')).length;
  const by = new Map();
  for (const s of scores) by.set(s.student_id + ':' + s.assessment_id, s);
  return students.map(stu => {
    const cat = {};
    for (const k of Object.keys(w)) {
      let got = 0, max = 0;
      for (const a of assessments.filter(x => x.category === k)) {
        const s = by.get(stu.id + ':' + a.id);
        if (s && s.score != null) { got += s.score; max += a.max; }
      }
      cat[k] = { got, max, pts: max ? (got / max) * w[k] : 0 };
    }
    const wUsed = Object.keys(w).reduce((n, k) => n + (cat[k].max ? w[k] : 0), 0);
    const raw = Object.values(cat).reduce((n, c) => n + c.pts, 0);
    // ปรับเป็นร้อยจากส่วนที่มีคะแนนแล้ว เพื่อให้ดูแนวโน้มระหว่างภาคได้
    const total = wUsed ? Math.round((raw / wUsed) * 100 * 100) / 100 : 0;
    const mine = att.filter(a => a.student_id === stu.id);
    const cnt = x => mine.filter(a => a.status === x).length;
    return {
      student: stu, cat, total, grade: wUsed ? gradeOf(total, st.grade_cuts) : null,
      attendance: {
        present: cnt('P'), late: cnt('L'), absent: cnt('S'), leave: cnt('A'), hours, // S = ขาด, A = ลา ตามชีท
        pct: hours ? Math.round(((cnt('P') + cnt('L')) / hours) * 1000) / 10 : 0,
      },
    };
  });
}

module.exports = { summary, gradeOf, TRAITS, TRAIT_LEVELS, CRITICAL, DESIRABLE };
