import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { load } from "js-yaml";

const DOCS_MAP_PATH = "shadcn-ui/docs/DOCS_MAP.yml";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is required");
    process.exit(1);
}

function sh(cmd) {
    try {
        return execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
    } catch {
        return "";
    }
}

// Load docs map
if (!existsSync(DOCS_MAP_PATH)) {
    console.error(`Missing ${DOCS_MAP_PATH}`);
    process.exit(1);
}
const docsMap = load(readFileSync(DOCS_MAP_PATH, "utf8"));

// Get changed files
let base = "origin/main";
if (!sh(`git rev-parse --verify ${base}`)) {
    base = "origin/master";
    if (!sh(`git rev-parse --verify ${base}`)) {
        base = "main";
        if (!sh(`git rev-parse --verify ${base}`)) {
            base = "master";
            if (!sh(`git rev-parse --verify ${base}`)) {
                base = "HEAD~1";
            }
        }
    }
}
const diff = sh(`git diff --name-only ${base}...HEAD`) || sh(`git diff --name-only ${base}`);
const changedFiles = diff ? diff.split("\n").filter(Boolean) : [];

// Match changed files to docs
const docsToUpdate = new Set();
for (const file of changedFiles) {
    for (const rule of docsMap.mappings) {
        const pattern = new RegExp(rule.pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*"));
        if (pattern.test(file)) {
            rule.docs.forEach(d => docsToUpdate.add(d));
        }
    }
}

if (docsToUpdate.size === 0) {
    console.log("No docs updates needed.");
    process.exit(0);
}

console.log("Docs to update:", Array.from(docsToUpdate));

// Read changed code for context
const codeContext = changedFiles
    .filter(f => f.endsWith(".ts") || f.endsWith(".tsx"))
    .slice(0, 5)
    .map(f => {
        const content = sh(`git show HEAD:${f}`);
        return `### ${f}\n\`\`\`typescript\n${content.slice(0, 2000)}\n\`\`\``;
    })
    .join("\n\n");

// Generate suggestions for each doc
for (const docPath of docsToUpdate) {
    const fullPath = `shadcn-ui/${docPath}`;
    if (!existsSync(fullPath)) {
        console.log(`Skipping ${docPath} (not found)`);
        continue;
    }

    const currentDoc = readFileSync(fullPath, "utf8");

    const prompt = `You are a technical documentation expert. Given the following code changes and existing documentation, suggest updates to keep the documentation accurate.

## Changed Code
${codeContext}

## Current Documentation (${docPath})
${currentDoc.slice(0, 4000)}

## Task
Provide specific, actionable suggestions for updating this documentation. Focus on:
1. New features or APIs that need documentation
2. Changed behavior that needs updating
3. Deprecated features to mark

Format your response as a list of suggested changes.`;

    console.log(`\n📄 Analyzing ${docPath}...`);

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 1000
            })
        });

        const data = await response.json();
        const suggestions = data.choices?.[0]?.message?.content || "No suggestions generated";

        console.log("\nSuggested updates:");
        console.log(suggestions);

        // If --apply flag, write suggestions to a file
        if (process.argv.includes("--apply")) {
            const suggestionsPath = fullPath.replace(".md", ".suggestions.md");
            writeFileSync(suggestionsPath, `# Documentation Update Suggestions\n\n${suggestions}`);
            console.log(`\nSuggestions saved to ${suggestionsPath}`);
        }
    } catch (err) {
        console.error(`Error generating suggestions for ${docPath}:`, err.message);
    }
}
