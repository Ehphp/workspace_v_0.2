import fs from 'fs';
import path from 'path';
const p = path.resolve(process.cwd(), 'src/pages/Requirements.tsx');
const s = fs.readFileSync(p, 'utf8');
for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '/') {
        const prev = s[i - 1] || '';
        const next = s[i + 1] || '';
        // skip comment starts and closing tags
        if (next === '/' || next === '*') continue;
        if (prev === '<') continue; // closing tag
        // show context
        const start = Math.max(0, i - 30);
        const end = Math.min(s.length, i + 30);
        const snippet = s.slice(start, end).replace(/\n/g, '␤');
        const { line } = s.slice(0, i).split('\n').reduce((acc, l, idx) => ({ line: idx + 1 }), { line: 1 });
        console.log(`index:${i} line snippet: ${snippet}`);
    }
}
