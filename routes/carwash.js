const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const router = express.Router();
const dir = process.env.CARWASH_DATA_DIR || path.join(path.dirname(process.env.DATABASE_PATH || './data/content.db'), 'carwash');
fs.mkdirSync(path.join(dir, 'uploads'), { recursive: true });
const db = new sqlite3.Database(path.join(dir, 'carwash.db'));
const run = (sql, args = []) => new Promise((resolve, reject) => db.run(sql, args, function(e) { e ? reject(e) : resolve({ id: this.lastID, changes: this.changes }); }));
const all = (sql, args = []) => new Promise((resolve, reject) => db.all(sql, args, (e, rows) => e ? reject(e) : resolve(rows)));
const ready = (async () => {
  await run('CREATE TABLE IF NOT EXISTS services (id INTEGER PRIMARY KEY, name TEXT NOT NULL, price INTEGER NOT NULL, minutes INTEGER NOT NULL, active INTEGER DEFAULT 1)');
  await run('CREATE TABLE IF NOT EXISTS jobs (id INTEGER PRIMARY KEY, token TEXT UNIQUE, device TEXT, name TEXT, plate TEXT, vehicle TEXT, services TEXT, total INTEGER, status TEXT DEFAULT "waiting", payment TEXT DEFAULT "unpaid", slip TEXT, created TEXT DEFAULT CURRENT_TIMESTAMP, paid_at TEXT)');
  await run('CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY, day TEXT, description TEXT, amount INTEGER)');
  await run('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)');
  if (!(await all('SELECT id FROM services LIMIT 1')).length) {
    for (const s of [['ล้างภายนอก',15000,30],['ล้างสี + ดูดฝุ่น',25000,45],['ล้างรถ SUV / กระบะ',35000,60],['เคลือบสี',60000,90],['ล้างมอเตอร์ไซค์',10000,25]]) await run('INSERT INTO services(name,price,minutes) VALUES(?,?,?)', s);
  }
})();
let pin = process.env.CARWASH_ADMIN_PIN;
if (!pin) {
  const pinFile = path.join(dir, 'admin-pin.txt');
  if (!fs.existsSync(pinFile)) fs.writeFileSync(pinFile, crypto.randomInt(100000, 999999).toString(), { mode: 0o600 });
  pin = fs.readFileSync(pinFile, 'utf8').trim();
  console.log('Carwash admin PIN is stored at ' + pinFile + ' (or set CARWASH_ADMIN_PIN).');
}
const sessions = new Map();
const attempts = new Map();
router.use(async (req, res, next) => { try { await ready; next(); } catch(e) { next(e); } });
const requiresLogin = process.env.CARWASH_REQUIRE_LOGIN === 'true';
router.get('/access', (req, res) => res.json({ requiresLogin }));
router.post('/login', (req, res) => {
  const key = req.ip;
  const rate = attempts.get(key) || { n: 0, until: Date.now() + 600000 };
  if (rate.until < Date.now()) { rate.n = 0; rate.until = Date.now() + 600000; }
  if (++rate.n > 10) return res.status(429).json({ error: 'กรุณารอ 10 นาทีแล้วลองใหม่' });
  attempts.set(key, rate);
  const supplied = crypto.createHash('sha256').update(String(req.body.pin || '')).digest();
  const expected = crypto.createHash('sha256').update(pin).digest();
  if (!crypto.timingSafeEqual(supplied, expected)) return res.status(401).json({ error: 'รหัสไม่ถูกต้อง' });
  attempts.delete(key);
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + 12 * 3600000);
  res.json({ token });
});
const auth = (req, res, next) => {
  if (!requiresLogin) return next();
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  if ((sessions.get(token) || 0) < Date.now()) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบพนักงาน' });
  next();
};
const safeJob = j => ({ ...j, services: JSON.parse(j.services), total: j.total / 100 });
router.get('/settings', async (req, res, next) => { try { res.json(Object.fromEntries((await all('SELECT * FROM settings')).map(x => [x.key,x.value]))); } catch(e) { next(e); } });
router.get('/services', async (req, res, next) => { try { res.json((await all('SELECT * FROM services WHERE active=1')).map(s => ({...s, price:s.price / 100}))); } catch(e) { next(e); } });
router.post('/jobs', async (req, res, next) => {
  try {
    const { name, plate, vehicle, device, serviceIds } = req.body;
    if (!name?.trim() || !plate?.trim() || !vehicle || !device || !Array.isArray(serviceIds) || !serviceIds.length || serviceIds.length > 20) return res.status(400).json({ error:'กรุณาระบุชื่อ ทะเบียน ประเภทรถ และบริการ' });
    const ids = [...new Set(serviceIds.map(Number))];
    const selected = await all(`SELECT * FROM services WHERE active=1 AND id IN (${ids.map(()=>'?').join(',')})`,ids);
    if (selected.length !== ids.length) return res.status(400).json({error:'บริการบางรายการปิดให้บริการแล้ว'});
    const token = crypto.randomBytes(24).toString('hex');
    const total = selected.reduce((n,s)=>n+s.price,0);
    const result = await run('INSERT INTO jobs(token,device,name,plate,vehicle,services,total) VALUES(?,?,?,?,?,?,?)',[token,String(device).slice(0,100),name.trim().slice(0,100),plate.trim().slice(0,30),String(vehicle).slice(0,50),JSON.stringify(selected.map(s=>({id:s.id,name:s.name,price:s.price/100}))),total]);
    res.json({id:result.id,token});
  } catch(e) { next(e); }
});
router.get('/jobs/:token', async (req,res,next)=> { try { const j=(await all('SELECT * FROM jobs WHERE token=?',[req.params.token]))[0]; if(!j)return res.status(404).json({error:'ไม่พบคิวนี้'}); const ahead=(await all("SELECT COUNT(*) n FROM jobs WHERE id<? AND status IN ('waiting','washing')",[j.id]))[0].n; res.json({...safeJob(j),ahead}); } catch(e){next(e);} });
const slipUpload=multer({storage:multer.diskStorage({destination:path.join(dir,'uploads'),filename:(req,file,cb)=>cb(null,crypto.randomBytes(20).toString('hex')+({ 'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp'}[file.mimetype]||'.bin'))}),limits:{fileSize:5*1024*1024},fileFilter:(req,file,cb)=>cb(null,['image/jpeg','image/png','image/webp'].includes(file.mimetype))});
router.post('/jobs/:token/slip', async(req,res,next)=> { try { const j=(await all('SELECT * FROM jobs WHERE token=?',[req.params.token]))[0]; if(!j || j.status!=='ready' || j.payment==='paid')return res.status(400).json({error:'แนบสลิปได้เมื่อรถเสร็จและยังไม่รับชำระ'}); slipUpload.single('slip')(req,res,async e=>{if(e)return next(e);try { if(!req.file)return res.status(400).json({error:'เลือกรูป JPG, PNG หรือ WebP ไม่เกิน 5 MB'}); await run("UPDATE jobs SET slip=?,payment='review' WHERE id=?",[req.file.filename,j.id]); res.json({success:true}); }catch(err){next(err);} }); }catch(e){next(e);} });
router.use('/admin',auth);
router.get('/admin/jobs',async(req,res,next)=>{try{res.json((await all("SELECT * FROM jobs WHERE status!='collected' AND status!='cancelled' ORDER BY id")).map(safeJob));}catch(e){next(e);}});
router.patch('/admin/jobs/:id',async(req,res,next)=>{try{const j=(await all('SELECT * FROM jobs WHERE id=?',[req.params.id]))[0];if(!j)return res.sendStatus(404);const {status,payment}=req.body;const transitions={waiting:['washing','cancelled'],washing:['ready'],ready:['collected']};if(status && !(transitions[j.status]||[]).includes(status))return res.status(400).json({error:'ลำดับสถานะไม่ถูกต้อง'});if(status==='collected'&&j.payment!=='paid')return res.status(400).json({error:'ยืนยันรับเงินก่อนส่งมอบรถ'});if(payment && (payment!=='paid'||j.status!=='ready'))return res.status(400).json({error:'รับชำระเมื่อรถเสร็จแล้ว'});await run('UPDATE jobs SET status=?,payment=?,paid_at=CASE WHEN ?="paid" AND paid_at IS NULL THEN CURRENT_TIMESTAMP ELSE paid_at END WHERE id=?',[status||j.status,payment||j.payment,payment||null,j.id]);res.json({success:true});}catch(e){next(e);}});
router.get('/admin/slips/:file',(req,res)=>{const file=path.basename(req.params.file);res.sendFile(path.resolve(dir,'uploads',file));});
router.post('/admin/services',async(req,res,next)=>{try{const {name,price,minutes}=req.body;if(!name?.trim()||!Number.isFinite(Number(price))||Number(price)<0||!Number.isFinite(Number(minutes))||Number(minutes)<1)return res.status(400).json({error:'ตรวจสอบชื่อ ราคา และเวลา'});await run('INSERT INTO services(name,price,minutes) VALUES(?,?,?)',[name.trim().slice(0,100),Math.round(Number(price)*100),Math.round(Number(minutes))]);res.json({success:true});}catch(e){next(e);}});
router.patch('/admin/services/:id',async(req,res,next)=>{try{const existing=(await all('SELECT * FROM services WHERE id=?',[req.params.id]))[0];if(!existing)return res.status(404).json({error:'ไม่พบบริการนี้'});const name=req.body.name===undefined?existing.name:String(req.body.name).trim();const price=req.body.price===undefined?existing.price:Math.round(Number(req.body.price)*100);const minutes=req.body.minutes===undefined?existing.minutes:Number(req.body.minutes);if(!name||!Number.isSafeInteger(price)||price<0||!Number.isInteger(minutes)||minutes<1)return res.status(400).json({error:'ตรวจสอบชื่อ ราคา และเวลา'});await run('UPDATE services SET name=?,price=?,minutes=?,active=? WHERE id=?',[name.slice(0,100),price,minutes,req.body.active===undefined?existing.active:(req.body.active?1:0),req.params.id]);res.json({success:true});}catch(e){next(e);}});
router.get('/admin/services',async(req,res,next)=>{try{res.json((await all('SELECT * FROM services')).map(s=>({...s,price:s.price/100})));}catch(e){next(e);}});
router.put('/admin/settings',async(req,res,next)=>{try{for(const key of ['shopName','promptpayId'])if(req.body[key]!==undefined){const value=String(req.body[key]).trim();if(key==='promptpayId' && value && !/^(0\d{9}|\d{13})$/.test(value))return res.status(400).json({error:'พร้อมเพย์ต้องเป็นเบอร์ 10 หลักหรือเลขประจำตัว 13 หลัก'});await run('INSERT OR REPLACE INTO settings VALUES(?,?)',[key,value.slice(0,120)]);}res.json({success:true});}catch(e){next(e);}});
router.post('/admin/expenses',async(req,res,next)=>{try{const {day,description,amount}=req.body;if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!description?.trim()||!Number.isFinite(Number(amount))||Number(amount)<=0)return res.status(400).json({error:'ตรวจสอบวันที่ รายการ และจำนวนเงิน'});await run('INSERT INTO expenses(day,description,amount) VALUES(?,?,?)',[day,description.trim().slice(0,200),Math.round(Number(amount)*100)]);res.json({success:true});}catch(e){next(e);}});
router.get('/admin/analytics',async(req,res,next)=>{try{const from=req.query.from||'2000-01-01',to=req.query.to||'2100-01-01';const sales=(await all("SELECT COALESCE(SUM(total),0) total,COUNT(*) count FROM jobs WHERE payment='paid' AND date(paid_at,'+7 hours') BETWEEN ? AND ?",[from,to]))[0];const expenses=await all('SELECT * FROM expenses WHERE day BETWEEN ? AND ? ORDER BY day DESC,id DESC',[from,to]);const costs=expenses.reduce((n,e)=>n+e.amount,0);res.json({sales:sales.total/100,count:sales.count,costs:costs/100,profit:(sales.total-costs)/100,expenses:expenses.map(e=>({...e,amount:e.amount/100}))});}catch(e){next(e);}});
router.use((e,req,res,next)=>{console.error('Carwash:',e.message);res.status(500).json({error:e.code==='LIMIT_FILE_SIZE'?'รูปต้องไม่เกิน 5 MB':'ระบบขัดข้อง กรุณาลองใหม่'});});
module.exports=router;
