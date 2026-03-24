# AI Pipeline — Postman CSE Discovery Intelligence Engine

Retrieval-augmented, evidence-backed discovery intelligence system for Postman Customer Success Engineering. Ingests customer evidence from multiple sources, runs a deterministic 12-agent AI pipeline, and generates actionable discovery briefs, infrastructure topology, solution designs, and deployment plans — all with evidence citations and human-in-the-loop review.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        EVIDENCE INGESTION                               │
│  Kepler · DNS · Headers · GitHub · Call Transcripts · Slack · Gmail     │
│  Manual Text & Images · Drag-and-Drop · Webhooks · OpenAPI Specs        │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────┐    ┌─────────────────────────────────┐
│  Sentence-Aware Chunker│───▶│  Voyage AI Embeddings            │
│  800-1200 tokens       │    │  voyage-3-lite (512 dimensions)  │
│  200-token overlap     │    │  Free tier: 200M tokens/month    │
└────────────────────────┘    └──────────────┬──────────────────┘
                                             │
                                             ▼
                              ┌─────────────────────────────────┐
                              │  PostgreSQL + pgvector            │
                              │  SourceDocument → DocumentChunk   │
                              │  EVIDENCE-1, EVIDENCE-2, ...     │
                              │  Cosine similarity search (<=>)  │
                              └──────────────┬──────────────────┘
                                             │
               ┌─────────────────────────────┘
               ▼
┌──────────────────────────────────────────────────────────────────────┐
│               12-AGENT AI PIPELINE (Claude Sonnet 4 / GPT-4.1)      │
│                                                                      │
│  ┌─── Discovery (5 agents) ─────────────────────────────────────┐   │
│  │ 1. ReconSynthesizer    → company snapshot + findings         │   │
│  │ 2. SignalClassifier     → cloud, CDN, auth, backend signals  │   │
│  │ 3. MaturityScorer       → API maturity 1-3 + justification   │   │
│  │ 4. HypothesisGenerator  → engagement strategy + stakeholders │   │
│  │ 5. BriefGenerator       → evidence-cited Discovery Brief     │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│  ┌─── Extended Pipeline (7 agents) ─────────────────────────────┐   │
│  │ 6.  CurrentTopologyBuilder → infrastructure node/edge graph  │   │
│  │ 7.  FutureStateDesigner    → desired topology delta          │   │
│  │ 8.  SolutionDesigner       → refactor actions mapped to graph│   │
│  │ 9.  InfrastructurePlanner  → cloud resources + IaC snippets  │   │
│  │ 10. TestDesigner           → test matrix per topology change │   │
│  │ 11. CraftSolution          → Postman collections + Newman    │   │
│  │ 12. DeploymentPlanner      → rollout plan + CI/CD configs    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  Every agent: retrieves evidence → calls LLM → Zod validates output │
│  All runs audited in AIRun table (model, tokens, duration, status)   │
│  Evidence citations: [EVIDENCE-1], [EVIDENCE-2], ... validated       │
└──────────────────────────┬───────────────────────────────────────────┘
                           │
                           ▼
             ┌──────────────────────────────────┐
             │   Versioned Phase Artifacts       │
             │   Cascade Engine (DAG)            │
             │   RFC6902 Patch Proposals         │
             │   Accept/Reject → New Version     │
             │   Auto-mark downstream DIRTY      │
             └──────────────────────────────────┘
```

### Phase DAG (Cascade Propagation)

```
                    DISCOVERY
                       │
               CURRENT_TOPOLOGY
                  │         │
      DESIRED_FUTURE_STATE  │
              │         │   │
         SOLUTION_DESIGN    │
          │    │    │       │
  INFRASTRUCTURE │  TEST_DESIGN
          │      │       │
          CRAFT_SOLUTION
               │
          TEST_SOLUTION
               │
        DEPLOYMENT_PLAN
          │         │
      MEETINGS  WORKING_SESSIONS
          │         │
          BUILD_LOG
```

When new evidence is ingested or a proposal is accepted, downstream phases are automatically marked **DIRTY** and new proposals are generated for human review. No silent overwrites.

### Multi-Model Router

```
┌─────────────────────────────────────────────────┐
│  Model Router (src/lib/ai/model-router.ts)      │
│                                                  │
│  1. Per-agent env override  AI_MODEL_<AGENT>     │
│  2. Global override         AI_DEFAULT_MODEL     │
│  3. Provider availability   (skip if no key)     │
│  4. Task-category mapping   (analysis → Claude,  │
│     code-gen → GPT-4.1, classification → mini)   │
│                                                  │
│  Automatic fallback: OpenAI 429 → Claude Sonnet  │
│  Quality scoring: ModelQualityScore table tracks  │
│  latency, success rate, parse attempts per model  │
└─────────────────────────────────────────────────┘
```

### Cascade Update Flow

```
  New Evidence Ingested
         │
         ▼
  Create EvidenceSnapshot (immutable SHA-256 hash)
         │
         ▼
  Impact Analysis → identify dirty phases (DAG walk)
         │
         ▼
  For each phase (topological order):
    ├── Check upstream dependencies are CLEAN
    ├── Run AI Agent (retrieve evidence → LLM → Zod validate)
    ├── Generate RFC6902 Patch (diff vs current artifact)
    ├── Create Proposal for human review
    └── If autoAccept: apply immediately, mark downstream DIRTY
         │
         ▼
  Cascade Complete → all phases updated
```

### Human-in-the-Loop Systems

```
  ┌── Assumptions ──────────────────────────────┐
  │ AI extracts assumptions during each phase    │
  │ Status: PENDING → VERIFIED / CORRECTED       │
  │ Gate: critical assumptions block downstream   │
  │ Auto-verify when new evidence confirms        │
  └──────────────────────────────────────────────┘

  ┌── Blockers ─────────────────────────────────┐
  │ Severity: LOW → MEDIUM → HIGH → CRITICAL     │
  │ Missiles: surgical targeted interventions     │
  │ Nukes: comprehensive escalation strategies    │
  │ Status: IDENTIFIED → MAPPED → NEUTRALIZED     │
  └──────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) + TypeScript 5.7 |
| Database | PostgreSQL 16 + pgvector (Neon serverless) |
| ORM | Prisma 6.x |
| Embeddings | Voyage AI voyage-3-lite (512d, free tier) |
| LLM | Claude Sonnet 4 (Anthropic) + GPT-4.1 (OpenAI) with automatic fallback |
| Validation | Zod (all agent I/O, server actions, API routes) |
| Auth | iron-session (encrypted cookies, 8-hour max age) |
| UI | React 19, TailwindCSS 4, React Hook Form |
| Visualization | react-force-graph-2d (topology constellation) |
| Observability | OpenTelemetry + Prometheus + AIRun audit log |
| Hosting | Vercel (Pro plan, 800s function timeout) |
| CI/CD | GitHub Actions + Docker |

**No LangChain. No external vector DB. Code-driven deterministic agents.**

## Local Setup

### Prerequisites

- Node.js 20+
- Docker (for Postgres + pgvector)
- Voyage AI API key (free at https://dash.voyageai.com/)
- Anthropic API key and/or OpenAI API key

### 1. Start Postgres

```bash
docker compose up -d db
```

### 2. Configure environment

```bash
cp .env.example .env
# Required:
#   DATABASE_URL, SESSION_SECRET, VOYAGE_API_KEY
# AI providers (at least one):
#   ANTHROPIC_API_KEY and/or OPENAI_API_KEY
```

### 3. Install & migrate

```bash
npm install
npx prisma migrate deploy
npm run db:seed
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Default Login

- **Email**: `cse@postman.com`
- **Password**: `pipeline123`

## Workflow

1. **Create a Project** — the customer you're researching
2. **Ingest Evidence** — paste Kepler intelligence, DNS findings, call transcripts, or drag-and-drop files into the Discovery page. Evidence is chunked, embedded via Voyage AI, and stored as citable chunks.
3. **Run CortexLab** — the 5-agent discovery pipeline retrieves relevant evidence, synthesizes findings, scores maturity, generates hypothesis, and compiles an evidence-cited Discovery Brief
4. **Add Service Template** — upload/paste your Postman service template (OpenAPI spec, collection, etc.)
5. **Run Cascade** — the full 12-agent pipeline generates topology, solution design, infrastructure, tests, CI/CD configs, and deployment plan
6. **Review & Accept** — review AI-generated proposals per phase, accept or reject. Downstream phases auto-update.
7. **Topology View** — explore the infrastructure graph in Constellation, Heatmap, or Story mode
8. **Track Assumptions & Blockers** — verify AI assumptions, design missile/nuke strategies for blockers

## Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/login` | Login |
| `/dashboard` | Project health scores, progress, recent activity |
| `/dashboard/ai-runs` | AI observability — all agent runs with token/timing details |
| `/ingest` | Source management + data ingest |
| `/architect` | Architecture mapping form share |
| `/projects` | Project list + create |
| `/projects/[id]` | Project overview with health score, notes, phase status |
| `/projects/[id]/discovery` | **AI Pipeline** — ingest evidence + run CortexLab |
| `/projects/[id]/discovery/brief` | Read-only brief with copy/download/export |
| `/projects/[id]/topology` | Constellation graph, Heatmap, Story Mode |
| `/projects/[id]/updates` | Cascade update proposals — review, accept, reject |
| `/projects/[id]/assumptions` | Assumption verification dashboard |
| `/projects/[id]/blockers` | Blocker mapping + missile/nuke design |
| `/projects/[id]/cicd` | CI/CD Playbook — pipeline configs, Newman commands |
| `/projects/[id]/buildlog` | Build log editor |
| `/projects/[id]/repo` | Git repo delivery |
| `/projects/[id]/execution` | Mission/execution tracking |
| `/projects/[id]/adoption` | Adoption acceleration |
| `/projects/[id]/case-study` | Case study builder |
| `/settings` | User settings |

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/health` | Health check (DB connectivity) |
| POST | `/api/seed` | Seed demo data (dev only) |
| POST | `/api/ingest/run` | Trigger ingestion pipeline |
| POST | `/api/cron/daily-ingest` | Scheduled daily ingest (bearer auth) |
| POST | `/api/webhooks/ingest` | External webhook for pushing evidence |
| POST | `/api/webhooks/evidence` | Generic evidence webhook |
| POST | `/api/webhooks/jira` | Jira bidirectional sync |
| POST | `/api/webhooks/newman-results` | Newman test results ingestion |
| POST | `/api/projects/[id]/cascade/recompute` | Run cascade (maxDuration=800s) |
| GET | `/api/projects/[id]/cascade/status` | SSE stream for cascade progress |
| GET | `/api/projects/[id]/updates` | Snapshots + dirty phases + proposals |
| POST | `/api/projects/[id]/proposals/[pid]/accept` | Accept a patch proposal |
| POST | `/api/projects/[id]/proposals/[pid]/reject` | Reject a patch proposal |
| GET | `/api/projects/[id]/topology` | Current topology + heatmap |
| GET | `/api/metrics` | Prometheus metrics (token-protected in prod) |

## AI Agent Architecture

Each agent in `src/lib/ai/agents/`:

| # | Agent | Input | Output |
|---|-------|-------|--------|
| 1 | `reconSynthesizer` | Raw evidence | Company snapshot, technical findings |
| 2 | `signalClassifier` | Evidence + recon | Classified signals (cloud, CDN, auth, backend) |
| 3 | `maturityScorer` | Evidence + signals | Maturity level 1-3 + justification |
| 4 | `hypothesisGenerator` | All prior outputs | Hypothesis, approach, stakeholders, agenda |
| 5 | `briefGenerator` | All prior outputs | Final markdown + JSON brief with evidence appendix |
| 6 | `currentTopologyBuilder` | Evidence + discovery | Node/edge infrastructure graph |
| 7 | `futureStateDesigner` | Topology + maturity | Desired future state delta |
| 8 | `solutionDesigner` | Current + future topology | Refactor actions mapped to graph |
| 9 | `infrastructurePlanner` | Solution + topology | Cloud resources, IaC snippets, container manifests |
| 10 | `testDesigner` | Solution design + graph | Test matrix per topology change |
| 11 | `craftSolution` | Solution + tests + infra | Postman collections, Newman configs, CI/CD pipelines |
| 12 | `deploymentPlanner` | Solution + tests | Rollout plan + CI/CD + environment gates |

Every agent:
- Retrieves evidence via `lib/ai/retrieval.ts` (pgvector cosine similarity)
- Calls LLM via multi-model router (Claude Sonnet 4 / GPT-4.1 with automatic fallback)
- Validates output with Zod schemas — malformed/hallucinated data is rejected and retried
- Cites evidence IDs on every non-trivial claim (`[EVIDENCE-1]`, `[EVIDENCE-2]`, ...)
- Logs to `AIRun` table (model, prompt hash, token usage, duration, status, citation accuracy)

## Security

- **Session**: `iron-session` with encrypted cookies, 8-hour max age, `httpOnly`, `secure`, `sameSite: lax`
- **Headers**: CSP (no `unsafe-eval` in prod), HSTS, X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- **Rate Limiting**: Sliding window on login, ingest, cron, and default routes (Redis or in-memory)
- **RBAC**: Admin, Admiral, CSE roles with middleware enforcement
- **Input Validation**: Zod schemas on all server actions and API routes with size limits
- **IDOR Prevention**: All data queries scoped to authenticated user's owned projects
- **CSRF**: Double-submit cookie protection
- **Encryption**: AES-256-GCM for secrets at rest
- **Audit Log**: LOGIN, PROJECT_DELETE, PROPOSAL_ACCEPT, CASCADE_TRIGGER, etc.
- **Error Sanitization**: Internal errors logged server-side, generic messages returned to clients

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Postgres connection string (use pooled URL for Neon) | Yes |
| `SESSION_SECRET` | 32+ char session encryption secret | Yes |
| `VOYAGE_API_KEY` | Voyage AI API key (free tier: 200M tokens/month) | Yes |
| `ANTHROPIC_API_KEY` | Anthropic API key (for Claude models) | Yes* |
| `OPENAI_API_KEY` | OpenAI API key (for GPT models) | Yes* |
| `AI_DEFAULT_MODEL` | Force all agents to a specific model (e.g. `claude-sonnet-4-20250514`) | No |
| `CRON_SECRET` | Bearer token for cron endpoint | Yes |
| `WEBHOOK_SECRET` | Bearer token for webhook ingest | No |
| `METRICS_TOKEN` | Bearer token for `/api/metrics` in prod | No |
| `NODE_ENV` | Environment: development, production, test | No |
| `LOG_LEVEL` | Logging level: debug, info, warn, error | No |

*At least one AI provider key is required. The model router auto-falls back if one provider returns errors.

## npm Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build (prisma generate + next build) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Run Vitest |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run ci` | Full CI check (lint + typecheck + test + build) |
| `npm run db:migrate` | Create new migration (dev) |
| `npm run db:migrate:deploy` | Apply migrations (production) |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio |
| `npm run docker:up` | Start Docker Compose stack |
| `npm run docker:down` | Stop Docker Compose stack |
| `npm run health` | Check app health |

## Project Structure

```
src/
├── app/
│   ├── (authenticated)/
│   │   ├── dashboard/
│   │   │   ├── page.tsx                ← Project health dashboard
│   │   │   └── ai-runs/               ← AI observability table
│   │   ├── ingest/                     ← Source management
│   │   ├── architect/                  ← Architecture mapping
│   │   ├── settings/                   ← User settings
│   │   └── projects/
│   │       ├── page.tsx                ← Project list + create
│   │       └── [projectId]/
│   │           ├── page.tsx            ← Project overview + health
│   │           ├── discovery/          ← AI Pipeline + brief viewer
│   │           ├── topology/           ← Constellation + Heatmap + Story
│   │           ├── updates/            ← Cascade proposals
│   │           ├── assumptions/        ← Assumption verification
│   │           ├── blockers/           ← Blocker mapping + missiles
│   │           ├── cicd/               ← CI/CD Playbook
│   │           ├── buildlog/           ← Build log editor
│   │           ├── repo/               ← Git repo delivery
│   │           ├── execution/          ← Mission tracking
│   │           ├── adoption/           ← Adoption acceleration
│   │           └── case-study/         ← Case study builder
│   ├── (admiral)/                      ← Fleet admin dashboard
│   ├── api/
│   │   ├── health/                     ← Health check
│   │   ├── auth/                       ← Google OAuth
│   │   ├── webhooks/                   ← External integrations
│   │   ├── cron/                       ← Scheduled tasks
│   │   ├── ingest/                     ← Trigger ingest
│   │   ├── metrics/                    ← Prometheus metrics
│   │   ├── projects/[id]/cascade/      ← Cascade recompute + SSE status
│   │   └── seed/                       ← Demo data seeder
│   └── login/
├── components/                         ← Shared React components
│   ├── Toast.tsx                       ← Global notification system
│   ├── CommandPalette.tsx              ← Cmd+K navigation + search
│   ├── NotificationBell.tsx            ← Notification center
│   ├── ProgressRing.tsx                ← Health score visualization
│   ├── DragDropZone.tsx                ← File/text upload
│   ├── CodeSnippet.tsx                 ← Syntax highlighting
│   ├── LazyCanvas.tsx                  ← Intersection observer wrapper
│   └── PlatformTabs.tsx                ← Multi-platform config tabs
├── lib/
│   ├── ai/
│   │   ├── agents/                     ← 12 AI agent modules
│   │   ├── orchestrator.ts             ← Discovery pipeline runner (5 agents)
│   │   ├── model-router.ts             ← Multi-model routing + fallback
│   │   ├── retrieval.ts                ← pgvector similarity search
│   │   ├── ingest.ts                   ← Chunk + embed + store (idempotent)
│   │   ├── chunker.ts                  ← Sentence-aware text chunker
│   │   ├── openai.ts                   ← Voyage AI embeddings + OpenAI client
│   │   └── plugins/                    ← Custom agent plugins
│   ├── actions/                        ← Server actions (31 files, authed + validated)
│   ├── cascade/
│   │   ├── recompute.ts                ← Cascade executor (tier-parallel, retry, timeout)
│   │   ├── phases.ts                   ← Phase DAG + topological sort
│   │   ├── patch.ts                    ← RFC6902 patch generation
│   │   ├── snapshot.ts                 ← Evidence snapshot creation
│   │   └── impact.ts                   ← Impact propagation analysis
│   ├── assumptions/                    ← Assumption tracking + auto-verify
│   ├── blockers/                       ← Blocker system + missile/nuke design
│   ├── gamification/                   ← Health scores, XP, streaks
│   ├── topology/                       ← Risk scoring engine
│   ├── auth/                           ← Auth utilities
│   ├── prisma.ts                       ← Prisma client
│   ├── session.ts                      ← Session management
│   ├── rbac.ts                         ← Role-based access control
│   ├── schemas.ts                      ← Shared Zod schemas
│   ├── logger.ts                       ← Structured JSON logger
│   ├── env-validation.ts               ← Startup env var validation
│   ├── crypto.ts                       ← AES-256-GCM encryption
│   ├── csrf.ts                         ← CSRF protection
│   ├── audit.ts                        ← Audit logging
│   └── dataloaders.ts                  ← DataLoader for N+1 prevention
├── middleware.ts                       ← Auth, rate limiting, security headers
└── __tests__/                          ← Vitest unit/integration tests

prisma/
├── schema.prisma                       ← Database schema (25+ models)
└── migrations/                         ← Migration history

e2e/                                    ← Playwright E2E tests
.github/workflows/ci.yml               ← CI pipeline
Dockerfile                              ← Production Docker image
docker-compose.yml                      ← Local dev (Postgres + PgBouncer)
vercel.json                             ← Vercel config (maxDuration=800s)
```

## Deployment

### Vercel (Production)

The app deploys to Vercel via GitHub integration:
- Push to `main` → auto-deploy
- `vercel.json` sets `maxDuration=800s` for cascade API routes
- Environment variables configured in Vercel dashboard
- Database: Neon PostgreSQL (pooled connection for long-running functions)
- Run `npx prisma migrate deploy` against production DB after schema changes

### Docker (Self-hosted)

```bash
npm run docker:up      # Start Postgres + PgBouncer + app
npm run docker:down    # Stop everything
npm run docker:build   # Rebuild app image
```

Multi-stage Dockerfile: non-root user, standalone output, health check built in.
