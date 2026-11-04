// Vercel function: ทุก /api/* ผ่านตัวจัดการเดียวกับเซิร์ฟเวอร์ในเครื่อง
const { handle } = require('../server');
module.exports = (req, res) => handle(req, res);
