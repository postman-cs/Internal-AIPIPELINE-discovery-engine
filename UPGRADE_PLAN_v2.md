# CortexLab Platform Upgrade Plan v2

> 50-point plan to harden, scale, and polish the platform across every layer.

---

## Section A: AI Agent Intelligence (Points 1–8)

### 1. Streaming agent output via SSE

Replace the current fire-and-forget cascade pattern with token-by-token SSE streaming from the LLM to the browser. Each `processSingleTask` call in `recompute.ts` should pipe the OpenAI/Anthropic stream through a `ReadableStream` to the existing `/api/projects/[projectId]/cascade/status` SSE endpoint, adding `type: "agent_token"` events alongside the existing `type: "progress"` events. The `CascadeUpdatesPanel` should render a live Markdown preview pane that fills in as the agent writes, letting the CSE watch the AI think in real time rather than staring at "Cascade update started. Monitoring progress…" for 60–120 seconds.

### 2. Dynamic model routing with quality scoring

Add a `ModelQualityScore` Prisma model (`agentType`, `modelId`, `avgLatencyMs`, `avgTokenCost`, `successRate`, `avgZodParseAttempts`, `sampleCount`, `lastUpdated`). After every `AIRun` completes, update the score table. Replace the static `TASK_MODEL_MAP` in `model-router.ts` with a scoring function: `score = successRate * 0.5 + (1 / latency) * 0.3 + (1 / cost) * 0.2`. On each agent call, pick the model with the highest score for that agent type, with a 10% exploration epsilon for lower-scored models. Add an `/admiral/ai-routing` page showing a table of model scores per agent type and a manual override toggle.

### 3. Agent evaluation harness

Create `src/lib/ai/evaluation/` with a `runEvalSuite(agentType, testCases[])` function. Each test case provides an input fixture and a set of Zod-validated assertions (required fields present, confidence thresholds, string-match checks). Store results in a new `AgentEvalResult` table. Add a `/dashboard/ai-runs/evals` page showing pass/fail rates per agent over time. Wire a `npm run eval` script that runs the full suite against a seeded project (e.g., NFL) and fails CI if pass rate drops below 80%.

### 4. Multi-turn agent conversations

Extend the `runner.ts` agent runner to support multi-turn exchanges. After the first LLM response, if Zod parsing fails or if the output has empty required sections, send a follow-up prompt: "Your response was incomplete. Specifically, the following fields are missing: [list]. Please provide them." Store the full message history per `AIRun` in a new `messagesJson` column. Cap at 3 turns. This replaces the current 6-strategy unwrapping hack with a more natural correction loop.

### 5. Evidence-grounded citations in agent output

Modify every agent's system prompt to require `[EVIDENCE-N]` citations inline within their output. In `runner.ts`, after parsing, cross-reference cited labels against the actual `DocumentChunk.evidenceLabel` values passed in context. Add a `citationAccuracy` field to `AIRun` (ratio of valid citations to total citations). Surface citation accuracy on the AI Runs table and flag runs below 60% accuracy with a warning badge.

### 6. BUILD_LOG AI agent

Create `src/lib/ai/agents/buildLogGenerator.ts` — the missing 10th phase agent. Input: all upstream artifact summaries (discovery brief, topology, solution, infrastructure, tests, deployment plan) plus the existing manual build log content. Output: a complete `BuildLogData` JSON matching the `BuildLogEditor` schema. Remove the `BUILD_LOG` skip in `recompute.ts` and instead let it generate a proposal like every other phase. The proposal enters the standard accept/reject flow, and the `BuildLogEditor` merges the AI draft with any manual edits.

### 7. Assumption auto-verification via evidence

Add an `autoVerify` step in the assumption engine. After assumptions are extracted from an agent run, for each assumption, run a vector similarity search (`retrieval.ts`) against the evidence base using the assumption's `claim` as the query. If the top-k results (k=3) have cosine similarity > 0.85 and the chunk content directly supports the claim, auto-set the assumption status to `VERIFIED` with `verifiedBy: "EVIDENCE_MATCH"` and `confidence: similarity_score`. This reduces the manual verification burden on CSEs while keeping human-in-the-loop for ambiguous cases.

### 8. Contextual prompt enrichment from Kepler data

When running discovery agents, pull the project's `DiscoveryArtifact` fields (industry, engineering size, maturity level, technical landscape) and inject them as structured context at the top of the agent prompt, not just raw evidence chunks. This gives agents domain awareness (e.g., "This is a Level 2 maturity retail company with 400 engineers on GCP") rather than making them infer it from scattered evidence. Modify `getUpstreamContent` in `recompute.ts` to include the discovery artifact summary for all post-discovery phases.

---

## Section B: Security & Production Hardening (Points 9–16)

### 9. Encrypt secrets at rest

Add a `src/lib/crypto.ts` utility using Node.js `crypto.createCipheriv` with AES-256-GCM. Derive the key from a `SECRETS_ENCRYPTION_KEY` env var via PBKDF2. Encrypt `Project.gitToken`, `Project.postmanApiKey`, `Project.jiraApiToken`, and `User.googleRefreshToken` before writing to Postgres. Decrypt on read in the corresponding server actions. Add a one-time migration script that encrypts all existing plaintext values.

### 10. Redis-backed rate limiting

Replace the in-memory `Map<string, number[]>` rate limiter in `middleware.ts` with a Redis sliding-window implementation using `@upstash/ratelimit` or raw `ioredis` commands (`ZADD`/`ZRANGEBYSCORE`/`ZCARD`). This makes rate limiting work correctly across multiple Next.js instances. Add `REDIS_URL` to the env config. Fall back to in-memory if Redis is unavailable (dev mode).

### 11. CSRF double-submit cookie

Add a `csrf.ts` middleware helper that generates a random token, sets it as an `HttpOnly` cookie, and injects it into a `<meta>` tag in the root layout. All server actions validate that the `X-CSRF-Token` header matches the cookie value. This prevents cross-site request forgery beyond SameSite cookie protection.

### 12. Admiral role enforcement in middleware

Extend `middleware.ts` to decode the session and check `role === "ADMIRAL"` for all `/admiral/*` paths. Currently this is only checked in the `(admiral)/layout.tsx` component, meaning a CSE could theoretically make direct API calls to admiral server actions. Add the check at the Edge middleware layer for defense-in-depth.

### 13. Audit log for sensitive operations

Create an `AuditLog` Prisma model: `id`, `userId`, `action` (enum: LOGIN, LOGOUT, PROJECT_CREATE, PROJECT_DELETE, PROPOSAL_ACCEPT, PROPOSAL_REJECT, SECRET_ACCESS, ROLE_CHANGE, EXPORT, SEED), `targetId`, `targetType`, `metadataJson`, `ipAddress`, `userAgent`, `createdAt`. Instrument all server actions that modify data. Add an `/admiral/audit-log` page with filterable table and CSV export.

### 14. Content Security Policy tightening

The current CSP in middleware uses `script-src 'self' 'unsafe-inline' 'unsafe-eval'`. Remove `'unsafe-eval'`. Replace `'unsafe-inline'` with nonce-based CSP: generate a per-request nonce in middleware, pass it via a custom header, and inject it into `<script>` tags in the root layout. This blocks XSS injection while allowing Next.js inline scripts.

### 15. Database connection pooling with PgBouncer

Add a PgBouncer container to `docker-compose.yml` sitting between the app and Postgres. Configure Prisma to connect through PgBouncer (port 6432) with `pgbouncer=true` in the connection string. Set pool mode to `transaction`. This prevents connection exhaustion under load from concurrent cascade recompute jobs + SSE connections + server actions.

### 16. Secrets rotation scheduler

Add a `SecretRotation` Prisma model tracking the last rotation date for each project secret. Create a daily worker task `secrets.checkRotation` that flags projects with secrets older than 90 days. Surface the warning on the project overview page ("Git token expires in 12 days") and on the Admiral dashboard as a fleet-wide count. Add a "Rotate Now" button that generates a new token via the provider API (GitHub, Jira) and updates the encrypted value.

---

## Section C: Testing & Quality (Points 17–22)

### 17. Vitest migration and test runner unification

The existing 6 test files import from `vitest` but are run with `jest`, causing all suites to fail. Install `vitest` as a dev dependency, add a `vitest.config.ts` with the `@vitejs/plugin-react` plugin, path aliases matching `tsconfig.json`, and `setupFiles` for Prisma mocking. Update `package.json` to run `vitest` instead of `jest`. Verify all 6 existing test files pass.

### 18. Server action integration tests

Create `src/__tests__/actions/` with test files for the 5 most critical server actions: `triggerCascadeUpdate`, `acceptProposal`, `loginAction`, `verifyAssumption`, and `deliverToRepo`. Each test uses a seeded test database (via Prisma's `$transaction` rollback pattern), calls the action, and asserts on the database state and return value. Target: 30+ test cases covering happy paths, error paths, and edge cases.

### 19. Cascade engine property-based tests

Add `src/__tests__/cascade/` with property-based tests using `fast-check`. Test properties: (a) `getTopologicalTiers()` always returns phases in valid dependency order, (b) `computeInputHash` is deterministic, (c) `diffArtifacts` produces patches that when applied reconstruct the target, (d) `markDownstreamDirty` never marks a phase that isn't downstream of the trigger. These catch edge cases that example-based tests miss.

### 20. E2E smoke tests with Playwright

Add `e2e/` directory with Playwright tests covering the 5 critical user journeys: (a) Login → Dashboard → Open project → View discovery, (b) Trigger cascade → Watch SSE progress → Accept proposal, (c) Admiral login → Fleet map → CSE detail, (d) Upload service template → Preview → Diff on re-upload, (e) Build log → Fill sections → Export Markdown. Run against the dev server + seeded database in CI.

### 21. Visual regression snapshots

Add `@playwright/test` visual comparison for the 8 canvas visualizations. Each test navigates to the page, waits for canvas initialization (listen for a `data-canvas-ready` attribute set by each component), takes a 1440x900 screenshot, and compares against a baseline PNG. Threshold: 0.5% pixel difference. This catches regressions in the handcrafted canvas rendering code (5,600+ lines across 8 components).

### 22. CI pipeline with GitHub Actions

Create `.github/workflows/ci.yml` with: (a) TypeScript check (`tsc --noEmit`), (b) ESLint (`next lint`), (c) Vitest unit/integration tests, (d) Playwright E2E tests (with Postgres service container), (e) Prisma schema validation (`prisma validate`), (f) Build check (`next build`). Run on every PR and push to `main`. Add status badges to README. Fail-fast on type errors.

---

## Section D: UX & Interface Polish (Points 23–34)

### 23. Notification center with bell icon

Add a `Notification` Prisma model (`userId`, `type`, `title`, `body`, `linkUrl`, `read`, `createdAt`). Create notifications when: cascade completes, proposal requires review, assumption needs verification, blocker escalated, engagement stage advanced. Add a bell icon to `TopNav` with an unread count badge. Click opens a slide-out panel with grouped notifications and "Mark all read". Use the existing SSE infrastructure to push new notifications in real time.

### 24. Global search with Cmd+K

Upgrade `CommandPalette.tsx` from navigation-only to full-text search. When the user types, query a new `/api/search` endpoint that runs `ts_rank` full-text search across `Project.name`, `SourceDocument.title`, `SourceDocument.rawText`, `Assumption.claim`, `Blocker.description`, and `AdmiralNote.content`. Return grouped results (Projects, Documents, Assumptions, Blockers, Notes) with highlighted match snippets. Navigate to the result on selection.

### 25. Responsive mobile layout

Add responsive breakpoints to `TopNav` (hamburger menu below `md`), `AdmiralSidebar` (collapsible drawer), `ProjectSubNav` (horizontal scroll with overflow indicators), and the dashboard grid (single-column on mobile). Use Tailwind's `sm:`/`md:`/`lg:` modifiers. The canvas visualizations should show a static thumbnail on mobile with a "View on desktop" message, since they require pointer interaction.

### 26. Relative time formatting

Install `date-fns` and create a `src/lib/format.ts` utility with `relativeTime(date: Date): string` (e.g., "2 hours ago", "3 days ago", "just now"). Replace all 40+ instances of `toLocaleDateString()` and `toLocaleString()` throughout the codebase with either `relativeTime()` (for recent dates) or `formatDate()` (for absolute dates). Add a tooltip showing the exact ISO timestamp on hover.

### 27. Syntax highlighting in CodeSnippet

Add `shiki` (2kB wasm highlighter) and update `CodeSnippet.tsx` to syntax-highlight code based on the `language` prop. Support `yaml`, `json`, `typescript`, `bash`, `dockerfile`, `hcl` (Terraform). Use a dark theme matching the platform's color palette (`#06080f` background). This makes CI/CD playbook configs, infrastructure code, and API specs significantly more readable.

### 28. Skeleton loading for Admiral pages

Add `loading.tsx` files for all 10 Admiral sub-routes (`/admiral/users`, `/admiral/projects`, `/admiral/teams`, `/admiral/waves`, `/admiral/campaigns`, `/admiral/blockers`, `/admiral/assumptions`, `/admiral/notes`, `/admiral/cse/[cseId]`, `/admiral/ai-routing`). Use the existing `CardSkeleton`, `TableRowSkeleton`, and `StatSkeleton` components from `SkeletonLoader.tsx`. This eliminates the flash of empty content when navigating between Admiral pages.

### 29. Toast-based operation feedback

Add toast notifications for all server actions that currently fail silently. Specifically: project create/delete, assumption verify/reject/correct, blocker create/update, build log save, repo init/push/PR, engagement stage advance, and admiral note create/pin/delete. Use the existing `ToastProvider`/`useToast` system. Pattern: call action → on success show green toast with summary → on error show red toast with error message.

### 30. Error boundaries on every route group

Add `error.tsx` files for: `(authenticated)/dashboard/`, `(authenticated)/ingest/`, `(authenticated)/settings/`, `(admiral)/admiral/`, and each admiral sub-route. Each error boundary should show the error message, a "Try Again" button (calling `reset()`), and a "Go Home" link. Log the error to the server via a `/api/log-error` endpoint for production monitoring.

### 31. Accessibility pass on canvas components

Add ARIA attributes to all 8 canvas components: `role="img"`, `aria-label` describing the visualization, and a visually-hidden `<div>` with a text summary of the data (e.g., "Fleet map showing 5 CSEs with 28 total projects. 3 active blockers."). Add keyboard focus support: Tab focuses the canvas, Arrow keys select items, Enter triggers the click action. Add `@media (prefers-reduced-motion)` check to disable particle animations.

### 32. User profile dropdown in TopNav

Replace the plain text `userName` in TopNav with a clickable avatar circle (initials-based, color derived from name hash). Click opens a dropdown with: user name, email, role badge, link to Settings, link to AI Runs, theme toggle (future), and Logout button. This consolidates user-related navigation into a standard pattern.

### 33. Inline validation on all forms

Wire `react-hook-form` + `zod` resolver to: `CreateProjectForm`, `DiscoveryForm`, `JiraSettingsForm`, `ServiceTemplateInput`, `BuildLogEditor`, and all Admiral CRUD forms (`AdminTable` form wrapper). Show per-field error messages below inputs with red text and a shake animation. Validate on blur and on submit. This replaces the current pattern of silent validation failures.

### 34. Pagination and virtual scrolling

Add cursor-based pagination to: the AI Runs table (currently loads 100 at once), the Admiral engagements table (28 projects, will grow), the project list (currently fetches all), and the ingest items browser. Use `@tanstack/react-virtual` for virtual scrolling on tables over 50 rows. Add page size selector (25/50/100) and "Load more" button. This prevents performance degradation as data grows.

---

## Section E: Data Pipeline & Integrations (Points 35–42)

### 35. Webhook-based evidence ingestion

Create a generic webhook endpoint at `/api/webhooks/evidence` that accepts `POST` with a JSON body `{ projectId, sourceType, title, content, metadata? }`. Validate via an `X-Webhook-Secret` header per project (stored encrypted in `Project.webhookSecret`). This lets external systems (Salesforce, Slack, custom scripts) push evidence into the pipeline without polling. Auto-trigger snapshot + impact analysis after ingestion.

### 36. Postman collection import as evidence

Add a "Import from Postman" button to the Discovery page. When clicked, use the project's `postmanApiKey` to call the Postman API (`/collections/{collectionUid}`), fetch the full collection JSON, parse it into a structured `SourceDocument` (extracting endpoints, test scripts, environment variables), and ingest it as evidence. This directly bridges the Postman workspace with the discovery pipeline.

### 37. Slack integration for blocker alerts

Add Slack webhook support: `Project.slackWebhookUrl` field. When a blocker is created or escalated to HIGH/CRITICAL severity, post a formatted message to the Slack channel with blocker details, project link, and action buttons (via Slack Block Kit). Add a similar notification when a cascade completes or a proposal is ready for review. Configure per-project in the Settings page.

### 38. Jira bidirectional sync

Upgrade the current one-way Jira sync (push from CortexLab → Jira) to bidirectional. Add a Jira webhook listener at `/api/webhooks/jira` that receives issue updates. When a Jira issue linked to a CortexLab blocker changes status (e.g., moved to Done), update the blocker status accordingly. When a Jira comment is added, attach it to the blocker's notes. This prevents CortexLab and Jira from drifting out of sync.

### 39. Gmail thread intelligence

Upgrade the Gmail integration from simple email ingestion to thread-aware intelligence. When ingesting emails, group by thread ID, extract the full conversation flow, identify action items and decisions using a lightweight LLM call (GPT-4.1-nano), and tag each thread with detected topics (technical, commercial, blocker, assumption). Surface the top threads on the project overview page with sentiment indicators.

### 40. Bulk evidence import via CSV/ZIP

Add a "Bulk Import" tab to the Ingest page. Accept a ZIP file containing multiple documents (Markdown, JSON, YAML, plain text) or a CSV with columns `source_type, title, content`. Parse each entry, create `SourceDocument` + `DocumentChunk` records, generate embeddings, and create a single `EvidenceSnapshot`. Show a progress bar during import. This handles the common case where a CSE has a folder of customer documents to ingest at once.

### 41. Evidence freshness scoring and staleness alerts

Add `lastVerifiedAt` and `freshnessScore` (0–100) fields to `SourceDocument`. Compute freshness based on document age, source reliability (Kepler > manual > DNS), and how frequently the document has been updated. When freshness drops below 40, mark dependent phases as STALE in the cascade. Show a "Stale Evidence" warning on the project overview and in the Admiral fleet health panel. Add a "Re-ingest" button that re-fetches from the original source.

### 42. OpenAPI spec auto-discovery

When a project has an `apiDomain` set, add a background worker task that probes common OpenAPI spec paths (`/openapi.json`, `/swagger.json`, `/v2/api-docs`, `/api/v1/openapi.yaml`, `/.well-known/openapi`). If found, automatically ingest the spec as a `SourceDocument` with `sourceType: "OPENAPI"`. Parse the spec to extract endpoint counts, auth schemes, and response schemas. Surface the findings on the Discovery page as structured cards.

---

## Section F: Performance & Scalability (Points 43–48)

### 43. Database query optimization pass

Add Prisma middleware (`src/lib/prisma.ts`) that logs queries exceeding 100ms. Identify and fix the top 10 slow queries by adding composite indexes. Priority candidates: `PhaseArtifact(projectId, phase, status)`, `DocumentChunk(projectId, evidenceLabel)`, `Assumption(projectId, status, phase)`, `Proposal(projectId, status)`, `RecomputeTask(jobId, status)`. Add `@@index` directives to `schema.prisma`. Run `EXPLAIN ANALYZE` on the cascade recompute flow to find sequential scans.

### 44. ISR and caching for read-heavy pages

Add `revalidate` tags to read-heavy server component pages: project list (revalidate 60s), dashboard stats (revalidate 30s), Admiral fleet overview (revalidate 60s), AI Runs table (revalidate 120s). Use `unstable_cache` from Next.js for expensive aggregation queries (fleet stats, cascade health rollups, workload heatmap data). Add `Cache-Control` headers to API routes that serve static-ish data (topology graph, evidence snapshot).

### 45. Lazy-load canvas visualizations below the fold

The dashboard loads `CommandConstellation` (677 lines of canvas code) eagerly even though users often scroll past it. Wrap all below-the-fold canvas components in an `IntersectionObserver`-based lazy loader that only initializes the canvas when it enters the viewport. Apply to: `OrbitalProgression` (cascade updates page), `SignalObservatory` (assumptions page), `ImpactFieldView` (blockers page), `PulseStreamView` (CI/CD page), and `NeuralFiringGrid` (execution page). This reduces initial JS parse time and eliminates offscreen `requestAnimationFrame` loops.

### 46. Prisma query batching with DataLoader

Install `dataloader` and create `src/lib/dataloaders.ts` with loaders for the most common N+1 patterns: `projectsByUserIdLoader`, `phaseArtifactsByProjectIdLoader`, `assumptionsByProjectIdLoader`, `blockersByProjectIdLoader`. Use these in the Admiral dashboard (which currently fetches CSE → projects → artifacts in nested loops) and in the cascade status endpoint. This collapses N+1 queries into batched `WHERE id IN (...)` calls.

### 47. Background job queue with priorities

Add priority levels to Graphile Worker jobs: `CRITICAL` (cascade recompute for active engagements), `HIGH` (proposal generation), `NORMAL` (evidence ingestion), `LOW` (Jira sync, email ingest). Set via the `priority` option in `worker.addJob()`. Add a max concurrent job limit per priority tier to prevent cascade recomputes from starving ingestion jobs. Surface the queue depth on the Admiral dashboard.

### 48. Edge caching for static API responses

Add Vercel Edge Config or Cloudflare KV caching for: the landing page content, the seed data responses (dev), and the topology graph data (which rarely changes mid-session). Set `Cache-Control: public, s-maxage=300, stale-while-revalidate=600` on the topology API route. This eliminates redundant database queries when multiple users view the same project's topology within a 5-minute window.

---

## Section G: Platform Features (Points 49–50)

### 49. Multi-tenant workspace isolation

Add a `Workspace` Prisma model with `id`, `name`, `slug`, `ownerId`, `createdAt`. Add `workspaceId` foreign key to `Project`, `User` (many-to-many via `WorkspaceMembership`), `AdmiralNote`, and `AuditLog`. Update all server actions and queries to filter by the current user's workspace. Update the session to include `workspaceId`. Add a workspace switcher dropdown in TopNav. This enables multiple CSE teams to use the same CortexLab instance without seeing each other's data, which is critical for scaling beyond a single Postman team.

### 50. Plugin architecture for custom agents

Create `src/lib/ai/plugins/` with a `PluginRegistry` that allows registering custom agent functions. Each plugin implements a `CascadePlugin` interface: `{ phase: Phase; name: string; run(context: AgentContext): Promise<AgentOutput> }`. The registry is populated from a `plugins/` directory at startup. Modify `recompute.ts` to check the registry before falling back to built-in agents. Add an `/admiral/plugins` page for enabling/disabling plugins per project. This lets teams extend the AI pipeline with domain-specific logic (e.g., a plugin that generates Postman Flows instead of collections) without modifying core code.
