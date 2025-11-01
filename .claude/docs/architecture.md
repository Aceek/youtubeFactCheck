# Architecture Documentation

## Overview

FactCheckTube follows a **layered architecture** pattern for both backend and frontend, with clear separation of concerns between presentation, business logic, and data access layers.

## Backend Architecture

### Layered Architecture Pattern

The backend follows a classic **3-tier layered architecture**:

```
Routes (HTTP Layer)
    ↓
Controllers (Request Handling)
    ↓
Services (Business Logic)
    ↓
Repositories (Data Access via Prisma)
    ↓
Database (PostgreSQL)
```

### Directory Structure

```
backend/
├── src/
│   ├── routes/           # API route definitions
│   ├── controllers/      # Request/response handling
│   ├── services/         # Core business logic
│   │   ├── videoService.js              # Main pipeline orchestrator
│   │   ├── metadataService.js           # YouTube metadata fetching
│   │   ├── transcriptionService.js      # Audio extraction + transcription
│   │   ├── claimExtractionService.js    # LLM claim extraction
│   │   ├── claimValidationService.js    # Claim validation
│   │   ├── factCheckingService.js       # Fact-checking orchestration
│   │   ├── webSearchService.js          # Web search API integration
│   │   ├── googleFactCheckService.js    # Google Fact Check Tools API
│   │   ├── reportService.js             # Report generation
│   │   └── debugLogService.js           # Debug logging
│   ├── utils/            # Utility functions
│   │   ├── chunkUtils.js     # Transcript chunking for LLM
│   │   └── jsonUtils.js      # JSON extraction from LLM responses
│   ├── prompts/          # LLM prompt templates (.txt files)
│   └── middleware/       # Express middleware (rate limiting, error handling)
├── prisma/
│   └── schema.prisma     # Database schema definition
└── index.js              # Application entry point
```

### Architectural Principles

#### 1. Separation of Concerns

**Routes** (`src/routes/`):
- Define HTTP endpoints only
- Handle request validation (express-validator)
- Delegate to controllers
- Apply middleware (rate limiting)

**Controllers**:
- Extract data from requests
- Call appropriate services
- Format responses
- Handle HTTP-specific logic (status codes, headers)

**Services** (`src/services/`):
- Contain ALL business logic
- No HTTP knowledge (no req/res objects)
- Return pure data or throw errors
- Orchestrate complex workflows

**Data Access** (Prisma):
- Database queries exclusively through Prisma Client
- Models defined in `schema.prisma`
- Migrations managed via Prisma Migrate

#### 2. Dependency Flow

Dependencies flow **downward** only:
- Routes depend on Controllers
- Controllers depend on Services
- Services depend on Prisma Client
- No upward dependencies allowed

This ensures:
- Testability (can mock lower layers)
- Maintainability (changes don't ripple upward)
- Clear responsibility boundaries

### Multi-Stage Processing Pipeline

The core of the application is an **asynchronous pipeline** that processes videos through multiple stages:

```
1. PENDING
   ↓
2. FETCHING_METADATA (metadataService)
   ↓
3. TRANSCRIBING (transcriptionService)
   ↓
4. EXTRACTING_CLAIMS (claimExtractionService)
   ↓
5. VALIDATING_CLAIMS (claimValidationService)
   ↓
6. FACT_CHECKING (factCheckingService)
   ↓
7. COMPLETE (or FAILED)
```

**Key Implementation Details:**

**Pipeline Orchestration** (`videoService.js`):
- Main entry point: `analyzeVideo(youtubeUrl)`
- Coordinates all stages sequentially
- Updates `Analysis.status` in database after each stage
- Captures errors in `Analysis.errorMessage` for debugging
- Allows frontend polling to track progress

**Chunk-Based Processing** (`claimExtractionService.js`):
- Long transcripts split into overlapping chunks (via `chunkUtils.js`)
- Each chunk processed independently by LLM
- Results merged and deduplicated
- Enables progressive loading (claims saved incrementally)

**Timestamp Synchronization**:
1. **LLM Estimation**: Transcript preprocessed with time markers `[t=15]`
2. **Backend Refinement**: Fuzzy search in narrow window to find exact match (via `string-similarity`)
3. **Result**: Precise timestamp for jumping to claim in video player

**Error Handling Strategy**:
- Retry logic with exponential backoff for LLM calls
- Non-blocking errors captured in `Analysis.errorMessage`
- Critical failures set status to `FAILED`
- Partial results preserved even on failure

### External Service Integration

**AssemblyAI (Transcription)**:
- Audio extracted via `yt-dlp` subprocess
- Uploaded to AssemblyAI for transcription
- Word-level timestamps retrieved
- Fallback to MOCK_PROVIDER for testing without API costs

**OpenRouter (LLM Access)**:
- Unified interface to multiple LLM providers
- Model selection via `OPENROUTER_MODEL` env var
- Prompts stored as `.txt` files in `backend/src/prompts/`
- Critical: Use larger models (e.g., 72B+) for JSON formatting accuracy

**Web Search APIs**:
- Serper API (Google search results)
- Tavily API (AI-optimized search)
- Google Fact Check Tools API (existing fact-checks)

### Rate Limiting Strategy

Two-tier rate limiting:

**Heavy Operations** (`heavyApiLimiter`):
- POST /api/analyses (start new analysis)
- POST /api/analyses/:id/rerun-claim-extraction
- Stricter limits (e.g., 10 requests/hour)

**Polling Operations** (`pollingLimiter`):
- GET /api/analyses/:id
- Generous limits (e.g., 100 requests/minute)
- Designed for frontend polling

## Frontend Architecture

### Component-Based Architecture

React 19 with **feature-based organization**:

```
frontend/src/
├── pages/
│   └── HomePage.jsx           # Main entry point
├── components/
│   ├── analysis/              # Analysis feature components
│   │   ├── AnalysisForm.jsx            # URL submission
│   │   ├── AnalysisStatus.jsx          # Real-time status display
│   │   ├── AnalysisResult.jsx          # Main results container
│   │   ├── ClaimList.jsx               # Claim display
│   │   ├── ExpandedClaimList.jsx       # Modal: detailed claims
│   │   ├── ExpandedTranscript.jsx      # Modal: full transcript
│   │   ├── YouTubePlayer.jsx           # Embedded video player
│   │   ├── VideoInfo.jsx               # Video metadata
│   │   ├── UnifiedStatusIndicator.jsx  # Validation/fact-check status
│   │   ├── ValidationIcon.jsx          # Claim validation icon
│   │   ├── FactCheckIcon.jsx           # Fact-check verdict icon
│   │   └── FactCheckPlaceholderIcon.jsx
│   └── common/                # Shared components
│       ├── ExpandModal.jsx             # Reusable modal
│       └── LoadingSpinner.jsx          # Loading indicator
├── api/                       # API layer (fetch wrappers)
├── hooks/                     # Custom React hooks
└── App.jsx                    # Root component
```

### Frontend Principles

#### 1. Feature-Based Organization

Components grouped by feature (e.g., `analysis/`) rather than type (e.g., `modals/`, `icons/`).

**Benefits:**
- Related components co-located
- Easy to find all claim-related UI
- Clear feature boundaries

#### 2. Component Size Limits

**Strict Rule:** Components must be < 200 lines

**Enforcement:**
- Split large components into smaller sub-components
- Extract logic into custom hooks (`hooks/`)
- Keep components focused on rendering

#### 3. Separation of Concerns

**Presentation Components** (`components/`):
- Render UI only
- Receive data via props
- Minimal logic (formatting, conditional rendering)

**API Layer** (`api/`):
- All fetch calls isolated here
- Return promises with typed data
- Handle error responses

**Custom Hooks** (`hooks/`):
- Business logic (e.g., polling, state management)
- Reusable stateful logic
- Named with `use` prefix

### State Management Strategy

**No global state library** (no Redux, no Zustand) - local state sufficient for this application:

**Component State** (useState):
- Form inputs (URL submission)
- Modal visibility
- UI interactions (expanded claims, tooltips)

**Server State** (polling):
- Analysis status fetched via polling
- No caching layer (fresh data on each poll)
- Polling interval: 2 seconds during processing

**Prop Drilling**:
- Used sparingly (max 2 levels)
- For deeply nested state, consider component refactoring

### Data Flow

```
User Action (e.g., submit URL)
    ↓
Component Handler (e.g., handleSubmit)
    ↓
API Call (via api/ layer)
    ↓
Backend Endpoint
    ↓
Service Logic
    ↓
Database Update
    ↓
Polling (GET /api/analyses/:id)
    ↓
Component Re-render
```

**Progressive Loading**:
- Claims displayed as soon as extracted (chunk by chunk)
- Status updates in real-time
- No full-page refresh needed

## Database Schema

### Entity-Relationship Overview

```
Video (1) ←→ (N) Analysis
              ↓
         Transcription (1:1)
              ↓
         Claim (1:N)
```

### Key Models

**Video**:
- Primary key: `videoId` (YouTube ID)
- Stores metadata (title, channelName, duration, publishedAt)
- One video can have multiple analyses

**Analysis**:
- Tracks a single analysis run
- Status field for pipeline progress
- Foreign key to Video and Transcription
- `errorMessage` for debugging

**Transcription**:
- Stores structured transcript (JSON: word-level timestamps)
- Full text version for display
- Linked to single Analysis

**Claim**:
- Individual factual claim extracted from transcript
- Timestamp for video player navigation
- `validationStatus`: VALID, INACCURATE, OUT_OF_CONTEXT, HALLUCINATION, etc.
- `factCheckVerdict`: TRUE, FALSE, MISLEADING, UNVERIFIABLE
- `sources`: JSON array of web sources used for fact-checking

### Status Enum Values

**Analysis.status**:
- PENDING
- FETCHING_METADATA
- TRANSCRIBING
- EXTRACTING_CLAIMS
- VALIDATING_CLAIMS
- FACT_CHECKING
- COMPLETE
- FAILED
- PARTIALLY_COMPLETE (claims extracted but fact-checking incomplete)

**Claim.validationStatus**:
- VALID (claim accurately represents transcript)
- INACCURATE (claim misrepresents what was said)
- OUT_OF_CONTEXT (claim is technically true but missing context)
- HALLUCINATION (claim not found in transcript)
- UNVERIFIED (validation not yet performed)
- NOT_VERIFIABLE_CLAIM (not a factual claim)

**Claim.factCheckVerdict**:
- TRUE (claim supported by evidence)
- FALSE (claim contradicted by evidence)
- MISLEADING (partially true, missing context)
- UNVERIFIABLE (insufficient evidence)

## Key Design Patterns

### 1. Repository Pattern (via Prisma)

All database access through Prisma Client:
```javascript
// Good: Using Prisma Client
await prisma.claim.create({ data: { ... } });

// Bad: Direct SQL queries
await pool.query("INSERT INTO claims...");
```

### 2. Service Orchestration

`videoService.js` acts as orchestrator:
- Calls multiple services in sequence
- Manages transaction-like workflow (all or nothing)
- Updates progress in database

### 3. Async Pipeline with Progress Tracking

Each stage:
1. Updates `Analysis.status` to IN_PROGRESS variant
2. Performs work (may take minutes)
3. Updates `Analysis.status` to next stage or COMPLETE
4. Frontend polls to display progress

### 4. Error Boundaries

**Backend**:
- Try/catch in each service method
- Errors propagated upward with context
- Centralized error handler middleware

**Frontend**:
- API errors displayed in UI (not console only)
- Graceful degradation (show partial results if available)

## Deployment Architecture

### Docker Compose Stack

```
services:
  - frontend (Vite dev server)
  - backend (Node.js + Express)
  - postgres (PostgreSQL database)
```

**Key Features**:
- Volume mounts for hot-reload development
- Health checks for service dependencies
- Environment variables via .env files
- Exposed ports: 5173 (frontend), 3001 (backend), 5432 (postgres)

### Production Considerations

**Not yet implemented** (current setup is development-focused):
- Frontend build optimization (Vite build)
- Backend process management (PM2, clustering)
- Database connection pooling
- Nginx reverse proxy
- HTTPS/SSL
- Horizontal scaling (multiple backend instances)

## Testing Strategy

**Current Status**: No automated tests yet

**Recommended Approach**:
- **Unit Tests**: Services (pure business logic, easily testable)
- **Integration Tests**: API endpoints (request → response)
- **E2E Tests**: Critical user flows (submit URL → view results)

**Testing Tools**:
- Backend: Jest or Vitest
- Frontend: Vitest + React Testing Library
- E2E: Playwright or Cypress

## Critical Architectural Decisions

### Why Layered Architecture?

**Pros**:
- Simple mental model (routes → services → database)
- Easy to onboard new developers
- Clear boundaries

**Cons**:
- Can lead to "anemic" models (all logic in services)
- Not ideal for complex domain logic (would benefit from DDD/Hexagonal)

**Decision**: Layered is appropriate for this project's complexity level.

### Why No Frontend State Management Library?

**Reasoning**:
- Application state is mostly server-driven (polling)
- UI state is simple (forms, modals)
- Prop drilling is manageable at current scale

**When to reconsider**: If UI becomes more complex (e.g., multi-step wizards, offline support).

### Why Chunk-Based Claim Extraction?

**Problem**: LLM context windows limited, long videos exceed limits

**Solution**:
- Split transcript into overlapping chunks
- Process independently
- Merge results with deduplication

**Trade-offs**:
- More LLM calls (higher cost)
- Potential for duplicate claims (mitigated by deduplication)
- Enables progressive loading (UX benefit)

## Future Architecture Considerations

### Scaling Concerns

**Current bottlenecks**:
- LLM API calls (slowest part of pipeline)
- Single-threaded Node.js backend

**Potential solutions**:
- Queue system (Bull, BullMQ) for background processing
- Worker processes for LLM calls
- Caching layer (Redis) for frequently analyzed videos
- Rate limiting per user (not per server)

### Microservices Migration

**When to consider**:
- Team grows beyond 5-10 developers
- Services need independent scaling (e.g., transcription vs fact-checking)
- Different technology requirements (e.g., Python for ML tasks)

**Candidates for extraction**:
- Transcription service (I/O bound)
- Fact-checking service (CPU bound for LLM calls)
- Separate job queue service

## References

- Prisma Schema: `backend/prisma/schema.prisma`
- Service Implementations: `backend/src/services/`
- API Routes: `backend/src/routes/`
- Frontend Components: `frontend/src/components/`
