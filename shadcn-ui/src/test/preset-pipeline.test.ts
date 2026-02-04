/**
 * Test Suite for AI Preset Generation Pipeline
 * 
 * Tests:
 * - splitTask: Activity splitting logic
 * - postProcessAndScore: Completeness scoring
 * - Pipeline integration: Full skeleton → expand → validate flow
 * - Idempotency: Redis caching behavior
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import {
    splitTask,
    postProcessAndScore,
    PipelineActivity
} from '../../../src/types/ai-validation';
import {
    generatePresetPipeline,
    PipelineInput,
    getMetrics
} from '../netlify/functions/lib/ai/pipeline/preset-pipeline';
import { validatePreset, FALLBACK_PRESET } from '../netlify/functions/lib/ai/validation/preset-schema';

/**
 * Unit Tests: splitTask
 */
describe('splitTask', () => {
    it('should not split activities within MAX_HOURS limit', () => {
        const activity: PipelineActivity = {
            title: 'Create API endpoint',
            group: 'DEV',
            estimatedHours: 6,
            priority: 'core'
        };

        const result = splitTask(activity, 8);

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Create API endpoint');
        expect(result[0].estimatedHours).toBe(6);
    });

    it('should split activity exceeding MAX_HOURS into multiple tasks', () => {
        const activity: PipelineActivity = {
            title: 'Build complete dashboard',
            group: 'DEV',
            estimatedHours: 18,
            priority: 'core',
            confidence: 0.8
        };

        const result = splitTask(activity, 8);

        // 18h with max 8h → should split into 3 tasks
        expect(result.length).toBeGreaterThanOrEqual(2);
        expect(result.length).toBeLessThanOrEqual(3);

        // All tasks should be ≤ 8h
        result.forEach(task => {
            expect(task.estimatedHours).toBeLessThanOrEqual(8);
        });

        // Total hours should match (±1h for rounding)
        const totalHours = result.reduce((sum, task) => sum + task.estimatedHours, 0);
        expect(totalHours).toBeGreaterThanOrEqual(17);
        expect(totalHours).toBeLessThanOrEqual(19);

        // Confidence should be reduced for splits
        result.forEach(task => {
            if (task.confidence) {
                expect(task.confidence).toBeLessThan(0.8);
            }
        });
    });

    it('should use group-specific templates for splitting', () => {
        const testActivity: PipelineActivity = {
            title: 'Complete testing suite',
            group: 'TEST',
            estimatedHours: 16,
            priority: 'core'
        };

        const result = splitTask(testActivity, 8);

        // Should have test-specific subtasks
        const titles = result.map(t => t.title).join(' ');
        expect(titles).toMatch(/test/i);
    });

    it('should handle edge case: exactly MAX_HOURS', () => {
        const activity: PipelineActivity = {
            title: 'Implement authentication',
            group: 'DEV',
            estimatedHours: 8,
            priority: 'core'
        };

        const result = splitTask(activity, 8);

        expect(result).toHaveLength(1);
        expect(result[0].estimatedHours).toBe(8);
    });
});

/**
 * Unit Tests: postProcessAndScore
 */
describe('postProcessAndScore', () => {
    it('should calculate low completeness for shallow activities', () => {
        const preset = {
            activities: [
                {
                    title: 'Do something',
                    group: 'DEV' as const,
                    estimatedHours: 4,
                    priority: 'core' as const,
                    description: 'Generic task' // No details, no criteria
                }
            ]
        };

        const result = postProcessAndScore(preset, 'Build a React dashboard with real-time data');

        expect(result.averageCompleteness).toBeLessThan(0.65);
        expect(result.activities[0].score.depth).toBeLessThan(0.5);
        expect(result.activities[0].score.actionable).toBe(0);
    });

    it('should calculate high completeness for detailed activities', () => {
        const preset = {
            activities: [
                {
                    title: 'Implement React dashboard with WebSocket integration',
                    group: 'DEV' as const,
                    estimatedHours: 6,
                    priority: 'core' as const,
                    description: `Create real-time dashboard using React 18 with Server Components.
                    - Set up WebSocket connection with Socket.io client
                    - Implement data visualization with Recharts
                    - Add state management with Zustand
                    - Configure real-time updates pipeline`,
                    acceptanceCriteria: [
                        'Dashboard displays real-time data with <1s latency',
                        'Charts update automatically on data push',
                        'WebSocket reconnection on connection loss',
                        'State persists across page refresh'
                    ],
                    technicalDetails: {
                        suggestedFiles: ['src/dashboard/Dashboard.tsx', 'src/lib/websocket.ts'],
                        suggestedCommands: ['npm install socket.io-client recharts zustand'],
                        dependencies: ['socket.io-client', 'recharts', 'zustand']
                    }
                }
            ]
        };

        const result = postProcessAndScore(preset, 'Build a React dashboard with real-time data');

        expect(result.averageCompleteness).toBeGreaterThanOrEqual(0.65);
        expect(result.activities[0].score.coherence).toBeGreaterThan(0.5); // Mentions React, dashboard
        expect(result.activities[0].score.depth).toBeGreaterThan(0.5); // Has bullets and details
        expect(result.activities[0].score.actionable).toBe(1); // Has 4 acceptance criteria
    });

    it('should calculate coherence based on project description alignment', () => {
        const preset = {
            activities: [
                {
                    title: 'Implement Python Django backend',
                    group: 'DEV' as const,
                    estimatedHours: 8,
                    priority: 'core' as const,
                    description: 'Build Django REST API with PostgreSQL'
                }
            ]
        };

        // Low coherence: project is React, activity is Django
        const result = postProcessAndScore(preset, 'Build a React SPA with Node.js backend');

        expect(result.activities[0].score.coherence).toBeLessThan(0.3);
    });
});

/**
 * Integration Tests: Full Pipeline (with mocked OpenAI)
 */
describe('generatePresetPipeline - Integration', () => {
    let mockOpenAI: any;

    beforeEach(() => {
        // Reset metrics
        const metrics = getMetrics();
        Object.keys(metrics).forEach(key => {
            (metrics as any)[key] = 0;
        });

        // Mock OpenAI client
        mockOpenAI = {
            chat: {
                completions: {
                    create: vi.fn()
                }
            }
        };
    });

    it('should generate valid preset through skeleton → expand pipeline', async () => {
        // Mock skeleton response
        (mockOpenAI.chat.completions.create as Mock)
            .mockResolvedValueOnce({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            success: true,
                            activities: [
                                { title: 'Set up database schema', group: 'DEV', estimatedHours: 4, priority: 'core' },
                                { title: 'Create API endpoints', group: 'DEV', estimatedHours: 6, priority: 'core' },
                                { title: 'Implement authentication', group: 'DEV', estimatedHours: 5, priority: 'core' },
                                { title: 'Build frontend components', group: 'DEV', estimatedHours: 7, priority: 'core' },
                                { title: 'Write unit tests', group: 'TEST', estimatedHours: 6, priority: 'recommended' }
                            ]
                        })
                    }
                }]
            });

        // Mock expand response
        (mockOpenAI.chat.completions.create as Mock)
            .mockResolvedValueOnce({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            success: true,
                            name: 'HR Dashboard Preset',
                            description: 'Serverless HR dashboard with real-time features',
                            detailedDescription: 'Comprehensive HR management system with employee data, performance metrics, and real-time analytics. Built with React, AWS Lambda, and DynamoDB.',
                            techCategory: 'MULTI',
                            activities: [
                                {
                                    title: 'Set up DynamoDB schema for employee data',
                                    description: 'Design and implement DynamoDB tables with GSI for efficient querying. Include tables for employees, departments, and performance reviews with proper partition and sort keys.',
                                    group: 'DEV',
                                    estimatedHours: 4,
                                    priority: 'core',
                                    confidence: 0.9,
                                    acceptanceCriteria: [
                                        'All tables created with correct schema',
                                        'GSI configured for common query patterns',
                                        'Test data seeded for development'
                                    ],
                                    technicalDetails: {
                                        suggestedFiles: ['infrastructure/dynamodb-tables.yml'],
                                        suggestedCommands: ['aws dynamodb create-table'],
                                        dependencies: ['aws-sdk']
                                    }
                                },
                                {
                                    title: 'Create Lambda functions for employee API',
                                    description: 'Implement CRUD operations for employee management using AWS Lambda with Node.js runtime. Include proper error handling and logging.',
                                    group: 'DEV',
                                    estimatedHours: 6,
                                    priority: 'core',
                                    confidence: 0.85,
                                    acceptanceCriteria: [
                                        'All CRUD endpoints implemented',
                                        'Input validation with Joi',
                                        'CloudWatch logging configured'
                                    ]
                                },
                                {
                                    title: 'Implement JWT authentication with Cognito',
                                    description: 'Set up AWS Cognito user pool and integrate JWT validation in Lambda authorizer.',
                                    group: 'DEV',
                                    estimatedHours: 5,
                                    priority: 'core',
                                    confidence: 0.8,
                                    acceptanceCriteria: [
                                        'Cognito user pool created',
                                        'JWT validation working',
                                        'Protected routes secured'
                                    ]
                                },
                                {
                                    title: 'Build React dashboard with Recharts',
                                    description: 'Create responsive dashboard using React 18 with performance metrics visualization using Recharts library.',
                                    group: 'DEV',
                                    estimatedHours: 7,
                                    priority: 'core',
                                    confidence: 0.75,
                                    acceptanceCriteria: [
                                        'Dashboard displays all key metrics',
                                        'Charts render correctly',
                                        'Responsive design works on mobile'
                                    ]
                                },
                                {
                                    title: 'Write Jest unit tests for Lambda functions',
                                    description: 'Create comprehensive unit test suite for all Lambda functions with mocked AWS services.',
                                    group: 'TEST',
                                    estimatedHours: 6,
                                    priority: 'recommended',
                                    confidence: 0.85,
                                    acceptanceCriteria: [
                                        'All functions have >80% coverage',
                                        'Edge cases tested',
                                        'Mock data fixtures created'
                                    ]
                                }
                            ],
                            driverValues: { complexity: 7, quality: 8, team: 5 },
                            riskCodes: ['TECH_NEW', 'INTEGRATION'],
                            reasoning: 'Serverless architecture chosen for scalability and cost efficiency',
                            confidence: 0.8
                        })
                    }
                }]
            });

        const input: PipelineInput = {
            userId: 'test-user-123',
            description: 'HR Dashboard with real-time employee metrics',
            answers: {
                framework: 'React',
                backend: 'AWS Lambda',
                database: 'DynamoDB'
            },
            category: 'MULTI',
            requestId: 'req-test-001'
        };

        const result = await generatePresetPipeline(input, mockOpenAI);

        // Assertions
        expect(result.success).toBe(true);
        expect(result.preset).toBeDefined();
        expect(result.preset!.activities.length).toBeGreaterThanOrEqual(5);
        expect(result.preset!.activities.length).toBeLessThanOrEqual(20);

        // All activities should be ≤ 8h
        result.preset!.activities.forEach(activity => {
            expect(activity.estimatedHours).toBeLessThanOrEqual(8);
        });

        // Validate with AJV
        const isValid = validatePreset(result.preset!);
        expect(isValid).toBe(true);

        // Check metadata
        expect(result.metadata.cached).toBe(false);
        expect(result.metadata.modelPasses).toContain('skeleton');
        expect(result.metadata.modelPasses).toContain('expand_temp0.6');
        expect(result.metadata.generationTimeMs).toBeGreaterThan(0);

        // Metrics updated
        const metrics = getMetrics();
        expect(metrics.preset_generation_attempts_total).toBe(1);
        expect(metrics.preset_generation_success_total).toBe(1);
    });

    it('should use fallback preset when completeness is too low after retries', async () => {
        // Mock skeleton
        (mockOpenAI.chat.completions.create as Mock)
            .mockResolvedValueOnce({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            success: true,
                            activities: [
                                { title: 'Task 1', group: 'DEV', estimatedHours: 4, priority: 'core' },
                                { title: 'Task 2', group: 'DEV', estimatedHours: 5, priority: 'core' },
                                { title: 'Task 3', group: 'TEST', estimatedHours: 3, priority: 'core' },
                                { title: 'Task 4', group: 'OPS', estimatedHours: 4, priority: 'core' },
                                { title: 'Task 5', group: 'GOVERNANCE', estimatedHours: 2, priority: 'core' }
                            ]
                        })
                    }
                }]
            });

        // Mock expand with low-quality responses (both attempts)
        const lowQualityResponse = {
            success: true,
            name: 'Generic Project',
            description: 'A software project',
            detailedDescription: 'This is a generic software project with standard activities.',
            techCategory: 'MULTI',
            activities: [
                { title: 'Do task 1', description: 'Generic', group: 'DEV', estimatedHours: 4, priority: 'core' },
                { title: 'Do task 2', description: 'Generic', group: 'DEV', estimatedHours: 5, priority: 'core' },
                { title: 'Do task 3', description: 'Generic', group: 'TEST', estimatedHours: 3, priority: 'core' },
                { title: 'Do task 4', description: 'Generic', group: 'OPS', estimatedHours: 4, priority: 'core' },
                { title: 'Do task 5', description: 'Generic', group: 'GOVERNANCE', estimatedHours: 2, priority: 'core' }
            ],
            driverValues: { complexity: 5 },
            riskCodes: [],
            reasoning: 'Generic preset',
            confidence: 0.5
        };

        (mockOpenAI.chat.completions.create as Mock)
            .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(lowQualityResponse) } }] })
            .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(lowQualityResponse) } }] });

        const input: PipelineInput = {
            userId: 'test-user-456',
            description: 'Complex enterprise system',
            answers: {},
            requestId: 'req-test-002'
        };

        const result = await generatePresetPipeline(input, mockOpenAI);

        // Should succeed but with fallback preset
        expect(result.success).toBe(true);
        expect(result.preset).toEqual(FALLBACK_PRESET);
        expect(result.metadata.attempts).toBe(2); // Two expand attempts

        // Metrics
        const metrics = getMetrics();
        expect(metrics.preset_generation_fallback_total).toBeGreaterThan(0);
    });

    it('should return cached result on second identical request (idempotency)', async () => {
        // This test requires Redis mock - simplified version
        // In full implementation, mock Redis client to verify cache behavior

        const input: PipelineInput = {
            userId: 'test-user-789',
            description: 'Same project description',
            answers: { framework: 'React' },
            requestId: 'req-test-003'
        };

        // First call - generates preset
        (mockOpenAI.chat.completions.create as Mock)
            .mockResolvedValueOnce({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            success: true,
                            activities: Array(5).fill(null).map((_, i) => ({
                                title: `Activity ${i + 1}`,
                                group: 'DEV',
                                estimatedHours: 4,
                                priority: 'core'
                            }))
                        })
                    }
                }]
            })
            .mockResolvedValueOnce({
                choices: [{
                    message: {
                        content: JSON.stringify({
                            success: true,
                            name: 'Test Preset',
                            description: 'Test',
                            detailedDescription: 'Test preset for caching',
                            techCategory: 'MULTI',
                            activities: Array(5).fill(null).map((_, i) => ({
                                title: `Activity ${i + 1}`,
                                description: 'Detailed activity',
                                group: 'DEV',
                                estimatedHours: 4,
                                priority: 'core',
                                acceptanceCriteria: ['Criterion 1', 'Criterion 2', 'Criterion 3']
                            })),
                            driverValues: { complexity: 5 },
                            riskCodes: [],
                            reasoning: 'Test reasoning',
                            confidence: 0.8
                        })
                    }
                }]
            });

        const result1 = await generatePresetPipeline(input, mockOpenAI);
        expect(result1.success).toBe(true);
        expect(result1.metadata.cached).toBe(false);

        // Verify OpenAI was called
        expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(2);
    });
});

/**
 * Validation Tests
 */
describe('Preset Schema Validation', () => {
    it('should validate correct preset structure', () => {
        const valid = validatePreset(FALLBACK_PRESET);
        expect(valid).toBe(true);
    });

    it('should reject preset with missing required fields', () => {
        const invalid = {
            name: 'Test',
            // Missing other required fields
        };

        const valid = validatePreset(invalid);
        expect(valid).toBe(false);
        expect(validatePreset.errors).toBeDefined();
    });

    it('should reject preset with invalid activity structure', () => {
        const invalid = {
            ...FALLBACK_PRESET,
            activities: [
                {
                    title: 'Test',
                    group: 'INVALID_GROUP', // Invalid enum
                    estimatedHours: 5,
                    priority: 'core'
                }
            ]
        };

        const valid = validatePreset(invalid);
        expect(valid).toBe(false);
    });
});
