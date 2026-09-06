# Changelog

All notable changes to Sai are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-07-04

### Added
- Three-tree canvas (DEV / FUNC / BIZ) with React Flow
- AI chat scoped to individual nodes with 5 personas (Investor, Devil's Advocate, Customer, Architect, Mentor)
- AI mutations: Expand, Refactor, Bridge Suggest, Idea Score, Propose Tree
- Multi-provider AI support: OpenAI, Anthropic, OpenRouter, DeepSeek, Ollama, custom OpenAI-compatible
- BYOK (Bring Your Own Key) with zero-knowledge AES-256-GCM encryption
- Markdown / PDF / TXT / JSON / Mermaid export with audience selector
- Minimal self-host Docker Compose (Postgres + pgvector only, no Redis required)
- Local user mode — no registration needed for personal use
- Command palette with 16 hotkeys (`mod+k`)
- Quick Capture: idea → 9-node skeleton (3 per tree)
- i18n: Russian and English
- Dark mode via next-themes
- Landing page with animated hero

### Changed
- Migrated from Python/PySide6 desktop (v0.0.1–v0.0.4) to Next.js 15 web application
- Stripped Redis, BullMQ, Hocuspocus, MinIO from 1.0 release (returning in 1.1)

### Known Issues
- Three-tree sync not yet implemented (planned for 1.1)
- Mind Map View not yet implemented (planned for 1.2)
- Authentication is local-only (OAuth/magic-link planned for 1.1)
- No CI/CD pipeline
- Minimal test coverage

## [0.0.5] — 2026-06-13

### Added
- Next.js 15 + React 19 + TypeScript web application
- Prisma ORM with PostgreSQL + pgvector schema
- tRPC API layer
- Auth.js v5 integration (stubbed for local user)
- Docker Compose with full infrastructure (Postgres, Redis, MinIO, workers, collab)
- Hocuspocus server for Yjs collaboration
- BullMQ workers (email, PDF, webhooks)
- Stripe billing integration
- Template system with 20 public templates
- Snapshot/recovery service
- AI Memory (RAG) database model

## [0.0.4] — 2026-06-08

### Added
- Frameless window with custom title bar
- Manhattan (orthogonal) edge routing
- Rubber band selection on canvas
- Canvas search (Ctrl+F)
- Auto-layout button
- SVG export placeholder
- Dark/light theme toggle
- Node statuses (IDEA / IN_PROGRESS / DONE / BLOCKED)

## [0.0.3] — 2026-06-01

### Added
- Infinite canvas with minimap
- Node cards with inline editing
- Edge creation via drag-connect
- Context menus for canvas, nodes, edges
- Cross-tree bridge visualization
- Export dialog (MD/PDF/TXT)
- Project explorer sidebar

## [0.0.2] — 2026-05-25

### Added
- Three-panel UI layout
- Node-based graph with QGraphicsScene
- Basic AI integration via LLM service
- JSON file-based project storage
- Prompt templates

## [0.0.1] — 2026-05-20

### Added
- Initial Python/PySide6 desktop prototype
- Infinite canvas with zoom/pan
- Node creation and basic editing
- Three-tree concept (DEV / FUNC / BIZ)
- First LLM chat integration

[1.0.0]: https://github.com/user/sai/releases/tag/v1.0.0
[0.0.5]: https://github.com/user/sai/releases/tag/v0.0.5
[0.0.4]: https://github.com/user/sai/releases/tag/v0.0.4
[0.0.3]: https://github.com/user/sai/releases/tag/v0.0.3
[0.0.2]: https://github.com/user/sai/releases/tag/v0.0.2
[0.0.1]: https://github.com/user/sai/releases/tag/v0.0.1
