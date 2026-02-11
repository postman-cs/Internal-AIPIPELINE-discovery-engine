# Topology UI Guide

## Route

`/projects/[projectId]/topology`

## Tabs

### 1. Constellation (Skyrim-style)

Interactive force-directed graph using `react-force-graph-2d`.

**Visual features:**
- Dark starfield background with scattered star particles
- Node glow based on confidence (High = bright, Medium = moderate, Low = dim)
- Node size based on degree centrality (more connections = larger)
- Bright white center dot on each node ("star" aesthetic)
- Radial gradient halo around each node
- Faint edge lines with directional arrows

**Interactions:**
- **Search**: Filter nodes by name/ID
- **Filters**: By node type (checkboxes), by confidence threshold
- **Highlight modes**:
  - Dependencies: shows upstream/downstream of selected node
  - Auth Path: highlights AUTHENTICATES_WITH + ROUTES_THROUGH edges
  - Traffic Flow: highlights CALLS edges
- **Click node**: Opens right panel with metadata, evidence IDs, connections, action buttons
- **Click edge**: Opens right panel with edge type, from/to, evidence IDs
- **Hover node**: Tooltip with type, confidence, evidence count, connection count

### 2. Heatmap (Risk Analysis)

Deterministic risk/opportunity scoring per topology node.

**Scoring engine** (`lib/topology/riskScoring.ts`):
- Risk drivers: Auth complexity, dependency fan-in/out, SPOF, low confidence, observability gaps
- Opportunity drivers: Reusable APIs, standardization targets, high-centrality services, gateway consolidation
- Scores 0-100 with explainable driver arrays

**Views:**
- **Table view**: Sortable columns (node, type, risk, opportunity, confidence, drivers)
- **Matrix view**: Rows = node type, columns = risk buckets (0-20, 21-40, ..., 81-100)
- **Drill-down panel**: Score badges, driver list with evidence IDs, recommended next action

**Export:**
- "Copy Markdown" — formatted heatmap summary to clipboard
- "Download JSON" — full heatmap data as `heatmap.json`

### 3. Story Mode (Guided Walkthrough)

Demo-friendly narrative stepper for stakeholder presentations.

**Auto Outline** (deterministic, no LLM):
- Beat 1: "What we mapped" — scope + confidence summary
- Beat 2: "How traffic/auth flows" — auth path highlights
- Beat 3: "Top risks" — top 3 by risk score
- Beat 4: "Top opportunities" — top 3 by opportunity score
- Beat 5: "Recommended next move" — quick win + risk mitigation
- Beat 6: "What we need to confirm" — low-confidence areas

**AI Polish** (optional):
- "Polish Narrative (AI)" button calls storyPolisher agent
- Returns polished speaker notes + 2-3 minute talk track
- Evidence-cited, Zod-validated

**Presentation Mode:**
- Fullscreen view with minimal chrome
- Large text, dot navigation
- Beat highlights sync with constellation view

## API Endpoint

`GET /api/projects/[id]/topology`

Returns:
- Latest CURRENT_TOPOLOGY artifact (nodes, edges)
- Heatmap risk scores per node
- Coverage metrics (solution design, test, monitoring coverage per node)
