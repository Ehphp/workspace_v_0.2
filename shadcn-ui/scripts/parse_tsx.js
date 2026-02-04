import fs from 'fs';
import path from 'path';
import { parse } from '@babel/parser';

const p = path.resolve(process.cwd(), 'src/pages/Requirements.tsx');
const code = fs.readFileSync(p, 'utf8');

const ast = parse(code, {
    sourceType: 'module',
    plugins: [
        'typescript',
        'jsx',
        'classProperties',
        'decorators-legacy',
        'topLevelAwait'
    ],
    errorRecovery: true,
});
if ((ast && ast.errors && ast.errors.length) || (ast && ast.comments && ast.comments.length && ast.comments[0].type === 'CommentBlock')) {
    const errs = ast.errors || [];
    console.error('\n--- Parser reported errors ---');
    errs.forEach((e, idx) => {
        console.error(`#${idx + 1}: ${e.message}`);
        if (e.loc) {
            const { line, column } = e.loc;
            console.error(`   at line ${line}, column ${column}`);
            const lines = code.split('\n');
            const start = Math.max(0, line - 4);
            const end = Math.min(lines.length, line + 2);
            console.error('   Code context:');
            for (let i = start; i < end; i++) {
                const num = i + 1;
                const marker = num === line ? '>' : ' ';
                console.error(`   ${marker} ${String(num).padStart(4)} | ${lines[i]}`);
            }
        }
    });
    process.exitCode = 2;
} else {
    console.log('Parsed successfully — no syntax errors detected by @babel/parser (with recovery)');
}
