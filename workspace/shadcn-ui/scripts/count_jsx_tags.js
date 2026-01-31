import fs from 'fs';
import path from 'path';
const p = path.resolve(process.cwd(), 'src/pages/Requirements.tsx');
const s = fs.readFileSync(p, 'utf8');
const tagRe = /<\s*(\/)?\s*([A-Za-z0-9_:-]+)([^>]*)>/g;
const counts = new Map();
let m;
while ((m = tagRe.exec(s))) {
    const full = m[0];
    const isClose = !!m[1];
    const name = m[2];
    const attrs = m[3] || '';
    const selfClose = /\/$/.test(attrs) || /\/$/.test(full);
    const key = name;
    if (!counts.has(key)) counts.set(key, { open: 0, close: 0 });
    const obj = counts.get(key);
    if (selfClose) { obj.open++; obj.close++; } else if (isClose) obj.close++; else obj.open++;
}
const arr = Array.from(counts.entries()).map(([k, v]) => ({ tag: k, open: v.open, close: v.close })).sort((a, b) => (b.open - b.close) - (a.open - a.close));
console.log('Top differences (open - close):');
console.table(arr.slice(0, 20));
