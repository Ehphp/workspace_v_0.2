/**
 * Netlify Function: Generate Embeddings for Catalog
 * 
 * Background job to generate embeddings for all activities in the catalog.
 * Should be run once after enabling pgvector, then periodically for new activities.
 * 
 * POST /.netlify/functions/ai-generate-embeddings
 * 
 * Query params:
 * - type: 'activities' | 'requirements' | 'all' (default: 'activities')
 * - force: 'true' to regenerate all, otherwise only missing embeddings
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
    generateEmbedding,
    generateEmbeddingsBatch,
    createActivitySearchText,
    createRequirementSearchText
} from './lib/ai/embeddings';
import { validateAuthToken, logAuthDebugInfo } from './lib/auth/auth-validator';
import { getCorsHeaders, isOriginAllowed } from './lib/security/cors';

interface Activity {
    id: string;
    code: string;
    name: string;
    description: string | null;
    group: string;
    embedding: number[] | null;
}

interface Requirement {
    id: string;
    title: string;
    description: string | null;
    embedding: number[] | null;
}

interface GenerationResult {
    type: string;
    processed: number;
    updated: number;
    skipped: number;
    errors: string[];
}

/**
 * Initialize Supabase client with service role for bulk updates
 */
function getSupabaseClient(): SupabaseClient | null {
    const supabaseUrl = process.env.SUPABASE_URL;
    // Use service role key for admin operations
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return null;
    }

    return createClient(supabaseUrl, supabaseKey);
}

/**
 * Generate embeddings for activities
 */
async function generateActivityEmbeddings(
    supabase: SupabaseClient,
    force: boolean
): Promise<GenerationResult> {
    const result: GenerationResult = {
        type: 'activities',
        processed: 0,
        updated: 0,
        skipped: 0,
        errors: [],
    };

    // Fetch activities (only missing embeddings unless force)
    let query = supabase
        .from('activities')
        .select('id, code, name, description, group, embedding')
        .eq('active', true);

    if (!force) {
        query = query.is('embedding', null);
    }

    const { data: activities, error } = await query;

    if (error) {
        result.errors.push(`Failed to fetch activities: ${error.message}`);
        return result;
    }

    if (!activities || activities.length === 0) {
        console.log('[embeddings] No activities need embedding updates');
        return result;
    }

    result.processed = activities.length;
    console.log(`[embeddings] Processing ${activities.length} activities`);

    // Process in batches of 50
    const BATCH_SIZE = 50;
    for (let i = 0; i < activities.length; i += BATCH_SIZE) {
        const batch = activities.slice(i, i + BATCH_SIZE) as Activity[];

        // Create search texts
        const texts = batch.map(a => createActivitySearchText({
            name: a.name,
            description: a.description,
            code: a.code,
            group: a.group,
        }));

        try {
            // Generate embeddings for batch
            const embeddings = await generateEmbeddingsBatch(texts);

            // Update each activity
            for (let j = 0; j < batch.length; j++) {
                const activity = batch[j];
                const embedding = embeddings[j];

                // Format as PostgreSQL vector string
                const vectorString = `[${embedding.join(',')}]`;

                const { error: updateError } = await supabase
                    .from('activities')
                    .update({
                        embedding: vectorString,
                        embedding_updated_at: new Date().toISOString(),
                    })
                    .eq('id', activity.id);

                if (updateError) {
                    result.errors.push(`Failed to update ${activity.code}: ${updateError.message}`);
                } else {
                    result.updated++;
                }
            }
        } catch (err) {
            result.errors.push(`Batch ${i}-${i + BATCH_SIZE} failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }

        // Rate limiting: pause between batches
        if (i + BATCH_SIZE < activities.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    return result;
}

/**
 * Generate embeddings for requirements
 */
async function generateRequirementEmbeddings(
    supabase: SupabaseClient,
    force: boolean
): Promise<GenerationResult> {
    const result: GenerationResult = {
        type: 'requirements',
        processed: 0,
        updated: 0,
        skipped: 0,
        errors: [],
    };

    // Fetch requirements (only missing embeddings unless force)
    let query = supabase
        .from('requirements')
        .select('id, title, description, embedding');

    if (!force) {
        query = query.is('embedding', null);
    }

    const { data: requirements, error } = await query.limit(500); // Limit per run

    if (error) {
        result.errors.push(`Failed to fetch requirements: ${error.message}`);
        return result;
    }

    if (!requirements || requirements.length === 0) {
        console.log('[embeddings] No requirements need embedding updates');
        return result;
    }

    result.processed = requirements.length;
    console.log(`[embeddings] Processing ${requirements.length} requirements`);

    // Process in batches
    const BATCH_SIZE = 50;
    for (let i = 0; i < requirements.length; i += BATCH_SIZE) {
        const batch = requirements.slice(i, i + BATCH_SIZE) as Requirement[];

        const texts = batch.map(r => createRequirementSearchText({
            title: r.title,
            description: r.description,
        }));

        try {
            const embeddings = await generateEmbeddingsBatch(texts);

            for (let j = 0; j < batch.length; j++) {
                const requirement = batch[j];
                const embedding = embeddings[j];

                const vectorString = `[${embedding.join(',')}]`;

                const { error: updateError } = await supabase
                    .from('requirements')
                    .update({
                        embedding: vectorString,
                        embedding_updated_at: new Date().toISOString(),
                    })
                    .eq('id', requirement.id);

                if (updateError) {
                    result.errors.push(`Failed to update req ${requirement.id}: ${updateError.message}`);
                } else {
                    result.updated++;
                }
            }
        } catch (err) {
            result.errors.push(`Batch ${i}-${i + BATCH_SIZE} failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }

        if (i + BATCH_SIZE < requirements.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    return result;
}

export const handler: Handler = async (
    event: HandlerEvent,
    context: HandlerContext
) => {
    const originHeader = event.headers.origin || event.headers.Origin;
    const headers = getCorsHeaders(originHeader);

    logAuthDebugInfo();
    console.log('[ai-generate-embeddings] Request received');

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: '',
        };
    }

    // Only POST allowed
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method Not Allowed' }),
        };
    }

    // Validate auth (admin only operation)
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const authResult = await validateAuthToken(authHeader as string | undefined);
    if (!authResult.ok) {
        return {
            statusCode: authResult.statusCode || 401,
            headers,
            body: JSON.stringify({ error: authResult.message || 'Unauthorized' }),
        };
    }

    // Parse query parameters
    const params = event.queryStringParameters || {};
    const type = params.type || 'activities';
    const force = params.force === 'true';

    console.log(`[ai-generate-embeddings] Type: ${type}, Force: ${force}`);

    // Get Supabase client
    const supabase = getSupabaseClient();
    if (!supabase) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Database not configured' }),
        };
    }

    // Check OpenAI is configured
    if (!process.env.OPENAI_API_KEY) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'OpenAI API key not configured' }),
        };
    }

    const results: GenerationResult[] = [];

    try {
        if (type === 'activities' || type === 'all') {
            const actResult = await generateActivityEmbeddings(supabase, force);
            results.push(actResult);
        }

        if (type === 'requirements' || type === 'all') {
            const reqResult = await generateRequirementEmbeddings(supabase, force);
            results.push(reqResult);
        }

        const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);
        const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

        console.log(`[ai-generate-embeddings] Complete. Updated: ${totalUpdated}, Errors: ${totalErrors}`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                results,
                summary: {
                    totalUpdated,
                    totalErrors,
                },
            }),
        };
    } catch (err) {
        console.error('[ai-generate-embeddings] Fatal error:', err);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: err instanceof Error ? err.message : 'Unknown error',
                results,
            }),
        };
    }
};
