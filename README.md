# Rules Templating Engine (Powston)

This project provides a rules templating engine and editor for Powston user code. The goal is to let users version, compare, and safely publish rule scripts using a split-section format that compiles into a single Python file compatible with Powston’s bespoke runtime.

## MVP scope
- Version-controlled rules with Git-like DAG history (branches, diffs, rollback).
- Split code into four sections: User Params, AI Tunables, Helpers, Main.
- Merge sections into a final script ready for Powston upload.
- Validation hooks calling Powston’s user-code validation endpoints.
- Web UI with a Python editor, syntax highlighting, and diff views.

## Planned tech stack (TypeScript-first)
- Next.js app with TanStack Query/Router/Table for UI and data flows.
- Monaco editor for Python editing and highlighting.
- SQLite + Prisma for MVP persistence.

## Environment variables
- POWSTON_API_KEY: API key for Powston validation endpoints.
- POWSTON_API_BASE_URL: Default https://app.powston.com

A placeholder .env is provided in this folder.

## Documentation
- docs/ARCHITECTURE.md: system design and data model
- docs/ROADMAP.md: phased feature roadmap

## Status
Documentation created. Implementation to follow.
