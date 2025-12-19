/**
 * Quick test script for activity validation
 * Run with: npx tsx scripts/test-validation.ts
 */

import { validateActivityGenericness } from '../netlify/functions/lib/validation/activity-genericness-validator';

const testCases = [
    {
        name: '❌ Specific: Employee entity',
        activity: {
            title: 'Creazione entità Employee con campi Nome, Email',
            description: 'Setup tabella dipendenti'
        },
        expectedPass: false
    },
    {
        name: '✅ Generic: Custom entity',
        activity: {
            title: 'Setup entità Dataverse con campi custom',
            description: 'Configurazione entità master data con validation'
        },
        expectedPass: true
    },
    {
        name: '❌ Specific: Login feature',
        activity: {
            title: 'Implementazione login con JWT',
            description: 'Endpoint /auth/login con validazione credenziali'
        },
        expectedPass: false
    },
    {
        name: '✅ Generic: Auth endpoint',
        activity: {
            title: 'Endpoint REST con autenticazione token-based',
            description: 'Implementazione API con middleware autenticazione'
        },
        expectedPass: true
    }
];

console.log('🧪 Activity Validation Quick Test\n');

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
    const result = validateActivityGenericness(test.activity);
    const actualPass = result.isGeneric;
    const testPassed = actualPass === test.expectedPass;

    console.log(`Test ${index + 1}: ${test.name}`);
    console.log(`  Title: "${test.activity.title}"`);
    console.log(`  Score: ${result.score}`);
    console.log(`  Is Generic: ${actualPass} (expected: ${test.expectedPass})`);
    console.log(`  Test Result: ${testPassed ? '✅ PASS' : '❌ FAIL'}`);

    if (!testPassed || !actualPass) {
        console.log(`  Issues: ${result.issues.join(', ')}`);
    }
    console.log('');

    if (testPassed) passed++;
    else failed++;
});

console.log(`\n📊 Summary: ${passed}/${testCases.length} tests passed`);
if (failed === 0) {
    console.log('✅ All tests passed!');
} else {
    console.log(`❌ ${failed} tests failed`);
    process.exit(1);
}
