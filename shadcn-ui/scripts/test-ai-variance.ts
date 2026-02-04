/**
 * AI Variance Test Script
 * 
 * Verifica che le stime AI siano deterministiche e consistenti.
 * Esegue lo stesso requisito N volte e calcola la varianza.
 * 
 * Esecuzione: npx tsx scripts/test-ai-variance.ts
 */

const API_BASE_URL = process.env.API_URL || 'http://localhost:8888';
const NUM_ITERATIONS = 5;
const MAX_ACCEPTABLE_VARIANCE = 0.1; // 10% variance max

// Test data - requisito di esempio
const TEST_REQUIREMENT = {
    description: "Implementare un flusso Power Automate che invia una email settimanale ai Service Line Manager e Project Manager con l'elenco delle candidature scartate nella settimana precedente. L'email deve contenere nome candidato, posizione e motivo dello scarto.",
    techPresetId: 'test-preset-id',
    techCategory: 'POWER_PLATFORM',
};

// Risposte fisse per l'interview (simulate)
const FIXED_ANSWERS: Record<string, any> = {
    q1_flow_complexity: {
        questionId: 'q1_flow_complexity',
        category: 'INTEGRATION',
        value: 'simple',
        timestamp: new Date().toISOString(),
    },
    q2_data_source: {
        questionId: 'q2_data_source',
        category: 'DATA',
        value: 'dataverse_single_table',
        timestamp: new Date().toISOString(),
    },
    q3_email_template: {
        questionId: 'q3_email_template',
        category: 'UI_UX',
        value: 'standard_html',
        timestamp: new Date().toISOString(),
    },
    q4_recipients: {
        questionId: 'q4_recipients',
        category: 'DATA',
        value: '2-5',
        timestamp: new Date().toISOString(),
    },
    q5_testing: {
        questionId: 'q5_testing',
        category: 'TESTING',
        value: 'basic',
        timestamp: new Date().toISOString(),
    },
};

// Mock activities (Power Platform)
const MOCK_ACTIVITIES = [
    { code: 'PP_ANL_ALIGN', name: 'Allineamento analisi requisiti', description: 'Analisi requisiti', base_hours: 4, group: 'ANALYSIS', tech_category: 'POWER_PLATFORM' },
    { code: 'PP_ANL_ALIGN_SM', name: 'Allineamento analisi requisiti (Quick)', description: 'Quick sync', base_hours: 1.5, group: 'ANALYSIS', tech_category: 'POWER_PLATFORM' },
    { code: 'PP_FLOW_SIMPLE', name: 'Power Automate Flow semplice', description: 'Flow semplice', base_hours: 4, group: 'DEV', tech_category: 'POWER_PLATFORM' },
    { code: 'PP_FLOW_SIMPLE_SM', name: 'Power Automate Flow (Minimal)', description: 'Flow minimal', base_hours: 2, group: 'DEV', tech_category: 'POWER_PLATFORM' },
    { code: 'PP_FLOW_COMPLEX', name: 'Power Automate Flow complesso', description: 'Flow complesso', base_hours: 8, group: 'DEV', tech_category: 'POWER_PLATFORM' },
    { code: 'PP_DV_FIELD', name: 'Creazione campi Dataverse', description: 'Campi Dataverse', base_hours: 2, group: 'DEV', tech_category: 'POWER_PLATFORM' },
    { code: 'PP_DV_FIELD_SM', name: 'Creazione campi Dataverse (1-2 campi)', description: '1-2 campi', base_hours: 1, group: 'DEV', tech_category: 'POWER_PLATFORM' },
    { code: 'PP_E2E_TEST', name: 'Test end-to-end Power Platform', description: 'Test E2E', base_hours: 8, group: 'TEST', tech_category: 'POWER_PLATFORM' },
    { code: 'PP_E2E_TEST_SM', name: 'Test end-to-end Power Platform (Smoke)', description: 'Smoke test', base_hours: 4, group: 'TEST', tech_category: 'POWER_PLATFORM' },
    { code: 'PP_DEPLOY', name: 'Deploy soluzione Power Platform', description: 'Deploy', base_hours: 4, group: 'OPS', tech_category: 'POWER_PLATFORM' },
    { code: 'PP_DEPLOY_SM', name: 'Deploy soluzione Power Platform (Dev→Test)', description: 'Deploy semplice', base_hours: 2, group: 'OPS', tech_category: 'POWER_PLATFORM' },
    { code: 'CRS_DOC', name: 'Documentazione tecnica', description: 'Doc', base_hours: 4, group: 'GOVERNANCE', tech_category: 'MULTI' },
    { code: 'CRS_DOC_SM', name: 'Documentazione tecnica (Basic)', description: 'Doc basic', base_hours: 2, group: 'GOVERNANCE', tech_category: 'MULTI' },
];

interface EstimationResult {
    success: boolean;
    totalBaseDays: number;
    activities: { code: string; baseHours: number }[];
    confidenceScore: number;
    generatedTitle?: string;
    error?: string;
}

interface TestResult {
    iteration: number;
    totalBaseDays: number;
    activityCodes: string[];
    confidenceScore: number;
    responseTimeMs: number;
}

/**
 * Call the estimation API
 */
async function callEstimationAPI(): Promise<EstimationResult> {
    const response = await fetch(`${API_BASE_URL}/.netlify/functions/ai-estimate-from-interview`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            description: TEST_REQUIREMENT.description,
            techPresetId: TEST_REQUIREMENT.techPresetId,
            techCategory: TEST_REQUIREMENT.techCategory,
            answers: FIXED_ANSWERS,
            activities: MOCK_ACTIVITIES,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`API error ${response.status}: ${error}`);
    }

    return response.json();
}

/**
 * Calculate statistics
 */
function calculateStats(values: number[]): { mean: number; stdDev: number; variance: number; min: number; max: number } {
    const n = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    const min = Math.min(...values);
    const max = Math.max(...values);

    return { mean, stdDev, variance, min, max };
}

/**
 * Calculate coefficient of variation (CV)
 */
function calculateCV(values: number[]): number {
    const stats = calculateStats(values);
    return stats.mean > 0 ? stats.stdDev / stats.mean : 0;
}

/**
 * Compare activity sets
 */
function compareActivitySets(results: TestResult[]): { identical: boolean; commonActivities: string[]; variance: Map<string, number> } {
    const activityCounts = new Map<string, number>();

    results.forEach(r => {
        r.activityCodes.forEach(code => {
            activityCounts.set(code, (activityCounts.get(code) || 0) + 1);
        });
    });

    const n = results.length;
    const commonActivities = Array.from(activityCounts.entries())
        .filter(([_, count]) => count === n)
        .map(([code]) => code);

    const variance = new Map<string, number>();
    activityCounts.forEach((count, code) => {
        variance.set(code, count / n);
    });

    const identical = results.every(r =>
        r.activityCodes.length === results[0].activityCodes.length &&
        r.activityCodes.every(code => results[0].activityCodes.includes(code))
    );

    return { identical, commonActivities, variance };
}

/**
 * Run the test
 */
async function runVarianceTest() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('   AI VARIANCE TEST - Verifica Determinismo Stime');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`\n📋 Requisito: "${TEST_REQUIREMENT.description.substring(0, 80)}..."`);
    console.log(`🔧 Tech Category: ${TEST_REQUIREMENT.techCategory}`);
    console.log(`🔄 Iterazioni: ${NUM_ITERATIONS}`);
    console.log(`📊 Varianza massima accettabile: ${MAX_ACCEPTABLE_VARIANCE * 100}%\n`);

    const results: TestResult[] = [];

    for (let i = 1; i <= NUM_ITERATIONS; i++) {
        console.log(`\n▶ Iterazione ${i}/${NUM_ITERATIONS}...`);

        const startTime = Date.now();
        try {
            const result = await callEstimationAPI();
            const responseTime = Date.now() - startTime;

            if (!result.success) {
                console.log(`  ❌ Errore: ${result.error}`);
                continue;
            }

            const testResult: TestResult = {
                iteration: i,
                totalBaseDays: result.totalBaseDays,
                activityCodes: result.activities.map(a => a.code).sort(),
                confidenceScore: result.confidenceScore,
                responseTimeMs: responseTime,
            };

            results.push(testResult);

            console.log(`  ✅ ${result.totalBaseDays}d | ${result.activities.length} attività | confidence: ${result.confidenceScore} | ${responseTime}ms`);
            console.log(`     Attività: ${testResult.activityCodes.join(', ')}`);

        } catch (error) {
            console.log(`  ❌ Errore: ${error instanceof Error ? error.message : 'Unknown'}`);
        }

        // Small delay between calls
        if (i < NUM_ITERATIONS) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    // Analyze results
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('   RISULTATI ANALISI');
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (results.length < 2) {
        console.log('❌ Insufficienti risultati per analisi (servono almeno 2)');
        process.exit(1);
    }

    // Days variance
    const daysValues = results.map(r => r.totalBaseDays);
    const daysStats = calculateStats(daysValues);
    const daysCV = calculateCV(daysValues);

    console.log('📊 VARIANZA GIORNI:');
    console.log(`   Media: ${daysStats.mean.toFixed(2)}d`);
    console.log(`   Min: ${daysStats.min.toFixed(2)}d | Max: ${daysStats.max.toFixed(2)}d`);
    console.log(`   Deviazione std: ${daysStats.stdDev.toFixed(3)}`);
    console.log(`   Coefficiente di variazione: ${(daysCV * 100).toFixed(1)}%`);

    // Activity comparison
    const activityAnalysis = compareActivitySets(results);

    console.log('\n📋 VARIANZA ATTIVITÀ:');
    console.log(`   Set identici: ${activityAnalysis.identical ? '✅ SÌ' : '❌ NO'}`);
    console.log(`   Attività comuni (100%): ${activityAnalysis.commonActivities.length}`);

    if (!activityAnalysis.identical) {
        console.log('\n   Dettaglio frequenza attività:');
        activityAnalysis.variance.forEach((freq, code) => {
            const percentage = (freq * 100).toFixed(0);
            const bar = '█'.repeat(Math.round(freq * 10));
            const status = freq === 1 ? '✅' : freq >= 0.8 ? '⚠️' : '❌';
            console.log(`   ${status} ${code.padEnd(25)} ${bar.padEnd(10)} ${percentage}%`);
        });
    }

    // Confidence score variance
    const confidenceValues = results.map(r => r.confidenceScore);
    const confidenceStats = calculateStats(confidenceValues);

    console.log('\n🎯 VARIANZA CONFIDENCE SCORE:');
    console.log(`   Media: ${confidenceStats.mean.toFixed(2)}`);
    console.log(`   Min: ${confidenceStats.min.toFixed(2)} | Max: ${confidenceStats.max.toFixed(2)}`);

    // Response time
    const responseTimeValues = results.map(r => r.responseTimeMs);
    const responseTimeStats = calculateStats(responseTimeValues);

    console.log('\n⏱️  TEMPO DI RISPOSTA:');
    console.log(`   Media: ${(responseTimeStats.mean / 1000).toFixed(1)}s`);
    console.log(`   Min: ${(responseTimeStats.min / 1000).toFixed(1)}s | Max: ${(responseTimeStats.max / 1000).toFixed(1)}s`);

    // Final verdict
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('   VERDETTO FINALE');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const daysPass = daysCV <= MAX_ACCEPTABLE_VARIANCE;
    const activitiesPass = activityAnalysis.identical;
    const overallPass = daysPass && activitiesPass;

    console.log(`   Varianza giorni ≤ ${MAX_ACCEPTABLE_VARIANCE * 100}%: ${daysPass ? '✅ PASS' : '❌ FAIL'} (${(daysCV * 100).toFixed(1)}%)`);
    console.log(`   Attività identiche: ${activitiesPass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`\n   ${overallPass ? '🎉 TEST SUPERATO!' : '⚠️  TEST FALLITO - Necessario migliorare determinismo'}`);

    // Export results
    const report = {
        timestamp: new Date().toISOString(),
        config: {
            iterations: NUM_ITERATIONS,
            maxAcceptableVariance: MAX_ACCEPTABLE_VARIANCE,
            requirement: TEST_REQUIREMENT,
        },
        results: results,
        analysis: {
            days: { ...daysStats, cv: daysCV },
            activities: {
                identical: activityAnalysis.identical,
                commonCount: activityAnalysis.commonActivities.length,
            },
            confidence: confidenceStats,
            responseTime: responseTimeStats,
        },
        verdict: {
            daysPass,
            activitiesPass,
            overallPass,
        },
    };

    const reportPath = `./test-results/variance-test-${Date.now()}.json`;
    try {
        const fs = await import('fs');
        const path = await import('path');
        const dir = path.dirname(reportPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\n📄 Report salvato: ${reportPath}`);
    } catch (e) {
        // Ignore file write errors
    }

    process.exit(overallPass ? 0 : 1);
}

// Run
runVarianceTest().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
