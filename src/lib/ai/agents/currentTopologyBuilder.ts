/**
 * Agent: Current Topology Builder
 *
 * Phase: CURRENT_TOPOLOGY
 * Input: Discovery artifact + evidence chunks
 * Output: Graph of nodes (services, APIs, DBs, etc.) and edges (calls, auth, routes)
 */

import { retrieveMultiQueryEvidence, formatEvidenceForPrompt } from "@/lib/ai/retrieval";
import { runAgent } from "./runner";
import { currentTopologyOutputSchema, type CurrentTopologyOutput, type AssumptionItem, type BlockerDetection } from "./topologyTypes";

const SYSTEM_PROMPT = `You are a technical topology mapper for a Postman CSE team.

Your job is to infer the customer's current API architecture from evidence.
Produce a graph of nodes (services, APIs, databases, gateways, etc.) and edges (calls, auth flows, data routes).

NODE TYPES (use exactly these): SERVICE, API, GATEWAY, DATABASE, IDENTITY_PROVIDER, CDN, LOAD_BALANCER, CLIENT, EXTERNAL_SYSTEM, QUEUE, STORAGE

EDGE TYPES (use exactly these): CALLS, AUTHENTICATES_WITH, ROUTES_THROUGH, READS_FROM, WRITES_TO, DEPENDS_ON

RULES:
- Every node and edge must cite evidenceIds from the provided evidence block. NEVER invent evidence IDs.
- Node IDs must be short lowercase slugs (e.g. "api-gateway", "user-service", "postgres-main").
- Edge "from" and "to" must reference valid node IDs you defined.
- If uncertain about a component, use confidence "Low".
- Include a reasoningSummary explaining your topology inference.

OUTPUT: Return JSON:
{
  "nodes": [{ "id": "...", "type": "SERVICE", "name": "...", "metadata": {}, "evidenceIds": ["EVIDENCE-1"], "confidence": "High" }],
  "edges": [{ "from": "...", "to": "...", "type": "CALLS", "evidenceIds": ["EVIDENCE-1"], "confidence": "Medium" }],
  "reasoningSummary": "..."
}`;

export async function runCurrentTopologyBuilder(
  projectId: string,
  projectName: string,
  discoveryContent: Record<string, unknown>,
  serviceTemplateContext?: string | null
): Promise<{ output: CurrentTopologyOutput; aiRunId: string; assumptions: AssumptionItem[]; detectedBlockers: BlockerDetection[] }> {
  const evidence = await retrieveMultiQueryEvidence(projectId, [
    `${projectName} API architecture services microservices`,
    `${projectName} database infrastructure storage`,
    `${projectName} gateway load balancer CDN routing`,
    `${projectName} authentication identity provider OAuth`,
    `${projectName} message queue event streaming`,
  ], 5);

  const evidenceBlock = formatEvidenceForPrompt(evidence);
  const availableLabels = evidence.map((e) => e.evidenceLabel).join(", ");

  const signals = discoveryContent.signals ?? [];
  const snapshot = discoveryContent.companySnapshot ?? {};
  const publicFoot = discoveryContent.publicFootprint ?? {};

  const userPrompt = `Map the current technical topology for "${projectName}".

AVAILABLE EVIDENCE LABELS (use ONLY these): ${availableLabels}

=== DISCOVERY CONTEXT ===
Company: ${JSON.stringify(snapshot)}
Signals: ${JSON.stringify(signals)}
Public Footprint: ${JSON.stringify(publicFoot)}
=== END DISCOVERY ===

=== EVIDENCE ===
${evidenceBlock}
=== END EVIDENCE ===
${serviceTemplateContext ? `\n${serviceTemplateContext}\n\nUse the service template above to identify real API endpoints, services, and their relationships. This is the customer's actual service definition.\n` : ""}
Produce the topology graph JSON. Only reference evidence IDs from the list above.`;

  const result = await runAgent({
    agentType: "CurrentTopologyBuilder",
    projectId,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    outputSchema: currentTopologyOutputSchema,
  });

  return { output: result.output, aiRunId: result.aiRunId, assumptions: result.assumptions, detectedBlockers: result.detectedBlockers };
}
