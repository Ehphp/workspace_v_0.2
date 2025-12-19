/**
 * Activity Genericness Validator Tests
 * 
 * Tests to verify the validation logic works correctly
 */

import { validateActivityGenericness, validateActivities } from '../netlify/functions/lib/validation/activity-genericness-validator';

console.log('=== Activity Genericness Validator Tests ===\n');

// Test 1: Project-specific activity (should FAIL)
console.log('Test 1: Project-specific activity (should FAIL)');
const specificActivity = {
    title: 'Creazione entità Employee con campi Nome, Email, Matricola',
    description: 'Implementare la tabella dipendenti nel modulo HR con campi per anagrafica e reparto'
};
const result1 = validateActivityGenericness(specificActivity);
console.log('Result:', {
    isGeneric: result1.isGeneric,
    score: result1.score,
    issues: result1.issues,
    suggestions: result1.suggestions
});
console.log('Expected: isGeneric=false, score<70\n');

// Test 2: Generic activity (should PASS)
console.log('Test 2: Generic activity (should PASS)');
const genericActivity = {
    title: 'Setup entità Dataverse con campi custom e relazioni',
    description: 'Configurazione entità master data con campi standard, relazioni 1:N, security roles e business rules'
};
const result2 = validateActivityGenericness(genericActivity);
console.log('Result:', {
    isGeneric: result2.isGeneric,
    score: result2.score,
    issues: result2.issues,
    suggestions: result2.suggestions
});
console.log('Expected: isGeneric=true, score>=70\n');

// Test 3: Specific feature (should FAIL)
console.log('Test 3: Specific feature (should FAIL)');
const featureActivity = {
    title: 'Implementazione login con JWT',
    description: 'Creare endpoint /auth/login con validazione credenziali e generazione token JWT'
};
const result3 = validateActivityGenericness(featureActivity);
console.log('Result:', {
    isGeneric: result3.isGeneric,
    score: result3.score,
    issues: result3.issues
});
console.log('Expected: isGeneric=false, score<70\n');

// Test 4: Generic API pattern (should PASS)
console.log('Test 4: Generic API pattern (should PASS)');
const apiActivity = {
    title: 'Endpoint REST con autenticazione token-based',
    description: 'Implementazione endpoint API con middleware autenticazione, validation e error handling'
};
const result4 = validateActivityGenericness(apiActivity);
console.log('Result:', {
    isGeneric: result4.isGeneric,
    score: result4.score,
    issues: result4.issues
});
console.log('Expected: isGeneric=true, score>=70\n');

// Test 5: Batch validation
console.log('Test 5: Batch validation of multiple activities');
const activities = [
    { title: 'Setup entità custom', description: 'Configurazione entità' },
    { title: 'Creazione Employee entity', description: 'Setup dipendenti' },
    { title: 'Form con validation', description: 'Form generico con regole' },
    { title: 'Login page', description: 'Pagina di accesso' }
];
const batchResult = validateActivities(activities);
console.log('Batch Result:', {
    allGeneric: batchResult.allGeneric,
    averageScore: batchResult.averageScore.toFixed(1),
    summary: batchResult.summary
});
console.log('Expected: allGeneric=false (2 should fail), averageScore~65-75\n');

// Summary
console.log('=== Test Summary ===');
console.log('Test 1 (specific):', result1.isGeneric ? '❌ FAIL' : '✅ PASS');
console.log('Test 2 (generic):', result2.isGeneric ? '✅ PASS' : '❌ FAIL');
console.log('Test 3 (feature):', result3.isGeneric ? '❌ FAIL' : '✅ PASS');
console.log('Test 4 (API):', result4.isGeneric ? '✅ PASS' : '❌ FAIL');
console.log('Test 5 (batch):', !batchResult.allGeneric && batchResult.summary.failed === 2 ? '✅ PASS' : '❌ FAIL');
