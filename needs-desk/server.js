import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { groupNeeds } from './group.js';
import { db, init } from './db.js';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const PIN = process.env.ADMIN_PIN || ''; // ตั้งไว้เพื่อป้องกัน dashboard / การแก้ไขสถานะ

const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
const body = async req => {
  if (req.body && typeof req.body === 'object') return req.body; // Vercel แปลงให้แล้ว
  let b = ''; for await (const c of req) { b += c; if (b.length > 1e5) break; }
  try { return JSON.parse(b); } catch { return {}; }
};
const isAdmin = (req, url) => !PIN || (req.headers['x-pin'] || url.searchParams.get('pin')) === PIN;

export async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  try {
    await init();
    if (req.method === 'POST' && p === '/api/needs') {
      const b = await body(req);
      const text = String(b.text || '').trim().slice(0, 1000);
      if (!text) return json(res, 400, { error: 'กรุณาพิมพ์ความต้องการ' });
      const id = randomUUID(), name = String(b.name || '').trim().slice(0, 80) || 'ไม่ระบุชื่อ';
      await db.execute({ sql: 'INSERT INTO needs (id,name,text,status,ts) VALUES (?,?,?,?,?)', args: [id, name, text, 'new', Date.now()] });
      return json(res, 201, { ok: true, id });
    }
    if (p === '/api/health') return json(res, 200, { ok: true });
    if (p.startsWith('/api/')) {
      if (!isAdmin(req, url)) return json(res, 401, { error: 'ต้องใช้ PIN' });
      if (req.method === 'GET' && p === '/api/groups') {
        const th = parseFloat(url.searchParams.get('t')) || 0.28;
        const needs = (await db.execute('SELECT * FROM needs ORDER BY ts')).rows.map(r => ({ ...r }));
        return json(res, 200, { total: needs.length, open: needs.filter(n => n.status !== 'done').length, groups: groupNeeds(needs, th) });
      }
      const m = p.match(/^\/api\/needs\/([\w-]+)$/);
      if (m && req.method === 'PATCH') {
        const b = await body(req);
        if (['new', 'doing', 'done'].includes(b.status)) await db.execute({ sql: 'UPDATE needs SET status=? WHERE id=?', args: [b.status, m[1]] });
        return json(res, 200, { ok: true });
      }
      if (m && req.method === 'DELETE') { await db.execute({ sql: 'DELETE FROM needs WHERE id=?', args: [m[1]] }); return json(res, 200, { ok: true }); }
      return json(res, 404, {});
    }
    const file = p === '/' ? 'index.html' : p === '/dashboard' ? 'dashboard.html' : null;
    if (!file) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(path.join(__dir, 'public', file)));
  } catch (e) { json(res, 500, { error: String(e) }); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const PORT = process.env.PORT || 3200;
  http.createServer(handle).listen(PORT, () => console.log(`needs-desk: http://localhost:${PORT}  (dashboard: /dashboard)`));
}
