import fs from 'fs';
import path from 'path';
const p = path.resolve(process.cwd(), 'src/pages/Requirements.tsx');
const s = fs.readFileSync(p, 'utf8');
const start = Math.max(0, s.length - 800);
const tail = s.slice(start);
console.log('--- tail text ---');
console.log(tail);
console.log('--- chars with codes ---');
for (let i = 0; i < tail.length; i++) {
    const ch = tail[i];
    const code = ch.charCodeAt(0).toString(16).padStart(4, '0');
    process.stdout.write(`${ch}(${code}) `);
    if ((i + 1) % 60 === 0) process.stdout.write('\n');
}
console.log('\n--- end ---');
