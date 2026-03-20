import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const target = body.target as string | undefined;

  const results: string[] = [];

  const daniel = await prisma.user.findUnique({ where: { email: "daniel@postman.com" } });
  const hammad = await prisma.user.findUnique({ where: { email: "hammad@postman.com" } });

  if (!daniel || !hammad) {
    return NextResponse.json({
      error: "Users daniel@postman.com and/or hammad@postman.com not found. Run /api/seed first.",
    }, { status: 400 });
  }

  if (!target || target === "nfl") {
    await seedNFLProject(daniel.id, results);
  }
  if (!target || target === "7-11") {
    await seed711Project(hammad.id, results);
  }

  return NextResponse.json({ success: true, results });
}

function makeId(prefix: string): string {
  return `seed-${prefix}-${Date.now().toString(36)}`;
}

async function createChunksForProject(
  projectId: string,
  documents: Array<{ source: string; title: string; rawText: string }>
) {
  const chunkIds: string[] = [];
  const chunksBySource: Record<string, number> = {};

  for (let i = 0; i < documents.length; i++) {
    const item = documents[i];
    const docId = makeId(`doc-${projectId.slice(-6)}-${i}`);
    const contentHash = crypto.createHash("sha256").update(item.rawText).digest("hex");

    await prisma.sourceDocument.create({
      data: {
        id: docId,
        projectId,
        sourceType: item.source,
        title: item.title,
        rawText: item.rawText,
        contentHash,
        metadataJson: { originalSource: item.source },
      },
    });

    const numChunks = item.rawText.length > 300 ? 2 : 1;
    for (let c = 0; c < numChunks; c++) {
      const chunkId = makeId(`chunk-${projectId.slice(-6)}-${i}-${c}`);
      const evidenceLabel = `EVIDENCE-${chunkIds.length + 1}`;
      const content = c === 0 ? item.rawText : item.rawText.substring(0, Math.floor(item.rawText.length / 2));

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
        projectId,
        content,
        vectorStr,
        Math.floor(content.length / 4),
        evidenceLabel
      );

      chunkIds.push(chunkId);
      chunksBySource[item.source] = (chunksBySource[item.source] || 0) + 1;
    }
  }

  const snapshotHash = crypto.createHash("sha256").update(JSON.stringify(chunkIds.sort())).digest("hex");
  await prisma.evidenceSnapshot.create({
    data: {
      projectId,
      chunkIdsJson: chunkIds,
      countsJson: { bySource: chunksBySource, total: chunkIds.length },
      hash: snapshotHash,
    },
  });

  return { chunkCount: chunkIds.length, docCount: documents.length };
}

// =============================================================================
// NFL Project for Daniel
// =============================================================================

async function seedNFLProject(ownerUserId: string, results: string[]) {
  const existing = await prisma.project.findFirst({
    where: { name: { contains: "NFL", mode: "insensitive" }, ownerUserId },
  });
  if (existing) {
    await prisma.project.delete({ where: { id: existing.id } });
    results.push(`Deleted existing NFL project: ${existing.id}`);
  }

  const project = await prisma.project.create({
    data: {
      name: "NFL",
      primaryDomain: "nfl.com",
      apiDomain: "api.nfl.com",
      publicWorkspaceUrl: "https://www.postman.com/nfl/workspace/nfl-public-apis",
      customerContactName: "Brian Rolapp (CTO)",
      customerContactEmail: "brian.rolapp@nfl.com",
      ownerUserId,
      isPinned: true,
      engagementStage: 3,
    },
  });

  const documents = [
    {
      source: "KEPLER",
      title: "NFL Kepler account overview",
      rawText: "NFL (National Football League) — Major US sports league with $20B+ annual revenue. 32 franchise teams. Headquartered in New York City. 345 million fans in the US. Major digital transformation led by CTO Brian Rolapp. NFL Media division operates NFL.com, NFL App, NFL+, and NFL Network. Engineering org: ~600 engineers across NFL HQ, NFL Media, and NFL Digital. Stadium operations technology team of 80+ people. GameDay operations involve real-time data feeds from all 30+ stadiums simultaneously.",
    },
    {
      source: "KEPLER",
      title: "NFL technology stack and platform notes",
      rawText: "Primary cloud: AWS (confirmed via CloudFront headers on nfl.com). Secondary: Azure for Teams/Office integrations. NFL uses Next Gen Stats powered by AWS Sagemaker for real-time player tracking data. API Gateway: Apigee (Google) for external partner APIs. Internal services use gRPC + REST mix. CDN: Akamai for media delivery, CloudFront for web properties. Database: PostgreSQL on RDS, DynamoDB for real-time stats, Redis for caching. Streaming infrastructure: AWS Elemental MediaLive for NFL+ streaming to 30M+ subscribers. Kubernetes (EKS) for microservices. Average game day generates 500K+ API calls per minute during peak.",
    },
    {
      source: "KEPLER",
      title: "NFL API platform initiative details",
      rawText: "NFL is building a unified API platform to serve 300+ partner integrations (ESPN, Yahoo Sports, betting platforms, fantasy sports). Currently managing 45+ public APIs and 200+ internal APIs. Partner API access generates significant licensing revenue. Pain points: inconsistent API documentation across teams, no centralized testing strategy, partner onboarding takes 6-8 weeks instead of target 2 weeks. NFL wants to standardize API contracts and reduce partner integration time. Current partner developer portal at developer.nfl.com built on custom React app. API governance is fragmented - each team has own standards.",
    },
    {
      source: "KEPLER",
      title: "NFL developer portal and API documentation findings",
      rawText: "Developer portal at developer.nfl.com serves 300+ partner organizations. Portal built on custom React/Node.js stack. 45 public APIs documented with varying quality. Stats API is the most consumed (80% of all partner calls). Real-time scoring API requires WebSocket connections. Fantasy API serves 50M+ fantasy football players during season. API key management via custom-built portal. No Postman workspace detected publicly. Partner sandbox environment exists but frequently out of sync with production. Average API documentation quality score: 6/10 (internal audit). OpenAPI specs exist for ~60% of APIs.",
    },
    {
      source: "KEPLER",
      title: "NFL engineering org structure and key contacts",
      rawText: "CTO: Brian Rolapp. VP Platform Engineering: Michelle McKenna-Doyle. Director of API Platform: Jason Rivera (primary technical contact). Head of Partner Integrations: Tom Park. Security Lead: David Kim (CISO office). 600 total engineers. Platform team: 45 engineers. Partner integration team: 20 engineers. GameDay operations: 80 engineers. Media/streaming: 120 engineers. Mobile team: 60 engineers. QA team: 35 engineers. Infrastructure: 40 engineers. Key initiative: 'API First' mandate from CTO for FY2026.",
    },
    {
      source: "KEPLER",
      title: "NFL compliance and security requirements",
      rawText: "PCI-DSS compliance for NFL Shop and ticketing APIs. SOC 2 Type II certified. Partner data sharing agreements require API audit trails. COPPA compliance for youth-targeted APIs. Data residency requirements for international partners (NFL International). Gambling/betting APIs require additional regulatory compliance in each state. Real-time data feeds must maintain 99.99% uptime during games. Security requirements: OAuth 2.0 for all partner APIs, API key rotation every 90 days, rate limiting per partner tier, DDoS protection mandatory.",
    },
    {
      source: "DNS",
      title: "nfl.com DNS analysis",
      rawText: "A records point to Akamai CDN (23.x range). CNAME api.nfl.com -> Apigee Gateway. MX: Google Workspace. SPF includes amazonses.com and google.com. developer.nfl.com CNAME -> custom EKS deployment. TLS 1.3 on all endpoints. HSTS enabled. Certificate issued by DigiCert. Subdomains found: api.nfl.com, developer.nfl.com, stats.nfl.com, fantasy.nfl.com, gameday.nfl.com, nflplus.nfl.com, shop.nfl.com.",
    },
    {
      source: "DNS",
      title: "api.nfl.com endpoint analysis",
      rawText: "Apigee gateway detected. Rate limiting headers present (X-RateLimit-Limit, X-RateLimit-Remaining). OAuth 2.0 token endpoint at auth.nfl.com/oauth/token. API versioning via URL path (/v3/). Response headers include X-Request-ID for tracing. Average response time: 45ms (cached), 200ms (uncached). GraphQL endpoint detected at api.nfl.com/graphql for stats data. WebSocket endpoint at ws.nfl.com for real-time scoring.",
    },
    {
      source: "MANUAL",
      title: "Meeting notes: Initial discovery call with NFL",
      rawText: "Met with Jason Rivera (Director of API Platform) and Tom Park (Head of Partner Integrations). Key pain points: 1) Partner onboarding takes 6-8 weeks — too slow, target is 2 weeks. 2) No centralized contract testing — each of 45 APIs tested independently. 3) API documentation inconsistency causing partner support tickets (200+/month). 4) GameDay API testing must happen in real-time simulation environment — current setup is fragile. 5) Fantasy API needs load testing for 50M+ user base during draft season. Jason is champion — already using Postman personally. Tom wants automated partner SDK generation from API specs.",
    },
    {
      source: "MANUAL",
      title: "Meeting notes: Security review with NFL CISO team",
      rawText: "David Kim (CISO) requires: all API testing tools must pass SOC 2 audit. No production credentials in testing tools. Secrets must integrate with their existing AWS Secrets Manager setup. API key rotation enforcement. Audit logs for all API interactions. Postman Enterprise SSO via Okta required. Data residency: all testing data must remain in US-East region. Gambling API testing requires additional data isolation.",
    },
    {
      source: "MANUAL",
      title: "NFL partner integration pain point analysis",
      rawText: "Current partner onboarding flow: 1) Manual API documentation review (2 weeks). 2) Sandbox access provisioning (1 week). 3) Integration development by partner (2-3 weeks). 4) Testing and certification (1-2 weeks). Total: 6-8 weeks. With Postman: 1) Postman Collection with examples + Run in Postman button (Day 1). 2) Auto-provisioned sandbox with mock servers (Day 1). 3) Contract testing with CI/CD (1 week). 4) Automated certification tests (2-3 days). Target: 2 weeks total.",
    },
    {
      source: "GITHUB",
      title: "NFL api-platform repo analysis",
      rawText: "Monorepo: nfl-digital/api-platform. 200+ microservices. Language breakdown: Java 40%, Node.js 35%, Python 15%, Go 10%. CI/CD: GitHub Actions + custom deployment tooling. Test coverage: 58% average. Newman used in 12 of 200 pipelines. No contract testing. No mock servers in CI. Average CI pipeline time: 12 minutes. 15 Postman collections found in scattered repos but no central collection management.",
    },
    {
      source: "GITHUB",
      title: "NFL partner-sdk repo analysis",
      rawText: "Partner SDKs generated manually in JavaScript, Python, and Java. Last updated 4 months ago. 23 open issues about outdated SDK methods. No automated SDK generation from OpenAPI specs. SDK documentation lives in README files. No integration tests for SDKs. Partner feedback: SDKs are unreliable and often lag behind API changes by weeks.",
    },
  ];

  const { chunkCount, docCount } = await createChunksForProject(project.id, documents);

  await prisma.discoveryArtifact.create({
    data: {
      projectId: project.id,
      version: 1,
      keplerPaste: `NFL (National Football League) — Largest professional sports league in the US. $20B+ annual revenue, 32 franchise teams, 345 million US fans. Digital operation includes NFL.com, NFL App, NFL+ streaming (30M subscribers), NFL Network. CTO Brian Rolapp driving 'API First' transformation. 600+ engineers across HQ, Media, Digital, and GameDay operations. Managing 45+ public APIs and 200+ internal APIs serving 300+ partner organizations including ESPN, Yahoo Sports, fantasy platforms, and betting partners. Partner API licensing is a significant revenue stream. Current pain: partner onboarding takes 6-8 weeks, no centralized API testing, inconsistent documentation across teams.`,

      dnsFindings: "Primary domain (nfl.com) behind Akamai CDN. API gateway (api.nfl.com) running Apigee. Auth (auth.nfl.com) custom OAuth2 server. Developer portal (developer.nfl.com) on EKS. All domains enforce HSTS and TLS 1.3. Subdomains: api, developer, stats, fantasy, gameday, nflplus, shop. GraphQL endpoint detected at api.nfl.com/graphql. WebSocket at ws.nfl.com for real-time scoring.",

      headerFindings: "X-Powered-By not disclosed (stripped). Rate limiting headers present (X-RateLimit-Limit/Remaining). X-Request-ID for distributed tracing. API versioning via URL path (/v3/). OAuth bearer token authentication. CORS properly configured for partner domains. Average response: 45ms cached, 200ms uncached.",

      publicFootprint: "Developer portal at developer.nfl.com with 45 public APIs. Stats API is most consumed (80% of partner traffic). Fantasy API serves 50M+ users. Real-time scoring via WebSocket. 300+ partner organizations. No public Postman workspace found. Partner sandbox exists but often out of sync with production. OpenAPI specs exist for ~60% of APIs.",

      authForensics: "Custom OAuth 2.0 implementation at auth.nfl.com. API keys for partner identification + OAuth tokens for authorization. Partner tiers: Bronze/Silver/Gold with different rate limits. JWT tokens. API key rotation every 90 days (enforced). AWS Secrets Manager for internal secrets. SSO via Okta for internal teams.",

      cloudGatewaySignals: "AWS primary cloud (Akamai CDN, EKS, RDS, DynamoDB, S3, SQS, Sagemaker). Azure for Teams/Office. Apigee API gateway for external partner APIs. gRPC + REST for internal services. Redis caching layer. AWS Elemental MediaLive for streaming. Kubernetes (EKS) for 200+ microservices. 500K+ API calls/min during game peaks.",

      developerFrictionSignals: "Newman adoption at 6% (12/200 pipelines). No contract testing. No mock servers in CI. 15 scattered Postman collections across repos — no central management. Average CI time 12 minutes. Partner SDKs manually generated and 4 months stale. 200+ partner support tickets/month due to documentation inconsistency. API documentation quality score: 6/10. Partner onboarding: 6-8 weeks (target: 2 weeks).",

      evidenceLinksJson: JSON.stringify([
        { label: "Developer Portal", url: "https://developer.nfl.com" },
        { label: "NFL Engineering Blog", url: "https://engineering.nfl.com" },
        { label: "NFL Stats API", url: "https://api.nfl.com/v3/stats" },
        { label: "Partner Program", url: "https://developer.nfl.com/partners" },
      ]),

      industry: "Sports & Entertainment / Media",
      engineeringSize: "600+ engineers across NFL HQ, Media, Digital, and GameDay",
      publicApiPresence: "Yes",

      technicalLandscapeJson: JSON.stringify([
        { signal: "Primary Cloud", finding: "AWS (Akamai CDN, EKS, RDS, DynamoDB)", evidence: "DNS records, HTTP headers, Kepler notes", confidence: "High" },
        { signal: "CDN / Edge", finding: "Akamai for media, CloudFront for web", evidence: "DNS A records in Akamai IP range", confidence: "High" },
        { signal: "Auth Pattern", finding: "Custom OAuth 2.0 + API keys + Okta SSO", evidence: "auth.nfl.com endpoint analysis", confidence: "High" },
        { signal: "Backend Tech", finding: "Java 40%, Node.js 35%, Python 15%, Go 10%", evidence: "GitHub repo language breakdown", confidence: "High" },
        { signal: "API Gateway", finding: "Apigee (Google) for partner APIs", evidence: "api.nfl.com gateway headers", confidence: "High" },
        { signal: "CI/CD", finding: "GitHub Actions + custom deployment tooling", evidence: "Workflow analysis across repos", confidence: "High" },
        { signal: "Observability", finding: "Custom monitoring + AWS CloudWatch", evidence: "Kepler notes, infrastructure analysis", confidence: "Med" },
        { signal: "Real-time", finding: "WebSocket for live scoring, DynamoDB streams", evidence: "ws.nfl.com endpoint, architecture notes", confidence: "High" },
      ]),

      maturityLevel: 2,
      maturityJustification: "Level 2 — Managed. NFL has significant API infrastructure (45 public APIs, 200+ internal) and established partner program, but API testing is severely fragmented (6% Newman adoption), documentation quality is inconsistent (6/10), and partner onboarding is 3x slower than target. The gap between their API business sophistication and developer tooling maturity is the primary opportunity.",

      confidenceJson: JSON.stringify({
        overall: 85,
        sections: { infrastructure: 92, auth: 88, testing: 70, organization: 80, compliance: 90 },
      }),

      hypothesis: "NFL's 'API First' CTO mandate and $20B revenue creates executive urgency, but 6% Newman adoption across 200 microservices reveals a systemic developer enablement gap. The 300+ partner ecosystem makes this a force-multiplier opportunity — solving partner onboarding (6-8 weeks → 2 weeks) has direct revenue impact. The Postman opportunity is to become the API collaboration layer connecting NFL's 600 engineers with 300+ partner organizations through standardized testing, documentation, and mock environments.",

      recommendedApproach: "Partner-first strategy: demonstrate partner onboarding acceleration from 6-8 weeks to 2 weeks using Postman Collections with Run-in-Postman buttons, auto-provisioned mock servers, and automated contract testing. Start with Stats API (highest partner volume). Address security team early with SOC 2 compliance documentation and AWS Secrets Manager integration. Scale to internal teams via the GameDay operations use case (real-time API testing under load).",

      conversationAngle: "Lead with the partner revenue angle — 300+ partners, 200+ support tickets/month, and 6-8 week onboarding cycle are costing NFL money and partnerships. Position Postman as the partner enablement platform that happens to also solve internal developer productivity. The Fantasy API load testing use case (50M users during draft) is a compelling proof point for the GameDay team.",

      stakeholderTargetsJson: JSON.stringify([
        { role: "Brian Rolapp — CTO", why: "Driving 'API First' mandate. Executive sponsor for platform modernization.", firstMeetingGoal: "Validate that partner onboarding speed is a top priority and get buy-in for a pilot." },
        { role: "Jason Rivera — Director of API Platform", why: "Champion. Already uses Postman personally. Owns the API platform team of 45 engineers.", firstMeetingGoal: "Agree on Stats API as pilot scope and define success criteria for 2-week partner onboarding." },
        { role: "Tom Park — Head of Partner Integrations", why: "Owns 300+ partner relationships. Directly feels the 6-8 week onboarding pain.", firstMeetingGoal: "Map the current onboarding flow and identify where Postman collections + mock servers compress time." },
        { role: "David Kim — CISO", why: "Security gate. All tools must pass SOC 2 audit. Owns AWS Secrets Manager integration.", firstMeetingGoal: "Address SOC 2 compliance upfront. Demo Postman Enterprise SSO and secret management capabilities." },
      ]),

      firstMeetingAgendaJson: JSON.stringify([
        { timeBlock: "5 min", topic: "Validate API First mandate priorities", detail: "Confirm partner onboarding speed and documentation consistency are top 2 pain points." },
        { timeBlock: "10 min", topic: "Current partner onboarding walkthrough", detail: "Map the 6-8 week flow. Identify manual steps that can be automated with Postman." },
        { timeBlock: "10 min", topic: "Stats API pilot proposal", detail: "Propose a 2-week pilot with the Stats API: collection, mock server, contract tests, Run-in-Postman for partners." },
        { timeBlock: "5 min", topic: "Security & compliance quick hits", detail: "Address SOC 2, SSO, secrets management. Set up a follow-up with David Kim's team." },
      ]),

      generatedBriefMarkdown: `# Discovery Brief: NFL

## Company Snapshot
- **Industry**: Sports & Entertainment / Media
- **Engineering Size**: 600+ engineers across NFL HQ, Media, Digital, and GameDay
- **Public API Presence**: Yes — 45 public APIs, 300+ partner organizations
- **Revenue**: $20B+ annual

## Technical Landscape
| Signal | Finding | Evidence | Confidence |
|--------|---------|----------|------------|
| Primary Cloud | AWS (Akamai CDN, EKS, RDS, DynamoDB) | DNS, headers, Kepler | High |
| API Gateway | Apigee (Google) | Gateway headers | High |
| Auth Pattern | Custom OAuth 2.0 + API keys + Okta | Endpoint analysis | High |
| Backend Tech | Java 40%, Node.js 35%, Python 15%, Go 10% | GitHub analysis | High |
| CI/CD | GitHub Actions + custom tooling | Workflow analysis | High |

## API Maturity: Level 2 (Managed)
Significant API infrastructure but fragmented testing (6% Newman adoption), inconsistent documentation (6/10 quality), and slow partner onboarding (6-8 weeks vs. 2-week target).

## Hypothesis
NFL's CTO mandate + $20B revenue creates urgency. 6% Newman adoption across 200 microservices reveals developer enablement gap. 300+ partner ecosystem = force multiplier. Partner onboarding (6-8 → 2 weeks) has direct revenue impact.

## Recommended Approach
Partner-first: Stats API pilot → partner onboarding acceleration → scale to GameDay operations → enterprise rollout.`,

      generatedBriefJson: JSON.stringify({ projectName: "NFL" }),
      aiGenerated: false,
    },
  });

  results.push(`Created NFL project (${project.id}) for Daniel with ${docCount} source docs, ${chunkCount} chunks, and full discovery artifact`);
}

// =============================================================================
// 7-Eleven Project for Hammad
// =============================================================================

async function seed711Project(ownerUserId: string, results: string[]) {
  const existing = await prisma.project.findFirst({
    where: { name: { contains: "7-11", mode: "insensitive" }, ownerUserId },
  });
  const existing2 = await prisma.project.findFirst({
    where: { name: { contains: "7-Eleven", mode: "insensitive" }, ownerUserId },
  });
  for (const e of [existing, existing2]) {
    if (e) {
      await prisma.project.delete({ where: { id: e.id } });
      results.push(`Deleted existing 7-Eleven project: ${e.id}`);
    }
  }

  const project = await prisma.project.create({
    data: {
      name: "7-Eleven",
      primaryDomain: "7-eleven.com",
      apiDomain: "api.7-eleven.com",
      publicWorkspaceUrl: "",
      customerContactName: "Raghu Mahadevan (SVP & CTO)",
      customerContactEmail: "raghu.mahadevan@7-eleven.com",
      ownerUserId,
      isPinned: true,
      engagementStage: 2,
    },
  });

  const documents = [
    {
      source: "KEPLER",
      title: "7-Eleven Kepler account overview",
      rawText: "7-Eleven Inc — World's largest convenience store chain. 13,000+ stores in US/Canada, 83,000+ stores globally across 19 countries. $100B+ global system sales. Headquartered in Dallas, TX. Owned by Seven & i Holdings (Japan). Massive digital transformation initiative: 7NOW delivery app, 7Rewards loyalty (75M+ members), and Speedway integration after 2021 acquisition of 3,800 Speedway locations. CTO: Raghu Mahadevan driving tech modernization. Engineering org: ~400 engineers across Dallas HQ, digital products, and franchise technology.",
    },
    {
      source: "KEPLER",
      title: "7-Eleven technology stack and platform notes",
      rawText: "Primary cloud: GCP (confirmed via Firebase integration in mobile app, GKE for backend services). Secondary: AWS for legacy systems being migrated. Mobile app (7-Eleven App / 7NOW): React Native frontend, Node.js BFF (backend for frontend). Loyalty platform (7Rewards): Java Spring Boot microservices on GKE. Payment processing: custom gateway integrating with multiple PSPs (Stripe, Worldpay). Store systems: edge computing at each of 13,000 locations, real-time inventory sync. CDN: Cloudflare. Database: Cloud SQL (PostgreSQL), Firestore for real-time, BigQuery for analytics. Message queue: Pub/Sub. API Gateway: Apigee (Google) for partner APIs. 300+ microservices across store ops, loyalty, delivery, payments, and franchise systems.",
    },
    {
      source: "KEPLER",
      title: "7-Eleven API platform and integration needs",
      rawText: "7-Eleven is building a unified commerce API platform to connect: 13,000 store POS systems, 7NOW delivery fleet, 7Rewards loyalty engine, franchise management systems, and 50+ third-party delivery partners (DoorDash, Uber Eats, Grubhub, Instacart). Current pain points: each delivery partner integration is custom-built and takes 3-4 months. Franchise systems use 5 different legacy APIs with no standardization. Store inventory API is critical — must sync real-time across 13,000 locations with <2s latency. Payment APIs handle $100M+ daily transaction volume. CTO wants to consolidate 8 separate API gateways into unified Apigee platform with standardized documentation, testing, and partner onboarding.",
    },
    {
      source: "KEPLER",
      title: "7-Eleven developer experience and tooling",
      rawText: "Developer portal: internal-only at devhub.7-eleven.com (not public-facing). 300+ internal APIs, 15+ partner-facing APIs. API documentation quality varies wildly — from excellent (Payments team) to nearly nonexistent (legacy store systems). No Postman workspace detected. Newman not in use. Testing approach: JUnit for Java services, Jest for Node services, no API-level integration testing. Partner integration testing is manual — QA team runs through test scripts in shared Google Docs. Average partner API response time: 120ms. API versioning inconsistent (mix of URL path, header, and no versioning). No mock server infrastructure. Contract testing: none.",
    },
    {
      source: "KEPLER",
      title: "7-Eleven engineering org and key contacts",
      rawText: "CTO: Raghu Mahadevan (driving modernization, 'One Platform' vision). VP Engineering — Digital Products: Priya Sharma. Director of API Platform: Mike Chen (primary technical contact, recently hired from Stripe). Head of Store Technology: Robert Kim. Head of Delivery/Logistics Tech: Amanda Torres. CISO: James Wilson. Total engineering: ~400. Platform team: 30 engineers. Store tech: 80 engineers. Mobile/digital: 60 engineers. Delivery/logistics: 45 engineers. Loyalty: 35 engineers. Payments: 25 engineers. QA: 30 engineers. Infra/SRE: 40 engineers. Key initiative: 'One Platform' — consolidate all APIs under unified governance by end of FY2026.",
    },
    {
      source: "KEPLER",
      title: "7-Eleven compliance and security requirements",
      rawText: "PCI-DSS Level 1 compliant (mandatory for payment processing at $100M+ daily volume). SOC 2 Type II certified. CCPA/GDPR compliance for 7Rewards loyalty data (75M members). Food safety API audit requirements (FDA compliance for 7NOW delivery). Franchise data isolation requirements — each franchise group's data must be segregated. International APIs must handle data residency per country (19 countries). Speedway migration requires backward-compatible APIs during 2-year transition. All partner APIs require mutual TLS. API security: OAuth 2.0 with PKCE for mobile, client credentials for server-to-server, API key + HMAC for legacy POS systems.",
    },
    {
      source: "DNS",
      title: "7-eleven.com DNS analysis",
      rawText: "A records point to Cloudflare (104.x range). api.7-eleven.com CNAME -> Apigee gateway. MX: Google Workspace. SPF includes google.com and sendgrid.net. devhub.7-eleven.com internal only (no public DNS). TLS 1.3 on all endpoints. HSTS enabled. Subdomains found: api, m (mobile), loyalty, delivery, franchise, pos. Certificate by DigiCert.",
    },
    {
      source: "DNS",
      title: "api.7-eleven.com endpoint analysis",
      rawText: "Apigee gateway detected. Rate limiting headers present. OAuth 2.0 endpoints at auth.7-eleven.com. API versioning via URL path (/v2/). X-Request-ID and X-Correlation-ID headers present (distributed tracing). Average response time: 80ms (cached), 250ms (uncached). Separate endpoints for delivery (delivery.api.7-eleven.com), loyalty (loyalty.api.7-eleven.com), and payments (payments.api.7-eleven.com).",
    },
    {
      source: "MANUAL",
      title: "Meeting notes: Initial discovery with 7-Eleven",
      rawText: "Met with Mike Chen (Director of API Platform, former Stripe) and Priya Sharma (VP Engineering). Key takeaways: 1) Mike was hired specifically to build a unified API platform — he's 3 months into the role and evaluating tools. 2) Biggest pain: 50+ delivery partner integrations are each custom and take 3-4 months. Target: 2 weeks. 3) Store inventory API is the most critical — 13,000 stores, real-time sync, <2s latency requirement. 4) Legacy Speedway APIs need backward-compat wrapper for 2-year migration. 5) Mike used Postman extensively at Stripe — strong champion. 6) Budget approved for FY2026 API platform tooling. 7) Priya wants developer velocity metrics to report to CTO.",
    },
    {
      source: "MANUAL",
      title: "Meeting notes: Franchise technology discussion",
      rawText: "Robert Kim (Head of Store Tech) walked through franchise architecture: 5 different POS systems (NCR, Oracle MICROS, Verifone, custom legacy x2). Each franchise group (1,200+ franchisees) has slightly different integration needs. Store systems communicate via edge computing nodes (one per store) that sync to GCP. Real-time inventory: RFID + POS transaction stream → Pub/Sub → inventory service. API latency requirement: <2s for inventory check, <500ms for payment auth. Current testing: manual scripts run once per store software update cycle (~quarterly). No automated store API testing. Robert wants automated regression testing for every POS software update.",
    },
    {
      source: "MANUAL",
      title: "7-Eleven delivery partner integration analysis",
      rawText: "Current delivery partner flow: 1) Legal/business agreement (4-6 weeks). 2) Custom API adapter development (4-6 weeks). 3) Testing in staging (2-3 weeks). 4) Certification and go-live (1-2 weeks). Total: 3-4 months per partner. 50+ delivery partners = massive ongoing maintenance burden. Each adapter is slightly different. With standardized Postman workflow: 1) Standard collection + environment + mock (Day 1). 2) Partner develops against mock, runs contract tests (1 week). 3) Integration testing with automated test suite (3-5 days). 4) Certification via automated test run (1 day). Target: 2 weeks. This would save ~$2M/year in integration engineering costs.",
    },
    {
      source: "GITHUB",
      title: "7-Eleven api-gateway-configs repo analysis",
      rawText: "Apigee proxy configurations for 8 API products. Language: XML/JSON Apigee proxy bundles. CI: Jenkins (legacy, migrating to GitHub Actions). 35 API proxy bundles. Test coverage: 42% (mostly unit tests on proxy logic). No Newman or Postman tests found. Manual test scripts in /tests/manual/ directory (curl commands in shell scripts). Average deployment: weekly for high-velocity services, monthly for stable ones.",
    },
    {
      source: "GITHUB",
      title: "7-Eleven delivery-service repo analysis",
      rawText: "Node.js delivery orchestration service. 12 partner adapters in /adapters/ directory. Each adapter: 400-800 lines of custom integration code. Shared test fixtures for 3 of 12 partners. Jest unit tests: 65% coverage. No integration tests against partner sandboxes. OpenAPI spec exists but is 6 months out of date. README has manual testing instructions: 'Use Postman or curl to test locally.' No Postman collection provided.",
    },
  ];

  const { chunkCount, docCount } = await createChunksForProject(project.id, documents);

  await prisma.discoveryArtifact.create({
    data: {
      projectId: project.id,
      version: 1,
      keplerPaste: `7-Eleven Inc — World's largest convenience store chain. 13,000+ US stores, 83,000+ globally across 19 countries. $100B+ global system sales. Headquartered in Dallas, TX. Massive digital transformation: 7NOW delivery app, 7Rewards loyalty (75M members), Speedway integration (3,800 locations acquired 2021). CTO Raghu Mahadevan driving 'One Platform' vision. ~400 engineers. 300+ microservices across store ops, loyalty, delivery, payments, and franchise systems. 50+ delivery partners (DoorDash, Uber Eats, Grubhub, Instacart). Partner integration takes 3-4 months per partner — target is 2 weeks. 8 separate API gateways being consolidated into unified Apigee platform. Mike Chen (new Director of API Platform, ex-Stripe) is the champion.`,

      dnsFindings: "Primary domain (7-eleven.com) behind Cloudflare CDN. API gateway (api.7-eleven.com) running Apigee. Auth at auth.7-eleven.com. Developer hub (devhub.7-eleven.com) internal only. All domains enforce HSTS and TLS 1.3. Subdomains: api, m (mobile), loyalty, delivery, franchise, pos. Separate API subdomains for delivery, loyalty, and payments.",

      headerFindings: "Apigee gateway headers on API endpoints. Rate limiting present. X-Request-ID and X-Correlation-ID for distributed tracing. API versioning via URL path (/v2/). OAuth bearer token auth. Average response: 80ms cached, 250ms uncached. CORS configured for mobile app origins.",

      publicFootprint: "No public developer portal — devhub.7-eleven.com is internal only. 15+ partner-facing APIs (delivery, inventory, loyalty). 300+ internal APIs. No public Postman workspace. 7Rewards loyalty program has 75M members. 7NOW delivery app available in 2,000+ cities. Store locator and product APIs partially public.",

      authForensics: "OAuth 2.0 with PKCE for mobile apps (7-Eleven App). Client credentials for server-to-server delivery partner integrations. API key + HMAC signature for legacy POS systems (5 different POS vendors). Mutual TLS required for all partner APIs. Auth endpoints at auth.7-eleven.com. Token refresh, API key rotation policies in place.",

      cloudGatewaySignals: "GCP primary cloud (GKE, Cloud SQL, Firestore, BigQuery, Pub/Sub). AWS for legacy systems being migrated. Cloudflare CDN. Apigee API gateway. React Native mobile apps. Node.js BFF. Java Spring Boot microservices. Firebase for push notifications. Edge computing nodes at 13,000 store locations for real-time inventory sync. $100M+ daily payment transaction volume.",

      developerFrictionSignals: "Newman: 0% adoption. No Postman collections in any repos. Testing: JUnit/Jest unit tests only, no API integration testing. Partner integration testing via manual curl scripts in Google Docs. API documentation quality varies wildly (excellent for Payments, nonexistent for legacy store systems). No mock server infrastructure. No contract testing. 50+ delivery partner adapters each custom-built. Average partner onboarding: 3-4 months. QA team of 30 running manual scripts for store API validation (quarterly).",

      evidenceLinksJson: JSON.stringify([
        { label: "7NOW Delivery", url: "https://www.7-eleven.com/7now" },
        { label: "7Rewards Loyalty", url: "https://www.7-eleven.com/7rewards" },
        { label: "Corporate Tech Blog", url: "https://corporate.7-eleven.com/technology" },
      ]),

      industry: "Retail / Convenience / Quick Service",
      engineeringSize: "~400 engineers across Dallas HQ, digital products, and franchise technology",
      publicApiPresence: "Partial",

      technicalLandscapeJson: JSON.stringify([
        { signal: "Primary Cloud", finding: "GCP (GKE, Cloud SQL, Firestore, BigQuery, Pub/Sub)", evidence: "Firebase integration, Kepler notes, DNS analysis", confidence: "High" },
        { signal: "CDN / Edge", finding: "Cloudflare + edge computing at 13K stores", evidence: "DNS A records, store architecture docs", confidence: "High" },
        { signal: "Auth Pattern", finding: "OAuth 2.0 PKCE (mobile) + API key/HMAC (POS) + mTLS (partners)", evidence: "auth.7-eleven.com analysis, meeting notes", confidence: "High" },
        { signal: "Backend Tech", finding: "Java Spring Boot, Node.js, React Native", evidence: "GitHub repos, Kepler notes", confidence: "High" },
        { signal: "API Gateway", finding: "Apigee — consolidating 8 gateways into one", evidence: "DNS CNAME, gateway headers", confidence: "High" },
        { signal: "CI/CD", finding: "Jenkins (legacy) → GitHub Actions migration", evidence: "Repo workflow analysis", confidence: "Med" },
        { signal: "Messaging", finding: "GCP Pub/Sub for event-driven store sync", evidence: "Architecture meeting notes", confidence: "High" },
        { signal: "Edge Computing", finding: "Custom edge nodes at each of 13,000 stores", evidence: "Franchise technology discussion", confidence: "High" },
      ]),

      maturityLevel: 1,
      maturityJustification: "Level 1 — Initial. Despite significant API infrastructure (300+ microservices, 15+ partner APIs), 7-Eleven has zero Newman adoption, no contract testing, no mock servers, manual-only partner integration testing (curl scripts in Google Docs), and wildly inconsistent API documentation. The massive scale (13,000 stores, 50+ delivery partners, $100M daily transactions) makes the testing gap a real operational risk. The new API Platform Director (Mike Chen, ex-Stripe) recognizes this and has budget to fix it.",

      confidenceJson: JSON.stringify({
        overall: 80,
        sections: { infrastructure: 88, auth: 82, testing: 60, organization: 75, compliance: 85 },
      }),

      hypothesis: "7-Eleven's 'One Platform' vision and CTO mandate create executive alignment, but zero automated API testing across 300+ microservices and 50+ delivery partners is an operational risk at $100B system sales scale. The Postman opportunity is dual: 1) Dramatically accelerate delivery partner onboarding from 3-4 months to 2 weeks (saving ~$2M/year), and 2) Build the automated API testing infrastructure that 13,000 stores need for safe, fast software updates. The champion (Mike Chen, ex-Stripe) already knows Postman's capabilities.",

      recommendedApproach: "Delivery partner acceleration first: standardize DoorDash or Uber Eats integration into a Postman Collection + mock server + contract tests, then replicate for remaining 50+ partners. Parallel track: store inventory API testing automation for the franchise technology team. Address security early — PCI-DSS compliance for payment APIs and mTLS for partner connections. Leverage Mike Chen's Stripe experience with Postman to accelerate adoption.",

      conversationAngle: "Lead with the delivery partner onboarding pain — 3-4 months × 50+ partners is unsustainable for a company moving at convenience-store speed. The $2M/year savings from reducing to 2 weeks is a number that resonates with the CTO. Position Postman as the missing layer that turns their Apigee gateway consolidation into a complete API platform play — not just traffic routing, but testing, documentation, and partner enablement.",

      stakeholderTargetsJson: JSON.stringify([
        { role: "Raghu Mahadevan — CTO", why: "Driving 'One Platform' vision. Executive sponsor with FY2026 budget for API tooling.", firstMeetingGoal: "Validate that partner onboarding speed and API testing coverage are top priorities." },
        { role: "Mike Chen — Director of API Platform", why: "Champion. Ex-Stripe, knows Postman well. Hired to build unified API platform. 3 months in.", firstMeetingGoal: "Agree on delivery partner integration as pilot scope. Define success metrics." },
        { role: "Priya Sharma — VP Engineering Digital Products", why: "Owns mobile app and digital experience. Wants developer velocity metrics for CTO reporting.", firstMeetingGoal: "Map current developer workflow and identify where Postman integrates." },
        { role: "Robert Kim — Head of Store Technology", why: "Owns 13,000 store edge systems and 5 POS integrations. Needs automated regression testing.", firstMeetingGoal: "Understand store API testing cycle and propose automated collection-based testing." },
        { role: "Amanda Torres — Head of Delivery/Logistics Tech", why: "Owns 50+ delivery partner integrations. Directly feels the 3-4 month onboarding pain.", firstMeetingGoal: "Walk through current partner onboarding flow. Identify automation opportunities." },
      ]),

      firstMeetingAgendaJson: JSON.stringify([
        { timeBlock: "5 min", topic: "Validate 'One Platform' priorities", detail: "Confirm partner onboarding speed and API testing coverage are the top pain points for FY2026." },
        { timeBlock: "10 min", topic: "Delivery partner integration deep-dive", detail: "Map the 3-4 month onboarding flow. Identify which steps Postman collections + mocks + contract tests compress." },
        { timeBlock: "10 min", topic: "Store API testing discussion", detail: "Understand quarterly manual testing cycle. Propose automated collection-based regression testing for POS integrations." },
        { timeBlock: "5 min", topic: "Security & compliance alignment", detail: "Address PCI-DSS, mTLS, and franchise data isolation requirements. Schedule follow-up with CISO." },
      ]),

      generatedBriefMarkdown: `# Discovery Brief: 7-Eleven

## Company Snapshot
- **Industry**: Retail / Convenience / Quick Service
- **Engineering Size**: ~400 engineers across Dallas HQ, digital, and franchise tech
- **Public API Presence**: Partial — 15+ partner APIs, 300+ internal APIs
- **Scale**: 13,000+ US stores, 83,000+ global, $100B+ system sales

## Technical Landscape
| Signal | Finding | Evidence | Confidence |
|--------|---------|----------|------------|
| Primary Cloud | GCP (GKE, Cloud SQL, Pub/Sub, BigQuery) | Firebase, DNS, Kepler | High |
| API Gateway | Apigee — consolidating 8 gateways | DNS CNAME, headers | High |
| Auth Pattern | OAuth 2.0 PKCE + API key/HMAC + mTLS | Endpoint analysis | High |
| Backend Tech | Java Spring Boot, Node.js, React Native | GitHub repos | High |
| Edge Computing | Custom edge nodes at 13K stores | Architecture notes | High |

## API Maturity: Level 1 (Initial)
300+ microservices but zero Newman adoption, no contract testing, manual partner testing via curl scripts, inconsistent documentation. Massive gap between business scale and API testing maturity.

## Hypothesis
'One Platform' CTO vision + zero API testing = high-urgency opportunity. Delivery partner onboarding (3-4 months → 2 weeks) saves ~$2M/year. Store API testing automation is critical for 13K location operations. Champion (Mike Chen, ex-Stripe) knows Postman.

## Recommended Approach
Delivery partner acceleration first (DoorDash/Uber Eats pilot) → store inventory API testing → enterprise rollout.`,

      generatedBriefJson: JSON.stringify({ projectName: "7-Eleven" }),
      aiGenerated: false,
    },
  });

  results.push(`Created 7-Eleven project (${project.id}) for Hammad with ${docCount} source docs, ${chunkCount} chunks, and full discovery artifact`);
}
