import fs from 'fs';
import path from 'path';
const p = path.resolve(process.cwd(), 'src/pages/Requirements.tsx');
const original = fs.readFileSync(p, 'utf8');
fs.writeFileSync(p + '.bak', original, 'utf8');
const lines = original.split(/\r?\n/);
const out = [];
for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let quoteCount = (line.match(/"/g) || []).length;
    while (quoteCount % 2 === 1 && i + 1 < lines.length) {
        // join with next line
        line = line + ' ' + lines[i + 1].trim();
        i++;
        quoteCount = (line.match(/"/g) || []).length;
    }
    out.push(line);
}
fs.writeFileSync(p, out.join('\n'), 'utf8');
console.log('Wrote fixed file and backup at', p + '.bak');
