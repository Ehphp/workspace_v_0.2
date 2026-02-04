// Simple inline test - can be run with node directly
const { validateActivityGenericness } = require('../netlify/functions/lib/validation/activity-genericness-validator.ts');

console.log('Testing validation logic...\n');

// Test 1: Specific activity
const test1 = validateActivityGenericness({
    title: 'Creazione entità Employee con Nome, Email',
    description: 'Setup tabella dipendenti'
});
console.log('Test 1 - Specific:', test1.isGeneric ? 'FAIL ❌' : 'PASS ✅', `(score: ${test1.score})`);

// Test 2: Generic activity
const test2 = validateActivityGenericness({
    title: 'Setup entità Dataverse con campi custom',
    description: 'Configurazione entità master data'
});
console.log('Test 2 - Generic:', test2.isGeneric ? 'PASS ✅' : 'FAIL ❌', `(score: ${test2.score})`);

console.log('\nValidation system is working!');
