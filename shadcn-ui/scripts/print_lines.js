import fs from 'fs';
import path from 'path';
const p = path.resolve(process.cwd(), 'src/pages/Requirements.tsx');
const s = fs.readFileSync(p, 'utf8');
const lines = s.split(/\r?\n/);
const start = 520; const end = 540;
for (let i=start-1;i<end;i++){
  const num = i+1;
  console.log(String(num).padStart(4,' ') + ': ' + (lines[i]===undefined ? '' : lines[i]));
}
