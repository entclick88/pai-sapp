const $ = (selector) => document.querySelector(selector);
const page = document.body.dataset.page;
const money = (value) => '฿' + Number(value).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const shortMoney = (value) => '฿' + Number(value).toLocaleString('th-TH', { maximumFractionDigits: 2 });
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const labels = { waiting: 'รอคิว', washing: 'กำลังล้าง', ready: 'รถเสร็จแล้ว', collected: 'รับรถแล้ว', cancelled: 'ยกเลิก' };
const today = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
const paths = {
  car: '<path d="m5 8 2-4h10l2 4M4 9h16v9H4zM4 13h16M7 18v2m10-2v2M7 11h1m8 0h1"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h3"/>',
  layers: '<path d="m12 3 10 5-10 5L2 8zm-10 9 10 5 10-5M2 16l10 5 10-5"/>',
  settings: '<path d="m10 3-.5 2-2 1L5.5 5 3 9l1.5 1.5v3L3 15l2.5 4 2-1 2 1 .5 2h4l.5-2 2-1 2 1 2.5-4-1.5-1.5v-3L21 9l-2.5-4-2 1-2-1L14 3z"/><circle cx="12" cy="12" r="3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  drop: '<path d="M12 3c-3 4-7 8-7 12a7 7 0 0 0 14 0c0-4-4-8-7-12Z"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  play: '<path d="m8 4 12 8-12 8z"/>',
  user: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-3a8 8 0 0 1 16 0v3z"/>',
  users: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-17a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v3"/>',
  tag: '<path d="M3 3h8l10 10-8 8L3 11z"/><circle cx="7" cy="7" r="1"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9m3-10v12"/>',
  receipt: '<path d="M5 3h14v18l-3-2-4 2-4-2-3 2zM8 7h8m-8 4h8m-8 4h4"/>',
  chart: '<path d="M4 3v18h17M8 16v-5m5 5V7m5 9V4"/>',
  external: '<path d="M14 3h7v7m0-7L10 14M10 3H4v17h17v-6"/>',
  volume: '<path d="m10 4-5 4H2v8h3l5 4zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  logout: '<path d="M9 3H4v18h5m4-15 6 6-6 6m-5-6h11"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
  sparkle: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
  edit: '<path d="m4 16 12-12 4 4L8 20H4zm9-9 4 4"/>',
};
function icon(name, extra = '') {
  if (name === 'brand') return '<svg class="icon" viewBox="0 0 54 44" aria-hidden="true"><path d="M6 28v-6c0-3 3-5 7-6l8-9h16M10 30h25M39 18h4c4 0 6 3 6 6v6h-4M6 30H4v-5"/><circle cx="15" cy="31" r="5"/><circle cx="40" cy="31" r="5"/><path class="water" d="M43 2c-3 4-6 7-6 10a6 6 0 0 0 12 0c0-3-3-6-6-10Z"/></svg>';
  return `<svg class="icon ${extra}" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.car}</svg>`;
}
function hydrateIcons(root = document) { root.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon); }); }
let services = [], settings = {}, currentToken = new URLSearchParams(location.search).get('job');
let knownJobs = null, audioContext = null, dashboardJobs = [], queueFilter = 'all', jobsSignature = '', trackingSignature = '', polling = false;
let device = localStorage.getItem('carwash_device');
if (!device) { device = crypto.randomUUID(); localStorage.setItem('carwash_device', device); }
function message(text) { $('#message').textContent = text; }
function authUI(active) {
  if (!$('#workspace')) return;
  $('#workspace').hidden = !active;
  $('#login').hidden = active;
  document.querySelectorAll('[data-auth-only]').forEach((el) => { el.hidden = !active; });
}
async function api(url, options = {}) {
  const headers = { ...options.headers };
  if (!(options.body instanceof FormData) && options.body) headers['Content-Type'] = 'application/json';
  const token = sessionStorage.getItem('carwash_admin');
  if (token) headers.Authorization = 'Bearer ' + token;
  const response = await fetch('/api/carwash' + url, { ...options, headers });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && page !== 'customer') { authUI(false); sessionStorage.removeItem('carwash_admin'); }
    throw Error(data.error || 'ไม่สามารถทำรายการได้ กรุณาลองใหม่');
  }
  return data;
}
const post = (url, data) => api(url, { method: 'POST', body: JSON.stringify(data) });
async function busy(form, action) {
  const button = form.querySelector('button[type="submit"],button');
  if (button?.disabled) return;
  if (button) button.disabled = true;
  try { await action(); } catch (e) { message(e.message); } finally { if (button) button.disabled = false; }
}
const panels = {
  queue: ['คิวบริการ', 'จัดการคิวล้างรถ ติดตามสถานะงาน และอัปเดตการบริการให้ลูกค้าได้ทันที'],
  intake: ['รับรถหน้าร้าน', 'เริ่มต้นการดูแลรถคันใหม่ กรอกข้อมูลแล้วส่งเข้าคิวบริการ'],
  catalog: ['บริการและราคา', 'จัดการรายการบริการ ราคา และเวลาที่ใช้ให้เหมาะกับร้าน'],
  settings: ['ตั้งค่าร้าน', 'ข้อมูลร้าน ช่องทางรับชำระ และ QR สำหรับลูกค้า'],
  report: ['ภาพรวมรายรับ', 'ติดตามรายรับ รายจ่าย และผลประกอบการของร้าน'],
  expenses: ['บันทึกรายจ่าย', 'บันทึกต้นทุนและค่าใช้จ่าย เพื่อเห็นภาพรวมร้านได้ชัดเจน'],
};
function activatePanel(name, scroll = true) {
  if (!document.querySelector(`[data-panel="${name}"]`)) return;
  document.querySelectorAll('[data-panel]').forEach((el) => { el.hidden = el.dataset.panel !== name; });
  document.querySelectorAll('.main-nav [data-panel-target]').forEach((el) => {
    const active = el.dataset.panelTarget === name;
    el.classList.toggle('active', active);
    if (active) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
  });
  $('#page-title').textContent = panels[name][0];
  $('#page-description').textContent = panels[name][1];
  if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
}
function serviceIcon(service) { return /เคลือบ/.test(service.name) ? 'shield' : /มอเตอร์ไซค์/.test(service.name) ? 'sparkle' : /ดูดฝุ่น/.test(service.name) ? 'sparkle' : 'drop'; }
function updateTotal() {
  const selected = services.filter((s) => $(`#services input[value="${s.id}"]`)?.checked);
  if ($('#total')) $('#total').textContent = money(selected.reduce((sum, s) => sum + s.price, 0));
  if ($('#selected-count')) $('#selected-count').textContent = selected.length ? `เลือกแล้ว ${selected.length} รายการ` : 'ยังไม่ได้เลือกบริการ';
  document.querySelectorAll('.steps .step').forEach((el, index) => el.classList.toggle('active', index === (selected.length ? 1 : 0)));
}
function renderServices() {
  if (!$('#services')) return;
  $('#services').innerHTML = services.map((s) => `<label class="service"><input type="checkbox" value="${s.id}" aria-label="${esc(s.name)} ${shortMoney(s.price)}"><span class="service-visual">${icon(serviceIcon(s))}</span><span class="service-info"><strong>${esc(s.name)}</strong><small>${icon('clock')}ประมาณ ${s.minutes} นาที</small></span><span class="service-price">${shortMoney(s.price)}</span><span class="selection-circle">${icon('check')}</span></label>`).join('') || '<p class="muted">ยังไม่มีบริการเปิดให้รับคิว</p>';
  $('#services').onchange = updateTotal;
  updateTotal();
}
function renderHistory() {
  const list = JSON.parse(localStorage.getItem('carwash_jobs') || '[]');
  $('#history').innerHTML = list.map((j) => `<a class="history-link" href="?job=${encodeURIComponent(j.token)}"><span class="section-icon">${icon('car')}</span><div><strong>คิว #${j.id} · ${esc(j.plate)}</strong><small>ดูสถานะและรายละเอียดบริการ</small></div>${icon('arrow')}</a>`).join('') || `<div class="empty-state compact"><span class="empty-icon">${icon('clock')}</span><h3>ยังไม่มีคิวในตอนนี้</h3><p>เมื่อคุณยืนยันรับคิวแล้ว จะแสดงรายละเอียดที่นี่</p></div>`;
}
function ppPayload(id, amount) {
  const tlv = (key, value) => key + String(value.length).padStart(2, '0') + value;
  const account = id.length === 10 ? tlv('01', '0066' + id.slice(1)) : tlv('02', id);
  let payload = tlv('00', '01') + tlv('01', '12') + tlv('29', tlv('00', 'A000000677010111') + account) + tlv('53', '764') + tlv('54', Number(amount).toFixed(2)) + tlv('58', 'TH') + '6304';
  let crc = 0xffff;
  for (const char of payload) { crc ^= char.charCodeAt(0) << 8; for (let i = 0; i < 8; i++) crc = ((crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff; }
  return payload + crc.toString(16).toUpperCase().padStart(4, '0');
}
function progress(status) {
  const steps = [['waiting', 'clock', 'รอคิว'], ['washing', 'drop', 'กำลังล้าง'], ['ready', 'check-circle', 'รถเสร็จแล้ว'], ['collected', 'car', 'รับรถแล้ว']];
  const index = steps.findIndex((step) => step[0] === status);
  if (index < 0) return '';
  return `<div class="tracking-steps">${steps.map((s, i) => `<div class="tracking-step ${i < index ? 'done' : i === index ? 'current' : ''}"><span class="step-icon">${icon(i < index ? 'check' : s[1])}</span><span>${s[2]}</span></div>`).join('')}</div>`;
}
async function tracking() {
  if (!currentToken) return;
  const job = await api('/jobs/' + encodeURIComponent(currentToken));
  const signature = JSON.stringify(job);
  if (signature === trackingSignature) return;
  // Keep the customer's selected gallery image intact while polling the queue.
  if ($('#slip-form input')?.files?.length && job.status === 'ready' && job.payment === 'unpaid') return;
  trackingSignature = signature;
  const box = $('#tracking'); box.hidden = false;
  box.innerHTML = `<div class="tracking-top"><h2>คิว #${job.id} · ${esc(job.plate)}</h2><span class="badge" data-status="${job.status}">${labels[job.status]}</span></div><p class="tracking-info">${esc(job.vehicle)} · คุณ${esc(job.name)}</p>${progress(job.status)}${job.status === 'waiting' ? `<p class="quick-note">${icon('clock')} มีคิวก่อนหน้าคุณ ${job.ahead} คิว</p>` : ''}${job.services.map((s) => `<div class="listrow"><span>${esc(s.name)}</span><strong>${money(s.price)}</strong></div>`).join('')}<div class="tracking-summary"><div class="summary-total"><span>ยอดชำระทั้งหมด</span><strong class="price">${money(job.total)}</strong></div></div>${job.payment === 'paid' ? `<p class="badge paid">${icon('check-circle')} ชำระเงินเรียบร้อยแล้ว</p>` : job.status === 'ready' ? `<div class="tracking-payment"><h3>รถพร้อมรับแล้ว</h3><p>ตรวจสอบยอดและชื่อบัญชีก่อนโอนชำระเงิน</p><div id="payment-qr"></div>${job.payment === 'review' ? `<p class="quick-note">ส่งสลิปแล้ว กำลังรอร้านตรวจสอบ</p>` : `<form id="slip-form"><label class="upload-label"><span>แนบสลิปจากรูปภาพในมือถือ</span><input type="file" name="slip" accept="image/jpeg,image/png,image/webp" required></label><p class="muted tiny">JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB</p><button class="button full-width" type="submit">ส่งสลิปให้ร้านตรวจสอบ${icon('arrow')}</button></form>`}</div>` : ''}<div class="sync-note"><span class="live-dot"></span>สถานะอัปเดตอัตโนมัติ เก็บลิงก์หน้านี้เพื่อติดตามคิว</div>`;
  if (job.status === 'ready' && job.payment !== 'paid') {
    if (settings.promptpayId && window.QRCode) new QRCode($('#payment-qr'), { text: ppPayload(settings.promptpayId, job.total), width: 200, height: 200 });
    else $('#payment-qr').innerHTML = '<p class="muted">กรุณาชำระกับพนักงาน ร้านยังไม่ได้ตั้งค่า QR พร้อมเพย์</p>';
  }
  if ($('#slip-form')) $('#slip-form').onsubmit = async (e) => {
    e.preventDefault(); await busy(e.target, async () => {
      await api('/jobs/' + encodeURIComponent(currentToken) + '/slip', { method: 'POST', body: new FormData(e.target) });
      await tracking(); message('ส่งสลิปแล้ว รอร้านตรวจสอบ');
    });
  };
}
function bindBooking() {
  const form = $('#booking'); if (!form) return;
  if (page === 'customer') {
    const profile = JSON.parse(localStorage.getItem('carwash_profile') || '{}');
    for (const key of ['name', 'plate', 'vehicle']) if (profile[key]) form.elements[key].value = profile[key];
  }
  form.onsubmit = async (event) => {
    event.preventDefault(); await busy(form, async () => {
      const data = Object.fromEntries(new FormData(form));
      data.serviceIds = Array.from(document.querySelectorAll('#services input:checked')).map((el) => Number(el.value));
      if (!data.serviceIds.length) throw Error('กรุณาเลือกบริการอย่างน้อยหนึ่งรายการ');
      data.device = page === 'customer' ? device : 'staff-' + crypto.randomUUID();
      const result = await post('/jobs', data); form.reset(); renderServices(); message('');
      if (page === 'customer') {
        localStorage.setItem('carwash_profile', JSON.stringify({ name: data.name, plate: data.plate, vehicle: data.vehicle }));
        const history = JSON.parse(localStorage.getItem('carwash_jobs') || '[]');
        history.unshift({ ...result, plate: data.plate }); localStorage.setItem('carwash_jobs', JSON.stringify(history.slice(0, 30)));
        currentToken = result.token; trackingSignature = '';
        window.history.replaceState(null, '', '?job=' + result.token); renderHistory(); await tracking();
        $('#tracking').scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else { await jobs(); activatePanel('queue'); message('รับรถเข้าคิว #' + result.id + ' แล้ว'); }
    });
  };
}
function beep() {
  if (!audioContext) return; audioContext.resume();
  [0, .2, .4].forEach((delay, index) => {
    const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
    oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.frequency.value = 780 + index * 100; gain.gain.value = .12;
    oscillator.start(audioContext.currentTime + delay); oscillator.stop(audioContext.currentTime + delay + .12);
  });
}
function renderJobs() {
  const list = dashboardJobs.filter((job) => queueFilter === 'all' || job.status === queueFilter);
  document.querySelectorAll('[data-count]').forEach((el) => {
    el.textContent = dashboardJobs.filter((job) => el.dataset.count === 'unpaid' ? job.status === 'ready' && job.payment !== 'paid' : job.status === el.dataset.count).length;
  });
  $('#queue-count').textContent = `${list.length} คิว${queueFilter === 'all' ? 'ที่กำลังให้บริการ' : ' · ' + labels[queueFilter]}`;
  $('#jobs').innerHTML = list.map((job) => `<article class="job-card"><div class="job-top"><span class="job-number">คิวที่ #${String(job.id).padStart(3, '0')}</span><span class="badge" data-status="${job.status}">${labels[job.status]}</span></div><div class="vehicle-heading"><span class="vehicle-mark">${icon('car')}</span><div><h3>${esc(job.plate)}</h3><p>${esc(job.vehicle)}</p></div></div><dl class="job-details"><div class="job-detail"><dt>${icon('user')}ลูกค้า</dt><dd>${esc(job.name)}</dd></div><div class="job-detail"><dt>${icon('tag')}บริการ</dt><dd>${job.services.map((s) => esc(s.name)).join(' + ')}</dd></div><div class="job-detail amount"><dt>${icon('coin')}ค่าบริการ</dt><dd>${shortMoney(job.total)}</dd></div></dl><p class="payment-state ${job.payment}">${icon(job.payment === 'paid' ? 'check-circle' : 'card')}${job.payment === 'paid' ? 'ชำระเงินเรียบร้อย' : job.payment === 'review' ? 'มีสลิปรอตรวจสอบ' : 'ยังไม่ชำระเงิน'}</p>${job.slip ? `<button class="slip-button" data-slip="${esc(job.slip)}">ดูหลักฐานการโอนเงิน</button>` : ''}<div class="job-actions">${job.status === 'waiting' ? `<button class="button" data-job="${job.id}" data-status="washing">${icon('play')}เริ่มล้าง</button><button class="button danger" data-job="${job.id}" data-status="cancelled">ยกเลิก</button>` : job.status === 'washing' ? `<button class="button success" data-job="${job.id}" data-status="ready">${icon('check')}ล้างเสร็จแล้ว</button>` : job.payment !== 'paid' ? `<button class="button" data-job="${job.id}" data-payment="paid">${icon('card')}ยืนยันรับเงินแล้ว</button>` : `<button class="button success" data-job="${job.id}" data-status="collected">${icon('check-circle')}ส่งมอบรถ</button>`}</div></article>`).join('') || `<div class="empty-state"><span class="empty-icon">${icon(queueFilter === 'all' ? 'car' : 'calendar')}</span><h3>${queueFilter === 'all' ? 'พร้อมดูแลรถคันถัดไป' : 'ยังไม่มีคิวในสถานะนี้'}</h3><p>${queueFilter === 'all' ? 'รับรถหน้าร้าน หรือให้ลูกค้าสแกน QR เพื่อเริ่มรับบริการ' : 'เมื่อมีการอัปเดตสถานะ คิวจะแสดงที่นี่โดยอัตโนมัติ'}</p>${queueFilter === 'all' ? `<button class="button secondary" data-panel-target="intake">${icon('plus')}รับรถเข้าคิว</button>` : ''}</div>`;
}
async function jobs() {
  if ($('#workspace').hidden || polling) return;
  polling = true;
  try {
    const list = await api('/admin/jobs'); const ids = new Set(list.map((job) => job.id));
    if (knownJobs && list.some((job) => !knownJobs.has(job.id))) beep(); knownJobs = ids;
    const signature = JSON.stringify(list); dashboardJobs = list;
    if (signature !== jobsSignature) { jobsSignature = signature; renderJobs(); }
    $('#last-updated').textContent = 'อัปเดตล่าสุด ' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' · สถานะอัปเดตอัตโนมัติ';
  } finally { polling = false; }
}
async function showSlip(file) {
  const response = await fetch('/api/carwash/admin/slips/' + encodeURIComponent(file), { headers: { Authorization: 'Bearer ' + sessionStorage.getItem('carwash_admin') } });
  if (!response.ok) throw Error('เปิดสลิปไม่ได้ กรุณาเข้าสู่ระบบใหม่');
  const url = URL.createObjectURL(await response.blob());
  const dialog = document.createElement('dialog'); dialog.setAttribute('aria-label', 'หลักฐานการโอนเงิน');
  dialog.innerHTML = `<div class="row"><h2>หลักฐานการโอนเงิน</h2><button class="button secondary" data-close>ปิด</button></div><img class="slip" alt="หลักฐานการโอนเงิน">`;
  dialog.querySelector('img').src = url; dialog.querySelector('[data-close]').onclick = () => dialog.close();
  dialog.onclose = () => { URL.revokeObjectURL(url); dialog.remove(); }; document.body.append(dialog); dialog.showModal();
}
function bindQueue() {
  document.querySelectorAll('[data-filter]').forEach((button) => { button.onclick = () => {
    queueFilter = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach((el) => { el.classList.toggle('active', el === button); el.setAttribute('aria-pressed', String(el === button)); });
    renderJobs();
  }; });
  $('#jobs').onclick = async (event) => {
    const button = event.target.closest('button'); if (!button || button.dataset.panelTarget) return;
    try {
      if (button.dataset.slip) { await showSlip(button.dataset.slip); return; }
      if ((button.dataset.payment || button.dataset.status === 'cancelled') && !confirm(button.dataset.payment ? 'ตรวจสอบยอดรับชำระแล้วใช่ไหม?' : 'ยกเลิกคิวนี้ใช่ไหม?')) return;
      button.disabled = true;
      await api('/admin/jobs/' + button.dataset.job, { method: 'PATCH', body: JSON.stringify(button.dataset.payment ? { payment: button.dataset.payment } : { status: button.dataset.status }) });
      await jobs();
    } catch (e) { message(e.message); } finally { if (button.isConnected) button.disabled = false; }
  };
}
function showServiceEditor(item) {
  const dialog = document.createElement('dialog'); dialog.setAttribute('aria-labelledby', 'edit-service-title');
  dialog.innerHTML = `<h2 id="edit-service-title">แก้ไขบริการ</h2><form class="catalog-edit-form"><label><span>ชื่อบริการ</span><input name="name" value="${esc(item.name)}" maxlength="100" required></label><div class="grid"><label><span>ราคา (บาท)</span><input name="price" type="number" min="0" step="0.01" value="${item.price}" required></label><label><span>เวลาโดยประมาณ (นาที)</span><input name="minutes" type="number" min="1" value="${item.minutes}" required></label></div><p class="muted tiny" data-error role="alert"></p><div class="dialog-actions"><button class="button secondary" type="button" data-cancel>ยกเลิก</button><button class="button" type="submit">บันทึกการแก้ไข</button></div></form>`;
  const form = dialog.querySelector('form'); dialog.querySelector('[data-cancel]').onclick = () => dialog.close();
  form.onsubmit = async (event) => {
    event.preventDefault(); const button = form.querySelector('[type=submit]'); button.disabled = true;
    try { await api('/admin/services/' + item.id, { method: 'PATCH', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); await management(); services = await api('/services'); renderServices(); dialog.close(); message('บันทึกบริการแล้ว'); }
    catch (e) { dialog.querySelector('[data-error]').textContent = e.message; } finally { button.disabled = false; }
  };
  dialog.onclose = () => dialog.remove(); document.body.append(dialog); dialog.showModal();
}
async function management() {
  const list = await api('/admin/services');
  $('#service-management').innerHTML = list.map((s) => `<div class="catalog-row ${s.active ? '' : 'inactive'}"><div class="catalog-info"><span class="section-icon">${icon(serviceIcon(s))}</span><div><h3>${esc(s.name)}</h3><p>${money(s.price)} · ประมาณ ${s.minutes} นาที</p></div></div><div class="catalog-actions"><button class="button secondary" data-edit="${s.id}">${icon('edit')}แก้ไข</button><button class="toggle" data-id="${s.id}" data-active="${s.active ? 0 : 1}" aria-pressed="${!!s.active}" aria-label="${s.active ? 'ปิด' : 'เปิด'}บริการ ${esc(s.name)}"><span class="toggle-track"></span><span>${s.active ? 'เปิดบริการ' : 'ปิดบริการ'}</span></button></div></div>`).join('');
  $('#service-management').onclick = async (event) => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.edit) { showServiceEditor(list.find((s) => s.id === Number(button.dataset.edit))); return; }
    button.disabled = true;
    try { await api('/admin/services/' + button.dataset.id, { method: 'PATCH', body: JSON.stringify({ active: button.dataset.active === '1' }) }); await management(); services = await api('/services'); renderServices(); }
    catch (e) { message(e.message); } finally { if (button.isConnected) button.disabled = false; }
  };
}
async function analytics() {
  const form = $('#range-form');
  if (form.elements.from.value > form.elements.to.value) throw Error('วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด');
  const report = await api('/admin/analytics?' + new URLSearchParams(new FormData(form)));
  $('#metrics').innerHTML = `<div class="metric"><span class="metric-label">${icon('coin')}ยอดขายที่รับชำระแล้ว</span><strong>${money(report.sales)}</strong><small>${report.count} คิวบริการ</small></div><div class="metric"><span class="metric-label">${icon('receipt')}รายจ่ายทั้งหมด</span><strong>${money(report.costs)}</strong><small>${report.expenses.length} รายการที่บันทึก</small></div><div class="metric ${report.profit >= 0 ? 'positive' : 'negative'}"><span class="metric-label">${icon('chart')}ส่วนต่างรับ–จ่าย</span><strong>${money(report.profit)}</strong><small>ยอดรับชำระ หักรายจ่ายในช่วงนี้</small></div>`;
  $('#expenses').innerHTML = report.expenses.map((expense) => `<div class="listrow"><div class="expense-info"><strong>${esc(expense.description)}</strong><p>${esc(expense.day)}</p></div><span class="expense-amount">${money(expense.amount)}</span></div>`).join('') || `<div class="empty-state compact"><span class="empty-icon">${icon('receipt')}</span><h3>ยังไม่มีรายจ่ายในช่วงนี้</h3><p>บันทึกค่าใช้จ่ายของร้านได้ที่เมนูบันทึกรายจ่าย</p></div>`;
}
async function workspace() {
  authUI(true);
  if (page === 'admin') {
    jobsSignature = ''; await jobs(); await management();
    for (const key of ['shopName', 'promptpayId']) $('#settings-form').elements[key].value = settings[key] || (key === 'shopName' ? 'ร้านล้างรถ' : '');
    $('#qr').innerHTML = '';
    if (window.QRCode) new QRCode($('#qr'), { text: location.origin + '/carwash/', width: 180, height: 180 });
    $('#booking-link').href = location.origin + '/carwash/'; $('#booking-link').textContent = location.origin + '/carwash/';
    activatePanel('queue', false);
  } else { await analytics(); activatePanel('report', false); }
}
async function init() {
  hydrateIcons();
  document.addEventListener('click', (event) => { const button = event.target.closest('[data-panel-target]'); if (button && !$('#workspace')?.hidden) activatePanel(button.dataset.panelTarget); });
  try {
    settings = await api('/settings');
    document.querySelectorAll('.shop-name').forEach((el) => { el.textContent = settings.shopName || 'ร้านล้างรถ'; });
    services = await api('/services'); renderServices(); bindBooking();
    if (page === 'customer') { renderHistory(); await tracking(); setInterval(() => tracking().catch((e) => message(e.message)), 5000); return; }
    $('#login-form').onsubmit = async (event) => { event.preventDefault(); await busy(event.target, async () => {
      const result = await post('/login', Object.fromEntries(new FormData(event.target))); sessionStorage.setItem('carwash_admin', result.token); event.target.reset(); message(''); await workspace();
    }); };
    $('#logout').onclick = () => { sessionStorage.removeItem('carwash_admin'); location.reload(); };
    if (page === 'admin') {
      bindQueue();
      $('#sound').setAttribute('aria-pressed', 'false');
      $('#sound').setAttribute('aria-label', 'เปิดหรือปิดเสียงแจ้งเตือน');
      $('#sound').setAttribute('title', 'เปิดหรือปิดเสียงแจ้งเตือน');
      $('#sound').onclick = () => {
        if (audioContext) { audioContext.close(); audioContext = null; $('#sound').innerHTML = icon('volume') + '<span>เปิดเสียงแจ้งเตือน</span>'; $('#sound').setAttribute('aria-pressed', 'false'); }
        else { audioContext = new (window.AudioContext || window.webkitAudioContext)(); beep(); $('#sound').innerHTML = icon('volume') + '<span>เปิดเสียงแจ้งเตือนแล้ว</span>'; $('#sound').setAttribute('aria-pressed', 'true'); }
      };
      $('#service-form').onsubmit = async (event) => { event.preventDefault(); await busy(event.target, async () => {
        await post('/admin/services', Object.fromEntries(new FormData(event.target))); event.target.reset(); await management(); services = await api('/services'); renderServices(); message('เพิ่มบริการเรียบร้อยแล้ว');
      }); };
      $('#settings-form').onsubmit = async (event) => { event.preventDefault(); await busy(event.target, async () => {
        const updates = Object.fromEntries(new FormData(event.target)); await api('/admin/settings', { method: 'PUT', body: JSON.stringify(updates) }); Object.assign(settings, updates);
        document.querySelectorAll('.shop-name').forEach((el) => { el.textContent = settings.shopName || 'ร้านล้างรถ'; }); message('บันทึกการตั้งค่าแล้ว');
      }); };
      setInterval(() => jobs().catch((e) => message(e.message)), 5000);
    } else {
      $('#range-form').elements.from.value = today().slice(0, 8) + '01'; $('#range-form').elements.to.value = today(); $('#expense-form').elements.day.value = today();
      $('#range-form').onsubmit = async (event) => { event.preventDefault(); await busy(event.target, analytics); };
      $('#expense-form').onsubmit = async (event) => { event.preventDefault(); await busy(event.target, async () => {
        await post('/admin/expenses', Object.fromEntries(new FormData(event.target))); event.target.elements.description.value = ''; event.target.elements.amount.value = ''; await analytics(); message('บันทึกรายจ่ายแล้ว');
      }); };
    }
    const access = await api('/access');
    if (!access.requiresLogin) {
      $('#logout').hidden = true;
      await workspace();
    } else if (sessionStorage.getItem('carwash_admin')) await workspace();
  } catch (e) { message(e.message); }
}
init();
