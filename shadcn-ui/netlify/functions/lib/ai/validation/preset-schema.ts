/**
 * AJV Schema Validation for AI-Generated Presets
 *
 * Schema is derived from the canonical Zod schemas in src/shared/validation/
 * via zod-to-json-schema, eliminating the risk of drift between TS types
 * and runtime JSON Schema validation.
 */

import Ajv from 'ajv';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { PresetOutputSchema } from '../../../../../src/shared/validation/preset-output.schema';

// Re-export the Zod-inferred type for consumers
export type { PresetOutput } from '../../../../../src/shared/validation/preset-output.schema';

// Convert Zod → JSON Schema and compile an AJV validator
const jsonSchema = zodToJsonSchema(PresetOutputSchema, 'PresetOutput');
const ajv = new Ajv({ allErrors: true, verbose: true });
export const validatePreset = ajv.compile(
    // zodToJsonSchema wraps under $defs.PresetOutput — extract the definition
    (jsonSchema as any).$defs?.PresetOutput ?? jsonSchema
);

/**
 * Fallback preset for when AI generation fails
 * This is a minimal but valid preset structure
 */
export const FALLBACK_PRESET: PresetOutput = {
    name: 'Generic Software Project',
    description: 'Standard software development project with basic activities',
    detailedDescription: `This is a fallback preset generated when AI-powered estimation is unavailable or fails validation. 
It includes common software development activities covering requirements analysis, design, implementation, testing, 
deployment, and documentation. Time estimates are conservative and should be adjusted based on project specifics.

This preset serves as a starting point and should be customized according to:
- Actual technology stack and architecture
- Team size and experience level
- Business requirements and complexity
- Quality and compliance standards`,
    techCategory: 'MULTI',
    activities: [
        {
            title: 'Requirements Analysis and Documentation',
            description: 'Gather, analyze, and document functional and non-functional requirements',
            group: 'ANALYSIS',
            estimatedHours: 8,
            priority: 'core',
            confidence: 0.8,
            acceptanceCriteria: [
                'All requirements documented and approved',
                'User stories created with acceptance criteria',
                'Non-functional requirements defined'
            ]
        },
        {
            title: 'System Architecture Design',
            description: 'Design overall system architecture, components, and data flow',
            group: 'ANALYSIS',
            estimatedHours: 8,
            priority: 'core',
            confidence: 0.8,
            acceptanceCriteria: [
                'Architecture diagram created',
                'Technology stack selected',
                'Component interfaces defined'
            ]
        },
        {
            title: 'Database Schema Design and Setup',
            description: 'Design and implement database schema with tables, relationships, and indexes',
            group: 'DEV',
            estimatedHours: 6,
            priority: 'core',
            confidence: 0.8
        },
        {
            title: 'Core Business Logic Implementation',
            description: 'Implement main application logic and business rules',
            group: 'DEV',
            estimatedHours: 8,
            priority: 'core',
            confidence: 0.7
        },
        {
            title: 'API/Interface Development',
            description: 'Create APIs or user interfaces for system interaction',
            group: 'DEV',
            estimatedHours: 8,
            priority: 'core',
            confidence: 0.7
        },
        {
            title: 'Authentication and Authorization',
            description: 'Implement user authentication and role-based access control',
            group: 'DEV',
            estimatedHours: 7,
            priority: 'core',
            confidence: 0.75
        },
        {
            title: 'Unit Testing',
            description: 'Write and execute unit tests for core components',
            group: 'TEST',
            estimatedHours: 8,
            priority: 'recommended',
            confidence: 0.8
        },
        {
            title: 'Integration Testing',
            description: 'Test integration between system components',
            group: 'TEST',
            estimatedHours: 6,
            priority: 'recommended',
            confidence: 0.75
        },
        {
            title: 'CI/CD Pipeline Setup',
            description: 'Configure continuous integration and deployment automation',
            group: 'OPS',
            estimatedHours: 6,
            priority: 'recommended',
            confidence: 0.7
        },
        {
            title: 'Production Deployment',
            description: 'Deploy application to production environment',
            group: 'OPS',
            estimatedHours: 5,
            priority: 'core',
            confidence: 0.8
        },
        {
            title: 'Technical Documentation',
            description: 'Create technical documentation including API docs and deployment guides',
            group: 'GOVERNANCE',
            estimatedHours: 6,
            priority: 'recommended',
            confidence: 0.8
        }
    ],
    driverValues: {
        complexity: 5,
        quality: 6,
        team: 5,
        urgency: 5
    },
    riskCodes: ['TECH_NEW', 'SCOPE_CHANGE'],
    reasoning: 'Fallback preset with standard software development activities. This is a generic template that should be customized based on project specifics.',
    confidence: 0.5
};
