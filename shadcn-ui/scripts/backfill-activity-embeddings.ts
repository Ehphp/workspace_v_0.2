/**
 * Backfill Activity Embeddings
 * 
 * Generates and stores vector embeddings for all activities that
 * have embedding IS NULL. This is needed for pgvector similarity
 * search (search_catalog tool) to work correctly.
 * 
 * Prerequisites:
 *   - OPENAI_API_KEY set in environment
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set in environment
 * 
 * Usage:
 *   npx tsx scripts/backfill-activity-embeddings.ts
 *   npx tsx scripts/backfill-activity-embeddings.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env from project root (no dotenv dependency)
try {
    const envPath = resolve(process.cwd(), '.env');
    const envContent = readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) continue;
        const key = trimmed.substring(0, eqIndex).trim();
        let value = trimmed.substring(eqIndex + 1).trim();
        // Remove surrounding quotes
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
} catch { /* .env not found, rely on existing env vars */ }

// ─── Config ──────────────────────────────────────────────────────────────────

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const BATCH_SIZE = 20; // OpenAI supports up to 2048 inputs per call
const DRY_RUN = process.argv.includes('--dry-run');

// ─── Clients ─────────────────────────────────────────────────────────────────

function getSupabase() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }
    return createClient(url, key);
}

function getOpenAI() {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('Missing OPENAI_API_KEY');
    }
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createSearchText(activity: { name: string; description: string | null; code: string; group: string | null }): string {
    return [activity.name, activity.description || '', `Category: ${activity.group || 'General'}`]
        .filter(Boolean)
        .join('. ');
}

async function generateBatch(openai: OpenAI, texts: string[]): Promise<number[][]> {
    const normalized = texts.map(t => t.replace(/\s+/g, ' ').trim().substring(0, 8000));
    const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: normalized,
        dimensions: EMBEDDING_DIMENSIONS,
    });
    return response.data.map(d => d.embedding);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    console.log(`\n🔧 Activity Embeddings Backfill${DRY_RUN ? ' (DRY RUN)' : ''}\n`);

    const supabase = getSupabase();
    const openai = getOpenAI();

    // ─── Global activities ───────────────────────────────────────────────────
    await backfillTable(supabase, openai, {
        table: 'activities',
        label: 'global activities',
        filter: (q) => q.eq('active', true).is('embedding', null),
    });

    // ─── Project activities ──────────────────────────────────────────────────
    await backfillTable(supabase, openai, {
        table: 'project_activities',
        label: 'project activities',
        filter: (q) => q.eq('is_enabled', true).is('embedding', null),
    });
}

interface BackfillOptions {
    table: string;
    label: string;
    filter: (query: any) => any;
}

async function backfillTable(supabase: ReturnType<typeof getSupabase>, openai: OpenAI, opts: BackfillOptions) {
    console.log(`\n── ${opts.label} ──────────────────────────────────────────\n`);

    // Fetch rows without embeddings
    let query = supabase
        .from(opts.table)
        .select('id, code, name, description, group, tech_category, embedding')
        .order('code');
    query = opts.filter(query);
    const { data: activities, error } = await query;

    if (error) {
        console.error(`❌ Failed to fetch ${opts.label}:`, error.message);
        return;
    }

    if (!activities || activities.length === 0) {
        console.log(`✅ All ${opts.label} already have embeddings. Nothing to do.`);
        return;
    }

    console.log(`📊 Found ${activities.length} ${opts.label} without embeddings:\n`);

    // Group by tech_category for reporting
    const byCategory = activities.reduce((acc, a) => {
        const cat = a.tech_category || 'PROJECT';
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    Object.entries(byCategory).forEach(([cat, count]) => {
        console.log(`   ${cat}: ${count}`);
    });
    console.log();

    if (DRY_RUN) {
        console.log(`🏁 Dry run for ${opts.label} complete. Re-run without --dry-run to apply.\n`);
        return;
    }

    // Process in batches
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < activities.length; i += BATCH_SIZE) {
        const batch = activities.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(activities.length / BATCH_SIZE);

        console.log(`⏳ Batch ${batchNum}/${totalBatches} (${batch.length} ${opts.label})...`);

        try {
            const texts = batch.map(a => createSearchText(a));
            const embeddings = await generateBatch(openai, texts);

            // Update each row with its embedding
            for (let j = 0; j < batch.length; j++) {
                const { error: updateError } = await supabase
                    .from(opts.table)
                    .update({
                        embedding: `[${embeddings[j].join(',')}]`,
                        embedding_updated_at: new Date().toISOString(),
                    })
                    .eq('id', batch[j].id);

                if (updateError) {
                    console.error(`   ❌ ${batch[j].code}: ${updateError.message}`);
                    errorCount++;
                } else {
                    successCount++;
                }
            }

            console.log(`   ✅ Batch ${batchNum} complete (${batch.map(a => a.code).join(', ')})`);

            // Rate limit: small delay between batches
            if (i + BATCH_SIZE < activities.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        } catch (err) {
            console.error(`   ❌ Batch ${batchNum} failed:`, err instanceof Error ? err.message : err);
            errorCount += batch.length;
        }
    }

    console.log(`\n🏁 ${opts.label} backfill: ${successCount} updated, ${errorCount} errors\n`);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
