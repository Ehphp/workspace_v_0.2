/**
 * docs:update - AI-powered documentation updater
 * 
 * Reads git diff, consults DOCS_MAP.yml, and uses OpenAI to suggest doc updates.
 * 
 * Usage:
 *   OPENAI_API_KEY=sk-xxx pnpm run docs:update
 *   OPENAI_API_KEY=sk-xxx pnpm run docs:update --apply  # Auto-apply changes
 * 
 * Requires: OPENAI_API_KEY environment variable
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DOCS_ROOT = join(ROOT, "docs");

// --- Utilities ---

function sh(cmd) {
    try {
        return execSync(cmd, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
    } catch (e) {
        return "";
    }
}

function loadYaml(path) {
    // Simple YAML parser for DOCS_MAP.yml structure
    const content = readFileSync(path, "utf-8");
    const rules = [];
    let currentRule = null;
    let currentKey = null;

    for (const line of content.split("\n")) {
        if (line.trim().startsWith("- when_changed:")) {
            if (currentRule) rules.push(currentRule);
            currentRule = { when_changed: [], docs_should_update: [] };
            currentKey = "when_changed";
        } else if (line.trim().startsWith("docs_should_update:")) {
            currentKey = "docs_should_update";
        } else if (line.trim().startsWith("- \"") && currentRule && currentKey) {
            const match = line.match(/"([^"]+)"/);
            if (match) currentRule[currentKey].push(match[1]);
        }
    }
    if (currentRule) rules.push(currentRule);

    return { rules };
}

function matchesPattern(filePath, pattern) {
    // Convert glob pattern to regex
    const regex = new RegExp(
        "^" + pattern
            .replace(/\*\*/g, ".*")
            .replace(/\*/g, "[^/]*")
            .replace(/\?/g, ".")
        + "$"
    );
    return regex.test(filePath);
}

// --- Main Logic ---

async function main() {
    const applyChanges = process.argv.includes("--apply");

    // Check for API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.error("Error: OPENAI_API_KEY environment variable required.");
        console.error("Usage: OPENAI_API_KEY=sk-xxx pnpm run docs:update");
        process.exit(1);
    }

    // Get changed files
    let base = "origin/main";
    try { sh(`git rev-parse --verify ${base}`); } catch { base = "main"; }

    const diffOutput = sh(`git diff --name-only ${base}...HEAD`);
    const changedFiles = diffOutput ? diffOutput.split("\n").filter(Boolean) : [];

    if (changedFiles.length === 0) {
        console.log("No changed files detected. Nothing to update.");
        process.exit(0);
    }

    console.log(`\n📁 Changed files (${changedFiles.length}):`);
    changedFiles.forEach(f => console.log(`   ${f}`));

    // Load DOCS_MAP.yml
    const docsMapPath = join(DOCS_ROOT, "DOCS_MAP.yml");
    if (!existsSync(docsMapPath)) {
        console.error("Error: DOCS_MAP.yml not found at", docsMapPath);
        process.exit(1);
    }

    const docsMap = loadYaml(docsMapPath);

    // Find which docs need updating
    const docsToUpdate = new Set();

    for (const file of changedFiles) {
        for (const rule of docsMap.rules) {
            const matches = rule.when_changed.some(pattern => matchesPattern(file, pattern));
            if (matches) {
                rule.docs_should_update.forEach(doc => docsToUpdate.add(doc));
            }
        }
    }

    if (docsToUpdate.size === 0) {
        console.log("\n✅ No documentation updates required based on DOCS_MAP.yml rules.");
        process.exit(0);
    }

    console.log(`\n📝 Docs that should be updated (${docsToUpdate.size}):`);
    docsToUpdate.forEach(d => console.log(`   ${d}`));

    // Get detailed diff for context
    const detailedDiff = sh(`git diff ${base}...HEAD -- ${changedFiles.slice(0, 10).join(" ")}`);

    // For each doc, generate update suggestions
    for (const docPath of docsToUpdate) {
        const fullDocPath = join(ROOT, "..", docPath);

        if (!existsSync(fullDocPath)) {
            console.warn(`\n⚠️  Doc not found: ${docPath}`);
            continue;
        }

        const currentDoc = readFileSync(fullDocPath, "utf-8");

        console.log(`\n🤖 Analyzing ${docPath}...`);

        const prompt = buildPrompt(docPath, currentDoc, changedFiles, detailedDiff);

        try {
            const suggestion = await callOpenAI(apiKey, prompt);

            if (suggestion.noChangesNeeded) {
                console.log(`   ✓ No changes needed for ${docPath}`);
                continue;
            }

            console.log(`\n--- Suggested changes for ${docPath} ---`);
            console.log(suggestion.explanation);

            if (suggestion.updatedContent && applyChanges) {
                writeFileSync(fullDocPath, suggestion.updatedContent, "utf-8");
                console.log(`\n   ✅ Changes applied to ${docPath}`);
            } else if (suggestion.updatedContent) {
                console.log(`\n   💡 Run with --apply to auto-apply changes`);
            }

        } catch (err) {
            console.error(`   ❌ Error processing ${docPath}:`, err.message);
        }
    }

    console.log("\n✨ docs:update complete.\n");
}

function buildPrompt(docPath, currentDoc, changedFiles, diff) {
    return `You are a technical documentation maintainer for Syntero, a requirements estimation system.

## Task
Review if the documentation file needs updates based on code changes.

## Documentation File
Path: ${docPath}

Current Content:
\`\`\`markdown
${currentDoc.slice(0, 8000)}
\`\`\`

## Changed Files
${changedFiles.map(f => `- ${f}`).join("\n")}

## Code Diff (truncated)
\`\`\`diff
${diff.slice(0, 4000)}
\`\`\`

## Instructions
1. Analyze if the code changes require documentation updates
2. If NO changes needed, respond with: {"noChangesNeeded": true}
3. If changes ARE needed, respond with:
   {
     "noChangesNeeded": false,
     "explanation": "Brief explanation of what changed and why docs need updating",
     "updatedContent": "Full updated markdown content"
   }

## Rules
- Do NOT add marketing language
- Do NOT change document structure unless necessary
- Keep existing formatting style
- Only update sections affected by the code changes
- Be precise and technical

Respond with valid JSON only.`;
}

async function callOpenAI(apiKey, prompt) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are a precise technical documentation assistant. Respond with valid JSON only." },
                { role: "user", content: prompt }
            ],
            temperature: 0,
            max_tokens: 4000
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "{}";

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = content;
    if (content.includes("```")) {
        const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (match) jsonStr = match[1];
    }

    return JSON.parse(jsonStr.trim());
}

main().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
