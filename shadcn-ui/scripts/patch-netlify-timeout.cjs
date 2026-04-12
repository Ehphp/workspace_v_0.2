/**
 * patch-netlify-timeout.js
 *
 * Netlify CLI v23.x hard-codes SYNCHRONOUS_FUNCTION_TIMEOUT = 30 (seconds)
 * in dist/utils/dev.js. When running locally without a linked site, this
 * value is the *only* source for the lambda-local timeout, meaning any
 * function that takes > 30 s will be killed.
 *
 * This script patches the constant to 120 s so that AI/agentic functions
 * have enough headroom during local development.
 *
 * It is idempotent: running it multiple times is safe.
 *
 * Called automatically by `pnpm run dev:netlify` before `netlify dev`.
 */

const fs = require('fs');
const path = require('path');

const DESIRED_TIMEOUT = 300; // seconds

// Locate the Netlify CLI dev.js file
// Support both direct and pnpm .pnpm store layouts
const candidates = [
  // pnpm hoisted
  path.join(__dirname, '..', 'node_modules', 'netlify-cli', 'dist', 'utils', 'dev.js'),
];

// Also search in the .pnpm store (pnpm strict / non-hoisted)
const pnpmStore = path.join(__dirname, '..', 'node_modules', '.pnpm');
if (fs.existsSync(pnpmStore)) {
  try {
    const entries = fs.readdirSync(pnpmStore).filter(e => e.startsWith('netlify-cli@'));
    for (const entry of entries) {
      candidates.push(
        path.join(pnpmStore, entry, 'node_modules', 'netlify-cli', 'dist', 'utils', 'dev.js')
      );
    }
  } catch {
    // ignore read errors
  }
}

let patched = false;

for (const filePath of candidates) {
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, 'utf8');

  // Match the hard-coded constant (any number)
  const regex = /const SYNCHRONOUS_FUNCTION_TIMEOUT\s*=\s*\d+/;
  const match = content.match(regex);

  if (!match) {
    console.log(`[patch-netlify-timeout] Pattern not found in ${filePath}, skipping`);
    continue;
  }

  const replacement = `const SYNCHRONOUS_FUNCTION_TIMEOUT = ${DESIRED_TIMEOUT}`;

  if (match[0] === replacement) {
    console.log(`[patch-netlify-timeout] Already patched (${DESIRED_TIMEOUT}s) in ${path.relative(process.cwd(), filePath)}`);
    patched = true;
    continue;
  }

  content = content.replace(regex, replacement);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`[patch-netlify-timeout] Patched ${match[0]} → ${replacement} in ${path.relative(process.cwd(), filePath)}`);
  patched = true;
}

if (!patched) {
  console.warn('[patch-netlify-timeout] WARNING: Could not find netlify-cli dev.js to patch. Function timeouts may default to 30s.');
  console.warn('[patch-netlify-timeout] Candidates searched:', candidates.map(c => path.relative(process.cwd(), c)));
}
