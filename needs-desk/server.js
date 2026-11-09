import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { groupNeeds } from './group.js';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3200;
const DATA = path.join(process.env.DATA_DIR || path.join(__dir, 'data'), 'needs.json');
const PIN = process.env.ADMIN_PIN || ''; // ตั้งไว้เพื่อป้องกัน dashboard / การแก้ไขสถานะ
fs.mkdirSync(path.dirname(DATA), { recursive: true });
let needs = fs.existsSync(DATA) ? JSON.parse(fs.readFileSync(DATA, 'utf8')) : [];
const save = () => fs.writeFileSync(DATA, JSON.stringify(needs, null, 1));

const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
const body = req => new Promise(r => { let b = ''; req.on('data', c => { b += c; if (b.length > 1e5) req.destroy(); }); req.on('end', () => { try { r(JSON.parse(b)); } catch { r({}); } }); });
const isAdmin = (req, url) => !PIN || (req.headers['x-pin'] || url.searchParams.get('pin')) === PIN;

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  try {
    if (req.method === 'POST' && p === '/api/needs') {
      const b = await body(req);
      const text = String(b.text || '').trim().slice(0, 1000);
      if (!text) return json(res, 400, { error: 'กรุณาพิมพ์ความต้องการ' });
      const n = { id: randomUUID(), name: String(b.name || '').trim().slice(0, 80) || 'ไม่ระบุชื่อ', text, status: 'new', ts: Date.now() };
      needs.push(n); save();
      return json(res, 201, { ok: true, id: n.id });
    }
    if (p.startsWith('/api/')) {
      if (!isAdmin(req, url)) return json(res, 401, { error: 'ต้องใช้ PIN' });
      if (req.method === 'GET' && p === '/api/groups') {
        const th = parseFloat(url.searchParams.get('t')) || 0.28;
        return json(res, 200, { total: needs.length, open: needs.filter(n => n.status !== 'done').length, groups: groupNeeds(needs, th) });
      }
      const m = p.match(/^\/api\/needs\/([\w-]+)$/);
      if (m && req.method === 'PATCH') {
        const n = needs.find(x => x.id === m[1]); if (!n) return json(res, 404, {});
        const b = await body(req); if (['new', 'doing', 'done'].includes(b.status)) n.status = b.status;
        save(); return json(res, 200, n);
      }
      if (m && req.method === 'DELETE') { needs = needs.filter(x => x.id !== m[1]); save(); return json(res, 200, { ok: true }); }
      return json(res, 404, {});
    }
    const file = p === '/' ? 'index.html' : p === '/dashboard' ? 'dashboard.html' : null;
    if (!file) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(path.join(__dir, 'public', file)));
  } catch (e) { json(res, 500, { error: String(e) }); }
}).listen(PORT, () => console.log(`needs-desk: http://localhost:${PORT}  (dashboard: /dashboard)`));
