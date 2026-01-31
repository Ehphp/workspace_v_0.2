import fs from 'fs';
import path from 'path';
import { parse } from '@babel/parser';
const p = path.resolve(process.cwd(), 'src/pages/Requirements.tsx');
const code = fs.readFileSync(p, 'utf8');
const lines = code.split(/\r?\n/);
let lo = 1, hi = lines.length, lastFail = null;
while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const part = lines.slice(0, mid).join('\n');
    try {
        parse(part, { sourceType: 'module', plugins: ['typescript', 'jsx', 'classProperties', 'decorators-legacy'], errorRecovery: false });
        // parse succeeded for prefix -> move right
        lo = mid + 1;
    } catch (err) {
        lastFail = { mid, message: err.message, loc: err.loc };
        hi = mid - 1;
    }
}
console.log('First failing prefix roughly at line:', lastFail ? lastFail.mid : 'none');
if (lastFail) console.log('Error:', lastFail.message, lastFail.loc);
else console.log('No failure in prefixes');
