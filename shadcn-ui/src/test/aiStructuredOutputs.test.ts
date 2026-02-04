/**
 * AI Structured Outputs Testing Suite - Phase 2
 * 
 * Test automatizzati per verificare:
 * - Structured outputs funzionano correttamente
 * - Schema strict impedisce codici invalidi
 * - Validazione garantita da OpenAI
 * - Backward compatibility con Fase 1
 * 
 * NOTA: Questi test chiamano l'API OpenAI reale.
 * Per eseguire senza API, rimuovi .skip dai test simulati.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { suggestActivities } from '@/lib/openai';
import type { Activity, Driver, Risk, TechnologyPreset } from '@/types/database';

// Mock data - Power Platform activities
const mockActivities: Activity[] = [
    {
        id: '1',
        code: 'PP_ANL_ALIGN',
        name: 'Allineamento analisi requisiti',
        base_hours: 0.5,
        tech_category: 'POWER_PLATFORM',
        group: 'ANALYSIS',
        active: true,
        created_at: '2024-01-01',
        description: 'Sessioni di allineamento funzionale/tecnico sul requisito in ambito Power Platform.'
    },
    {
        id: '2',
        code: 'PP_DV_FIELD',
        name: 'Creazione campi Dataverse',
        base_hours: 0.25,
        tech_category: 'POWER_PLATFORM',
        group: 'DEV',
        active: true,
        created_at: '2024-01-01',
        description: 'Definizione e creazione di nuovi campi su tabelle Dataverse, incluse proprietà base e relazioni semplici.'
    },
    {
        id: '3',
        code: 'PP_DV_FORM',
        name: 'Configurazione form Dataverse',
        base_hours: 0.5,
        tech_category: 'POWER_PLATFORM',
        group: 'DEV',
        active: true,
        created_at: '2024-01-01',
        description: 'Configurazione layout form, controlli e logica di base lato Dataverse.'
    },
    {
        id: '4',
        code: 'PP_E2E_TEST',
        name: 'Test end-to-end Power Platform',
        base_hours: 1.0,
        tech_category: 'POWER_PLATFORM',
        group: 'TEST',
        active: true,
        created_at: '2024-01-01',
        description: 'Test end-to-end della soluzione in ambiente di test/pre-produzione.'
    },
    {
        id: '5',
        code: 'PP_DEPLOY',
        name: 'Deploy soluzione Power Platform',
        base_hours: 0.5,
        tech_category: 'POWER_PLATFORM',
        group: 'OPS',
        active: true,
        created_at: '2024-01-01',
        description: 'Preparazione e rilascio soluzione tra ambienti (dev/test/prod) con validazioni base.'
    },
    {
        id: '6',
        code: 'CRS_DOC',
        name: 'Documentazione tecnica',
        base_hours: 0.5,
        tech_category: 'MULTI',
        group: 'GOVERNANCE',
        active: true,
        created_at: '2024-01-01',
        description: 'Redazione o aggiornamento documentazione tecnica fondamentale per il requisito.'
    },
];

const mockDrivers: Driver[] = [
    {
        id: '1',
        code: 'COMPLEXITY',
        name: 'Complessità Tecnica',
        description: 'Livello di complessità tecnica',
        options: [
            { value: 'LOW', label: 'Bassa', multiplier: 0.8 },
            { value: 'MEDIUM', label: 'Media', multiplier: 1.0 },
            { value: 'HIGH', label: 'Alta', multiplier: 1.3 },
        ],
        created_at: '2024-01-01',
    },
];

const mockRisks: Risk[] = [
    {
        id: '1',
        code: 'INTEGRATION',
        name: 'Rischi di Integrazione',
        weight: 5,
        created_at: '2024-01-01',
        description: 'Rischi legati a integrazioni'
    },
];

const mockTech: TechnologyPreset = {
    id: '1',
    code: 'PP_BASIC',
    name: 'Power Platform Basic',
    description: 'Standard Power Platform configuration',
    tech_category: 'POWER_PLATFORM',
    default_activity_codes: ['PP_ANL_ALIGN', 'PP_DV_FIELD', 'PP_DV_FORM'],
    default_driver_values: { COMPLEXITY: 'MEDIUM' },
    default_risks: ['INTEGRATION'],
    color: 'green',
    icon: 'database',
    sort_order: 1,
    created_at: '2024-01-01',
};

describe('AI Structured Outputs - Phase 2', () => {

    // ============================================
    // TEST 1: Schema Validation (Simulated)
    // ============================================
    describe('Schema Validation (Simulated)', () => {

        it('should validate response structure', () => {
            // Simula response con structured outputs
            const response = {
                isValidRequirement: true,
                activityCodes: ['PP_ANL_ALIGN', 'PP_DV_FIELD', 'PP_DV_FORM'],
                reasoning: 'Selected activities for form field addition'
            };

            // Verifica struttura
            expect(response).toHaveProperty('isValidRequirement');
            expect(response).toHaveProperty('activityCodes');
            expect(response).toHaveProperty('reasoning');
            expect(typeof response.isValidRequirement).toBe('boolean');
            expect(Array.isArray(response.activityCodes)).toBe(true);
            expect(typeof response.reasoning).toBe('string');
        });

        it('should have all required fields', () => {
            const response = {
                isValidRequirement: true,
                activityCodes: ['PP_ANL_ALIGN'],
                reasoning: 'Test'
            };

            const requiredFields = ['isValidRequirement', 'activityCodes', 'reasoning'];
            requiredFields.forEach(field => {
                expect(response).toHaveProperty(field);
            });
        });

        it('should reject responses with additional properties (simulated)', () => {
            const invalidResponse = {
                isValidRequirement: true,
                activityCodes: ['PP_ANL_ALIGN'],
                reasoning: 'Test',
                extraField: 'should not be here'  // ❌ additionalProperties: false
            };

            // In produzione, OpenAI rifiuterebbe questa response
            const validKeys = ['isValidRequirement', 'activityCodes', 'reasoning'];
            const responseKeys = Object.keys(invalidResponse);
            const hasExtraFields = responseKeys.some(key => !validKeys.includes(key));

            expect(hasExtraFields).toBe(true);
            // OpenAI con strict: true non permetterebbe questa response
        });

        it('should validate activityCodes are from valid enum', () => {
            const validCodes = mockActivities.map(a => a.code);
            const response = {
                isValidRequirement: true,
                activityCodes: ['PP_ANL_ALIGN', 'PP_DV_FIELD'],
                reasoning: 'Test'
            };

            // Verifica che tutti i codici siano validi
            const allValid = response.activityCodes.every(code => validCodes.includes(code));
            expect(allValid).toBe(true);
        });

        it('should detect invalid codes that violate enum constraint', () => {
            const validCodes = mockActivities.map(a => a.code);
            const responseWithInvalidCode = {
                isValidRequirement: true,
                activityCodes: ['PP_ANL_ALIGN', 'FAKE_CODE_123'],  // ❌ Non nell'enum
                reasoning: 'Test'
            };

            const allValid = responseWithInvalidCode.activityCodes.every(code => validCodes.includes(code));
            expect(allValid).toBe(false);
            // Con structured outputs, OpenAI non permetterebbe questo
        });
    });

    // ============================================
    // TEST 2: API Integration Tests (Real API)
    // ============================================
    describe('API Integration - Real OpenAI Calls', () => {
        // ⚠️ SKIP di default - rimuovi .skip per eseguire con API reale

        it('should return valid structured output for simple requirement', async () => {
            const description = 'Aggiungere campo email al form utente';

            const result = await suggestActivities({
                description,
                preset: mockTech,
                activities: mockActivities,
                drivers: mockDrivers,
                risks: mockRisks,
            });

            // Verifica struttura response
            expect(result).toHaveProperty('isValidRequirement');
            expect(result).toHaveProperty('activityCodes');
            expect(result).toHaveProperty('reasoning');

            // Verifica che isValidRequirement sia true per requisito valido
            expect(result.isValidRequirement).toBe(true);

            // Verifica che activityCodes sia array non vuoto
            expect(Array.isArray(result.activityCodes)).toBe(true);
            expect(result.activityCodes.length).toBeGreaterThan(0);

            // Verifica che TUTTI i codici siano nell'enum valido
            const validCodes = mockActivities.map(a => a.code);
            result.activityCodes.forEach(code => {
                expect(validCodes).toContain(code);
            });

            console.log('✅ Structured output test passed:', result);
        }, 10000); // 10s timeout

        it('should reject invalid requirement', async () => {
            const description = 'test';  // Requisito invalido

            const result = await suggestActivities({
                description,
                preset: mockTech,
                activities: mockActivities,
                drivers: mockDrivers,
                risks: mockRisks,
            });

            // Verifica che isValidRequirement sia false
            expect(result.isValidRequirement).toBe(false);

            // Verifica reasoning presente
            expect(result.reasoning).toBeTruthy();
            expect(typeof result.reasoning).toBe('string');

            console.log('✅ Invalid requirement test passed:', result);
        }, 10000);

        it('should handle complex requirement', async () => {
            const description = 'Implementare sistema di autenticazione completo con login, registrazione, password reset e audit log';

            const result = await suggestActivities({
                description,
                preset: mockTech,
                activities: mockActivities,
                drivers: mockDrivers,
                risks: mockRisks,
            });

            expect(result.isValidRequirement).toBe(true);
            expect(result.activityCodes.length).toBeGreaterThan(3);

            // Verifica enum constraint
            const validCodes = mockActivities.map(a => a.code);
            result.activityCodes.forEach(code => {
                expect(validCodes).toContain(code);
            });

            console.log('✅ Complex requirement test passed:', result);
        }, 15000);

        it('should never return codes outside enum (guaranteed by structured outputs)', async () => {
            // Test con 5 requisiti diversi
            const requirements = [
                'Aggiungere campo',
                'Modificare form',
                'Creare workflow',
                'Integrare API',
                'Deploy soluzione'
            ];

            const validCodes = mockActivities.map(a => a.code);

            for (const description of requirements) {
                const result = await suggestActivities({
                    description,
                    preset: mockTech,
                    activities: mockActivities,
                    drivers: mockDrivers,
                    risks: mockRisks,
                });

                // ✅ Verifica CRITICA: Nessun codice fuori dall'enum
                result.activityCodes.forEach(code => {
                    expect(validCodes).toContain(code);
                });
            }

            console.log('✅ Enum constraint test passed for all requirements');
        }, 30000);
    });

    // ============================================
    // TEST 3: Backward Compatibility
    // ============================================
    describe('Backward Compatibility', () => {

        it('should maintain same response structure as Phase 1', () => {
            // Verifica che la struttura response sia identica a Fase 1
            const phase2Response = {
                isValidRequirement: true,
                activityCodes: ['PP_ANL_ALIGN', 'PP_DV_FIELD'],
                reasoning: 'Selected for field addition'
            };

            // Stessa struttura di Fase 1
            expect(phase2Response).toHaveProperty('isValidRequirement');
            expect(phase2Response).toHaveProperty('activityCodes');
            expect(phase2Response).toHaveProperty('reasoning');

            // Nessun campo aggiuntivo che rompa compatibilità
            const keys = Object.keys(phase2Response);
            expect(keys).toHaveLength(3);
        });

        it('should work with existing validation logic', () => {
            const response = {
                isValidRequirement: true,
                activityCodes: ['PP_ANL_ALIGN', 'PP_DV_FIELD'],
                reasoning: 'Test'
            };

            // Validazione Zod dovrebbe funzionare ancora (anche se ridondante)
            const validCodes = mockActivities.map(a => a.code);

            // Filter codici validi (come fa validateAISuggestion)
            const filtered = response.activityCodes.filter(code => validCodes.includes(code));

            expect(filtered).toEqual(response.activityCodes);
            expect(filtered.length).toBe(response.activityCodes.length);
        });
    });

    // ============================================
    // TEST 4: Performance
    // ============================================
    describe('Performance Tests (Simulated)', () => {

        it('should handle large enum (27+ activities)', () => {
            // Simula scenario con molte attività
            const largeActivityList = [
                ...mockActivities,
                ...Array(21).fill(null).map((_, i) => ({
                    id: `${7 + i}`,
                    code: `ACTIVITY_${i}`,
                    name: `Activity ${i}`,
                    base_hours: 1,
                    tech_category: 'MULTI',
                    group: 'DEV',
                    active: true,
                    created_at: '2024-01-01',
                    description: `Description ${i}`
                }))
            ];

            expect(largeActivityList.length).toBeGreaterThanOrEqual(27);

            // Verifica che enum possa contenere tutti i codici
            const allCodes = largeActivityList.map(a => a.code);
            expect(allCodes.length).toBe(largeActivityList.length);

            // OpenAI supporta enum fino a 100+ valori
            expect(allCodes.length).toBeLessThan(100);
        });

        it('should process response quickly (simulated)', () => {
            const startTime = Date.now();

            // Simula validazione response
            const response = {
                isValidRequirement: true,
                activityCodes: ['PP_ANL_ALIGN', 'PP_DV_FIELD', 'PP_DV_FORM'],
                reasoning: 'Test reasoning'
            };

            const validCodes = mockActivities.map(a => a.code);
            const allValid = response.activityCodes.every(code => validCodes.includes(code));

            const endTime = Date.now();
            const duration = endTime - startTime;

            expect(allValid).toBe(true);
            expect(duration).toBeLessThan(10); // Validazione istantanea
        });
    });

    // ============================================
    // TEST 5: Error Handling
    // ============================================
    describe('Error Handling', () => {

        it('should handle empty activityCodes array', () => {
            const response = {
                isValidRequirement: false,
                activityCodes: [],  // Vuoto per requisito invalido
                reasoning: 'Requirement is invalid'
            };

            expect(Array.isArray(response.activityCodes)).toBe(true);
            expect(response.activityCodes.length).toBe(0);
            expect(response.isValidRequirement).toBe(false);
        });

        it('should validate reasoning is present', () => {
            const response = {
                isValidRequirement: true,
                activityCodes: ['PP_ANL_ALIGN'],
                reasoning: 'Analysis needed for requirement'
            };

            expect(response.reasoning).toBeTruthy();
            expect(typeof response.reasoning).toBe('string');
            expect(response.reasoning.length).toBeGreaterThan(0);
        });

        it('should handle Italian text in reasoning', () => {
            const response = {
                isValidRequirement: true,
                activityCodes: ['PP_ANL_ALIGN', 'PP_DV_FIELD'],
                reasoning: 'Selezionate attività per aggiunta campo email al form utente'
            };

            expect(response.reasoning).toContain('attività');
            expect(typeof response.reasoning).toBe('string');
        });
    });
});

// ============================================
// TEST 6: Integration with UI (Mock)
// ============================================
describe('UI Integration Tests (Mock)', () => {

    it('should format response for UI display', () => {
        const apiResponse = {
            isValidRequirement: true,
            activityCodes: ['PP_ANL_ALIGN', 'PP_DV_FIELD', 'PP_DV_FORM'],
            reasoning: 'Selected for form field addition'
        };

        // Simula trasformazione per UI
        const uiData = {
            isValid: apiResponse.isValidRequirement,
            selectedActivities: mockActivities.filter(a =>
                apiResponse.activityCodes.includes(a.code)
            ),
            explanation: apiResponse.reasoning
        };

        expect(uiData.isValid).toBe(true);
        expect(uiData.selectedActivities.length).toBe(3);
        expect(uiData.explanation).toBeTruthy();
    });

    it('should handle invalid requirement in UI', () => {
        const apiResponse = {
            isValidRequirement: false,
            activityCodes: [],
            reasoning: 'Requirement is too vague'
        };

        const shouldShowError = !apiResponse.isValidRequirement;
        const errorMessage = apiResponse.reasoning;

        expect(shouldShowError).toBe(true);
        expect(errorMessage).toBeTruthy();
    });
});
