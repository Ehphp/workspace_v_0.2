import fs from 'fs';
import path from 'path';
const p = path.resolve(process.cwd(), 'src/pages/Requirements.tsx');
const s = fs.readFileSync(p, 'utf8');
let stack = [];
const pairs = { '{': '}', '(': ')', '[': ']', '`': '`' };
for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const prev = s[i - 1];
    // ignore escaped backticks
    if (ch === '`') {
        if (prev === '\\') continue;
        if (stack.length && stack[stack.length - 1] === '`') stack.pop(); else stack.push('`');
        continue;
    }
    if (ch in pairs) {
        stack.push(ch);
    } else if (Object.values(pairs).includes(ch)) {
        const last = stack[stack.length - 1];
        if (pairs[last] === ch) {
            stack.pop();
        } else {
            console.log('Mismatch at index', i, 'char', ch, 'last on stack', last);
            break;
        }
    }
}
if (stack.length === 0) console.log('No unmatched {([` found'); else console.log('Unmatched stack:', stack);

// Count tags like <Layout> vs </Layout>
const tagRe = /<\/?([A-Za-z0-9_]+)/g;
let m; const tags = [];
while ((m = tagRe.exec(s))) { tags.push(m[0]); }
console.log('Found', tags.length, 'tags sample:', tags.slice(-10));

// Quick search for lone regex-like slashes: occurrences of /=/ or /.../ not followed by alpha (very naive)
const slashMatches = [];
for (let i = 0; i < s.length; i++) {
    if (s[i] === '/' && s[i + 1] && s[i + 1] !== '/' && s[i + 1] !== '*') {
        slashMatches.push({ idx: i, context: s.slice(Math.max(0, i - 10), i + 10) });
    }
}
console.log('Potential slash occurrences (first 10):', slashMatches.slice(0, 10));
