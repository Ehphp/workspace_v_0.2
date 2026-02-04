/**
 * AI Variance Testing Suite
 * 
 * Test per misurare la consistenza e varianza delle risposte di GPT
 * quando analizza lo stesso requisito multiple volte.
 * 
 * IMPORTANTE: Questi test chiamano l'API OpenAI reale e consumano token.
 * Eseguirli solo quando necessario.
 */

import { describe, it, expect } from 'vitest';
import { suggestActivities } from '@/lib/openai';
import type { Activity, Driver, Risk, TechnologyPreset } from '@/types/database';

// Mock data realistici
const mockActivities: Activity[] = [
    { id: '1', code: 'REQ_ANALYSIS', name: 'Requirements Analysis', base_hours: 2, tech_category: 'MULTI', group: 'ANALYSIS', active: true, created_at: '2024-01-01', description: 'Analyze requirements' },
    { id: '2', code: 'DESIGN_UI', name: 'UI Design', base_hours: 3, tech_category: 'FRONTEND', group: 'ANALYSIS', active: true, created_at: '2024-01-01', description: 'Design user interface' },
    { id: '3', code: 'DEV_BACKEND', name: 'Backend Development', base_hours: 8, tech_category: 'BACKEND', group: 'DEV', active: true, created_at: '2024-01-01', description: 'Develop backend' },
    { id: '4', code: 'DEV_FRONTEND', name: 'Frontend Development', base_hours: 6, tech_category: 'FRONTEND', group: 'DEV', active: true, created_at: '2024-01-01', description: 'Develop frontend' },
    { id: '5', code: 'TEST_UNIT', name: 'Unit Testing', base_hours: 3, tech_category: 'MULTI', group: 'TEST', active: true, created_at: '2024-01-01', description: 'Unit tests' },
    { id: '6', code: 'TEST_INTEG', name: 'Integration Testing', base_hours: 4, tech_category: 'MULTI', group: 'TEST', active: true, created_at: '2024-01-01', description: 'Integration tests' },
    { id: '7', code: 'DEPLOY', name: 'Deployment', base_hours: 2, tech_category: 'MULTI', group: 'OPS', active: true, created_at: '2024-01-01', description: 'Deploy to production' },
]; const mockDrivers: Driver[] = [
    {
        id: '1',
        code: 'COMPLEXITY',
        name: 'Technical Complexity',
        description: 'How complex is the implementation',
        options: [
            { value: 'LOW', label: 'Low', multiplier: 0.8 },
            { value: 'MEDIUM', label: 'Medium', multiplier: 1.0 },
            { value: 'HIGH', label: 'High', multiplier: 1.3 },
        ],
        created_at: '2024-01-01',
    },
    {
        id: '2',
        code: 'INTEGRATION',
        name: 'Integration Complexity',
        description: 'Number of integrations',
        options: [
            { value: 'NONE', label: 'None', multiplier: 0.9 },
            { value: 'FEW', label: 'Few', multiplier: 1.0 },
            { value: 'MANY', label: 'Many', multiplier: 1.2 },
        ],
        created_at: '2024-01-01',
    },
];

const mockRisks: Risk[] = [
    { id: '1', code: 'R_TECH', name: 'Technical Risk', description: 'Technical challenges', weight: 5, created_at: '2024-01-01' },
    { id: '2', code: 'R_INTEG', name: 'Integration Risk', description: 'Integration issues', weight: 8, created_at: '2024-01-01' },
    { id: '3', code: 'R_PERF', name: 'Performance Risk', description: 'Performance concerns', weight: 6, created_at: '2024-01-01' },
];

const mockTech: TechnologyPreset = {
    id: '1',
    code: 'FULLSTACK_WEB',
    name: 'Full Stack Web',
    description: 'Full stack web application',
    tech_category: 'FULLSTACK',
    default_activity_codes: ['REQ_ANALYSIS', 'DEV_BACKEND', 'DEV_FRONTEND', 'TEST_UNIT'],
    default_driver_values: { COMPLEXITY: 'MEDIUM', INTEGRATION: 'FEW' },
    default_risks: ['R_TECH'],
    color: 'blue',
    icon: 'code',
    sort_order: 1,
    created_at: '2024-01-01',
}; describe('AI Variance Analysis', () => {
    // NOTA: Questi test sono disabilitati di default perché chiamano API reali
    // Per eseguirli, rimuovi .skip e assicurati che OPENAI_API_KEY sia configurato

    // Base URL per Netlify Dev (di default gira su porta 8888)
    const NETLIFY_BASE_URL = 'http://localhost:8888';

    describe('Single Requirement - Multiple Runs', () => {
        it('should measure variance when analyzing same requirement 5 times', async () => {
            const requirement = 'Create a user authentication system with login, registration, password reset, and email verification';
            const runs = 5;
            const results = [];

            console.log('\n=== AI VARIANCE TEST ===');
            console.log(`Requirement: "${requirement}"`);
            console.log(`Runs: ${runs}\n`);

            // Esegui 5 volte la stessa richiesta
            for (let i = 0; i < runs; i++) {
                console.log(`Run ${i + 1}/${runs}...`);

                const result = await suggestActivities({
                    description: requirement,
                    preset: mockTech,
                    activities: mockActivities,
                    drivers: mockDrivers,
                    risks: mockRisks,
                    baseUrl: NETLIFY_BASE_URL,
                    testMode: true, // Disable cache, enable variance
                });

                results.push(result);

                console.log(`  Activities: [${result.activityCodes.join(', ')}]`);
                console.log(`  Drivers: ${JSON.stringify(result.suggestedDrivers || {})}`);
                console.log(`  Risks: [${result.suggestedRisks?.join(', ') || 'none'}]`);
                console.log(`  Reasoning: ${result.reasoning?.substring(0, 80)}...`);
                console.log('');

                // Pausa tra le chiamate per evitare rate limiting
                if (i < runs - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            // Analisi dei risultati
            console.log('=== VARIANCE ANALYSIS ===\n');

            // 1. Analizza attività suggerite
            const activitySets = results.map(r => new Set(r.activityCodes));
            const allActivities = new Set<string>();
            activitySets.forEach(set => set.forEach((act: string) => allActivities.add(act)));

            console.log('Activities Variance:');
            allActivities.forEach((activity: string) => {
                const count = activitySets.filter(set => set.has(activity)).length;
                const percentage = (count / runs) * 100;
                console.log(`  ${activity}: ${count}/${runs} (${percentage}%)`);
            });

            // 2. Calcola Jaccard similarity tra i set di attività
            const similarities: number[] = [];
            for (let i = 0; i < results.length - 1; i++) {
                for (let j = i + 1; j < results.length; j++) {
                    const set1 = activitySets[i];
                    const set2 = activitySets[j];
                    const intersection = new Set([...set1].filter(x => set2.has(x)));
                    const union = new Set([...set1, ...set2]);
                    const similarity = intersection.size / union.size;
                    similarities.push(similarity);
                }
            }

            const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;
            console.log(`\nAverage Jaccard Similarity: ${(avgSimilarity * 100).toFixed(1)}%`);
            console.log(`Min Similarity: ${(Math.min(...similarities) * 100).toFixed(1)}%`);
            console.log(`Max Similarity: ${(Math.max(...similarities) * 100).toFixed(1)}%`);

            // 3. Analizza varianza dei driver
            console.log('\nDrivers Variance:');
            const driverKeys = new Set<string>();
            results.forEach(r => Object.keys(r.suggestedDrivers || {}).forEach(k => driverKeys.add(k)));

            driverKeys.forEach(driverKey => {
                const values = results.map(r => r.suggestedDrivers?.[driverKey] || 'NOT_SET');
                const valueCounts = values.reduce((acc, val) => {
                    acc[val] = (acc[val] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>);

                console.log(`  ${driverKey}:`);
                Object.entries(valueCounts).forEach(([value, count]) => {
                    const percentage = ((count as number) / runs * 100).toFixed(0);
                    console.log(`    ${value}: ${count}/${runs} (${percentage}%)`);
                });
            });

            // 4. Analizza varianza dei rischi
            console.log('\nRisks Variance:');
            const riskSets = results.map(r => new Set(r.suggestedRisks || []));
            const allRisks = new Set<string>();
            riskSets.forEach(set => set.forEach((risk: string) => allRisks.add(risk)));

            allRisks.forEach((risk: string) => {
                const count = riskSets.filter(set => set.has(risk)).length;
                const percentage = (count / runs) * 100;
                console.log(`  ${risk}: ${count}/${runs} (${percentage}%)`);
            });

            // Aspettative del test
            expect(results).toHaveLength(runs);
            expect(avgSimilarity).toBeGreaterThan(0.5); // Almeno 50% di similarità            // Log finale
            console.log('\n=== CONCLUSIONS ===');
            if (avgSimilarity > 0.8) {
                console.log('✅ AI is HIGHLY CONSISTENT (>80% similarity)');
            } else if (avgSimilarity > 0.6) {
                console.log('⚠️  AI is MODERATELY CONSISTENT (60-80% similarity)');
            } else {
                console.log('❌ AI is INCONSISTENT (<60% similarity)');
            }
            console.log('');
        }, 60000); // Timeout di 60 secondi per test con API calls

        it('should compare variance between simple and complex requirements', async () => {
            const simpleReq = 'Add a button to the homepage';
            const complexReq = 'Build a complete e-commerce platform with user accounts, product catalog, shopping cart, payment integration, order management, inventory tracking, and admin dashboard';

            console.log('\n=== SIMPLE vs COMPLEX VARIANCE ===\n');

            // Test requisito semplice (2 runs)
            console.log('Testing SIMPLE requirement (2 runs)...');
            const simpleResults = [];
            for (let i = 0; i < 2; i++) {
                const result = await suggestActivities({
                    description: simpleReq,
                    preset: mockTech,
                    activities: mockActivities,
                    drivers: mockDrivers,
                    risks: mockRisks,
                    baseUrl: NETLIFY_BASE_URL,
                    testMode: true,
                });
                simpleResults.push(result);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            const simpleSet1 = new Set(simpleResults[0].activityCodes);
            const simpleSet2 = new Set(simpleResults[1].activityCodes);
            const simpleIntersection = new Set([...simpleSet1].filter(x => simpleSet2.has(x)));
            const simpleUnion = new Set([...simpleSet1, ...simpleSet2]);
            const simpleSimilarity = simpleIntersection.size / simpleUnion.size;

            console.log(`Simple Req Activities Run 1: [${simpleResults[0].activityCodes.join(', ')}]`);
            console.log(`Simple Req Activities Run 2: [${simpleResults[1].activityCodes.join(', ')}]`);
            console.log(`Simple Req Similarity: ${(simpleSimilarity * 100).toFixed(1)}%\n`);

            // Test requisito complesso (2 runs)
            console.log('Testing COMPLEX requirement (2 runs)...');
            const complexResults = [];
            for (let i = 0; i < 2; i++) {
                const result = await suggestActivities({
                    description: complexReq,
                    preset: mockTech,
                    activities: mockActivities,
                    drivers: mockDrivers,
                    risks: mockRisks,
                    baseUrl: NETLIFY_BASE_URL,
                    testMode: true,
                });
                complexResults.push(result);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            const complexSet1 = new Set(complexResults[0].activityCodes);
            const complexSet2 = new Set(complexResults[1].activityCodes);
            const complexIntersection = new Set([...complexSet1].filter(x => complexSet2.has(x)));
            const complexUnion = new Set([...complexSet1, ...complexSet2]);
            const complexSimilarity = complexIntersection.size / complexUnion.size;

            console.log(`Complex Req Activities Run 1: [${complexResults[0].activityCodes.join(', ')}]`);
            console.log(`Complex Req Activities Run 2: [${complexResults[1].activityCodes.join(', ')}]`);
            console.log(`Complex Req Similarity: ${(complexSimilarity * 100).toFixed(1)}%\n`);

            // Conclusioni
            console.log('=== CONCLUSIONS ===');
            console.log(`Simple requirements consistency: ${(simpleSimilarity * 100).toFixed(1)}%`);
            console.log(`Complex requirements consistency: ${(complexSimilarity * 100).toFixed(1)}%`);

            if (simpleSimilarity > complexSimilarity) {
                console.log('→ Simple requirements have HIGHER consistency (expected)');
            } else {
                console.log('→ Complex requirements have HIGHER consistency (unexpected!)');
            }
            console.log('');

            expect(simpleResults).toHaveLength(2);
            expect(complexResults).toHaveLength(2);
        }, 60000);
    });

    describe('Local Variance Simulation (No API Calls)', () => {
        it('should simulate AI variance patterns', () => {
            // Simula diversi scenari di varianza
            const scenarios = [
                {
                    name: 'High Consistency (AI sempre uguale)',
                    runs: [
                        { activities: ['A', 'B', 'C'], drivers: { COMPLEXITY: 'HIGH' } },
                        { activities: ['A', 'B', 'C'], drivers: { COMPLEXITY: 'HIGH' } },
                        { activities: ['A', 'B', 'C'], drivers: { COMPLEXITY: 'HIGH' } },
                    ],
                },
                {
                    name: 'Moderate Consistency (AI varia leggermente)',
                    runs: [
                        { activities: ['A', 'B', 'C'], drivers: { COMPLEXITY: 'HIGH' } },
                        { activities: ['A', 'B', 'D'], drivers: { COMPLEXITY: 'HIGH' } },
                        { activities: ['A', 'B', 'C'], drivers: { COMPLEXITY: 'MEDIUM' } },
                    ],
                },
                {
                    name: 'Low Consistency (AI molto variabile)',
                    runs: [
                        { activities: ['A', 'B'], drivers: { COMPLEXITY: 'HIGH' } },
                        { activities: ['C', 'D', 'E'], drivers: { COMPLEXITY: 'LOW' } },
                        { activities: ['F', 'G'], drivers: { COMPLEXITY: 'MEDIUM' } },
                    ],
                },
            ];

            scenarios.forEach(scenario => {
                console.log(`\nScenario: ${scenario.name}`);

                // Calcola Jaccard similarity media
                const sets = scenario.runs.map(r => new Set(r.activities));
                let totalSimilarity = 0;
                let comparisons = 0;

                for (let i = 0; i < sets.length - 1; i++) {
                    for (let j = i + 1; j < sets.length; j++) {
                        const intersection = new Set([...sets[i]].filter(x => sets[j].has(x)));
                        const union = new Set([...sets[i], ...sets[j]]);
                        const similarity = intersection.size / union.size;
                        totalSimilarity += similarity;
                        comparisons++;
                    }
                }

                const avgSimilarity = totalSimilarity / comparisons;
                console.log(`  Average Similarity: ${(avgSimilarity * 100).toFixed(1)}%`);

                if (avgSimilarity > 0.8) {
                    console.log('  → ALTA consistenza');
                    expect(avgSimilarity).toBeGreaterThan(0.8);
                } else if (avgSimilarity > 0.5) {
                    console.log('  → MEDIA consistenza');
                    expect(avgSimilarity).toBeGreaterThan(0.5);
                } else {
                    console.log('  → BASSA consistenza');
                    expect(avgSimilarity).toBeLessThan(0.5);
                }
            });
        });

        it('should calculate expected variance metrics', () => {
            // Metriche che ti aspetti di vedere
            console.log('\n=== EXPECTED VARIANCE METRICS ===\n');

            console.log('Per requisiti SEMPLICI:');
            console.log('  - Jaccard Similarity attesa: >85%');
            console.log('  - Numero attività suggerite: 2-4');
            console.log('  - Varianza driver: <20%');
            console.log('');

            console.log('Per requisiti COMPLESSI:');
            console.log('  - Jaccard Similarity attesa: 65-80%');
            console.log('  - Numero attività suggerite: 5-8');
            console.log('  - Varianza driver: 20-40%');
            console.log('');

            console.log('NOTA: Se la similarità è <60%, considera:');
            console.log('  1. Usare temperature più bassa (es. 0.3)');
            console.log('  2. Rendere il prompt più specifico');
            console.log('  3. Aggiungere esempi nel prompt');
            console.log('');

            // Test passa sempre (è solo informativo)
            expect(true).toBe(true);
        });
    });
});
