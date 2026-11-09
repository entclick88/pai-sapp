// จัดกลุ่มความต้องการที่คล้ายกัน (ไม่ต้องใช้ API ภายนอก; รองรับภาษาไทยที่ไม่มีช่องว่างระหว่างคำ)
const clean = s => s.toLowerCase().replace(/[\s\p{P}\p{S}\d]+/gu, '');
function grams(s) {
  const t = clean(s), set = new Set();
  for (const n of [2, 3]) for (let i = 0; i + n <= t.length; i++) set.add(t.slice(i, i + n));
  if (!set.size && t) set.add(t);
  return set;
}
function sim(a, b) { // Dice coefficient
  if (!a.size || !b.size) return 0;
  let inter = 0; for (const g of a) if (b.has(g)) inter++;
  return (2 * inter) / (a.size + b.size);
}
export function groupNeeds(needs, threshold = 0.28) {
  const g = needs.map(n => grams(n.text));
  const parent = needs.map((_, i) => i);
  const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < needs.length; i++)
    for (let j = i + 1; j < needs.length; j++)
      if (sim(g[i], g[j]) >= threshold) parent[find(j)] = find(i);
  const buckets = new Map();
  needs.forEach((n, i) => { const r = find(i); if (!buckets.has(r)) buckets.set(r, []); buckets.get(r).push(i); });
  const groups = [...buckets.values()].map(idx => {
    // หัวข้อกลุ่ม = ข้อความที่คล้ายกับสมาชิกอื่นมากที่สุด
    let best = idx[0], bs = -1;
    for (const i of idx) {
      const s = idx.reduce((a, j) => a + (i === j ? 0 : sim(g[i], g[j])), 0);
      if (s > bs) { bs = s; best = i; }
    }
    const items = idx.map(i => needs[i]).sort((a, b) => b.ts - a.ts);
    return {
      label: needs[best].text.length > 60 ? needs[best].text.slice(0, 60) + '…' : needs[best].text,
      count: items.length,
      open: items.filter(x => x.status !== 'done').length,
      latest: items[0].ts,
      items,
    };
  });
  return groups.sort((a, b) => b.open - a.open || b.latest - a.latest);
}
