// Vercel function: ทุก /api/* ผ่านตัวจัดการเดียวกับเซิร์ฟเวอร์ในเครื่อง
import { handle } from '../server.js';
export default (req, res) => handle(req, res);
