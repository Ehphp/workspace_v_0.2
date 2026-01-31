import { execSync } from "node:child_process";

function sh(cmd) {
    try {
        return execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
    } catch {
        return "";
    }
}

// Check if we're in a git repo
const isGitRepo = sh("git rev-parse --is-inside-work-tree") === "true";
if (!isGitRepo) {
    console.log("Docs check skipped: not a git repository.");
    process.exit(0);
}

// Files changed vs main (fallback: origin/main, then HEAD~1)
let base = "origin/main";
if (!sh(`git rev-parse --verify ${base}`)) {
    base = "main";
    if (!sh(`git rev-parse --verify ${base}`)) {
        base = "HEAD~1";
        if (!sh(`git rev-parse --verify ${base}`)) {
            console.log("Docs check skipped: no base commit to compare.");
            process.exit(0);
        }
    }
}

const diff = sh(`git diff --name-only ${base}...HEAD`) || sh(`git diff --name-only ${base}`);
const files = diff ? diff.split("\n").filter(Boolean) : [];

const codeChanged = files.some(p =>
    p.startsWith("workspace/shadcn-ui/src/") ||
    p.startsWith("workspace/shadcn-ui/netlify/functions/") ||
    p.startsWith("workspace/shadcn-ui/supabase/")
);

const docsChanged = files.some(p =>
    p.startsWith("workspace/shadcn-ui/docs/")
);

const skipFile = files.includes("workspace/shadcn-ui/docs/NO_DOCS_NEEDED.md");

if (codeChanged && !docsChanged && !skipFile) {
    console.error(
        "Docs required: code changed under shadcn-ui but no docs updated.\n" +
        "Update workspace/shadcn-ui/docs/ or add workspace/shadcn-ui/docs/NO_DOCS_NEEDED.md."
    );
    process.exit(1);
}

console.log("Docs check OK.");
