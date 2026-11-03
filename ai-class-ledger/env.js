// อ่านไฟล์ .env (KEY=VALUE ต่อบรรทัด) โดยไม่ทับค่าที่ตั้งไว้ใน environment อยู่แล้ว
const fs = require('fs'), path = require('path');
const f = path.join(__dirname, '.env');
if (fs.existsSync(f)) {
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#') && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
