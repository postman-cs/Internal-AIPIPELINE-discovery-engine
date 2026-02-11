# Cascade Update System

## Overview

The cascade system ensures that when evidence changes, all downstream artifacts are regenerated through a proposal-based workflow. No artifact is ever silently overwritten.

## Flow

```
1. New evidence ingested
2. EvidenceSnapshot created (immutable, SHA-256 hashed)
3. Impact analysis marks affected phases DIRTY
4. RecomputeJob created with tasks per affected phase
5. AI agents generate proposals (JSON patches) per phase
6. User reviews proposals → Accept or Reject
7. Accept: new PhaseArtifact version created, downstream phases marked DIRTY
8. Reject: CLEAN_WITH_EXCEPTIONS, snapshotId added to ignored list
```

## Status Transitions

| From | Event | To |
|------|-------|----|
| CLEAN | New snapshot arrives | DIRTY |
| DIRTY | Agent generates proposal | NEEDS_REVIEW |
| NEEDS_REVIEW | User accepts | CLEAN (new version) |
| NEEDS_REVIEW | User rejects | CLEAN_WITH_EXCEPTIONS |
| CLEAN_WITH_EXCEPTIONS | New snapshot (different from ignored) | DIRTY |

## Rejection Handling

When a proposal is rejected:
- The snapshot ID is added to `ignoredSnapshotIds` on the artifact
- Future impact analysis will skip this phase for that specific snapshot
- A new snapshot with different evidence hash will re-trigger the phase

## Cascade Propagation Rules

| Phase Accepted | Phases Marked DIRTY |
|---------------|---------------------|
| DISCOVERY | All 9 downstream phases |
| CURRENT_TOPOLOGY | DESIRED_FUTURE_STATE, SOLUTION_DESIGN, and all downstream |
| SOLUTION_DESIGN | TEST_DESIGN, CRAFT_SOLUTION, and all downstream |
| DEPLOYMENT_PLAN | MONITORING, ITERATION |
| MONITORING | ITERATION |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/projects/[id]/cascade/recompute | Force recompute for dirty phases |
| GET | /api/projects/[id]/updates | Get cascade state (snapshots, proposals, jobs) |
| POST | /api/projects/[id]/proposals/[pid]/accept | Accept a proposal |
| POST | /api/projects/[id]/proposals/[pid]/reject | Reject a proposal |

## Graphile Worker Jobs

| Job | Trigger | Description |
|-----|---------|-------------|
| ingest.fetchSourceDeltas | Cron (daily 6am UTC) | Fetch new data from enabled sources |
| ingest.normalizePersist | After fetch | Normalize and persist with dedup |
| snapshot.createEvidenceSnapshot | After ingest | Create immutable snapshot |
| cascade.impactAnalysis | After snapshot | Mark phases DIRTY |
| cascade.generateProposals | After impact | Run agents, create proposals |
| monitor.evaluateSignals | Cron (every 6h) | Check monitoring signals |
| iteration.createNextActions | After monitor | Create iteration backlog |
