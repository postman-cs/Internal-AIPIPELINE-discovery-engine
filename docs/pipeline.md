# AI Pipeline — Phase Architecture

## Phase DAG

```
DISCOVERY → CURRENT_TOPOLOGY → DESIRED_FUTURE_STATE → SOLUTION_DESIGN → TEST_DESIGN → CRAFT_SOLUTION → TEST_SOLUTION → DEPLOYMENT_PLAN → MONITORING → ITERATION
```

Each phase is a node in a DAG. Downstream phases depend on upstream phases. When an upstream phase changes (new artifact accepted), all downstream phases become DIRTY.

## Phases

| # | Phase | Agent | Input Dependencies | Output |
|---|-------|-------|-------------------|--------|
| 0 | DISCOVERY | 5-agent pipeline | Evidence only | Company snapshot, signals, maturity, hypothesis, brief |
| 1 | CURRENT_TOPOLOGY | topologySynthesizer | Discovery | Nodes + edges graph with evidence citations |
| 2 | DESIRED_FUTURE_STATE | futureStatePlanner | Discovery, Current Topology | Target nodes/edges, delta summary, patterns |
| 3 | SOLUTION_DESIGN | solutionDesigner | Current + Future Topology | Refactor actions, rollout phases, risks |
| 4 | TEST_DESIGN | testDesigner | Solution Design | Test cases with steps, types, expected results |
| 5 | CRAFT_SOLUTION | craftSolution | Solution + Test Design + Topology | Implementation plan, migration steps, CI/CD notes |
| 6 | TEST_SOLUTION | testSolution | Craft Solution + Test Design | Execution sequence, rollback triggers, monitoring hooks |
| 7 | DEPLOYMENT_PLAN | deploymentPlanner | Test Solution + Craft Solution + Topology + Discovery | Deployment steps, change management, training, go-live criteria |
| 8 | MONITORING | monitoringPlanner | Deployment + Solution + Topology + Test Design | Monitors, SLOs, alerts, dashboard, renewal signals |
| 9 | ITERATION | iterationPlanner | Monitoring + Discovery + Topology | Backlog items, priority matrix, drift analysis |

## Agent Rules

1. All outputs are strict JSON validated by Zod
2. Every non-trivial claim must cite evidenceIds
3. Confidence field on every claim (High / Medium / Low)
4. No hallucinated evidence IDs — validated against DB
5. Low temperature (0.1) for deterministic output
6. All calls logged to AIRun table with prompt hash, tokens, duration

## Evidence Flow

```
Source Documents → Chunking (800-1200 tokens) → Embedding (text-embedding-3-large, 3072d)
→ DocumentChunk (pgvector) → Retrieval (cosine similarity) → Agent prompts
```

## Idempotent Ingestion

- Content hash (SHA-256) computed for every document
- Unique constraint on (projectId, contentHash)
- Same content ingested twice → skip silently
- External ID tracking for source-specific dedup
