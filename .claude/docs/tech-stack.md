# Tech Stack Documentation

## Overview

FactCheckTube is built with modern JavaScript/TypeScript technologies, prioritizing developer experience, performance, and reliability.

## Frontend Stack

### Core Framework

**React**
- Version: 19.1.0
- Why: Industry-standard component library, excellent ecosystem
- Key features used:
  - Functional components
  - Hooks (useState, useEffect, custom hooks)
  - No class components

**React DOM**
- Version: 19.1.0
- Rendering engine for React in browser

### Build Tool

**Vite**
- Version: 6.3.5
- Why: Extremely fast HMR, modern ES modules, better DX than Webpack
- Configuration: `frontend/vite.config.js`
- Features used:
  - Hot Module Replacement (HMR)
  - Optimized production builds
  - Environment variable handling

**Vite Plugin: React**
- Version: 4.4.1
- Package: `@vitejs/plugin-react`
- Enables React Fast Refresh

### Styling

**Tailwind CSS**
- Version: 4.1.10
- Why: Utility-first CSS, rapid UI development, consistent design system
- Configuration: `frontend/tailwind.config.js`
- Key features:
  - Responsive design utilities
  - Dark mode support (if enabled)
  - Custom color palette
  - JIT (Just-In-Time) compilation

**Tailwind Vite Plugin**
- Version: 4.1.10
- Package: `@tailwindcss/vite`
- Deep Vite integration for optimal performance

**Styling Standards**:
- **STRICT**: Tailwind CSS classes ONLY
- **FORBIDDEN**: Inline styles, CSS-in-JS libraries
- **EXCEPTION**: None (no exceptions to Tailwind-only rule)

### Video Integration

**react-youtube**
- Version: 10.1.0
- Why: Lightweight React wrapper for YouTube IFrame API
- Features used:
  - Video embedding
  - Programmatic playback control
  - Timestamp seeking (for claim navigation)

### Code Quality Tools

**ESLint**
- Version: 9.25.0
- Configuration: `frontend/eslint.config.js`
- Plugins:
  - `eslint-plugin-react-hooks` (5.2.0) - Enforces React Hooks rules
  - `eslint-plugin-react-refresh` (0.4.19) - Validates Fast Refresh constraints
  - `@eslint/js` (9.25.0) - Core ESLint rules

**Globals**
- Version: 16.0.0
- Provides global variable definitions for linting

### Type Checking (Development)

**TypeScript Types** (dev dependencies only - not using TypeScript in runtime):
- `@types/react` (19.1.2)
- `@types/react-dom` (19.1.2)
- Why: IDE autocomplete and IntelliSense even in .jsx files

### Package Manager

**npm**
- Version: 11.4.2 (included in dependencies for consistency)
- Lock file: `frontend/package-lock.json`

## Backend Stack

### Runtime & Framework

**Node.js**
- Version: (specified in Dockerfile, typically LTS)
- Why: JavaScript everywhere, excellent async I/O performance

**Express.js**
- Version: 5.1.0
- Why: Minimal, flexible, widely adopted
- Features used:
  - RESTful routing
  - Middleware pipeline
  - JSON request/response handling

### Database & ORM

**PostgreSQL**
- Version: (specified in docker-compose.yml, typically 15+)
- Why: Robust relational database, excellent JSON support, ACID guarantees
- Used features:
  - JSONB columns (for transcript storage, claim sources)
  - Full-text search capabilities
  - Transactional integrity

**Prisma**
- Version: 6.9.0 (both `prisma` CLI and `@prisma/client`)
- Why: Type-safe database client, excellent migration system, great DX
- Features used:
  - Schema-first approach (`schema.prisma`)
  - Automatic migrations (`prisma migrate`)
  - Type-safe queries
  - Relationship management
  - Prisma Studio (database GUI)

**Prisma Components**:
- `prisma` - CLI tool for migrations, generate, studio
- `@prisma/client` - Runtime query client

### LLM Integration

**OpenAI SDK**
- Version: 5.5.0
- Package: `openai`
- Why: Used to interface with OpenRouter API (OpenAI-compatible)
- Note: Not using OpenAI directly, using OpenRouter as proxy

**OpenRouter**
- Not a package, accessed via HTTP API
- Why: Access to multiple LLM providers through single API
- Base URL: `https://openrouter.ai/api/v1`
- Model selection via env var: `OPENROUTER_MODEL`
- Recommended models:
  - `moonshotai/kimi-dev-72b:free` - Good balance of quality/cost
  - Avoid models < 30B parameters (poor JSON formatting)

### HTTP Client

**Axios**
- Version: 1.9.0
- Why: More features than native fetch, better error handling
- Used for:
  - External API calls (AssemblyAI, Serper, Tavily, Google Fact Check)
  - Request/response interceptors
  - Timeout handling

### Validation & Security

**express-validator**
- Version: 7.2.1
- Why: Declarative request validation, sanitization
- Used in routes for:
  - URL validation (YouTube URLs)
  - Request body validation
  - Query parameter validation

**express-rate-limit**
- Version: 7.5.0
- Why: Prevent abuse, protect external API quotas
- Two rate limiters:
  - `heavyApiLimiter` - Strict limits for analysis creation
  - `pollingLimiter` - Generous limits for status polling

**CORS**
- Version: 2.8.5
- Package: `cors`
- Why: Enable frontend-backend communication across ports
- Configuration: Allow frontend origin (http://localhost:5173)

### Environment Configuration

**dotenv**
- Version: 16.5.0
- Why: Load environment variables from .env file
- File: `backend/.env`
- Variables:
  - `DATABASE_URL` - Prisma connection string
  - `OPENROUTER_API_KEY` - LLM access
  - `ASSEMBLYAI_API_KEY` - Transcription service
  - `SERPER_API_KEY` - Web search
  - `TAVILY_API_KEY` - Alternative web search
  - `GOOGLE_FACT_CHECK_API_KEY` - Google Fact Check Tools
  - `OPENROUTER_MODEL` - LLM model selection

### Utility Libraries

**string-similarity**
- Version: 4.0.4
- Why: Fuzzy text matching for timestamp synchronization
- Algorithm: Dice coefficient
- Used in: Claim extraction (matching LLM estimate to exact transcript position)

**inquirer**
- Version: 8.2.4
- Why: Interactive CLI prompts (for setup scripts, debugging)
- Note: Used in development only

### Development Tools

**nodemon**
- Version: 3.1.10 (dev dependency)
- Why: Auto-restart server on file changes
- Configuration: `backend/package.json` (`nodemonConfig` key)
- Ignored paths: `results/*` (debug output directory)

## External Services

### Transcription

**AssemblyAI**
- API: https://api.assemblyai.com
- Why: Best-in-class word-level timestamps, speaker detection
- Features used:
  - Audio transcription
  - Word-level timing (critical for timestamp accuracy)
  - Automatic punctuation

**yt-dlp**
- Command-line tool (not npm package)
- Why: Extract audio from YouTube videos
- Installed in Docker container
- Usage: `yt-dlp -x --audio-format mp3 <youtube-url>`

### Web Search APIs

**Serper**
- API: https://serper.dev
- Why: Google search results via API, affordable
- Used for: General fact-checking queries

**Tavily**
- API: https://tavily.com
- Why: AI-optimized search, returns summarized snippets
- Used for: Alternative search provider

**Google Fact Check Tools API**
- API: https://toolbox.google.com/factcheck
- Why: Access existing fact-checks from ClaimReview markup
- Used for: Quick verification of well-known claims

## DevOps & Deployment

### Containerization

**Docker**
- Version: (specified in Dockerfile)
- Why: Consistent dev/prod environments, easy setup
- Dockerfiles:
  - `frontend/Dockerfile` - Multi-stage build (dev/prod)
  - `backend/Dockerfile` - Node.js runtime

**Docker Compose**
- Version: (specified in docker-compose.yml)
- File: `docker-compose.yml`
- Services:
  - `frontend` - Vite dev server (port 5173)
  - `backend` - Express server (port 3001)
  - `postgres` - Database (port 5432)
- Features:
  - Volume mounts for hot-reload
  - Health checks
  - Service dependencies (backend waits for postgres)

### Version Control

**Git**
- Conventional Commits enforced
- Branches:
  - `main` - Production-ready code
  - `feature/*` - Feature development
  - `fix/*` - Bug fixes

## Testing Stack (Recommended - Not Yet Implemented)

### Backend Testing

**Recommended: Vitest**
- Why: Fast, Vite-native, ESM support
- Test types:
  - Unit tests for services
  - Integration tests for routes

**Alternative: Jest**
- More mature, larger ecosystem

### Frontend Testing

**Recommended: Vitest + React Testing Library**
- Vitest: Fast unit tests
- React Testing Library: Component testing
- Test types:
  - Component rendering tests
  - User interaction tests
  - Hook tests

### E2E Testing

**Recommended: Playwright**
- Why: Modern, fast, supports multiple browsers
- Scenarios:
  - Submit YouTube URL → view analysis
  - Click claim → jump to timestamp
  - Polling updates in real-time

## Development Environment Requirements

### Prerequisites

**Required**:
- Docker & Docker Compose
- Git

**Optional (for non-Docker development)**:
- Node.js 18+ (LTS)
- PostgreSQL 15+
- yt-dlp (for audio extraction)

### API Keys Required

**Essential**:
- `OPENROUTER_API_KEY` - LLM access (get from https://openrouter.ai)

**Optional** (can use MOCK_PROVIDER):
- `ASSEMBLYAI_API_KEY` - Transcription (get from https://assemblyai.com)
- `SERPER_API_KEY` - Web search (get from https://serper.dev)
- `TAVILY_API_KEY` - Alternative search (get from https://tavily.com)
- `GOOGLE_FACT_CHECK_API_KEY` - Fact-check API (get from Google Cloud)

### Environment Files

**Root**: `postgres_password.txt`
```
your_postgres_password
```

**Backend**: `backend/.env`
```env
DATABASE_URL="postgresql://user:password@postgres:5432/factchecktube"
OPENROUTER_API_KEY="sk-or-..."
ASSEMBLYAI_API_KEY="..."
SERPER_API_KEY="..."
TAVILY_API_KEY="..."
GOOGLE_FACT_CHECK_API_KEY="..."
OPENROUTER_MODEL="moonshotai/kimi-dev-72b:free"
ENABLE_FACT_CHECKING="true"
```

**Frontend**: `frontend/.env`
```env
VITE_API_URL=http://localhost:3001/api
```

## Browser Compatibility

### Supported Browsers

**Modern browsers only** (ES2020+ support required):
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

**Not supported**:
- Internet Explorer
- Legacy browsers without ES modules support

## Performance Considerations

### Frontend

**Vite Optimizations**:
- Code splitting (lazy loading)
- Tree shaking
- Minification in production
- Asset optimization (images, fonts)

**React Optimizations**:
- Minimal re-renders (proper state structure)
- No unnecessary useEffect dependencies
- Debouncing for expensive operations (search, filtering)

### Backend

**Database**:
- Prisma query optimization (select only needed fields)
- Indexes on frequently queried columns (videoId, analysisId)
- Connection pooling (via Prisma)

**API Calls**:
- Retry with exponential backoff (for LLM calls)
- Timeout handling (prevent hanging requests)
- Rate limiting (protect external API quotas)

## Security Considerations

### Environment Variables

**NEVER commit**:
- `.env` files
- `postgres_password.txt`
- API keys

**Git protection**:
- `.gitignore` configured to exclude secrets
- `.env.example` provided as template

### Input Validation

**All user inputs validated**:
- YouTube URL format (regex validation)
- Request body structure (express-validator)
- SQL injection prevented (Prisma parameterized queries)

### Rate Limiting

**Protection against**:
- API abuse
- External API quota exhaustion
- DDoS attempts (basic protection)

## Monitoring & Debugging

### Backend Logging

**debugLogService.js**:
- Structured logging to `backend/results/` directory
- Log levels: INFO, WARN, ERROR
- Includes timestamps, request IDs
- LLM request/response artifacts saved for debugging

**Console Logging**:
- Service entry/exit points
- Error stack traces
- API response times

### Frontend Debugging

**React DevTools**:
- Component tree inspection
- Props/state debugging

**Network Tab**:
- API request/response inspection
- Polling behavior verification

## Future Tech Stack Considerations

### Potential Additions

**TypeScript** (in production code):
- When: Team grows, codebase becomes complex
- Benefits: Type safety, better IDE support, fewer runtime errors
- Migration: Gradual (rename .js → .ts incrementally)

**State Management** (Redux, Zustand, Jotai):
- When: UI state becomes complex (multi-step forms, offline support)
- Recommended: Zustand (simpler than Redux, more powerful than Context API)

**Background Job Queue** (Bull, BullMQ):
- When: Need to decouple API requests from processing
- Benefits: Better scalability, retry logic, job monitoring
- Requires: Redis

**Caching Layer** (Redis):
- When: Frequent re-analysis of same videos
- Cache: Transcripts, extracted claims, fact-check results
- TTL: Configurable (e.g., 24 hours)

**Testing Frameworks**:
- Priority: Implement soon (currently no automated tests)
- Start with: Service unit tests (highest ROI)

## References

- Frontend Dependencies: `frontend/package.json`
- Backend Dependencies: `backend/package.json`
- Docker Configuration: `docker-compose.yml`
- Prisma Schema: `backend/prisma/schema.prisma`
