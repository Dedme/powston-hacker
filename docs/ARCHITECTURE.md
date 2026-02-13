# Architecture (Draft)

## Overview
The system is a Next.js (TypeScript-first) web app that manages Powston rule templates, versions, and publishing workflows. A rule is stored as a split template with four sections and compiled into a single Python script for Powston.

## Core concepts
- Rule: A named script template and root node for its history.
- Branch: A named pointer to a version node (like git branches).
- VersionNode: A commit-like node with parent(s), metadata, and a snapshot reference.
- Snapshot: The full template payload (split sections and metadata).
- Diff: Optional computed metadata for comparing versions (stored or computed on demand).

## Template format (split sections)
A rule template is divided into four sections:
1. User Params: tunable targets, windows, preferences.
2. AI Tunables: 0–100 factors for tuning.
3. Helpers: shared functions and utilities.
4. Main: executable logic block.

The compiler merges these sections into one Python file in a deterministic order.

## API surface (Next.js API routes)
- Rules: create, list, update, delete.
- Versions: create commit, list history, diff/compare, branch/merge.
- Compiler: split, merge, validate.
- Powston validation: check_code, test_code, sim_code.

## Powston integration
Server-side validation calls use POWSTON_API_KEY and POWSTON_API_BASE_URL. Endpoints to support:
- POST /api/check_code
- POST /api/test_code/{inverter_id}
- POST /api/sim_code

## UI
- Rule list + version graph
- Split-section editor (Monaco)
- Diff view between any two versions
- User Params panel generated from section metadata/macros
- Validate and Publish workflow

## Security
MVP is local-only without auth. Later phases will add user auth, role-based access, and auditing.
