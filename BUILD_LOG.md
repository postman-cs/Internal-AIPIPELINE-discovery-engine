# Build Log: Internal-AIPIPELINE-discovery-engine

## Context
- AE / CSE: Daniel Shively (CSE)
- Customer technical lead: Internal tooling — no external customer
- Sprint dates: Ongoing

## Hypothesis
- If we build an AI-driven discovery intelligence engine, we will prove that RAG + multi-agent pipelines can automate and standardize CSE customer discovery, reducing time-to-brief and improving evidence quality.

## Success Criteria
- 12-agent LLM pipeline produces accurate, evidence-cited discovery briefs from ingested customer data
- Cascade system generates versioned phase artifacts (topology, solution, infrastructure, tests) with human-reviewable proposals
- Embedding-backed retrieval (Voyage/pgvector) returns relevant evidence chunks for each agent phase

## Environment Baseline
- SCM: GitHub (shivemind/AI_pipeline, danielshively-source/AI_pipeline, postman-cs)
- CI/CD: Vercel (auto-deploy on push to main)
- Gateway: N/A
- Cloud: Vercel (frontend + serverless), PostgreSQL + pgvector (database)
- Dev Portal: N/A
- Current Postman usage: Webhook ingest endpoints for architecture data, Postman collection integration via cascade agents
- v11/v12: N/A (internal tool)

## What We Built
- Next.js 15 web application with React 19 and Tailwind CSS
- 12-agent LLM pipeline (discovery: recon, signals, maturity, hypothesis, brief; extended: topology, future state, solution, infrastructure, tests, craft, deployment)
- RAG system with Voyage embeddings (512d) stored in PostgreSQL/pgvector via Prisma
- Cascade engine with topological phase DAG, RFC6902-style proposals (accept/reject), and version tracking
- Multi-source document ingest (Kepler intel, DNS, manual paste, Gmail, OpenAPI/service templates, webhooks)
- Iron-session auth, rate limiting, security headers, audit logging
- Gmail OAuth integration for email evidence ingest
- Gamification/XP engine for engagement milestones

## Value Unlocked
- Automated customer discovery brief generation from raw evidence
- Standardized, auditable phase artifacts across all CSE engagements
- Human-in-the-loop proposal review prevents AI hallucination from reaching deliverables

## Reusable Pattern
- Multi-agent LLM orchestration with topological phase DAG and proposal-based artifact generation
- RAG ingest pipeline (chunk → embed → store → retrieve with evidence labels)
- Cascade recompute engine (dirty-flag propagation across phase dependencies)

## Product Gaps / Risks
- LLM latency on complex agents (timeout increased to 300s)
- Embedding model dependency on Voyage API availability
- No built-in backup/restore for cascade state
- Single-tenant auth model (iron-session cookies)

## Next Step
- Continue iterating on cascade phases and agent quality
- Explore Postman API integration for automated collection/environment generation from cascade output
