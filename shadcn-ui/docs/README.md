# Syntero Documentation

> **Last Updated**: 2026-03-22

## Overview

This documentation describes the Syntero requirements estimation system. All claims are verifiable against the codebase.

> **New here?** Start with [START_HERE.md](START_HERE.md) for onboarding, reading paths, and quick start.

## Documentation Map

### Core Reference

| Document | Description | Primary Audience |
|----------|-------------|------------------|
| [START_HERE.md](START_HERE.md) | Onboarding, reading paths, quick start | All (start here) |
| [architecture.md](architecture.md) | System architecture, 8-step wizard, estimation flows | Developers |
| [estimation-engine.md](estimation-engine.md) | Deterministic calculation model | Developers, Technical Leads |
| [ai-integration.md](ai-integration.md) | AI artifact pipeline, scope, limits | Developers |
| [data-model.md](data-model.md) | Database schema, domain model, relationships | Developers, DBAs |
| [technology-presets.md](technology-presets.md) | Preset system, configuration, maintenance | Developers, Admins |

### Subdirectory Indexes

| Path | Description |
|------|-------------|
| [ai/README.md](ai/README.md) | AI validation, variance testing, key policy |
| [api/ai-endpoints.md](api/ai-endpoints.md) | AI endpoint reference |
| [architecture/](architecture/) | Estimation flows, consistency, activity catalog, security |
| [components/](components/) | UI component guides (style, interactions)|
| [data/integrity-playbook.md](data/integrity-playbook.md) | Data integrity and troubleshooting |
| [deployment/deployment.md](deployment/deployment.md) | Production deployment |
| [diagrams/](diagrams/) | ERD, sequence diagrams |
| [setup/setup-guide.md](setup/setup-guide.md) | Local dev setup, Docker/Redis |
| [testing/testing-guide.md](testing/testing-guide.md) | Testing strategy and guides |

### Non-Reference

| Path | Description |
|------|-------------|
| [plans/](plans/) | Implementation plans (may be stale after completion) |
| [reports/](reports/) | Point-in-time audits and analysis reports |
| [archive/](archive/) | Historical documents — do not edit |

## Principles

1. **Accuracy**: Every statement must be traceable to code or configuration.
2. **Precision**: Distinguish between AI assistance (artifacts/suggestions) and deterministic logic (calculations).
3. **Maintainability**: Each document has a single purpose. Update one place, not many.
4. **No Marketing**: Technical documentation, not promotional material.

## Terminology

| Term | Definition |
|------|------------|
| **Activity** | Atomic work unit with a fixed `base_hours` value. |
| **Driver** | Multiplier factor with selectable options (e.g., Low=0.8x, Medium=1.0x, High=1.5x). |
| **Risk** | Binary flag with a weight contributing to contingency calculation. |
| **Preset** | Pre-configured set of default activities, driver values, and risks for a technology stack. |
| **Estimation** | Saved calculation result with selected activities, drivers, risks, and computed totals. |
| **Requirement Understanding** | AI-generated structured analysis of a requirement (scope, assumptions, constraints). |
| **Impact Map** | AI-generated architectural impact analysis (components, dependencies, complexity). |
| **Estimation Blueprint** | AI-generated technical blueprint with activity recommendations. |
| **Domain Model** | Traceability chain: Analysis → ImpactMap → CandidateSet → Decision → Snapshot. |

## What Syntero Does

1. **Collects** requirement descriptions from users (wizard or quick estimate).
2. **Generates** structured AI artifacts: Understanding → Impact Map → Blueprint.
3. **Proposes** relevant activities via AI interview planner.
4. **Calculates** estimates using a deterministic formula.
5. **Stores** estimation history with full traceability for audit and comparison.

## What Syntero Does NOT Do

- AI does not calculate estimates. The deterministic engine does.
- AI does not set final driver/risk values. The user confirms all selections.
- AI does not make final decisions. The user always reviews and confirms.
