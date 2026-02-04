import fs from 'fs';
import path from 'path';
const p = path.resolve(process.cwd(), 'src/pages/Requirements.tsx');
const s = fs.readFileSync(p, 'utf8');
const tagRe = /<\s*(\/)?\s*([A-Za-z0-9_]+)([^>]*)>/g;
let stack = [];
let m;
let lineStarts = [0];
for (let i = 0; i < s.length; i++) if (s[i] === '\n') lineStarts.push(i + 1);
function getLineCol(idx) {
    let line = 0; while (line + 1 < lineStarts.length && lineStarts[line + 1] <= idx) line++;
    return { line: line + 1, col: idx - lineStarts[line] + 1 };
}
// Limit scan to the returned JSX block to avoid matching generics/types elsewhere
const returnIdx = s.indexOf('return (');
const scanSource = returnIdx >= 0 ? s.slice(returnIdx) : s;
while ((m = tagRe.exec(scanSource))) {
    const isClose = !!m[1];
    const name = m[2];
    const rest = m[3] || '';
    const idx = (returnIdx >= 0 ? returnIdx : 0) + m.index;
    // Heuristic: skip matches that are likely TypeScript generics or JSX-like tokens inside types
    const prevChar = idx > 0 ? s[idx - 1] : '\n';
    if (/[A-Za-z0-9_.:]/.test(prevChar)) {
        // likely a generic/type like React.ChangeEvent<HTML...> - ignore
        continue;
    }
    // determine if the tag is self-closing by checking the character before the next '>' in the source
    const closeIdx = s.indexOf('>', idx);
    const selfClose = closeIdx > 0 && s[closeIdx - 1] === '/';
    const pos = getLineCol(idx);
    if (!isClose && !selfClose) {
        stack.push({ name, idx, pos });
    } else if (!isClose && selfClose) {
        // ignore
    } else if (isClose) {
        const top = stack[stack.length - 1];
        if (!top) {
            console.log('Closing tag without opening:', name, 'at', pos);
            break;
        }
        if (top.name === name) {
            stack.pop();
        } else {
            console.log('Mismatch at', pos, ': closing', name, 'but top is', top.name, 'opened at', top.pos);
            const topTagSrc = s.slice(top.idx, s.indexOf('>', top.idx) + 1);
            const thisTagSrc = s.slice(m.index, s.indexOf('>', m.index) + 1);
            console.log('Top tag source:', topTagSrc);
            console.log('This tag source:', thisTagSrc);
            break;
        }
    }
}
console.log('Remaining stack top 5:', stack.slice(-5).map(s => ({ name: s.name, pos: s.pos })));
console.log('Total tags scanned');

