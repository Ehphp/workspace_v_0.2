# Syntero Documentation

## Overview

This documentation describes the Syntero requirements estimation system. All claims are verifiable against the codebase.

## Documentation Map

| Document | Description | Primary Audience |
|----------|-------------|------------------|
| [../README.md](../README.md) | Quick start, installation, project overview | All |
| [architecture.md](architecture.md) | System architecture, component responsibilities | Developers |
| [estimation-engine.md](estimation-engine.md) | Deterministic calculation model | Developers, Technical Leads |
| [ai-integration.md](ai-integration.md) | AI assistance: scope, limits, implementation | Developers |
| [data-model.md](data-model.md) | Database schema, entities, relationships | Developers, DBAs |
| [technology-presets.md](technology-presets.md) | Preset system, configuration, maintenance | Developers, Admins |
| [setup/setup-guide.md](setup/setup-guide.md) | Installation and configuration | Developers |
| [deployment/deployment.md](deployment/deployment.md) | Production deployment | DevOps |

## Archived Documentation

Historical and implementation-specific documents are in [archive/](archive/).

---

## Principles

1. **Accuracy**: Every statement must be traceable to code or configuration.
2. **Precision**: Distinguish between AI assistance (suggestions) and deterministic logic (calculations).
3. **Maintainability**: Each document has a single purpose. Update one place, not many.
4. **No Marketing**: Technical documentation, not promotional material.

---

## Terminology

| Term | Definition |
|------|------------|
| **Activity** | Atomic work unit with a fixed `base_hours` value. |
| **Driver** | Multiplier factor with selectable options (e.g., Low=0.8x, Medium=1.0x, High=1.5x). |
| **Risk** | Binary flag with a weight contributing to contingency calculation. |
| **Preset** | Pre-configured set of default activities, driver values, and risks for a technology stack. |
| **Estimation** | Saved calculation result with selected activities, drivers, risks, and computed totals. |
| **AI Suggestion** | Activity codes proposed by GPT based on requirement description. User reviews and accepts/modifies. |

---

## What Syntero Does

1. **Collects** requirement descriptions from users.
2. **Proposes** relevant activities via AI (GPT-4o-mini).
3. **Calculates** estimates using a deterministic formula.
4. **Stores** estimation history for audit and comparison.

## What Syntero Does NOT Do

- AI does not calculate estimates. The engine does.
- AI does not set final driver/risk values. The user confirms all selections.
- AI does not make final decisions. The user always reviews and confirms.

---

## Quick Links

- **AI System**: [ai/README.md](ai/README.md) — Full AI documentation index
- **Testing**: [testing/testing-guide.md](testing/testing-guide.md)
- **Architecture Decisions**: [architecture/](architecture/)

---

**Last Updated**: 2026-01-31  
**Maintainer**: Development Team
