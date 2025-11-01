---
model: sonnet-4.5
---

# FactCheckTube - Project Guide

This file provides guidance to Claude Code when working with this repository.

## Project Overview

**FactCheckTube** is a full-stack web application that analyzes YouTube videos to extract factual claims and verify their accuracy. The system provides an async pipeline that transcribes videos, extracts claims using LLMs, validates claims, and performs fact-checking with web searches.

## Type

**Fullstack** (React + Node.js)

## Standards Non-Negotiables

### Frontend
- **Styling**: Tailwind CSS ONLY - Inline styles are STRICTLY FORBIDDEN
- **Components**: Maximum 200 lines per component - Split if exceeded
- **State**: Local state (useState) + custom hooks - No global state library
- **Validation**: All components use Tailwind classes exclusively

### Backend
- **Architecture**: Strict layered architecture (Routes → Services → Database)
- **Validation**: express-validator required for ALL user inputs
- **Database**: Prisma Client ONLY - Raw SQL forbidden (except approved exceptions)
- **Error Handling**: Try/catch required for ALL async operations
- **Logging**: Contextual logging with service name and relevant IDs

### Universal
- **TypeScript**: Not currently used (pure JavaScript/JSX)
- **ES6+**: Modern JavaScript required (arrow functions, async/await, destructuring)
- **Async**: async/await ONLY - Promise chains (.then) forbidden
- **Git**: Conventional Commits format mandatory

## Documentation Reference

**Agents MUST consult these documents for complete context:**

- **Architecture**: `.claude/docs/architecture.md`
  - Layered architecture pattern (Routes → Services → Database)
  - Multi-stage processing pipeline (7 stages)
  - Frontend component structure
  - Database schema and relationships
  - Key design patterns and decisions

- **Tech Stack**: `.claude/docs/tech-stack.md`
  - Frontend: React 19, Vite 6, Tailwind CSS 4, react-youtube
  - Backend: Express 5, Prisma 6, PostgreSQL
  - External: AssemblyAI (transcription), OpenRouter (LLM), Serper/Tavily (search)
  - DevOps: Docker Compose, nodemon, ESLint
  - Environment configuration details

- **Standards**: `.claude/docs/standards.md`
  - JavaScript/ES6+ standards (mandatory rules)
  - React component standards (< 200 lines, Tailwind only)
  - Backend layered architecture enforcement
  - Git commit conventions (Conventional Commits)
  - Code review checklist

**Note**: If a document is missing or unclear, alert the user.

## Quick Start Commands

### Development Environment

**Start the entire stack:**
```bash
docker-compose up --build
```

**Apply database migrations:**
```bash
docker-compose exec backend npx prisma migrate dev --name <migration_name>
```

**View database in Prisma Studio:**
```bash
docker-compose exec backend npx prisma studio
```

### Environment Configuration

Three environment files required:

1. **Root**: `postgres_password.txt` - PostgreSQL password
2. **Backend**: `backend/.env` - API keys, database URL, LLM model selection
3. **Frontend**: `frontend/.env` - API endpoint URL (default: http://localhost:3001/api)

See `.claude/docs/tech-stack.md` for detailed environment variable documentation.

## Architecture Quick Reference

### Pipeline Flow

```
PENDING
  → FETCHING_METADATA (metadataService)
  → TRANSCRIBING (transcriptionService)
  → EXTRACTING_CLAIMS (claimExtractionService)
  → VALIDATING_CLAIMS (claimValidationService)
  → FACT_CHECKING (factCheckingService)
  → COMPLETE (or FAILED)
```

### Backend Structure

```
Routes (HTTP Layer)
  ↓
Services (Business Logic)
  ↓
Prisma Client (Data Access)
  ↓
PostgreSQL Database
```

**Key Services:**
- `videoService.js` - Main pipeline orchestrator
- `transcriptionService.js` - Audio extraction + AssemblyAI transcription
- `claimExtractionService.js` - LLM claim extraction (chunk-based)
- `claimValidationService.js` - Claim accuracy validation
- `factCheckingService.js` - Web search + fact-checking

**Utilities:**
- `chunkUtils.js` - Transcript chunking for LLM context limits
- `jsonUtils.js` - Extract JSON from LLM markdown responses

**Prompts:**
- All LLM prompts in `backend/src/prompts/*.txt`

### Frontend Structure

**Feature-based organization:**
```
frontend/src/
  ├── pages/           # HomePage.jsx (main entry)
  ├── components/
  │   ├── analysis/    # Analysis feature components
  │   └── common/      # Shared components (modals, spinners)
  ├── api/             # API layer (fetch wrappers)
  └── hooks/           # Custom React hooks
```

**State Management:**
- Component-local state (useState)
- Server state via polling (no caching layer)
- No global state library (Redux, Zustand)

### Database Schema

**Key Models:**
- `Video` - YouTube metadata (PK: videoId)
- `Analysis` - Analysis run with status tracking
- `Transcription` - Word-level timestamped transcript (JSON + text)
- `Claim` - Extracted claim with validation + fact-check verdict

**Relationships:**
```
Video (1) ←→ (N) Analysis
              ↓
         Transcription (1:1)
              ↓
         Claim (1:N)
```

## Critical Implementation Notes

### Timestamp Synchronization

**Two-phase approach:**
1. **LLM Estimation**: Transcript preprocessed with `[t=15]` markers, LLM estimates timestamp
2. **Backend Refinement**: Fuzzy search in narrow window for exact match (via `string-similarity`)

**Result**: Precise timestamps for video player navigation

### Validation vs Fact-Checking

- **Validation** (claimValidationService): Verifies claim accurately represents transcript (prevents hallucinations)
- **Fact-Checking** (factCheckingService): Verifies claim is factually true using web sources

**Both are separate, sequential pipeline stages.**

### Claim Extraction Chunking

**Problem**: Long videos exceed LLM context windows

**Solution**:
- Transcript split into overlapping chunks (chunkUtils.js)
- Each chunk processed independently
- Results merged with deduplication
- Enables progressive loading (claims saved incrementally)

### LLM Model Selection

**Critical**: Model quality directly impacts results

**Recommended**:
- `moonshotai/kimi-dev-72b:free` - Good balance of quality/cost
- Avoid models < 30B parameters (poor JSON formatting, inaccurate extraction)

**Configuration**: `OPENROUTER_MODEL` in `backend/.env`

**Testing**: Use `MOCK_PROVIDER` to simulate pipeline without API costs

### Rate Limiting Strategy

**Two tiers:**
- **Heavy operations** (POST /api/analyses): Strict limits (heavyApiLimiter)
- **Polling operations** (GET /api/analyses/:id): Generous limits (pollingLimiter)

**Reason**: Prevent abuse while allowing real-time status updates

## Workflow Recommendations

### For Simple Changes (< 30 min, < 3 files)

Use main chat directly - it has access to this CLAUDE.md and all referenced docs.

### For Complex Features

1. **Brainstorm**: Discuss strategy in main chat
2. **Analyze**: Use `feature-analyzer` (optional, for critical features)
3. **Plan**: Use `feature-planner` to generate implementation plan
4. **Implement**: Use `feature-implementer` for step-by-step implementation
5. **Review**: Use `senior-reviewer` for final verification

### Commits

**After each major phase**:
```bash
git add .
git commit -m "feat(scope): description"
```

**Format**: Conventional Commits (see `.claude/docs/standards.md`)

## Development Tips

- **Docker Logs**: Keep `docker-compose up` terminal open for real-time service logs
- **Hot Reload**: Both frontend (Vite) and backend (nodemon) auto-reload on changes
- **Database Inspection**: Use Prisma Studio for easy DB browsing
- **LLM Debugging**: Check `backend/results/` for debug logs and LLM artifacts
- **Testing Pipeline**: Use `MOCK_PROVIDER=true` to test without API costs

## Common Pitfalls

1. **Inline styles in React**: FORBIDDEN - Use Tailwind classes only
2. **Business logic in routes**: FORBIDDEN - Must be in services
3. **Raw SQL queries**: FORBIDDEN (except approved exceptions) - Use Prisma Client
4. **Promise chains (.then)**: FORBIDDEN - Use async/await
5. **Components > 200 lines**: FORBIDDEN - Split into sub-components
6. **Missing try/catch**: FORBIDDEN - All async functions must have error handling

## Quick Reference: File Locations

**Backend:**
- Routes: `backend/src/routes/`
- Services: `backend/src/services/`
- Utilities: `backend/src/utils/`
- Prompts: `backend/src/prompts/`
- Schema: `backend/prisma/schema.prisma`

**Frontend:**
- Pages: `frontend/src/pages/`
- Components: `frontend/src/components/analysis/` and `frontend/src/components/common/`
- API layer: `frontend/src/api/`
- Hooks: `frontend/src/hooks/`

**Configuration:**
- Docker: `docker-compose.yml`
- Vite: `frontend/vite.config.js`
- ESLint: `frontend/eslint.config.js`
- Tailwind: `frontend/tailwind.config.js`

## API Endpoints

All routes under `/api`:

- `POST /api/analyses` - Submit YouTube URL (rate-limited)
- `GET /api/analyses/:id` - Get analysis status and results (polling-friendly)
- `POST /api/analyses/:id/rerun-claim-extraction` - Re-extract claims with different model (rate-limited)

**Frontend polling**: GET /api/analyses/:id every 2 seconds during processing

## External Services

**Required API Keys:**
- `OPENROUTER_API_KEY` - LLM access (essential)
- `ASSEMBLYAI_API_KEY` - Transcription (optional with MOCK_PROVIDER)
- `SERPER_API_KEY` - Web search (optional)
- `TAVILY_API_KEY` - Alternative search (optional)
- `GOOGLE_FACT_CHECK_API_KEY` - Fact-check API (optional)

See `.claude/docs/tech-stack.md` for detailed API configuration.

## Testing Strategy (Not Yet Implemented)

**Recommended when implementing tests:**
- **Backend**: Vitest for services (unit) and routes (integration)
- **Frontend**: Vitest + React Testing Library for components
- **E2E**: Playwright for critical user flows

**Priority**: Start with service unit tests (highest ROI)

## Resources

- Project Documentation: `.claude/docs/`
- Prisma Schema: `backend/prisma/schema.prisma`
- LLM Prompts: `backend/src/prompts/`
- Debug Logs: `backend/results/`

---

**Remember**: This CLAUDE.md is the entry point. For detailed information, ALWAYS reference the documents in `.claude/docs/`.
