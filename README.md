# AI Pipeline — Postman CSE Discovery Intelligence Engine

Retrieval-augmented, evidence-backed discovery intelligence system for Postman Customer Success Engineering.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Ingest Evidence                                                │
│  Kepler · DNS · Headers · GitHub · Call Transcripts · Manual    │
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
│  5-Agent Deterministic Pipeline (GPT-4.1 structured output)   │
│                                                               │
│  1. ReconSynthesizer  → company snapshot + findings           │
│  2. SignalClassifier   → Primary Cloud, CDN, Auth, Backend    │
│  3. MaturityScorer     → API maturity 1-3 with justification  │
│  4. HypothesisGenerator → engagement strategy + stakeholders  │
│  5. BriefGenerator     → evidence-cited Discovery Brief       │
│                                                               │
│  Every agent: retrieves evidence → calls OpenAI → Zod output  │
│  All runs audited in AIRun table (prompt hash, tokens, time)  │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
              ┌──────────────────────────────┐
              │  Versioned Discovery Artifact │
              │  Markdown + JSON + Citations  │
              │  Copy · Download · Export     │
              └──────────────────────────────┘
```

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

**No LangChain. No external vector DB. Code-driven deterministic agents.**

## Local Setup

### Prerequisites

- Node.js 18+
- Docker (for Postgres + pgvector)
- OpenAI API key

### 1. Start Postgres

```bash
docker compose up -d
```

This starts Postgres 17 with pgvector pre-installed.

### 2. Configure environment

```bash
# .env is pre-configured for local Docker.
# Add your OpenAI API key:
echo 'OPENAI_API_KEY="sk-your-key-here"' >> .env
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
2. **Ingest Evidence** — paste Kepler intelligence, DNS findings, HTTP header analysis, call transcripts, or any other raw text into the Discovery page
3. **Run AI Pipeline** — the 5-agent pipeline retrieves relevant evidence chunks, synthesizes findings, scores maturity, generates hypothesis, and compiles the brief
4. **Review & Export** — view the evidence-cited Discovery Brief, copy markdown, download, or export JSON

## Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/login` | Login |
| `/dashboard` | Recent projects + ingest status |
| `/ingest` | Source management + data ingest |
| `/projects` | Project list + create |
| `/projects/[id]` | Project overview |
| `/projects/[id]/discovery` | **AI Pipeline** — ingest evidence + run agents |
| `/projects/[id]/discovery/brief` | Read-only brief with copy/download/export |

## AI Agent Architecture

Each agent in `src/lib/ai/agents/`:

| Agent | Input | Output |
|-------|-------|--------|
| `reconSynthesizer` | Raw evidence | Company snapshot, technical findings |
| `signalClassifier` | Evidence + recon | Classified signals (cloud, CDN, auth, backend) |
| `maturityScorer` | Evidence + signals | Maturity level 1-3 + justification |
| `hypothesisGenerator` | All prior outputs | Hypothesis, approach, stakeholders, agenda |
| `briefGenerator` | All prior outputs | Final markdown + JSON brief |

Every agent:
- Retrieves evidence via `lib/ai/retrieval.ts` (pgvector cosine similarity)
- Calls GPT-4.1 with `response_format: { type: "json_object" }`
- Validates output with Zod schemas
- Logs to `AIRun` table (prompt hash, token usage, duration)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Postgres connection string | `postgresql://pipeline:pipeline@localhost:5432/ai_pipeline` |
| `OPENAI_API_KEY` | OpenAI API key | (required) |
| `SESSION_SECRET` | 32+ char session secret | (dev default) |
| `CRON_SECRET` | Cron endpoint auth | `dev-cron-secret` |

## Project Structure

```
src/
├── app/
│   ├── (authenticated)/
│   │   ├── dashboard/
│   │   ├── ingest/
│   │   └── projects/
│   │       └── [projectId]/
│   │           └── discovery/
│   │               ├── AIPipelinePanel.tsx   ← AI controls
│   │               ├── DiscoveryForm.tsx     ← Manual form
│   │               └── brief/
│   ├── api/
│   │   ├── cron/daily-ingest/
│   │   └── seed/
│   └── login/
├── lib/
│   ├── ai/
│   │   ├── agents/
│   │   │   ├── types.ts              ← Zod schemas for all agents
│   │   │   ├── runner.ts             ← Shared agent execution + audit
│   │   │   ├── reconSynthesizer.ts
│   │   │   ├── signalClassifier.ts
│   │   │   ├── maturityScorer.ts
│   │   │   ├── hypothesisGenerator.ts
│   │   │   └── briefGenerator.ts
│   │   ├── orchestrator.ts           ← Sequential pipeline runner
│   │   ├── retrieval.ts              ← pgvector similarity search
│   │   ├── ingest.ts                 ← Chunk + embed + store
│   │   ├── chunker.ts                ← Sentence-aware text chunker
│   │   └── openai.ts                 ← OpenAI client + helpers
│   ├── actions/                       ← Server actions
│   ├── prisma.ts
│   ├── session.ts
│   └── schemas.ts
└── middleware.ts
```
