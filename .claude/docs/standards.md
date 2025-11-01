# Coding Standards & Conventions

## Overview

FactCheckTube follows **strict coding standards** to ensure code quality, maintainability, and consistency across the codebase. These are not guidelines - they are **mandatory rules**.

## JavaScript Standards

### ES6+ Modern Syntax

**Required**:
- ES6+ features (arrow functions, destructuring, template literals, async/await)
- ESM modules (`import`/`export`, not `require`)
- `const` by default, `let` when reassignment needed
- **NEVER** use `var`

**Examples**:

```javascript
// Good: Modern ES6+
const fetchAnalysis = async (id) => {
  const { data } = await axios.get(`/api/analyses/${id}`);
  return data;
};

// Bad: Old-style JavaScript
var fetchAnalysis = function(id) {
  return axios.get('/api/analyses/' + id).then(function(response) {
    return response.data;
  });
};
```

### Variable Naming

**Conventions**:
- `camelCase` for variables, functions
- `PascalCase` for React components, classes
- `SCREAMING_SNAKE_CASE` for constants (env vars, config)
- Descriptive names (no `tmp`, `temp`, `data`, `result` without context)

```javascript
// Good
const analysisStatus = 'COMPLETE';
const RATE_LIMIT_MAX = 100;
const ClaimListItem = ({ claim }) => { ... };

// Bad
const x = 'COMPLETE';              // Too short
const rateLimitMax = 100;          // Should be uppercase constant
const claimListItem = ({ claim }) => { ... }; // Component should be PascalCase
```

### Function Declaration

**Prefer arrow functions** (except for React components - see React section):

```javascript
// Good: Arrow function
const processTranscript = (transcript) => {
  return transcript.split('\n');
};

// Bad: Function declaration (use arrow instead)
function processTranscript(transcript) {
  return transcript.split('\n');
}
```

**Exception**: React components can use either (see React standards below).

### Error Handling

**STRICT RULE**: All async functions MUST have error handling.

**Required**:
- `try/catch` for async operations
- Specific error messages (not generic "Error occurred")
- Propagate errors upward with context

```javascript
// Good: Proper error handling
const analyzeVideo = async (videoUrl) => {
  try {
    const metadata = await metadataService.fetchMetadata(videoUrl);
    return metadata;
  } catch (error) {
    console.error('Failed to fetch metadata for video:', videoUrl, error);
    throw new Error(`Metadata fetch failed: ${error.message}`);
  }
};

// Bad: Missing error handling
const analyzeVideo = async (videoUrl) => {
  const metadata = await metadataService.fetchMetadata(videoUrl); // No try/catch
  return metadata;
};

// Bad: Generic error message
catch (error) {
  throw new Error('Error'); // Too generic
}
```

### Async/Await vs Promises

**STRICT RULE**: Use async/await, NOT `.then()` chains.

```javascript
// Good: Async/await
const getAnalysisWithClaims = async (analysisId) => {
  const analysis = await prisma.analysis.findUnique({ where: { id: analysisId } });
  const claims = await prisma.claim.findMany({ where: { analysisId } });
  return { analysis, claims };
};

// Bad: Promise chains
const getAnalysisWithClaims = (analysisId) => {
  return prisma.analysis.findUnique({ where: { id: analysisId } })
    .then(analysis => {
      return prisma.claim.findMany({ where: { analysisId } })
        .then(claims => ({ analysis, claims }));
    });
};
```

### Console Logging

**Rules**:
- Use `console.error()` for errors
- Use `console.log()` for info/debug
- Include context (function name, relevant IDs)
- **Production**: Replace with proper logging library (winston, pino)

```javascript
// Good: Contextual logging
console.log('[videoService] Starting analysis for video:', videoId);
console.error('[claimExtractionService] LLM call failed:', error.message);

// Bad: No context
console.log(videoId);
console.error(error);
```

## React Standards

### Component Structure

**STRICT RULE**: Components must be < 200 lines.

**When exceeded**:
1. Extract sub-components
2. Move logic to custom hooks
3. Split into multiple files

### Component Declaration

**Both styles acceptable** (team preference):

```javascript
// Style 1: Function declaration (preferred for readability)
function ClaimList({ claims }) {
  return <div>{claims.map(c => <Claim key={c.id} claim={c} />)}</div>;
}

// Style 2: Arrow function + export
const ClaimList = ({ claims }) => {
  return <div>{claims.map(c => <Claim key={c.id} claim={c} />)}</div>;
};
export default ClaimList;
```

**Consistency**: Pick one style per file.

### Props Destructuring

**STRICT RULE**: Always destructure props in function signature.

```javascript
// Good: Destructured props
function VideoInfo({ title, channelName, publishedAt }) {
  return <div>{title} by {channelName}</div>;
}

// Bad: Props object
function VideoInfo(props) {
  return <div>{props.title} by {props.channelName}</div>;
}
```

### Component File Organization

**Standard structure** (top to bottom):

1. Imports (external libraries, then internal)
2. Component definition
3. Helper functions (if any)
4. Export

```javascript
// 1. Imports
import React, { useState, useEffect } from 'react';
import { fetchAnalysis } from '../api/analysisApi';

// 2. Component
function AnalysisStatus({ analysisId }) {
  const [status, setStatus] = useState('PENDING');

  useEffect(() => {
    pollStatus(analysisId, setStatus);
  }, [analysisId]);

  return <div>{status}</div>;
}

// 3. Helpers
function pollStatus(id, setStatus) {
  // Polling logic
}

// 4. Export
export default AnalysisStatus;
```

### Styling (Tailwind CSS)

**STRICT RULE**: Tailwind CSS classes ONLY. **ABSOLUTELY NO INLINE STYLES**.

```javascript
// Good: Tailwind classes
<div className="flex items-center justify-between p-4 bg-gray-100 rounded-lg">
  <span className="text-lg font-semibold">Title</span>
</div>

// Bad: Inline styles (FORBIDDEN)
<div style={{ display: 'flex', padding: '16px', backgroundColor: '#f3f4f6' }}>
  <span style={{ fontSize: '18px', fontWeight: 600 }}>Title</span>
</div>

// Bad: CSS-in-JS (FORBIDDEN)
const styles = { container: { display: 'flex' } };
<div style={styles.container}>...</div>
```

**Exception**: **NONE**. No exceptions to Tailwind-only rule.

### State Management

**Rules**:
- Use `useState` for component-local state
- Use custom hooks for reusable stateful logic
- **NO** global state libraries (Redux, Zustand) unless project complexity demands it
- Prop drilling acceptable for max 2 levels

```javascript
// Good: Local state
function AnalysisForm() {
  const [url, setUrl] = useState('');
  const handleSubmit = () => { ... };
  return <form onSubmit={handleSubmit}>...</form>;
}

// Good: Custom hook for reusable logic
function usePolling(url, interval) {
  const [data, setData] = useState(null);
  useEffect(() => {
    const timer = setInterval(() => fetch(url).then(setData), interval);
    return () => clearInterval(timer);
  }, [url, interval]);
  return data;
}
```

### Event Handlers

**Naming**: Prefix with `handle` (e.g., `handleClick`, `handleSubmit`)

```javascript
// Good
function AnalysisForm() {
  const handleSubmit = (e) => {
    e.preventDefault();
    // Submit logic
  };
  return <form onSubmit={handleSubmit}>...</form>;
}

// Bad: Generic names
function AnalysisForm() {
  const submit = (e) => { ... };       // Should be handleSubmit
  const onClick = () => { ... };       // Should be handleClick
}
```

### Keys in Lists

**STRICT RULE**: Use stable, unique keys. **NEVER** use array index.

```javascript
// Good: Unique ID
claims.map(claim => <Claim key={claim.id} claim={claim} />)

// Bad: Array index (FORBIDDEN)
claims.map((claim, index) => <Claim key={index} claim={claim} />)
```

### Conditional Rendering

**Preferred**: Ternary or `&&` operator (not if/else with return)

```javascript
// Good: Inline conditional
return (
  <div>
    {loading ? <Spinner /> : <Results data={data} />}
    {error && <ErrorMessage error={error} />}
  </div>
);

// Avoid: Multiple returns (less readable)
if (loading) return <Spinner />;
if (error) return <ErrorMessage error={error} />;
return <Results data={data} />;
```

## Backend Standards

### Layered Architecture Enforcement

**STRICT RULE**: Respect layer boundaries.

**Routes**:
- Define endpoints only
- Call controllers (or directly services for simple cases)
- Apply middleware (validation, rate limiting)
- **FORBIDDEN**: Business logic in routes

**Controllers** (if used):
- Extract data from `req`
- Call services
- Format responses
- **FORBIDDEN**: Database queries, external API calls

**Services**:
- All business logic here
- No HTTP knowledge (`req`, `res` objects forbidden)
- Return data or throw errors
- **ALLOWED**: Database access (via Prisma), external API calls

```javascript
// Good: Layered separation

// Route (routes/analysisRoutes.js)
router.post('/analyses', rateLimiter, validateYouTubeUrl, async (req, res) => {
  const { url } = req.body;
  const analysis = await videoService.analyzeVideo(url); // Delegate to service
  res.json(analysis);
});

// Service (services/videoService.js)
const analyzeVideo = async (youtubeUrl) => {
  const videoId = extractVideoId(youtubeUrl);
  const metadata = await metadataService.fetchMetadata(videoId);
  // ... business logic
  return analysis;
};

// Bad: Business logic in route
router.post('/analyses', async (req, res) => {
  const videoId = extractVideoId(req.body.url); // Should be in service
  const video = await prisma.video.create({ ... }); // Should be in service
  // ... more logic in route (WRONG)
});
```

### Input Validation

**STRICT RULE**: Validate ALL user inputs using `express-validator`.

**Location**: Routes (before controller/service call)

```javascript
// Good: Validation middleware
router.post('/analyses',
  body('url').isURL().withMessage('Invalid URL'),
  body('url').matches(/youtube\.com|youtu\.be/).withMessage('Must be YouTube URL'),
  validateRequest, // Middleware that checks validation results
  async (req, res) => {
    // Input guaranteed to be valid here
    const analysis = await videoService.analyzeVideo(req.body.url);
    res.json(analysis);
  }
);

// Bad: No validation
router.post('/analyses', async (req, res) => {
  const analysis = await videoService.analyzeVideo(req.body.url); // No validation
  res.json(analysis);
});
```

### Database Access

**STRICT RULE**: Use Prisma Client exclusively. **NO** raw SQL.

```javascript
// Good: Prisma Client
const claims = await prisma.claim.findMany({
  where: { analysisId },
  include: { analysis: true }
});

// Bad: Raw SQL (FORBIDDEN)
const claims = await prisma.$queryRaw`SELECT * FROM claims WHERE analysis_id = ${analysisId}`;
```

**Exception**: Complex queries that Prisma can't express (rare - ask before using).

### Service Method Structure

**Standard pattern**:

```javascript
const serviceName_methodName = async (params) => {
  try {
    // 1. Validate inputs (if needed)
    if (!param) throw new Error('Invalid input');

    // 2. Perform operations
    const result = await externalApi.call(param);

    // 3. Update database (if applicable)
    await prisma.model.update({ ... });

    // 4. Return data
    return result;

  } catch (error) {
    // 5. Handle errors
    console.error('[serviceName] methodName failed:', error);
    throw new Error(`Operation failed: ${error.message}`);
  }
};
```

### API Response Format

**Standard JSON response**:

```javascript
// Success (200)
{
  "id": "123",
  "status": "COMPLETE",
  "data": { ... }
}

// Error (4xx/5xx)
{
  "error": "Descriptive error message",
  "code": "INVALID_URL" // Optional error code
}
```

**Consistency**: Always return JSON, never plain text.

### Rate Limiting

**STRICT RULE**: Apply rate limiting to ALL public endpoints.

**Two tiers**:
- **Heavy operations** (analysis creation): Strict limits
- **Polling operations** (status checks): Generous limits

```javascript
// Heavy operations
router.post('/analyses', heavyApiLimiter, ...);

// Polling operations
router.get('/analyses/:id', pollingLimiter, ...);
```

## Database (Prisma) Standards

### Schema Naming

**Conventions**:
- `PascalCase` for model names (e.g., `Video`, `Analysis`, `Claim`)
- `camelCase` for field names (e.g., `videoId`, `createdAt`)
- `SCREAMING_SNAKE_CASE` for enum values (e.g., `PENDING`, `COMPLETE`)

### Relationships

**Always define both sides** of relationships:

```prisma
// Good: Both sides defined
model Analysis {
  id     String  @id @default(uuid())
  claims Claim[] // One-to-many
}

model Claim {
  id         String   @id @default(uuid())
  analysis   Analysis @relation(fields: [analysisId], references: [id])
  analysisId String
}

// Bad: Only one side defined
model Analysis {
  id String @id @default(uuid())
  // Missing claims relation
}
```

### Migrations

**STRICT RULE**: Never edit migrations manually. Always use `prisma migrate`.

**Workflow**:
1. Edit `schema.prisma`
2. Run `npx prisma migrate dev --name descriptive_name`
3. Commit migration files to git

**FORBIDDEN**:
- Editing generated migration SQL
- Creating migrations manually
- Deleting migrations (unless unreleased)

### Prisma Client Usage

**Always generate after schema changes**:

```bash
npx prisma generate
```

**Type safety**: Use generated types, not `any`:

```javascript
// Good: Typed
import { Prisma } from '@prisma/client';
const createClaim = (data: Prisma.ClaimCreateInput) => { ... };

// Bad: Untyped (if using TypeScript)
const createClaim = (data: any) => { ... };
```

## Git Standards

### Commit Messages

**STRICT RULE**: Follow [Conventional Commits](https://www.conventionalcommits.org/).

**Format**: `type(scope): description`

**Types**:
- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code change that neither fixes nor adds feature
- `docs` - Documentation only
- `test` - Adding/updating tests
- `chore` - Build process, dependencies, tooling

**Examples**:

```bash
# Good
feat(claim-extraction): add support for chunked processing
fix(validation): correct timestamp matching algorithm
refactor(services): extract common LLM retry logic
docs(readme): update installation instructions

# Bad
Added feature           # Missing type
fix: bug               # Too vague, missing scope
feat(claim): added the new claim extraction feature that supports chunked processing  # Too long
```

**Scope**: Component/feature being modified (e.g., `claim-extraction`, `validation`, `frontend`, `backend`)

**Description**:
- Imperative mood ("add" not "added" or "adds")
- Lowercase (no capital first letter)
- No period at end
- Max 72 characters

### Branch Naming

**Convention**: `type/short-description`

```bash
# Good
feature/chunked-claim-extraction
fix/timestamp-sync-bug
refactor/service-layer-cleanup

# Bad
my-feature
fix_bug
feature/add-the-new-claim-extraction-feature  # Too long
```

### Pull Requests

**Title**: Same format as commit messages (Conventional Commits)

**Description** (required):
- Summary: What changed and why
- Test plan: How to verify the change
- Screenshots (if UI change)

**Review**: All PRs require review before merge (if team > 1)

## File Organization

### Backend Structure

```
backend/
├── src/
│   ├── routes/           # One file per resource (e.g., analysisRoutes.js)
│   ├── controllers/      # (Optional) Request handlers
│   ├── services/         # Business logic (one service per domain)
│   ├── utils/            # Pure utility functions
│   ├── middleware/       # Express middleware
│   └── prompts/          # LLM prompt templates (.txt files)
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── migrations/       # Auto-generated migrations
├── results/              # Debug logs (gitignored)
├── .env                  # Environment variables (gitignored)
└── index.js              # Application entry point
```

### Frontend Structure

```
frontend/
├── src/
│   ├── pages/            # Top-level page components
│   ├── components/       # Organized by feature
│   │   ├── analysis/     # Analysis feature components
│   │   └── common/       # Shared components
│   ├── api/              # API layer (fetch wrappers)
│   ├── hooks/            # Custom React hooks
│   └── App.jsx           # Root component
├── public/               # Static assets
└── vite.config.js        # Vite configuration
```

### File Naming

**Rules**:
- `PascalCase` for React components (e.g., `ClaimList.jsx`)
- `camelCase` for services, utilities (e.g., `videoService.js`)
- `kebab-case` for config files (e.g., `vite.config.js`)
- Match export name (e.g., `ClaimList.jsx` exports `ClaimList`)

## Environment Variables

### Security

**STRICT RULE**: NEVER commit secrets.

**Protected files** (must be in `.gitignore`):
- `.env`
- `.env.local`
- `.env.production`
- `postgres_password.txt`

**Allowed** (template files):
- `.env.example` (no real values, just placeholders)

### Naming Convention

**Backend** (`backend/.env`):
- `SCREAMING_SNAKE_CASE`
- Descriptive names (e.g., `OPENROUTER_API_KEY`, not `API_KEY`)

**Frontend** (`frontend/.env`):
- Prefix with `VITE_` for exposure to client
- Example: `VITE_API_URL`

## Comments & Documentation

### Code Comments

**When to comment**:
- Complex algorithms (e.g., timestamp synchronization logic)
- Non-obvious business rules
- Workarounds for external API limitations

**When NOT to comment**:
- Obvious code (e.g., `// Set status to complete` before `status = 'COMPLETE'`)
- Code that should be self-documenting (use better variable names instead)

```javascript
// Good: Explains non-obvious logic
// Use fuzzy matching to find exact position in transcript
// because LLM estimate may be slightly off
const exactTimestamp = findExactMatch(transcript, claimText, estimatedTime);

// Bad: States the obvious
// Increment counter
counter++;
```

### JSDoc (Optional but Recommended)

**For complex services**:

```javascript
/**
 * Extracts factual claims from a video transcript using LLM.
 *
 * @param {string} transcriptId - ID of the transcript in database
 * @param {string} modelName - OpenRouter model to use (e.g., 'kimi-dev-72b')
 * @returns {Promise<Claim[]>} Array of extracted claims with timestamps
 * @throws {Error} If LLM call fails or transcript not found
 */
const extractClaims = async (transcriptId, modelName) => {
  // Implementation
};
```

## Testing Standards (When Implemented)

### Test File Organization

**Location**: Next to source file or in `__tests__/` directory

**Naming**: `{component}.test.js` or `{service}.test.js`

```
services/
  videoService.js
  videoService.test.js       # Co-located test
```

### Test Structure

**Pattern**: AAA (Arrange, Act, Assert)

```javascript
describe('videoService', () => {
  describe('analyzeVideo', () => {
    it('should create analysis with PENDING status', async () => {
      // Arrange
      const videoUrl = 'https://youtube.com/watch?v=123';

      // Act
      const analysis = await videoService.analyzeVideo(videoUrl);

      // Assert
      expect(analysis.status).toBe('PENDING');
    });
  });
});
```

### Test Coverage

**Minimum requirements** (when tests are implemented):
- Services: 80% coverage
- Utilities: 90% coverage
- Routes: 70% coverage (integration tests)

## Performance Standards

### Backend

**Rules**:
- Database queries: Use `select` to limit fields (not `SELECT *`)
- Loops: Avoid N+1 queries (use `include` or batch queries)
- External API calls: Implement retry with exponential backoff

```javascript
// Good: Efficient query
const claims = await prisma.claim.findMany({
  where: { analysisId },
  select: { id: true, text: true, timestamp: true } // Only needed fields
});

// Bad: Over-fetching
const claims = await prisma.claim.findMany({
  where: { analysisId }
  // Fetches ALL fields, including large JSON blobs
});
```

### Frontend

**Rules**:
- Debounce expensive operations (search, filter)
- Use React.memo for expensive components (sparingly)
- Lazy load routes (when app grows)

## Accessibility Standards

**Current status**: Basic accessibility (not fully WCAG compliant)

**Minimum requirements**:
- Semantic HTML (use `<button>` not `<div onClick>`)
- Alt text for images
- Keyboard navigation (tab order)
- ARIA labels for icon buttons

```javascript
// Good: Accessible button
<button className="..." aria-label="Close modal">
  <CloseIcon />
</button>

// Bad: Non-semantic, not keyboard accessible
<div onClick={handleClose} className="...">
  <CloseIcon />
</div>
```

## Code Review Checklist

Before submitting PR, verify:

- [ ] No console.log in production code (use proper logging)
- [ ] All async functions have try/catch
- [ ] React components < 200 lines
- [ ] Tailwind CSS only (no inline styles)
- [ ] Conventional Commits format
- [ ] No secrets committed (.env, API keys)
- [ ] Input validation on all routes
- [ ] Prisma queries are efficient (select only needed fields)
- [ ] Error messages are descriptive
- [ ] Code is self-documenting (minimal comments needed)

## Enforcement

**Tools**:
- ESLint (frontend) - Automatically enforces many rules
- Prettier (both) - Code formatting
- Git hooks (pre-commit) - Prevent commits that violate standards

**Manual Review**:
- PR reviews check for architectural violations
- Senior developer approval required for:
  - Schema changes
  - New external dependencies
  - Architectural changes

## Exceptions

**When to break rules**:
- Performance critical sections (document with comment)
- External library requirements (document why)
- Temporary workarounds (add TODO with deadline)

**Process**:
1. Document exception in code comment
2. Mention in PR description
3. Get approval from senior developer

**Example**:

```javascript
// TODO(2024-12-01): Replace with proper solution once API supports pagination
// EXCEPTION: Using raw SQL here because Prisma doesn't support this query pattern
const results = await prisma.$queryRaw`...`;
```

## References

- Conventional Commits: https://www.conventionalcommits.org/
- Prisma Best Practices: https://www.prisma.io/docs/guides/performance-and-optimization
- React Best Practices: https://react.dev/learn/thinking-in-react
- ESLint Rules: `frontend/eslint.config.js`
