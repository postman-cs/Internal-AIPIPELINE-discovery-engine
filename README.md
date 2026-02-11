# AI Pipeline — Postman CSE Discovery Intelligence Engine

Retrieval-augmented, evidence-backed discovery intelligence system for Postman Customer Success Engineering.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Ingest Evidence                                                │
│  Kepler · DNS · Headers · GitHub · Call Transcripts · Manual    │
│  Manual Text & Images · Drag-and-Drop · Webhooks                │
└───────────────┬─────────────────────────────────────────────────┘
                │
                ▼
┌───────────────────────────┐    ┌──────────────────────────────┐
│  Chunker                  │───▶│  Embeddings                  │
│  800-1200 tokens, 200     │    │  text-embedding-3-large      │
│  overlap, sentence-aware  │    │  3072 dimensions             │
└───────────────────────────┘    └──────────┬───────────────────┘
                                            │
                                            ▼
                                 ┌──────────────────────────────┐
                                 │  Postgres + pgvector          │
                                 │  SourceDocument → Chunks      │
                                 │  EVIDENCE-1, EVIDENCE-2, ...  │
                                 └──────────┬───────────────────┘
                                            │
                ┌───────────────────────────┘
                ▼
┌───────────────────────────────────────────────────────────────┐
│  Deterministic AI Agent Pipeline (GPT-4.1 structured output)  │
│                                                               │
│  Discovery Agents:                                            │
│  1. ReconSynthesizer  → company snapshot + findings           │
│  2. SignalClassifier   → Primary Cloud, CDN, Auth, Backend    │
│  3. MaturityScorer     → API maturity 1-3 with justification  │
│  4. HypothesisGenerator → engagement strategy + stakeholders  │
│  5. BriefGenerator     → evidence-cited Discovery Brief       │
│                                                               │
│  Extended Pipeline Agents:                                    │
│  6. CurrentTopologyBuilder → node/edge graph from evidence    │
│  7. FutureStateDesigner    → desired topology delta           │
│  8. SolutionDesigner       → refactor actions mapped to graph │
│  9. TestDesigner           → test matrix per topology change  │
│  10. DeploymentPlanner     → rollout plan + CI/CD notes       │
│  11. MonitoringPlanner     → SLOs, alerts, monitoring hooks   │
│  12. IterationPlanner      → backlog from monitoring signals  │
│                                                               │
│  Every agent: retrieves evidence → calls OpenAI → Zod output  │
│  All runs audited in AIRun table (prompt hash, tokens, time)  │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
              ┌──────────────────────────────┐
              │  Versioned Phase Artifacts    │
              │  Cascade Engine (DAG)         │
              │  Patch Proposals (RFC6902)    │
              │  Accept/Reject → New Version  │
              └──────────────────────────────┘
```

### Phase DAG (Cascade Propagation)

```
DISCOVERY → CURRENT_TOPOLOGY → DESIRED_FUTURE_STATE → SOLUTION_DESIGN
    → TEST_DESIGN → CRAFT_SOLUTION → TEST_SOLUTION
    → DEPLOYMENT_PLAN → MONITORING → ITERATION
```

When new evidence is ingested or a proposal is accepted, downstream phases are automatically marked **DIRTY** and new proposals are generated for human review. No silent overwrites.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) + TypeScript |
| Database | PostgreSQL + pgvector |
| ORM | Prisma |
| Embeddings | OpenAI text-embedding-3-large (3072d) |
| LLM | GPT-4.1 (JSON structured output) |
| Validation | Zod (all agent I/O) |
| Auth | iron-session (cookie-based) |
| UI | TailwindCSS 4 + React Hook Form |
| Observability | OpenTelemetry + Prometheus + AIRun audit log |
| CI/CD | GitHub Actions + Docker + Docker Compose |

**No LangChain. No external vector DB. Code-driven deterministic agents.**

## Local Setup

### Prerequisites

- Node.js 18+
- Docker (for Postgres + pgvector)
- OpenAI API key

### 1. Start Postgres

```bash
docker compose up -d db
```

This starts Postgres 17 with pgvector pre-installed.

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and add your OpenAI API key + generate secrets
# See .env.example for instructions on generating SESSION_SECRET, CRON_SECRET, etc.
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

### Docker (Full Stack)

```bash
npm run docker:up      # Start Postgres + app
npm run docker:down    # Stop everything
npm run docker:build   # Rebuild app image
```

### Health Check

```bash
curl http://localhost:3000/api/health
```

## Workflow

1. **Create a Project** — the customer you're researching
2. **Ingest Evidence** — paste Kepler intelligence, DNS findings, HTTP headers, call transcripts, or drag-and-drop text files and images into the Discovery page
3. **Run AI Pipeline** — the agent pipeline retrieves relevant evidence chunks, synthesizes findings, scores maturity, generates hypothesis, and compiles the brief
4. **Review & Export** — view the evidence-cited Discovery Brief, copy markdown, download, or export JSON
5. **Topology View** — explore the generated infrastructure graph in Constellation mode, assess risk via Heatmap, or present findings in Story Mode
6. **Cascade Updates** — when new evidence arrives, review AI-generated patch proposals and accept/reject per phase

## Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/login` | Login |
| `/dashboard` | Project health scores, progress, recent activity |
| `/dashboard/ai-runs` | AI observability — all agent runs with token/timing details |
| `/ingest` | Source management + data ingest |
| `/projects` | Project list + create |
| `/projects/[id]` | Project overview with health score, notes, phase status |
| `/projects/[id]/discovery` | **AI Pipeline** — ingest evidence + run agents |
| `/projects/[id]/discovery/brief` | Read-only brief with copy/download/export |
| `/projects/[id]/topology` | Constellation graph, Heatmap, Story Mode |
| `/projects/[id]/updates` | Cascade update proposals — review, accept, reject |

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/health` | Health check (DB connectivity) |
| POST | `/api/seed` | Seed demo data (dev only) |
| POST | `/api/ingest/run` | Trigger ingestion pipeline |
| POST | `/api/cron/daily-ingest` | Scheduled daily ingest (bearer auth) |
| POST | `/api/webhooks/ingest` | External webhook for pushing evidence |
| POST | `/api/projects/[id]/cascade/recompute` | Force cascade recompute |
| GET | `/api/projects/[id]/updates` | Snapshots + dirty phases + proposals |
| POST | `/api/projects/[id]/proposals/[pid]/accept` | Accept a patch proposal |
| POST | `/api/projects/[id]/proposals/[pid]/reject` | Reject a patch proposal |
| GET | `/api/projects/[id]/topology` | Current topology artifact + heatmap |
| GET | `/api/metrics` | Prometheus metrics (token-protected in prod) |

## AI Agent Architecture

Each agent in `src/lib/ai/agents/`:

| Agent | Input | Output |
|-------|-------|--------|
| `reconSynthesizer` | Raw evidence | Company snapshot, technical findings |
| `signalClassifier` | Evidence + recon | Classified signals (cloud, CDN, auth, backend) |
| `maturityScorer` | Evidence + signals | Maturity level 1-3 + justification |
| `hypothesisGenerator` | All prior outputs | Hypothesis, approach, stakeholders, agenda |
| `briefGenerator` | All prior outputs | Final markdown + JSON brief |
| `currentTopologyBuilder` | Evidence + discovery | Node/edge infrastructure graph |
| `futureStateDesigner` | Topology + maturity | Desired future state delta |
| `solutionDesigner` | Current + future topology | Refactor actions mapped to graph |
| `testDesigner` | Solution design + graph | Test matrix per topology change |
| `deploymentPlanner` | Solution + tests | Rollout plan + CI/CD integration |
| `monitoringPlanner` | Deployment + risks | SLOs, alerts, monitoring hooks |
| `iterationPlanner` | Monitoring signals | Backlog items from drift + failures |
| `storyPolisher` | Topology + heatmap | Polished narrative for demo (optional) |

Every agent:
- Retrieves evidence via `lib/ai/retrieval.ts` (pgvector cosine similarity)
- Calls GPT-4.1 with `response_format: { type: "json_object" }`
- Validates output with Zod schemas — malformed/hallucinated data is rejected
- Cites evidence IDs on every non-trivial claim
- Logs to `AIRun` table (prompt hash, token usage, duration, status)

## Security

- **Session**: `iron-session` with encrypted cookies, 8-hour max age, `httpOnly`, `secure`, `sameSite: lax`
- **Headers**: CSP (no `unsafe-eval` in prod), HSTS, X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- **Rate Limiting**: In-memory sliding window on login, ingest, cron, and default routes
- **Input Validation**: Zod schemas on all server actions and API routes with size limits
- **IDOR Prevention**: All data queries scoped to authenticated user's owned projects
- **API Protection**: `/api/seed` blocked in prod, `/api/metrics` token-gated in prod, `/api/cron` requires `CRON_SECRET`, `/api/webhooks/ingest` requires `WEBHOOK_SECRET` (timing-safe comparison)
- **Error Sanitization**: Internal errors logged server-side, generic messages returned to clients

## Gamification & UX

- **Project Health Scores** — 0-100 composite of discovery completeness, evidence density, phase progress, and freshness
- **Progress Rings & Bars** — visual indicators on dashboard and project pages
- **Momentum Indicators** — trend arrows showing project velocity
- **Freshness Classification** — new / recent / aging / stale based on last activity
- **Command Palette** — `Cmd+K` / `Ctrl+K` for quick navigation
- **Toast Notifications** — global feedback system for all actions
- **Breadcrumbs** — auto-generated navigation context
- **Quick Notes** — per-project scratchpad
- **Pin Projects** — prioritize frequently accessed projects
- **Data Export** — download project data as JSON
- **Drag & Drop** — file and text upload with type/size validation

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Postgres connection string | Yes |
| `SESSION_SECRET` | 32+ char session encryption secret | Yes |
| `OPENAI_API_KEY` | OpenAI API key | Yes (for AI features) |
| `CRON_SECRET` | Bearer token for cron endpoint | Yes |
| `WEBHOOK_SECRET` | Bearer token for webhook ingest | No |
| `METRICS_TOKEN` | Bearer token for `/api/metrics` in prod | No |
| `SEED_TOKEN` | Bearer token for `/api/seed` in dev | No |
| `LOG_LEVEL` | Logging level: debug, info, warn, error | No (default: info/debug) |
| `NODE_ENV` | Environment: development, production, test | No |

See `.env.example` for generation instructions.

## CI/CD

### GitHub Actions

The CI pipeline (`.github/workflows/ci.yml`) runs on every push and PR:

1. **Lint** — ESLint
2. **Type Check** — `tsc --noEmit`
3. **Unit Tests** — Vitest (65 tests across 5 suites)
4. **Build** — Next.js production build
5. **Migration Check** — Prisma migration drift detection

### Docker

Multi-stage Dockerfile optimized for production:
- Non-root user (`nextjs`)
- Standalone output mode
- Health check built in
- `docker-compose.yml` for local dev with Postgres + pgvector

### npm Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Run Vitest |
| `npm run ci` | Full CI check (lint + typecheck + test + build) |
| `npm run db:migrate:deploy` | Apply migrations |
| `npm run db:migrate:reset` | Reset database |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:seed` | Seed demo data |
| `npm run docker:up` | Start Docker Compose stack |
| `npm run docker:down` | Stop Docker Compose stack |
| `npm run docker:build` | Build Docker image |
| `npm run health` | Check app health |

## Project Structure

```
src/
├── app/
│   ├── (authenticated)/
│   │   ├── dashboard/
│   │   │   ├── page.tsx              ← Project health dashboard
│   │   │   └── ai-runs/             ← AI observability table
│   │   ├── ingest/                   ← Source management
│   │   └── projects/
│   │       ├── page.tsx              ← Project list + create
│   │       └── [projectId]/
│   │           ├── page.tsx          ← Project overview + health
│   │           ├── QuickNotes.tsx    ← Per-project notes
│   │           ├── ProjectActions.tsx ← Pin, export actions
│   │           ├── discovery/
│   │           │   ├── AIPipelinePanel.tsx  ← AI controls + DnD ingest
│   │           │   ├── DiscoveryForm.tsx    ← Manual form
│   │           │   └── brief/              ← Brief viewer
│   │           ├── topology/
│   │           │   └── page.tsx      ← Constellation + Heatmap + Story
│   │           └── updates/
│   │               └── page.tsx      ← Cascade proposals
│   ├── api/
│   │   ├── health/                   ← Health check
│   │   ├── webhooks/ingest/          ← External webhook
│   │   ├── cron/daily-ingest/        ← Scheduled ingest
│   │   ├── ingest/run/               ← Trigger ingest
│   │   ├── metrics/                  ← Prometheus metrics
│   │   ├── seed/                     ← Demo data seeder
│   │   └── projects/[id]/            ← Cascade, proposals, topology
│   └── login/
├── components/
│   ├── Toast.tsx                     ← Global notification system
│   ├── CommandPalette.tsx            ← Cmd+K navigation
│   ├── Breadcrumbs.tsx               ← Auto breadcrumb nav
│   ├── ProgressRing.tsx              ← Health score ring + phase bars
│   ├── DragDropZone.tsx              ← File/text upload zone
│   ├── SkeletonLoader.tsx            ← Loading placeholders
│   ├── TopNav.tsx                    ← Navigation header
│   └── ProjectSidebar.tsx            ← Project navigation sidebar
├── lib/
│   ├── ai/
│   │   ├── agents/                   ← All AI agent modules
│   │   ├── orchestrator.ts           ← Sequential pipeline runner
│   │   ├── retrieval.ts              ← pgvector similarity search
│   │   ├── ingest.ts                 ← Chunk + embed + store
│   │   ├── chunker.ts                ← Sentence-aware text chunker
│   │   └── openai.ts                 ← OpenAI client + helpers
│   ├── actions/                      ← Server actions (authed, validated)
│   ├── cascade/                      ← Cascade engine + proposals
│   ├── gamification/scoring.ts       ← Health score computation
│   ├── topology/                     ← Risk scoring engine
│   ├── story/                        ← Story outline generator
│   ├── logger.ts                     ← Structured JSON logger
│   ├── env-validation.ts             ← Startup env var validation
│   ├── feature-flags.ts              ← Code-driven feature flags
│   ├── session.ts                    ← Session management
│   ├── session-config.ts             ← Edge-safe session config
│   ├── rbac.ts                       ← Role-based access control
│   ├── schemas.ts                    ← Shared Zod schemas
│   └── prisma.ts                     ← Prisma client
├── middleware.ts                     ← Auth, rate limiting, security headers
└── __tests__/                        ← Unit tests (Vitest)
prisma/
├── schema.prisma                     ← Database schema
└── migrations/                       ← Migration history
.github/workflows/ci.yml             ← CI pipeline
Dockerfile                            ← Production Docker image
docker-compose.yml                    ← Local dev environment
```
