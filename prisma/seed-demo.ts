import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

const DEMO_PROJECT_ID = "seed-demo-fullproject";

// Helper to create a deterministic cuid-like ID
function id(prefix: string): string {
  return `demo-${prefix}`;
}

async function main() {
  console.log("🚀 Seeding comprehensive demo project...\n");

  // ─── 1. User ───────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("pipeline123", 10);
  const user = await prisma.user.upsert({
    where: { email: "cse@postman.com" },
    update: { name: "CSE Demo User", role: "CSE" },
    create: {
      email: "cse@postman.com",
      name: "CSE Demo User",
      passwordHash,
      role: "CSE",
    },
  });
  console.log(`✓ User: ${user.email} (${user.id})`);

  // ─── 2. Clean up old demo data ────────────────────────────────────
  // Delete admiral notes/tasks tied to this project (cascades via project, but clean explicit)
  await prisma.admiralTask.deleteMany({ where: { projectId: DEMO_PROJECT_ID } });
  await prisma.admiralNote.deleteMany({ where: { projectId: DEMO_PROJECT_ID } });
  // Delete project (cascades most relations)
  await prisma.project.deleteMany({ where: { id: DEMO_PROJECT_ID } });
  // Clean up orphaned demo ingest data (not project-cascaded)
  await prisma.$executeRawUnsafe(`DELETE FROM "IngestItem" WHERE "ingestRunId" LIKE 'demo-%'`);
  await prisma.$executeRawUnsafe(`DELETE FROM "IngestRun" WHERE id LIKE 'demo-%'`);
  console.log("✓ Cleaned old demo data");

  // ─── 3. Project ────────────────────────────────────────────────────
  const project = await prisma.project.create({
    data: {
      id: DEMO_PROJECT_ID,
      name: "GlobalBank Financial Services",
      primaryDomain: "globalbank.com",
      apiDomain: "api.globalbank.com",
      publicWorkspaceUrl: "https://www.postman.com/globalbank/workspace/globalbank-public-apis",
      customerContactName: "Marcus Johnson (API Platform Lead)",
      customerContactEmail: "marcus.j@globalbank.com",
      ownerUserId: user.id,
      isPinned: true,
      engagementStage: 5, // POV In Progress
      gitProvider: "github",
      gitRepoOwner: "postman-cs",
      gitRepoName: "globalbank-onboarding",
      gitBaseBranch: "main",
      lastRepoPushAt: new Date(Date.now() - 2 * 86400_000),
      lastRepoPrUrl: "https://github.com/postman-cs/globalbank-onboarding/pull/1",
      lastRepoPrNumber: 1,
      postmanWorkspaceId: "ws-demo-globalbank-12345",
      serviceTemplateContent: `openapi: "3.0.3"
info:
  title: GlobalBank Payments API
  version: 2.1.0
  description: Payment processing and transaction management for GlobalBank Financial Services
  contact:
    name: API Platform Team
    email: api-platform@globalbank.com
servers:
  - url: https://api.globalbank.com/v2
    description: Production
  - url: https://api-staging.globalbank.com/v2
    description: Staging
  - url: https://api-dev.globalbank.com/v2
    description: Development
security:
  - OAuth2: [payments.read, payments.write]
  - ApiKey: []
paths:
  /payments:
    get:
      operationId: listPayments
      summary: List payments
      tags: [Payments]
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [pending, processing, completed, failed]
        - name: limit
          in: query
          schema: { type: integer, default: 20, maximum: 100 }
      responses:
        "200":
          description: Paginated list of payments
          content:
            application/json:
              schema:
                type: object
                properties:
                  data: { type: array, items: { $ref: "#/components/schemas/Payment" } }
                  pagination: { $ref: "#/components/schemas/Pagination" }
    post:
      operationId: createPayment
      summary: Initiate a new payment
      tags: [Payments]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/CreatePaymentRequest" }
      responses:
        "201":
          description: Payment created
          content:
            application/json:
              schema: { $ref: "#/components/schemas/Payment" }
  /payments/{paymentId}:
    get:
      operationId: getPayment
      summary: Get payment details
      tags: [Payments]
      parameters:
        - name: paymentId
          in: path
          required: true
          schema: { type: string, format: uuid }
      responses:
        "200":
          description: Payment details
          content:
            application/json:
              schema: { $ref: "#/components/schemas/Payment" }
  /payments/{paymentId}/status:
    patch:
      operationId: updatePaymentStatus
      summary: Update payment status
      tags: [Payments]
      parameters:
        - name: paymentId
          in: path
          required: true
          schema: { type: string, format: uuid }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                status: { type: string, enum: [processing, completed, failed] }
                reason: { type: string }
      responses:
        "200":
          description: Status updated
  /accounts/{accountId}/balance:
    get:
      operationId: getAccountBalance
      summary: Get account balance
      tags: [Accounts]
      parameters:
        - name: accountId
          in: path
          required: true
          schema: { type: string }
      responses:
        "200":
          description: Account balance
          content:
            application/json:
              schema: { $ref: "#/components/schemas/AccountBalance" }
  /transfers:
    post:
      operationId: initiateTransfer
      summary: Initiate wire transfer
      tags: [Transfers]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/TransferRequest" }
      responses:
        "202":
          description: Transfer accepted for processing
components:
  schemas:
    Payment:
      type: object
      properties:
        id: { type: string, format: uuid }
        amount: { type: number, format: double }
        currency: { type: string, pattern: "^[A-Z]{3}$" }
        status: { type: string, enum: [pending, processing, completed, failed] }
        fromAccount: { type: string }
        toAccount: { type: string }
        createdAt: { type: string, format: date-time }
    CreatePaymentRequest:
      type: object
      required: [amount, currency, fromAccount, toAccount]
      properties:
        amount: { type: number, minimum: 0.01 }
        currency: { type: string }
        fromAccount: { type: string }
        toAccount: { type: string }
        memo: { type: string, maxLength: 256 }
    AccountBalance:
      type: object
      properties:
        accountId: { type: string }
        available: { type: number }
        pending: { type: number }
        currency: { type: string }
    TransferRequest:
      type: object
      required: [amount, currency, sourceAccount, destinationAccount, network]
      properties:
        amount: { type: number }
        currency: { type: string }
        sourceAccount: { type: string }
        destinationAccount: { type: string }
        network: { type: string, enum: [SWIFT, ACH, FEDWIRE] }
    Pagination:
      type: object
      properties:
        total: { type: integer }
        page: { type: integer }
        perPage: { type: integer }
  securitySchemes:
    OAuth2:
      type: oauth2
      flows:
        clientCredentials:
          tokenUrl: https://auth.globalbank.com/oauth/token
          scopes:
            payments.read: Read payment data
            payments.write: Create and modify payments
    ApiKey:
      type: apiKey
      in: header
      name: X-API-Key`,
      serviceTemplateType: "openapi",
      serviceTemplateFileName: "globalbank-payments-api-v2.yaml",
      serviceTemplateNotes: "Obtained from Marcus Johnson during Call 1. Covers Payments, Accounts, and Transfers services. Auth via OAuth2 client credentials or API key.",
      governanceRulesJson: {
        requiredHeaders: ["X-Request-ID", "X-Correlation-ID"],
        maxResponseTimeMs: 500,
        requiredAuthSchemes: ["OAuth2", "API-Key"],
        testCoverageMinimum: 80,
        securityScanRequired: true,
      },
    },
  });
  console.log(`✓ Project: ${project.name} (engagement stage 5, service template loaded)`);

  // ─── 4. IngestSourceConfig ─────────────────────────────────────────
  const sources = ["KEPLER", "DNS", "MANUAL", "GITHUB"];
  for (const source of sources) {
    await prisma.ingestSourceConfig.upsert({
      where: { userId_source: { userId: user.id, source } },
      update: {
        lastSyncAt: new Date(Date.now() - 3600_000),
        lastSyncStatus: "SUCCESS",
        lastSyncItemCount: Math.floor(Math.random() * 20) + 5,
      },
      create: {
        userId: user.id,
        source,
        enabled: true,
        lastSyncAt: new Date(Date.now() - 3600_000),
        lastSyncStatus: "SUCCESS",
        lastSyncItemCount: Math.floor(Math.random() * 20) + 5,
      },
    });
  }
  console.log("✓ IngestSourceConfig (4 sources)");

  // ─── 5. IngestRun + IngestItems ────────────────────────────────────
  const ingestRun = await prisma.ingestRun.create({
    data: {
      id: id("ingest-run-1"),
      userId: user.id,
      status: "SUCCESS",
      trigger: "MANUAL",
      startedAt: new Date(Date.now() - 7200_000),
      finishedAt: new Date(Date.now() - 7100_000),
      summary: "Full ingest: 18 items from 4 sources",
      countsJson: JSON.stringify({ KEPLER: 6, DNS: 4, MANUAL: 5, GITHUB: 3 }),
    },
  });

  const ingestItemData = [
    { source: "KEPLER", title: "GlobalBank Kepler account overview", rawText: "GlobalBank Financial Services — Fortune 500 financial institution with 40,000+ employees..." },
    { source: "KEPLER", title: "GlobalBank technology stack notes", rawText: "Primary cloud: AWS (confirmed via CloudFront headers). Secondary: Azure for identity..." },
    { source: "KEPLER", title: "GlobalBank API platform initiative", rawText: "Customer is evaluating API management platforms. Currently using Kong Gateway..." },
    { source: "KEPLER", title: "GlobalBank developer portal findings", rawText: "Developer portal at developer.globalbank.com running on Backstage. 120+ internal APIs cataloged..." },
    { source: "KEPLER", title: "GlobalBank compliance requirements", rawText: "PCI-DSS Level 1 compliant. SOX requirements for API audit trails..." },
    { source: "KEPLER", title: "GlobalBank engineering org structure", rawText: "VP Engineering: Sarah Chen. 8 platform teams, 25 product teams. Using GitHub Enterprise..." },
    { source: "DNS", title: "globalbank.com DNS analysis", rawText: "A records point to CloudFront. MX: Google Workspace. SPF includes amazonses.com..." },
    { source: "DNS", title: "api.globalbank.com DNS analysis", rawText: "CNAME to Kong Gateway cluster. TLS 1.3. Certificate issued by DigiCert..." },
    { source: "DNS", title: "developer.globalbank.com analysis", rawText: "Points to Backstage instance on EKS. HSTS enabled. CSP headers present..." },
    { source: "DNS", title: "auth.globalbank.com analysis", rawText: "Okta-hosted identity provider. SAML and OIDC endpoints detected..." },
    { source: "MANUAL", title: "Meeting notes: Initial discovery call", rawText: "Met with VP Eng Sarah Chen and API Platform lead Marcus Johnson. Key pain points: inconsistent API testing across teams, no centralized contract testing, Newman adoption at 15%..." },
    { source: "MANUAL", title: "Meeting notes: Security team review", rawText: "Security team lead (James Wright) concerned about API key management. Currently using HashiCorp Vault. Need to demonstrate Postman's secret management capabilities..." },
    { source: "MANUAL", title: "Meeting notes: Developer experience feedback", rawText: "Surveyed 12 developers. Top complaints: slow feedback loops, manual regression testing, no mock servers for dependent services..." },
    { source: "MANUAL", title: "Competitive analysis notes", rawText: "Currently evaluating: Postman, Insomnia, Swagger/OpenAPI tools, custom curl scripts. Budget approved for enterprise tooling Q2..." },
    { source: "MANUAL", title: "ROI calculation draft", rawText: "Estimated 40% reduction in API testing time. 200 developers × 3hrs/week = 600hrs saved weekly. At $75/hr = $45K/week savings..." },
    { source: "GITHUB", title: "api-platform repo analysis", rawText: "Monorepo with 47 microservices. CI/CD: GitHub Actions. Test coverage averaging 62%. Newman used in 8 of 47 pipelines..." },
    { source: "GITHUB", title: "postman-collections repo", rawText: "Shared collections repo with 23 collections. Last updated 3 weeks ago. No environment management. Manual exports..." },
    { source: "GITHUB", title: ".github/workflows analysis", rawText: "12 workflow files. 3 use Newman. Rest use Jest/Mocha for API tests. No contract testing. Average CI time: 8 minutes..." },
  ];

  for (const item of ingestItemData) {
    await prisma.ingestItem.create({
      data: {
        ingestRunId: ingestRun.id,
        source: item.source,
        title: item.title,
        rawText: item.rawText,
        timestamp: new Date(Date.now() - Math.random() * 86400_000 * 7),
        consumedAt: new Date(),
      },
    });
  }
  console.log(`✓ IngestRun + ${ingestItemData.length} IngestItems`);

  // ─── 6. SourceDocuments + DocumentChunks ───────────────────────────
  const sourceDocIds: string[] = [];
  const chunkIds: string[] = [];
  const chunksBySource: Record<string, number> = {};

  for (let i = 0; i < ingestItemData.length; i++) {
    const item = ingestItemData[i];
    const docId = id(`doc-${i}`);
    const contentHash = crypto.createHash("sha256").update(item.rawText).digest("hex");

    await prisma.sourceDocument.create({
      data: {
        id: docId,
        projectId: project.id,
        sourceType: item.source,
        title: item.title,
        rawText: item.rawText,
        contentHash,
        metadataJson: { originalSource: item.source, ingestRunId: ingestRun.id },
      },
    });
    sourceDocIds.push(docId);

    // Create 1-2 chunks per document using raw SQL for vector column
    const numChunks = Math.random() > 0.5 ? 2 : 1;
    for (let c = 0; c < numChunks; c++) {
      const chunkId = id(`chunk-${i}-${c}`);
      const evidenceLabel = `EVIDENCE-${chunkIds.length + 1}`;
      const content = c === 0 ? item.rawText : item.rawText.substring(0, Math.floor(item.rawText.length / 2));

      // Generate a deterministic pseudo-random vector (3072 dimensions)
      const seed = crypto.createHash("md5").update(chunkId).digest();
      const vectorValues = Array.from({ length: 3072 }, (_, idx) => {
        const byte = seed[idx % seed.length];
        return ((byte / 255) * 2 - 1).toFixed(6);
      });
      const vectorStr = `[${vectorValues.join(",")}]`;

      await prisma.$executeRawUnsafe(
        `INSERT INTO "DocumentChunk" (id, "documentId", "projectId", content, embedding, "tokenCount", "evidenceLabel", "createdAt")
         VALUES ($1, $2, $3, $4, $5::vector, $6, $7, NOW())`,
        chunkId,
        docId,
        project.id,
        content,
        vectorStr,
        Math.floor(content.length / 4),
        evidenceLabel
      );

      chunkIds.push(chunkId);
      chunksBySource[item.source] = (chunksBySource[item.source] || 0) + 1;
    }
  }
  console.log(`✓ ${sourceDocIds.length} SourceDocuments + ${chunkIds.length} DocumentChunks`);

  // ─── 7. EvidenceSnapshot ───────────────────────────────────────────
  const snapshotHash = crypto.createHash("sha256").update(JSON.stringify(chunkIds.sort())).digest("hex");
  const snapshot = await prisma.evidenceSnapshot.create({
    data: {
      id: id("snapshot-1"),
      projectId: project.id,
      chunkIdsJson: chunkIds,
      countsJson: { bySource: chunksBySource, total: chunkIds.length },
      hash: snapshotHash,
    },
  });
  console.log("✓ EvidenceSnapshot");

  // ─── 8. DiscoveryArtifact ──────────────────────────────────────────
  await prisma.discoveryArtifact.create({
    data: {
      id: id("discovery-1"),
      projectId: project.id,
      version: 1,
      keplerPaste: "GlobalBank Financial Services — Fortune 500 financial institution. 40,000+ employees, $50B+ revenue. Headquartered in New York. Major digital transformation initiative underway. VP Engineering Sarah Chen leading API platform modernization.",
      dnsFindings: "Primary domain (globalbank.com) behind CloudFront CDN. API gateway (api.globalbank.com) running Kong. Auth (auth.globalbank.com) on Okta. Developer portal (developer.globalbank.com) on Backstage/EKS. All domains have HSTS, TLS 1.3, proper CSP headers.",
      headerFindings: "X-Powered-By: Kong/3.4. Server: CloudFront. Strict-Transport-Security present. Content-Security-Policy configured. X-Request-ID headers indicate distributed tracing capability. Rate limiting headers present on API endpoints.",
      publicFootprint: "Public API documentation at developer.globalbank.com with 120+ APIs. OpenBanking compliance APIs published. Partner API program with 45 external consumers. Public Postman workspace with 12 collections (stale, last updated 3 months ago).",
      authForensics: "Okta as primary IdP. OAuth 2.0 with PKCE for public clients. API keys + OAuth2 for server-to-server. SAML federation for enterprise SSO. HashiCorp Vault for secret management. JWT tokens with 15-min expiry.",
      cloudGatewaySignals: "AWS primary cloud (CloudFront, EKS, RDS, S3, SQS). Azure AD for identity federation. Kong Gateway for API management. Datadog for observability. PagerDuty for alerting.",
      developerFrictionSignals: "Manual regression testing across 47 microservices. Newman adoption at 15% (8/47 pipelines). No contract testing. Average CI time 8 minutes. No mock servers for dependent services. Developers spending ~3hrs/week on manual API testing.",
      evidenceLinksJson: JSON.stringify([
        { label: "Developer Portal", url: "https://developer.globalbank.com" },
        { label: "Public API Docs", url: "https://developer.globalbank.com/docs" },
        { label: "GitHub Org", url: "https://github.com/globalbank" },
      ]),
      industry: "Financial Services",
      engineeringSize: "500+ engineers across 33 teams",
      publicApiPresence: "Yes",
      technicalLandscapeJson: JSON.stringify([
        { signal: "Primary Cloud", finding: "AWS (CloudFront, EKS, RDS)", evidence: "DNS CNAME records, HTTP headers", confidence: "High" },
        { signal: "CDN / Edge", finding: "CloudFront with WAF", evidence: "Server headers, DNS records", confidence: "High" },
        { signal: "Auth Pattern", finding: "Okta + OAuth2 + SAML", evidence: "auth.globalbank.com analysis", confidence: "High" },
        { signal: "Backend Tech", finding: "Java (Spring Boot), Node.js, Python", evidence: "GitHub repo analysis, response headers", confidence: "Medium" },
        { signal: "API Gateway", finding: "Kong Gateway 3.4", evidence: "X-Powered-By header", confidence: "High" },
        { signal: "CI/CD", finding: "GitHub Actions", evidence: "Workflow file analysis", confidence: "High" },
        { signal: "Observability", finding: "Datadog APM + Logging", evidence: "Header traces, Kepler notes", confidence: "Medium" },
      ]),
      maturityLevel: 3,
      maturityJustification: "Level 3 — Defined. GlobalBank has standardized API design guidelines and a central developer portal. However, API testing is fragmented (only 15% Newman adoption), no contract testing exists, and mock server usage is zero. The gap between their API design maturity and testing maturity is the primary opportunity.",
      confidenceJson: JSON.stringify({
        overall: 82,
        sections: {
          infrastructure: 90,
          auth: 88,
          testing: 75,
          organization: 70,
          compliance: 85,
        },
      }),
      hypothesis: "GlobalBank's API-first mandate from leadership creates urgency, but the 85% gap in Newman adoption across their 47 microservices indicates a systemic developer enablement problem, not a tooling awareness gap. The Postman opportunity is to position as the unified API development platform that bridges their excellent API design standards with their weak testing/monitoring execution — specifically targeting the 3hrs/week per developer currently lost to manual API testing.",
      recommendedApproach: "Bottoms-up developer adoption + top-down executive sponsorship. Start with the Payments API team (highest urgency, champion identified), demonstrate 40% testing time reduction in a 2-week pilot, then leverage the ROI data to secure enterprise commitment. Address the security team's concerns early by demonstrating Vault integration and secret management.",
      conversationAngle: "Lead with the developer productivity angle — the 600hrs/week lost to manual testing is a number that resonates with VP Eng Sarah Chen. Position Postman not as replacing Kong or their existing tools, but as the missing collaboration and testing layer that makes everything else work better.",
      stakeholderTargetsJson: JSON.stringify([
        { name: "Sarah Chen", role: "VP Engineering", priority: "Primary", influence: "Decision maker", notes: "Driving API platform modernization. Cares about developer velocity metrics." },
        { name: "Marcus Johnson", role: "API Platform Lead", priority: "Champion", influence: "Technical authority", notes: "Already evaluating Postman. Wants to standardize testing across all teams." },
        { name: "James Wright", role: "Security Lead", priority: "Gate", influence: "Blocker/enabler", notes: "Concerned about API key management. Needs Vault integration demo." },
        { name: "Lisa Park", role: "QA Director", priority: "Ally", influence: "Budget holder", notes: "Owns test automation strategy. Frustrated with current fragmentation." },
      ]),
      firstMeetingAgendaJson: JSON.stringify([
        { timeBlock: "5 min", topic: "Validate infrastructure assumptions", detail: "Confirm AWS/Kong/Okta stack. Verify 47 microservice count. Understand deployment cadence." },
        { timeBlock: "10 min", topic: "Developer pain point deep-dive", detail: "Explore the 3hr/week manual testing burden. Understand which teams feel it most. Map the friction points." },
        { timeBlock: "10 min", topic: "Newman adoption gap analysis", detail: "Why only 8/47 pipelines? What blocked the other 39? Is it tooling, knowledge, or process?" },
        { timeBlock: "5 min", topic: "Pilot proposal + next steps", detail: "Propose 2-week pilot with Payments team. Define success metrics. Schedule security review with James." },
      ]),
      generatedBriefMarkdown: `# GlobalBank Financial Services — Discovery Brief

## Executive Summary
GlobalBank is a Fortune 500 financial institution undergoing API platform modernization. With 500+ engineers, 47 microservices, and only 15% Newman adoption, there is a significant opportunity to standardize API testing and collaboration across the organization.

## Key Findings
- **Infrastructure**: AWS-based with Kong Gateway, Okta auth, Backstage developer portal
- **Testing Gap**: Only 8/47 CI pipelines use Newman. 600hrs/week lost to manual testing.
- **Champion Identified**: Marcus Johnson (API Platform Lead) actively evaluating Postman
- **Budget Available**: Enterprise tooling budget approved for Q2

## Recommended Approach
1. **Pilot**: 2-week engagement with Payments API team
2. **Prove**: Demonstrate 40% testing time reduction
3. **Expand**: Use ROI data to secure enterprise commitment
4. **Scale**: Wave-based rollout to all 33 teams

## Risk Factors
- Security team (James Wright) needs early engagement on Vault integration
- Competing evaluation with Insomnia and custom tooling
- Compliance requirements (PCI-DSS, SOX) may slow procurement`,
      generatedBriefJson: JSON.stringify({
        executiveSummary: "GlobalBank is a Fortune 500 financial institution with a significant API testing gap.",
        keyFindings: ["Only 15% Newman adoption", "600hrs/week manual testing", "Champion identified", "Budget approved Q2"],
        risks: ["Security team concerns", "Competing evaluation", "Compliance requirements"],
      }),
      aiGenerated: true,
      aiRunIds: [id("airun-1"), id("airun-2"), id("airun-3"), id("airun-4"), id("airun-5")],
      evidenceCitations: [
        { evidenceLabel: "EVIDENCE-1", chunkId: chunkIds[0], sourceType: "KEPLER", usedInSection: "keplerPaste" },
        { evidenceLabel: "EVIDENCE-7", chunkId: chunkIds[6], sourceType: "DNS", usedInSection: "dnsFindings" },
        { evidenceLabel: "EVIDENCE-11", chunkId: chunkIds[10], sourceType: "MANUAL", usedInSection: "hypothesis" },
        { evidenceLabel: "EVIDENCE-16", chunkId: chunkIds[15], sourceType: "GITHUB", usedInSection: "developerFrictionSignals" },
      ],
    },
  });
  console.log("✓ DiscoveryArtifact (AI-generated, fully populated)");

  // ─── 9. AIRuns ─────────────────────────────────────────────────────
  const aiRunDefs = [
    { id: id("airun-1"), agentType: "recon_synthesis", model: "gpt-4o", status: "SUCCESS", durationMs: 12400 },
    { id: id("airun-2"), agentType: "signal_classification", model: "gpt-4o", status: "SUCCESS", durationMs: 8200 },
    { id: id("airun-3"), agentType: "maturity_scoring", model: "gpt-4o", status: "SUCCESS", durationMs: 5600 },
    { id: id("airun-4"), agentType: "hypothesis_generation", model: "gpt-4o", status: "SUCCESS", durationMs: 9800 },
    { id: id("airun-5"), agentType: "brief_generation", model: "gpt-4o", status: "SUCCESS", durationMs: 15200 },
    { id: id("airun-6"), agentType: "topology_generation", model: "gpt-4o", status: "SUCCESS", durationMs: 11300 },
    { id: id("airun-7"), agentType: "assumption_extraction", model: "gpt-4o-mini", status: "SUCCESS", durationMs: 4500 },
    { id: id("airun-8"), agentType: "blocker_detection", model: "gpt-4o", status: "SUCCESS", durationMs: 7800 },
    { id: id("airun-9"), agentType: "adoption_planning", model: "gpt-4o", status: "SUCCESS", durationMs: 13100 },
    { id: id("airun-10"), agentType: "recon_synthesis", model: "gpt-4o", status: "FAILED", durationMs: 2100 },
  ];

  for (const run of aiRunDefs) {
    await prisma.aIRun.create({
      data: {
        id: run.id,
        projectId: project.id,
        agentType: run.agentType,
        model: run.model,
        promptHash: crypto.createHash("sha256").update(run.agentType + run.id).digest("hex").substring(0, 16),
        snapshotId: snapshot.id,
        inputJson: { projectId: project.id, snapshotId: snapshot.id, chunkCount: chunkIds.length },
        outputJson: run.status === "SUCCESS" ? { generated: true, sections: ["all"] } : undefined,
        tokenUsage: run.status === "SUCCESS"
          ? { promptTokens: 4500 + Math.floor(Math.random() * 2000), completionTokens: 1200 + Math.floor(Math.random() * 800), totalTokens: 5700 + Math.floor(Math.random() * 2800) }
          : undefined,
        durationMs: run.durationMs,
        status: run.status,
        createdAt: new Date(Date.now() - (aiRunDefs.length - aiRunDefs.indexOf(run)) * 300_000),
      },
    });
  }
  console.log(`✓ ${aiRunDefs.length} AIRuns`);

  // ─── 10. PhaseArtifacts (all 11 phases) ────────────────────────────
  const phases = [
    "DISCOVERY",
    "CURRENT_TOPOLOGY",
    "DESIRED_FUTURE_STATE",
    "SOLUTION_DESIGN",
    "INFRASTRUCTURE",
    "TEST_DESIGN",
    "CRAFT_SOLUTION",
    "TEST_SOLUTION",
    "DEPLOYMENT_PLAN",
    "BUILD_LOG",
  ] as const;

  const phaseContents: Record<string, { json: object; markdown: string; status: string }> = {
    DISCOVERY: {
      json: { summary: "Full discovery completed for GlobalBank", evidenceCount: chunkIds.length, maturityLevel: 3 },
      markdown: "# Discovery\nFull discovery complete. 18 evidence sources analyzed. Maturity Level 3 — Defined.",
      status: "CLEAN",
    },
    CURRENT_TOPOLOGY: {
      json: {
        nodes: [
          { id: "n1", type: "CLIENT", name: "Web App", metadata: { tech: "React", hosting: "CloudFront" }, evidenceIds: ["EVIDENCE-1"], confidence: "High" },
          { id: "n2", type: "CLIENT", name: "Mobile App", metadata: { tech: "React Native", platform: "iOS/Android" }, evidenceIds: ["EVIDENCE-1"], confidence: "High" },
          { id: "n3", type: "LOAD_BALANCER", name: "AWS ALB", metadata: { region: "us-east-1" }, evidenceIds: ["EVIDENCE-7"], confidence: "High" },
          { id: "n4", type: "GATEWAY", name: "Kong Gateway", metadata: { version: "3.4", plugins: ["rate-limiting", "oauth2", "cors"] }, evidenceIds: ["EVIDENCE-8"], confidence: "High" },
          { id: "n5", type: "SERVICE", name: "Payments Service", metadata: { tech: "Java/Spring Boot", team: "Payments" }, evidenceIds: ["EVIDENCE-16"], confidence: "High" },
          { id: "n6", type: "SERVICE", name: "Account Service", metadata: { tech: "Java/Spring Boot", team: "Core Banking" }, evidenceIds: ["EVIDENCE-16"], confidence: "High" },
          { id: "n7", type: "SERVICE", name: "Auth Service", metadata: { tech: "Node.js", team: "Platform" }, evidenceIds: ["EVIDENCE-10"], confidence: "High" },
          { id: "n8", type: "SERVICE", name: "Notification Service", metadata: { tech: "Python", team: "Comms" }, evidenceIds: ["EVIDENCE-16"], confidence: "Medium" },
          { id: "n9", type: "SERVICE", name: "Analytics Service", metadata: { tech: "Python", team: "Data" }, evidenceIds: ["EVIDENCE-16"], confidence: "Medium" },
          { id: "n10", type: "DATABASE", name: "Payments DB", metadata: { engine: "PostgreSQL", hosting: "RDS" }, evidenceIds: ["EVIDENCE-2"], confidence: "High" },
          { id: "n11", type: "DATABASE", name: "Accounts DB", metadata: { engine: "PostgreSQL", hosting: "RDS" }, evidenceIds: ["EVIDENCE-2"], confidence: "High" },
          { id: "n12", type: "IDENTITY_PROVIDER", name: "Okta", metadata: { protocols: ["OIDC", "SAML"] }, evidenceIds: ["EVIDENCE-10"], confidence: "High" },
          { id: "n13", type: "QUEUE", name: "SQS Events", metadata: { type: "SQS FIFO" }, evidenceIds: ["EVIDENCE-2"], confidence: "Medium" },
          { id: "n14", type: "CDN", name: "CloudFront", metadata: { origins: ["ALB", "S3"] }, evidenceIds: ["EVIDENCE-7"], confidence: "High" },
          { id: "n15", type: "STORAGE", name: "S3 Documents", metadata: { encryption: "AES-256" }, evidenceIds: ["EVIDENCE-2"], confidence: "Medium" },
          { id: "n16", type: "EXTERNAL_SYSTEM", name: "SWIFT Network", metadata: { protocol: "ISO 20022" }, evidenceIds: ["EVIDENCE-5"], confidence: "High" },
        ],
        edges: [
          { from: "n1", to: "n14", type: "ROUTES_THROUGH", label: "Static assets", evidenceIds: ["EVIDENCE-7"], confidence: "High" },
          { from: "n2", to: "n3", type: "CALLS", label: "API requests", evidenceIds: ["EVIDENCE-1"], confidence: "High" },
          { from: "n14", to: "n3", type: "ROUTES_THROUGH", label: "API passthrough", evidenceIds: ["EVIDENCE-7"], confidence: "High" },
          { from: "n3", to: "n4", type: "ROUTES_THROUGH", label: "Load balanced", evidenceIds: ["EVIDENCE-7", "EVIDENCE-8"], confidence: "High" },
          { from: "n4", to: "n5", type: "CALLS", label: "Payment APIs", evidenceIds: ["EVIDENCE-8"], confidence: "High" },
          { from: "n4", to: "n6", type: "CALLS", label: "Account APIs", evidenceIds: ["EVIDENCE-8"], confidence: "High" },
          { from: "n4", to: "n7", type: "AUTHENTICATES_WITH", label: "Token validation", evidenceIds: ["EVIDENCE-10"], confidence: "High" },
          { from: "n5", to: "n10", type: "READS_FROM", label: "Payment data", evidenceIds: ["EVIDENCE-16"], confidence: "Medium" },
          { from: "n5", to: "n10", type: "WRITES_TO", label: "Transactions", evidenceIds: ["EVIDENCE-16"], confidence: "High" },
          { from: "n6", to: "n11", type: "READS_FROM", label: "Account data", evidenceIds: ["EVIDENCE-16"], confidence: "Medium" },
          { from: "n5", to: "n13", type: "WRITES_TO", label: "Payment events", evidenceIds: ["EVIDENCE-16"], confidence: "Medium" },
          { from: "n8", to: "n13", type: "READS_FROM", label: "Event consumer", evidenceIds: ["EVIDENCE-16"], confidence: "Medium" },
          { from: "n9", to: "n13", type: "READS_FROM", label: "Analytics events", evidenceIds: ["EVIDENCE-16"], confidence: "Low" },
          { from: "n7", to: "n12", type: "AUTHENTICATES_WITH", label: "OIDC/SAML", evidenceIds: ["EVIDENCE-10"], confidence: "High" },
          { from: "n5", to: "n16", type: "CALLS", label: "Wire transfers", evidenceIds: ["EVIDENCE-5"], confidence: "High" },
          { from: "n5", to: "n15", type: "WRITES_TO", label: "Payment receipts", evidenceIds: ["EVIDENCE-16"], confidence: "Medium" },
        ],
      },
      markdown: "# Current Topology\n16 nodes, 16 edges. Kong Gateway → 4 microservices → PostgreSQL + SQS. Okta auth. CloudFront CDN.",
      status: "CLEAN",
    },
    DESIRED_FUTURE_STATE: {
      json: {
        goals: [
          "100% API test coverage in CI/CD pipelines",
          "Centralized collection management via Postman workspaces",
          "Contract testing between all service boundaries",
          "Mock servers for all external dependencies",
          "Automated API governance checks in PR workflow",
        ],
        timeline: "6 months to full adoption",
      },
      markdown: "# Desired Future State\nFull Postman adoption across 33 teams. Contract testing at every service boundary. Automated governance.",
      status: "CLEAN",
    },
    SOLUTION_DESIGN: {
      json: {
        approach: "Wave-based rollout with Payments team as pilot",
        phases: ["Pilot (2 weeks)", "Early Adopters (4 weeks)", "Majority (8 weeks)", "Laggards (4 weeks)"],
        toolchain: ["Postman Enterprise", "Newman CLI", "Postman API", "GitHub Actions integration"],
      },
      markdown: "# Solution Design\nWave-based 18-week rollout. Postman Enterprise + Newman + GitHub Actions. Pilot → Early Adopters → Majority → Laggards.",
      status: "CLEAN",
    },
    INFRASTRUCTURE: {
      json: {
        cicd: "GitHub Actions with Newman orb",
        environments: ["dev", "staging", "production"],
        secrets: "HashiCorp Vault → Postman API keys via CI variables",
        monitoring: "Newman results → Datadog dashboards",
        deploymentTargets: [
          { env: "dev", url: "https://api-dev.globalbank.com/v2", provider: "EKS us-east-1", autoDeployOnMerge: true },
          { env: "staging", url: "https://api-staging.globalbank.com/v2", provider: "EKS us-east-1", autoDeployOnMerge: false },
          { env: "production", url: "https://api.globalbank.com/v2", provider: "EKS us-east-1 (blue/green)", autoDeployOnMerge: false },
        ],
      },
      markdown: "# Infrastructure\nGitHub Actions + Newman. Vault for secrets. Datadog for monitoring. 3 environments. Blue/green production deploy.",
      status: "CLEAN",
    },
    TEST_DESIGN: {
      json: {
        strategy: "Contract-first testing with Postman collections as source of truth",
        layers: ["Unit (Jest/Mocha)", "Integration (Newman)", "Contract (Postman)", "E2E (Newman + environments)"],
        coverage: { current: 62, target: 90 },
        contractTestingApproach: "OpenAPI spec as contract. Newman validates response schema, headers, status codes. Pact for consumer-driven contracts between internal services.",
      },
      markdown: "# Test Design\nContract-first strategy. Current coverage 62%, target 90%. Four testing layers defined. Pact for consumer-driven contracts.",
      status: "CLEAN",
    },
    CRAFT_SOLUTION: {
      json: {
        implementationPlan: [
          { step: 1, title: "Onboard Payments API spec into Postman", description: "Import the OpenAPI 3.0 spec, generate baseline collection", targetComponents: ["n5"], evidenceIds: ["EVIDENCE-16"] },
          { step: 2, title: "Create Newman CI pipeline", description: "GitHub Actions workflow running contract + smoke tests", targetComponents: ["n5", "n6"], evidenceIds: ["EVIDENCE-18"] },
          { step: 3, title: "Set up mock servers for SWIFT", description: "Mock external SWIFT network dependency for local dev + CI", targetComponents: ["n16"], evidenceIds: ["EVIDENCE-5"] },
          { step: 4, title: "Deploy environment promotion gates", description: "Dev → Staging → Production with Newman gates", targetComponents: ["n4", "n5"], evidenceIds: ["EVIDENCE-8"] },
        ],
        migrationSteps: ["Export existing curl-based tests to Postman collection format", "Migrate environment variables from .env files to Postman environments"],
        ciCdNotes: ["All pipelines require POSTMAN_API_KEY secret", "Newman v6+ required for JUnit reporter"],
        estimatedEffort: "M (2 weeks for pilot team)",
        postmanCollections: [
          { name: "Payments API v2 — Contract Tests", description: "Contract tests for all Payments API endpoints", folders: [
            { name: "Payments", requests: [
              { method: "GET", name: "List Payments", urlPattern: "{{baseUrl}}/payments?status=completed&limit=20", description: "List payments with status filter" },
              { method: "POST", name: "Create Payment", urlPattern: "{{baseUrl}}/payments", description: "Initiate a new payment" },
              { method: "GET", name: "Get Payment by ID", urlPattern: "{{baseUrl}}/payments/{{paymentId}}", description: "Retrieve payment details" },
              { method: "PATCH", name: "Update Payment Status", urlPattern: "{{baseUrl}}/payments/{{paymentId}}/status", description: "Update payment status" },
            ]},
            { name: "Accounts", requests: [
              { method: "GET", name: "Get Account Balance", urlPattern: "{{baseUrl}}/accounts/{{accountId}}/balance", description: "Check account balance" },
            ]},
            { name: "Transfers", requests: [
              { method: "POST", name: "Initiate Wire Transfer", urlPattern: "{{baseUrl}}/transfers", description: "Initiate SWIFT/ACH/FEDWIRE transfer" },
            ]},
          ]},
          { name: "Payments API v2 — Smoke Tests", description: "Quick health-check smoke tests for each environment", folders: [
            { name: "Health", requests: [
              { method: "GET", name: "Health Check", urlPattern: "{{baseUrl}}/health", description: "Basic health check" },
              { method: "GET", name: "List Payments (smoke)", urlPattern: "{{baseUrl}}/payments?limit=1", description: "Verify API responds" },
            ]},
          ]},
          { name: "Auth Flow Validation", description: "OAuth2 token flow + API key validation tests", folders: [
            { name: "OAuth2", requests: [
              { method: "POST", name: "Get Access Token", urlPattern: "{{authUrl}}/oauth/token", description: "Client credentials grant" },
              { method: "GET", name: "Token Introspect", urlPattern: "{{authUrl}}/oauth/introspect", description: "Validate token" },
            ]},
          ]},
        ],
        newmanRunConfigs: [
          { name: "contract-tests-dev", description: "Contract tests against Dev environment", collectionRef: "Payments API v2 — Contract Tests", environmentRef: "Dev", reporters: ["cli", "junit"], bailOnFailure: true },
          { name: "contract-tests-staging", description: "Contract tests against Staging", collectionRef: "Payments API v2 — Contract Tests", environmentRef: "Staging", reporters: ["cli", "junit", "htmlextra"], bailOnFailure: true },
          { name: "smoke-tests-prod", description: "Production smoke tests", collectionRef: "Payments API v2 — Smoke Tests", environmentRef: "Production", reporters: ["cli", "junit"], bailOnFailure: false },
          { name: "auth-flow-dev", description: "Auth flow validation in Dev", collectionRef: "Auth Flow Validation", environmentRef: "Dev", reporters: ["cli"], bailOnFailure: true },
        ],
        ciCdPipelines: [
          { platform: "github_actions", platformLabel: "GitHub Actions", configLanguage: "yaml", filename: ".github/workflows/postman-tests.yml", description: "Full Newman test suite on push to main", configContent: `name: Postman API Tests
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  contract-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm install -g newman newman-reporter-htmlextra
      - name: Run Contract Tests (Dev)
        run: |
          newman run postman/collections/payments-contract.json \\
            -e postman/environments/dev.json \\
            --reporters cli,junit \\
            --reporter-junit-export results/contract-dev.xml \\
            --bail
        env:
          POSTMAN_API_KEY: \${{ secrets.POSTMAN_API_KEY }}
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: results/` },
          { platform: "github_actions", platformLabel: "GitHub Actions", configLanguage: "yaml", filename: ".github/workflows/postman-promotion.yml", description: "Environment promotion pipeline with Newman gates", configContent: `name: Environment Promotion
on:
  workflow_dispatch:
    inputs:
      target_env:
        description: Target environment
        required: true
        type: choice
        options: [staging, production]

jobs:
  promote:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm install -g newman
      - name: Newman Gate Check
        run: |
          newman run postman/collections/payments-contract.json \\
            -e postman/environments/\${{ inputs.target_env }}.json \\
            --bail
      - name: Deploy
        if: success()
        run: echo "Deploying to \${{ inputs.target_env }}"` },
        ],
      },
      markdown: "# Craft Solution\n3 collections (contract, smoke, auth). 4 Newman configs. 2 GitHub Actions pipelines. Mock servers for SWIFT dependency.",
      status: "CLEAN",
    },
    TEST_SOLUTION: {
      json: {
        newmanResults: { total: 156, passed: 151, failed: 5, skipped: 0 },
        coverageImprovement: "62% → 84% in pilot",
        failingSummary: [
          { test: "SWIFT Transfer - timeout on settlement confirmation", severity: "low", notes: "Intermittent mock latency, non-blocking" },
          { test: "Auth token refresh race condition", severity: "medium", notes: "Okta token refresh window edge case" },
        ],
        ciRunHistory: [
          { date: "2026-01-22", passed: 128, failed: 28, duration: 12500 },
          { date: "2026-01-25", passed: 140, failed: 16, duration: 8900 },
          { date: "2026-01-29", passed: 148, failed: 8, duration: 6200 },
          { date: "2026-02-03", passed: 151, failed: 5, duration: 4800 },
        ],
      },
      markdown: "# Test Solution\n156 tests, 97% passing (151/156). Coverage 62% → 84%. 5 remaining failures are low/medium severity. CI run time improved from 12.5s → 4.8s over 2 weeks.",
      status: "CLEAN_WITH_EXCEPTIONS",
    },
    DEPLOYMENT_PLAN: {
      json: {
        waves: ["Wave 1: Payments (2 teams)", "Wave 2: Core Banking (5 teams)", "Wave 3: Platform (8 teams)", "Wave 4: Remaining (18 teams)"],
        rollback: "Feature flags per collection. Gradual Newman enforcement.",
        governance: "PR check required before merge. API score > 80%.",
      },
      markdown: "# Deployment Plan\n4-wave rollout over 18 weeks. Feature flags for gradual enforcement. PR checks required.",
      status: "CLEAN",
    },
    BUILD_LOG: {
      json: {
        context: {
          aeCse: "CSE Demo User",
          customerTechnicalLead: "Marcus Johnson (API Platform Lead)",
          sprintDates: "Jan 20 – Feb 7, 2026",
          accountExecutive: "Lisa Chen",
          customerOrg: "GlobalBank Financial Services",
          engagementType: "Technical POV",
        },
        hypothesis: "By deploying Postman collections with Newman CI gates across GlobalBank's Payments API pipeline, we can reduce manual API testing effort by 40% (from ~3 hrs/week per developer to <2 hrs/week), improve test coverage from 62% to 80%+, and establish a reusable pattern that can scale to all 47 microservices.",
        successCriteria: [
          "Newman running in CI for Payments API on every push to main",
          "Contract test coverage ≥ 80% for all Payments endpoints",
          "SWIFT mock server operational for dev + CI environments",
          "Environment promotion gates enforced (Dev → Staging → Prod)",
          "Payments team developers actively using Postman (≥ 6 of 8 team members)",
        ],
        environmentBaseline: {
          scm: "GitHub Enterprise",
          ciCd: "GitHub Actions",
          gateway: "Kong Gateway 3.4",
          cloud: "AWS (EKS, RDS, SQS, S3)",
          devPortal: "Backstage on EKS",
          currentPostmanUsage: "Minimal — 12 stale collections in a public workspace, no environments, no CI integration",
          version: "Postman v11 (free tier)",
          identityProvider: "Okta (OIDC/SAML)",
          secretsManagement: "HashiCorp Vault",
          observability: "Datadog APM + Logging",
        },
        whatWeBuilt: [
          "Payments API v2 Contract Test Collection — 6 endpoints, 128 assertions covering happy path, error cases, and schema validation",
          "Payments API v2 Smoke Test Collection — lightweight health checks for each environment",
          "Auth Flow Validation Collection — OAuth2 client credentials + token introspect tests",
          "3 Postman Environments (Dev, Staging, Production) with Vault-backed secrets",
          "GitHub Actions workflow: postman-tests.yml — runs full Newman contract suite on push/PR",
          "GitHub Actions workflow: postman-promotion.yml — environment promotion with Newman gates",
          "SWIFT Network Mock Server — simulates ISO 20022 wire transfer responses for local dev and CI",
          "Newman CI Reporter Configuration — JUnit + HTML Extra reporters for artifact archiving",
        ],
        valueUnlocked: [
          "40% reduction in manual API testing time for Payments team (confirmed: 3.1 hrs → 1.8 hrs/week/dev)",
          "Test coverage improved from 62% → 84% for Payments API endpoints",
          "CI feedback loop reduced from 8 minutes (Jest/Mocha) to 2.5 minutes (Newman contract tests)",
          "Zero production incidents related to Payments API since Newman gate deployment",
          "Developer NPS for API testing workflow improved from 3.2 to 7.8 (out of 10)",
        ],
        reusablePatterns: [
          "Vault-to-Newman secret injection pattern — reusable across all 47 microservices",
          "Environment promotion gate template — adaptable for any API service with Newman",
          "Mock server scaffolding for external dependencies — pattern documented for SWIFT, usable for any external API",
          "Collection-as-code Git workflow — collections stored in repo, synced via Postman API",
        ],
        productGapsRisks: [
          "Postman collection sync doesn't handle merge conflicts well when multiple developers edit simultaneously",
          "Newman reporter ecosystem is fragmented — htmlextra reporter not officially maintained",
          "No native Vault integration in Postman desktop — workaround via CI env vars only",
          "gRPC support still in beta — blocker for Trading team adoption in Wave 3",
        ],
        nextSteps: [
          "Wave 2 kickoff: Replicate pattern for Core Banking API team (5 teams, target: 4 weeks)",
          "Security review with James Wright — demo Vault integration POC (scheduled Tuesday)",
          "Create comparison matrix for evaluation committee (Postman vs Insomnia, due Thursday)",
          "Prepare ROI dashboard for Sarah Chen's executive review",
          "Draft enterprise license proposal based on pilot metrics",
        ],
      },
      markdown: `# Build Log — GlobalBank Financial Services

## Context
**AE/CSE:** CSE Demo User | **Customer Lead:** Marcus Johnson | **Sprint:** Jan 20 – Feb 7, 2026

## Hypothesis
Deploying Postman + Newman across Payments API will reduce manual testing 40%, improve coverage to 80%+.

## What We Built
- 3 Postman Collections (contract, smoke, auth) with 128+ assertions
- 3 Environments (Dev/Staging/Prod) with Vault-backed secrets
- 2 GitHub Actions pipelines (test + promotion)
- SWIFT mock server for external dependency isolation

## Value Unlocked
- **40% testing time reduction** (3.1 → 1.8 hrs/week/dev)
- **84% test coverage** (up from 62%)
- **2.5 min CI feedback** (down from 8 min)
- **Zero production incidents** since deployment

## Reusable Patterns
- Vault→Newman secret injection | Environment promotion gates | Mock server scaffolding | Collection-as-code workflow

## Next Steps
Wave 2 kickoff, security review, evaluation committee, executive ROI dashboard`,
      status: "CLEAN",
    },
  };

  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    const content = phaseContents[phase];
    await prisma.phaseArtifact.create({
      data: {
        id: id(`phase-${phase.toLowerCase()}`),
        projectId: project.id,
        phase,
        version: 1,
        status: content.status as "CLEAN" | "DIRTY" | "STALE" | "NEEDS_REVIEW" | "CLEAN_WITH_EXCEPTIONS",
        snapshotId: snapshot.id,
        derivedFromJson: { upstreamRefs: i > 0 ? [{ phase: phases[i - 1], version: 1 }] : [], snapshotHash: snapshotHash },
        contentJson: content.json,
        contentMarkdown: content.markdown,
        lastComputedAt: new Date(Date.now() - (phases.length - i) * 600_000),
      },
    });
  }
  console.log(`✓ ${phases.length} PhaseArtifacts (all phases)`);

  // ─── 11. TopologyNodes + Edges ─────────────────────────────────────
  const topoContent = phaseContents.CURRENT_TOPOLOGY.json as {
    nodes: Array<{ id: string; type: string; name: string; metadata: object }>;
    edges: Array<{ from: string; to: string; type: string; label: string }>;
  };

  const nodeIdMap: Record<string, string> = {};
  for (const node of topoContent.nodes) {
    const nodeId = id(`topo-node-${node.id}`);
    nodeIdMap[node.id] = nodeId;
    await prisma.topologyNode.create({
      data: {
        id: nodeId,
        projectId: project.id,
        type: node.type as "SERVICE" | "API" | "GATEWAY" | "DATABASE" | "IDENTITY_PROVIDER" | "CDN" | "LOAD_BALANCER" | "CLIENT" | "EXTERNAL_SYSTEM" | "QUEUE" | "STORAGE",
        name: node.name,
        metadataJson: node.metadata,
      },
    });
  }

  const edgeIds: string[] = [];
  for (let i = 0; i < topoContent.edges.length; i++) {
    const edge = topoContent.edges[i];
    const edgeId = id(`topo-edge-${i}`);
    edgeIds.push(edgeId);
    await prisma.topologyEdge.create({
      data: {
        id: edgeId,
        projectId: project.id,
        fromNodeId: nodeIdMap[edge.from],
        toNodeId: nodeIdMap[edge.to],
        type: edge.type as "CALLS" | "AUTHENTICATES_WITH" | "ROUTES_THROUGH" | "READS_FROM" | "WRITES_TO" | "DEPENDS_ON",
        metadataJson: { label: edge.label },
      },
    });
  }
  console.log(`✓ ${topoContent.nodes.length} TopologyNodes + ${topoContent.edges.length} TopologyEdges`);

  // ─── 12. TopologySnapshot ──────────────────────────────────────────
  await prisma.topologySnapshot.create({
    data: {
      id: id("topo-snapshot-1"),
      projectId: project.id,
      snapshotId: snapshot.id,
      nodeIdsJson: Object.values(nodeIdMap),
      edgeIdsJson: edgeIds,
    },
  });
  console.log("✓ TopologySnapshot");

  // ─── 13. RecomputeJob + Tasks ──────────────────────────────────────
  const recomputeJob = await prisma.recomputeJob.create({
    data: {
      id: id("recompute-1"),
      projectId: project.id,
      triggeredBy: "INGEST",
      snapshotId: snapshot.id,
      status: "COMPLETED",
      startedAt: new Date(Date.now() - 3600_000),
      finishedAt: new Date(Date.now() - 3500_000),
    },
  });

  for (const phase of phases.slice(0, 5)) {
    await prisma.recomputeTask.create({
      data: {
        jobId: recomputeJob.id,
        phase,
        status: "COMPLETED",
        inputRefsJson: { upstreamVersions: { DISCOVERY: 1 }, snapshotId: snapshot.id },
        message: `Successfully recomputed ${phase}`,
        startedAt: new Date(Date.now() - 3550_000),
        finishedAt: new Date(Date.now() - 3500_000),
      },
    });
  }
  console.log("✓ RecomputeJob + 5 RecomputeTasks");

  // ─── 14. Proposals ─────────────────────────────────────────────────
  await prisma.proposal.create({
    data: {
      id: id("proposal-1"),
      projectId: project.id,
      phase: "DISCOVERY",
      snapshotId: snapshot.id,
      baseArtifactVersion: 1,
      patchJson: [{ op: "replace", path: "/maturityLevel", value: 3 }],
      proposedJson: { maturityLevel: 3, summary: "Updated with new evidence" },
      proposedMarkdown: "Updated discovery with 18 new evidence items. Maturity confirmed at Level 3.",
      diffSummary: "Maturity level confirmed. 4 new evidence citations added. Developer friction signals updated.",
      status: "ACCEPTED",
      aiRunIds: [id("airun-1")],
      resolvedAt: new Date(Date.now() - 1800_000),
    },
  });

  await prisma.proposal.create({
    data: {
      id: id("proposal-2"),
      projectId: project.id,
      phase: "TEST_DESIGN",
      snapshotId: snapshot.id,
      baseArtifactVersion: 1,
      patchJson: [{ op: "add", path: "/contractTesting", value: true }],
      proposedJson: { strategy: "Add contract testing layer", coverage: { current: 62, target: 95 } },
      proposedMarkdown: "Proposal: Add Pact-based contract testing between all service boundaries.",
      diffSummary: "Add contract testing. Increase coverage target from 90% to 95%.",
      status: "PENDING",
      aiRunIds: [id("airun-6")],
    },
  });
  console.log("✓ 2 Proposals (1 accepted, 1 pending)");

  // ─── 15. Assumptions ───────────────────────────────────────────────
  const assumptions = [
    { category: "cloud_provider", claim: "GlobalBank uses AWS as their primary cloud provider", reasoning: "CloudFront headers, EKS references in GitHub repos, RDS database endpoints", confidence: "High", status: "VERIFIED" as const, phase: "DISCOVERY" as const },
    { category: "api_gateway", claim: "Kong Gateway 3.4 is the primary API gateway", reasoning: "X-Powered-By: Kong/3.4 header detected on api.globalbank.com", confidence: "High", status: "VERIFIED" as const, phase: "DISCOVERY" as const },
    { category: "auth_pattern", claim: "Okta is the sole identity provider for all applications", reasoning: "auth.globalbank.com resolves to Okta infrastructure", confidence: "Medium", status: "CORRECTED" as const, humanResponse: "Okta is primary but Azure AD is used for internal employee SSO. Okta handles customer-facing auth only.", phase: "DISCOVERY" as const },
    { category: "ci_cd_platform", claim: "All teams use GitHub Actions for CI/CD", reasoning: "GitHub Enterprise detected, workflow files found in repos", confidence: "Medium", status: "PENDING" as const, phase: "INFRASTRUCTURE" as const },
    { category: "api_architecture", claim: "All microservices follow REST API patterns", reasoning: "OpenAPI specs found in developer portal", confidence: "Low", status: "CORRECTED" as const, humanResponse: "Mostly REST, but the real-time trading team uses gRPC and the analytics team has a GraphQL API.", phase: "CURRENT_TOPOLOGY" as const },
    { category: "test_coverage", claim: "Current test coverage is approximately 62% across all services", reasoning: "GitHub Actions coverage reports sampled from 12 repos", confidence: "Medium", status: "VERIFIED" as const, phase: "TEST_DESIGN" as const },
    { category: "team_structure", claim: "The API Platform team has authority to mandate tooling changes", reasoning: "Kepler notes mention Marcus Johnson leading API standardization", confidence: "Low", status: "PENDING" as const, phase: "SOLUTION_DESIGN" as const },
    { category: "compliance", claim: "PCI-DSS compliance requires all API changes to go through a change advisory board", reasoning: "Compliance documentation mentions CAB process", confidence: "Medium", status: "REJECTED" as const, humanResponse: "CAB review is only required for production deployments, not for tooling changes. This is not a blocker.", phase: "DEPLOYMENT_PLAN" as const },
    { category: "budget", claim: "Enterprise tooling budget is approved and available for Q2", reasoning: "Meeting notes reference Q2 budget approval", confidence: "High", status: "VERIFIED" as const, phase: "SOLUTION_DESIGN" as const },
    { category: "developer_sentiment", claim: "Most developers are frustrated with current API testing workflow", reasoning: "Survey of 12 developers showed manual testing as top complaint", confidence: "Medium", status: "PENDING" as const, phase: "DISCOVERY" as const },
  ];

  for (let i = 0; i < assumptions.length; i++) {
    const a = assumptions[i];
    await prisma.assumption.create({
      data: {
        id: id(`assumption-${i}`),
        projectId: project.id,
        phase: a.phase,
        category: a.category,
        claim: a.claim,
        reasoning: a.reasoning,
        confidence: a.confidence,
        status: a.status,
        humanResponse: a.humanResponse || null,
        verifiedBy: a.status !== "PENDING" ? user.id : null,
        verifiedAt: a.status !== "PENDING" ? new Date(Date.now() - Math.random() * 86400_000 * 3) : null,
        impact: `If incorrect, affects ${a.phase} phase accuracy and downstream cascade`,
        evidenceIds: [chunkIds[i % chunkIds.length]],
        blocksPhases: [a.phase],
        recomputeJobId: recomputeJob.id,
      },
    });
  }
  console.log(`✓ ${assumptions.length} Assumptions (4 verified, 3 pending, 2 corrected, 1 rejected)`);

  // ─── 16. Blockers + Missiles + Nukes ──────────────────────────────
  const blocker1 = await prisma.blocker.create({
    data: {
      id: id("blocker-1"),
      projectId: project.id,
      title: "Security team won't approve Newman in CI without Vault integration demo",
      description: "James Wright (Security Lead) requires a demonstration of how Postman/Newman handles secrets via HashiCorp Vault before approving Newman in production CI pipelines. This blocks deployment to all production environments.",
      domain: "SECURITY",
      severity: "HIGH",
      status: "MISSILE_FIRED",
      blockedPhases: ["INFRASTRUCTURE", "DEPLOYMENT_PLAN"],
      blockedCapabilities: ["Production CI/CD integration", "Automated API testing in prod"],
      rootCause: "Security team has strict policy requiring all secrets to flow through Vault. Newman's default env variable approach doesn't meet their audit requirements.",
      rootCauseCategory: "org_policy",
      blockerOwner: "James Wright (Security Lead)",
      decisionMaker: "James Wright",
      allies: ["Marcus Johnson (API Platform)", "Lisa Park (QA Director)"],
      resistors: [],
      impactScore: 85,
      revenueImpact: "Delays enterprise deal by 2-4 weeks if not resolved before Q2 budget cycle",
      timelineImpact: "Blocks Wave 2 and beyond from production deployment",
      cascadeImpact: "All downstream teams blocked from production API testing",
      surfacedByPhase: "INFRASTRUCTURE",
      surfacedByAgent: "blocker_detection",
      evidenceIds: [chunkIds[4], chunkIds[11]],
      notes: "Scheduled demo for next Tuesday. Preparing Vault integration POC.",
    },
  });

  await prisma.blockerMissile.create({
    data: {
      blockerId: blocker1.id,
      name: "Vault Integration POC + Live Demo",
      strategy: "Build a working POC showing Newman pulling secrets from Vault via CI environment variables. Present to James in a 30-minute session with live demo.",
      targetAudience: "James Wright (Security Lead) + Security team",
      talkingPoints: [
        "Newman never sees raw secrets — Vault injects via CI env vars",
        "Audit trail maintained through Vault's access logs",
        "Same pattern already used by 8 existing pipelines for database credentials",
      ],
      evidence: ["Fortune 500 customer case study with similar Vault setup", "Postman security whitepaper"],
      actionSteps: [
        "Create sample collection with Vault-backed environment",
        "Set up GitHub Actions workflow with Vault action",
        "Record demo video as backup",
        "Schedule 30-min meeting with James",
      ],
      deliverables: ["Working GitHub Actions workflow", "Architecture diagram", "Security compliance checklist"],
      estimatedEffort: "1 day",
      deadline: new Date(Date.now() + 7 * 86400_000),
      successCriteria: "James signs off on Newman in production CI pipelines",
      fallbackPlan: "Escalate to VP Engineering Sarah Chen for executive override",
      status: "in_progress",
      firedAt: new Date(Date.now() - 2 * 86400_000),
      aiGenerated: true,
      aiRunId: id("airun-8"),
    },
  });

  const blocker2 = await prisma.blocker.create({
    data: {
      id: id("blocker-2"),
      projectId: project.id,
      title: "Competing evaluation with Insomnia creating decision paralysis",
      description: "Two teams are simultaneously evaluating Insomnia alongside Postman. The QA Director wants a single recommendation but the teams can't agree, creating procurement delay.",
      domain: "ORGANIZATIONAL",
      severity: "MEDIUM",
      status: "MAPPED",
      blockedPhases: ["SOLUTION_DESIGN"],
      blockedCapabilities: ["Enterprise license procurement", "Standardized tooling"],
      rootCause: "No clear evaluation criteria were established before the evaluation began. Each team is optimizing for their specific use case.",
      rootCauseCategory: "process",
      blockerOwner: "Lisa Park (QA Director)",
      decisionMaker: "Sarah Chen (VP Engineering)",
      allies: ["Marcus Johnson"],
      resistors: ["Trading team (prefers Insomnia for gRPC support)"],
      impactScore: 60,
      revenueImpact: "Could delay procurement by 4-6 weeks",
      timelineImpact: "Delays Wave 1 start",
      cascadeImpact: "Enterprise commitment delayed",
      surfacedByPhase: "SOLUTION_DESIGN",
      surfacedByAgent: "blocker_detection",
    },
  });

  await prisma.blockerMissile.create({
    data: {
      blockerId: blocker2.id,
      name: "Head-to-Head Comparison Matrix + Pilot Results",
      strategy: "Create an objective feature comparison matrix weighted by GlobalBank's specific requirements. Combine with Payments team pilot results showing concrete ROI.",
      targetAudience: "Lisa Park + evaluation committee",
      talkingPoints: [
        "Postman covers 95% of use cases vs Insomnia's 70% for their stack",
        "Enterprise features (governance, RBAC, audit) only in Postman",
        "Pilot showed 40% testing time reduction — hard data beats opinions",
      ],
      actionSteps: ["Build comparison matrix", "Compile pilot ROI data", "Present to evaluation committee"],
      estimatedEffort: "4 hours",
      successCriteria: "Evaluation committee recommends Postman",
      status: "designed",
      aiGenerated: true,
      aiRunId: id("airun-8"),
    },
  });

  await prisma.blockerNuke.create({
    data: {
      blockerId: blocker2.id,
      name: "Executive Decision Override",
      rationale: "If the evaluation committee remains deadlocked, escalate to Sarah Chen for a top-down decision based on enterprise-wide strategic alignment.",
      strategy: "Present Sarah Chen with: (1) cost of delay analysis, (2) pilot ROI data, (3) roadmap alignment with API-first mandate, (4) competitive risk of delayed adoption.",
      escalationChain: ["Lisa Park → Sarah Chen → CTO"],
      executiveSponsor: "Sarah Chen (VP Engineering)",
      collateralDamage: ["Trading team may feel overridden", "Could create short-term friction"],
      riskAssessment: "Medium — trading team resistance could slow their adoption wave",
      pointOfNoReturn: "Once Sarah makes the call, it's final. No going back to evaluation.",
      phases: [
        { phase: "Prepare brief", duration: "2 hours" },
        { phase: "Schedule Sarah 1:1", duration: "1 day" },
        { phase: "Present and get decision", duration: "30 minutes" },
      ],
      successCriteria: "Sarah mandates Postman as the standard",
      failureContingency: "Accept dual-tool strategy with Postman as primary, Insomnia for gRPC-specific use cases",
      status: "designed",
      aiGenerated: true,
      aiRunId: id("airun-8"),
    },
  });

  const blocker3 = await prisma.blocker.create({
    data: {
      id: id("blocker-3"),
      projectId: project.id,
      title: "Change Advisory Board meets quarterly — next slot in 6 weeks",
      description: "Production deployment changes require CAB approval. The next CAB meeting is 6 weeks away, which could delay the Wave 2 production rollout.",
      domain: "PROCESS",
      severity: "LOW",
      status: "NEUTRALIZED",
      blockedPhases: ["DEPLOYMENT_PLAN"],
      rootCause: "Legacy change management process designed for monolithic deployments, not suited for iterative tooling rollouts.",
      rootCauseCategory: "process",
      blockerOwner: "Change Management Office",
      impactScore: 30,
      resolvedAt: new Date(Date.now() - 5 * 86400_000),
      resolvedBy: user.id,
      resolutionNotes: "Got exemption for non-production-code changes. Newman is classified as a test tool, not a production code change. CAB approved via email vote.",
    },
  });
  console.log("✓ 3 Blockers + 2 Missiles + 1 Nuke");

  // ─── 17. ProjectWorkspaces ─────────────────────────────────────────
  const workspaces = [
    { name: "Payments Team", team: "Payments", description: "Workspace for Payments API collections and environments" },
    { name: "Core Banking", team: "Core Banking", description: "Account, transaction, and ledger API testing" },
    { name: "Platform Services", team: "Platform", description: "Auth, gateway, and infrastructure API testing" },
  ];

  for (const ws of workspaces) {
    await prisma.projectWorkspace.create({
      data: {
        projectId: project.id,
        workspaceName: ws.name,
        team: ws.team,
        description: ws.description,
        workspaceId: `ws-${ws.name.toLowerCase().replace(/ /g, "-")}`,
      },
    });
  }
  console.log("✓ 3 ProjectWorkspaces");

  // ─── 18. PipelineDeployments ───────────────────────────────────────
  const deployments = [
    { platform: "github_actions", label: "GitHub Actions", repo: "https://github.com/globalbank/payments-api", filename: ".github/workflows/api-tests.yml", status: "passing", branch: "main" },
    { platform: "github_actions", label: "GitHub Actions", repo: "https://github.com/globalbank/account-service", filename: ".github/workflows/newman.yml", status: "passing", branch: "main" },
    { platform: "github_actions", label: "GitHub Actions", repo: "https://github.com/globalbank/auth-service", filename: ".github/workflows/api-tests.yml", status: "failing", branch: "develop" },
    { platform: "github_actions", label: "GitHub Actions", repo: "https://github.com/globalbank/notification-svc", filename: ".github/workflows/smoke-tests.yml", status: "pending", branch: "main" },
  ];

  for (const dep of deployments) {
    await prisma.pipelineDeployment.create({
      data: {
        projectId: project.id,
        platform: dep.platform,
        platformLabel: dep.label,
        repoUrl: dep.repo,
        filename: dep.filename,
        branchName: dep.branch,
        lastStatus: dep.status,
        lastRunAt: dep.status !== "pending" ? new Date(Date.now() - Math.random() * 86400_000 * 2) : null,
      },
    });
  }
  console.log("✓ 4 PipelineDeployments");

  // ─── 19. NewmanTestResults ─────────────────────────────────────────
  const newmanResults = [
    { collection: "Payments API v2", env: "Staging", total: 45, assertions: 128, passed: 124, failed: 4, duration: 12500, status: "fail" },
    { collection: "Payments API v2", env: "Dev", total: 45, assertions: 128, passed: 128, failed: 0, duration: 8900, status: "pass" },
    { collection: "Account Service v1", env: "Staging", total: 32, assertions: 89, passed: 89, failed: 0, duration: 7200, status: "pass" },
    { collection: "Auth Flow Tests", env: "Dev", total: 18, assertions: 52, passed: 50, failed: 2, duration: 15300, status: "fail" },
    { collection: "Smoke Tests", env: "Production", total: 12, assertions: 36, passed: 36, failed: 0, duration: 4200, status: "pass" },
  ];

  for (let i = 0; i < newmanResults.length; i++) {
    const nr = newmanResults[i];
    await prisma.newmanTestResult.create({
      data: {
        projectId: project.id,
        collectionName: nr.collection,
        environmentName: nr.env,
        totalRequests: nr.total,
        totalAssertions: nr.assertions,
        passedAssertions: nr.passed,
        failedAssertions: nr.failed,
        totalDuration: nr.duration,
        status: nr.status,
        source: i < 3 ? "ci" : "webhook",
        createdAt: new Date(Date.now() - (newmanResults.length - i) * 86400_000),
      },
    });
  }
  console.log("✓ 5 NewmanTestResults");

  // ─── 20. ProjectNotes ──────────────────────────────────────────────
  const noteContents = [
    "Follow up with James Wright on Vault integration demo — scheduled for Tuesday",
    "Marcus mentioned the trading team is a potential blocker for org-wide standardization. Their gRPC use case needs a creative solution.",
    "Sarah Chen wants to see ROI dashboard before committing to enterprise license. Need to prepare data from pilot.",
    "Key insight from pilot: developers love the collection runner but need better documentation on environment management.",
    "TODO: Prepare comparison matrix (Postman vs Insomnia) for evaluation committee meeting next Thursday",
  ];

  for (const content of noteContents) {
    await prisma.projectNote.create({
      data: {
        projectId: project.id,
        userId: user.id,
        content,
      },
    });
  }
  console.log("✓ 5 ProjectNotes");

  // ─── 25. Admiral Notes + Tasks ───────────────────────────────────
  // Ensure an Admiral user exists for authoring notes/tasks
  const admiralHash = await bcrypt.hash("admiral123", 10);
  const admiral = await prisma.user.upsert({
    where: { email: "jared@postman.com" },
    update: { role: "ADMIN", isAdmin: true },
    create: {
      email: "jared@postman.com",
      name: "Jared",
      passwordHash: admiralHash,
      role: "ADMIN",
      isAdmin: true,
    },
  });

  const admiralNotes = [
    { content: "GlobalBank is our highest-priority account this quarter. Sarah Chen is the exec sponsor — keep her informed but don't overwhelm with details. Marcus Johnson is the technical champion. Do NOT let the Insomnia evaluation derail progress.", pinned: true, phase: "DISCOVERY", scope: "project" },
    { content: "Security blocker with James Wright is the critical path item. If the Vault demo next Tuesday goes well, we clear the biggest objection. If it doesn't, escalation path is Sarah Chen.", pinned: true, phase: "INFRASTRUCTURE", scope: "project" },
    { content: "Great pilot results — 40% testing time reduction exceeded our 30% target. Use these numbers in the enterprise pitch. Lisa Park (QA Director) is particularly interested in the ROI data.", pinned: false, phase: null, scope: "project" },
    { content: "Trading team's gRPC concerns are valid but shouldn't block the enterprise deal. Acknowledge it, propose a dual-tool exception, and keep moving. Michael Brown is vocal but isolated.", pinned: false, phase: "SOLUTION_DESIGN", scope: "project" },
    { content: "Demo User has been crushing it on this engagement. The service template work and CI/CD pipeline setup are solid. Consider featuring this as a case study.", pinned: false, phase: null, scope: "cse" },
  ];

  for (let i = 0; i < admiralNotes.length; i++) {
    const n = admiralNotes[i];
    await prisma.admiralNote.create({
      data: {
        authorId: admiral.id,
        projectId: project.id,
        cseUserId: n.scope === "cse" ? user.id : null,
        phase: n.phase,
        scope: n.scope,
        content: n.content,
        pinned: n.pinned,
        createdAt: new Date(Date.now() - (admiralNotes.length - i) * 86400_000),
      },
    });
  }

  const admiralTasks = [
    { title: "Prepare Vault integration demo for Security team", description: "Build working POC of Newman pulling secrets from Vault via GitHub Actions env vars. Demo to James Wright on Tuesday.", priority: "high", status: "in_progress", dueDate: new Date(Date.now() + 3 * 86400_000) },
    { title: "Create Postman vs Insomnia comparison matrix", description: "Objective feature comparison weighted by GlobalBank requirements. Include pilot ROI data. Due for evaluation committee Thursday.", priority: "high", status: "pending", dueDate: new Date(Date.now() + 5 * 86400_000) },
    { title: "Draft enterprise license proposal", description: "Based on pilot metrics: 40% time reduction, 84% coverage, 18 active users. Calculate org-wide projection for 500+ engineers.", priority: "medium", status: "pending", dueDate: new Date(Date.now() + 10 * 86400_000) },
    { title: "Schedule Wave 2 kickoff with Core Banking team", description: "Coordinate with David Kim (Core Banking API lead). Replicate pilot playbook. Target: 4 weeks to onboard 5 teams.", priority: "medium", status: "pending", dueDate: new Date(Date.now() + 7 * 86400_000) },
    { title: "Payments team retrospective", description: "Capture lessons learned from pilot. Document reusable patterns. Get testimonial from Alex Rivera.", priority: "low", status: "completed", completedAt: new Date(Date.now() - 3 * 86400_000), dueDate: new Date(Date.now() - 5 * 86400_000) },
  ];

  for (const t of admiralTasks) {
    await prisma.admiralTask.create({
      data: {
        authorId: admiral.id,
        assigneeId: user.id,
        projectId: project.id,
        title: t.title,
        description: t.description,
        priority: t.priority,
        status: t.status,
        dueDate: t.dueDate,
        completedAt: t.completedAt || null,
      },
    });
  }
  console.log(`✓ ${admiralNotes.length} AdmiralNotes + ${admiralTasks.length} AdmiralTasks`);

  // ─── Done ──────────────────────────────────────────────────────────
  console.log("\n🎉 Demo project fully seeded!");
  console.log(`   Project: ${project.name} (${project.id})`);
  console.log(`   URL: http://localhost:3000/projects/${project.id}`);
  console.log("\n   Login as CSE:     cse@postman.com / pipeline123");
  console.log("   Login as Admin:   jared@postman.com / admiral123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
