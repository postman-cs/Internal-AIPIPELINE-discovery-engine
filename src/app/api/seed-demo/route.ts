import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/seed-demo
 *
 * Seeds a fully discovered, fleshed-out, and validated demo project
 * ("GlobalBank Financial Services") that has been through the entire
 * pipeline from Discovery → Iteration.
 */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Get the CSE user to own the project
  const user = await prisma.user.findUnique({ where: { email: "cse@postman.com" } });
  if (!user) {
    return NextResponse.json({ error: "Run /api/seed first to create users" }, { status: 400 });
  }

  const PROJECT_ID = "demo-globalbank";
  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);

  // Clean up any existing demo data
  await prisma.project.deleteMany({ where: { id: PROJECT_ID } });

  // ─────────────────────────────────────────────────────────────────────────
  // 1. PROJECT
  // ─────────────────────────────────────────────────────────────────────────

  await prisma.project.create({
    data: {
      id: PROJECT_ID,
      name: "GlobalBank Financial Services",
      primaryDomain: "globalbank.com",
      apiDomain: "api.globalbank.com",
      publicWorkspaceUrl: "https://www.postman.com/globalbank/workspace/globalbank-open-banking",
      ownerUserId: user.id,
      isPinned: true,
      gitProvider: "github",
      gitRepoOwner: "globalbank",
      gitRepoName: "api-platform",
      gitBaseBranch: "main",
    },
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. DISCOVERY ARTIFACT (fully populated)
  // ─────────────────────────────────────────────────────────────────────────

  await prisma.discoveryArtifact.create({
    data: {
      projectId: PROJECT_ID,
      version: 1,
      keplerPaste: `GlobalBank Financial Services — Fortune 500 banking institution. 450+ engineers across 12 product teams. Migrating from monolithic SOAP services to microservices architecture. Currently heavy REST + emerging GraphQL gateway. Key products: Open Banking API (PSD2 compliant), Mobile Banking API, Wealth Management Platform, Payments Processing Engine. Heavy regulatory compliance (PCI-DSS, SOX, GDPR, PSD2). Current pain: inconsistent API testing across teams, manual QA gates slowing releases from monthly to bi-monthly, no standardized contract testing.`,
      dnsFindings: `api.globalbank.com → AWS ALB (us-east-1)\nopen-banking.globalbank.com → CloudFront → API Gateway\npartner-api.globalbank.com → AWS ALB (eu-west-1)\ndeveloper.globalbank.com → Netlify (developer portal)\nstatus.globalbank.com → Statuspage.io\nauth.globalbank.com → Okta CNAME`,
      headerFindings: `Server: AmazonS3 (static), nginx/1.24 (API)\nX-Request-Id: present (distributed tracing)\nStrict-Transport-Security: max-age=31536000\nX-Content-Type-Options: nosniff\nX-RateLimit-Limit: 1000\nX-RateLimit-Remaining: varies\nAPI-Version: 2024-01-15 (header-based versioning)\nContent-Security-Policy: present and strict`,
      publicFootprint: `Developer portal at developer.globalbank.com with OpenAPI specs for Open Banking API (v3.1), Mobile API (v2.0), and Partner API (v1.5). Swagger UI + Redocly. Public Postman workspace exists with 3 collections (sparse, outdated — last updated 8 months ago). npm package @globalbank/sdk published but unmaintained. GitHub org has 12 public repos, mostly client SDKs.`,
      authForensics: `Primary: OAuth 2.0 with PKCE (customer-facing), Client Credentials (B2B partners)\nIdP: Okta (SSO for internal, customer CIAM via Auth0)\nAPI Keys: Legacy system still uses rotating API keys for older partner integrations\nmTLS: Required for PCI-scoped payment endpoints\nJWT issuer: auth.globalbank.com with RS256\nToken lifetime: 15min access, 7d refresh`,
      cloudGatewaySignals: `AWS API Gateway (regional, REST) for Open Banking\nKong Gateway (self-managed on EKS) for internal services\nnginx reverse proxy for legacy SOAP bridge\nCloudFront + WAF for developer portal\nDatadog APM integration detected via headers\nAWS X-Ray trace IDs in response headers`,
      developerFrictionSignals: `Manual Postman collection creation per team (no shared standards)\nNo Newman in CI — tests run manually before release\nAPI versioning inconsistent (header vs URL path vs query param)\nContract testing attempted with Pact but abandoned 6 months ago\nOpenAPI specs drift from implementation within 2 sprints\nNo automated mock servers — teams block on dependencies`,
      evidenceLinksJson: JSON.stringify([
        { label: "EVIDENCE-1", source: "DNS", description: "DNS/infrastructure scan" },
        { label: "EVIDENCE-2", source: "HEADERS", description: "HTTP header analysis" },
        { label: "EVIDENCE-3", source: "KEPLER", description: "Discovery call notes" },
        { label: "EVIDENCE-4", source: "GITHUB", description: "GitHub org analysis" },
        { label: "EVIDENCE-5", source: "MANUAL", description: "Architecture diagram review" },
      ]),
      industry: "Financial Services / Banking",
      engineeringSize: "450+ engineers, 12 product teams, 3 platform teams",
      publicApiPresence: "Strong — PSD2-compliant Open Banking API, developer portal, public workspace",
      technicalLandscapeJson: JSON.stringify({
        languages: ["Java (Spring Boot)", "TypeScript (Node.js)", "Python (ML pipelines)", "Go (infrastructure)"],
        frameworks: ["Spring Boot 3", "Express.js", "FastAPI", "gRPC"],
        cicd: ["Jenkins (legacy)", "GitHub Actions (new teams)", "ArgoCD (GitOps)"],
        cloud: ["AWS (primary)", "Azure (disaster recovery)"],
        databases: ["PostgreSQL", "DynamoDB", "Redis", "MongoDB (legacy)"],
        monitoring: ["Datadog APM", "PagerDuty", "Grafana", "AWS CloudWatch"],
        apiGateways: ["AWS API Gateway", "Kong", "nginx"],
        testing: ["JUnit", "Jest", "Pytest", "Postman (manual)", "Selenium"],
        containers: ["Docker", "EKS (Kubernetes)", "ECR"],
      }),
      maturityLevel: 3,
      maturityJustification: `Level 3 — Defined: GlobalBank has established API standards and a developer portal, but adoption is inconsistent across teams. Some teams have automated testing in CI, most don't. Contract testing was attempted but abandoned. They have the infrastructure (gateways, monitoring) but lack the process consistency to reach Level 4 (Managed). Key gap: no standardized API testing in CI pipelines across all 12 teams.`,
      confidenceJson: JSON.stringify({
        overall: 0.85,
        technicalLandscape: 0.92,
        maturity: 0.78,
        hypothesis: 0.82,
        stakeholders: 0.70,
      }),
      hypothesis: `GlobalBank's primary opportunity is standardizing API testing across all 12 product teams using Postman collections + Newman in their CI pipelines (Jenkins for legacy teams, GitHub Actions for modern teams). The Open Banking API team is the ideal pilot — they already have Postman collections and face PSD2 compliance pressure that mandates comprehensive API testing. Success there creates the template for rolling out to all teams. Secondary play: replace their abandoned Pact contract testing with Postman's native contract testing capabilities.`,
      recommendedApproach: `Phase 1 (Weeks 1-3): Pilot with Open Banking API team — convert existing manual Postman tests to Newman CI runs\nPhase 2 (Weeks 4-8): Expand to Payments and Mobile API teams with standardized collection templates\nPhase 3 (Weeks 9-16): Enterprise rollout to all 12 teams with governance rules, shared workspaces, and automated contract testing\nPhase 4 (Ongoing): Iteration — monitoring dashboards, adoption metrics, champion network`,
      conversationAngle: `Lead with compliance angle: "Your PSD2 requirements mandate API testing evidence for auditors. Right now that's manual and inconsistent. We can automate that chain — every API change triggers tests, results feed into your compliance dashboard, auditors get real-time evidence instead of stale spreadsheets." Follow up with developer velocity: "Your teams are blocked waiting on each other because there are no mock servers. Postman's mock server capability eliminates that dependency bottleneck."`,
      stakeholderTargetsJson: JSON.stringify([
        { role: "VP of Engineering", name: "Sarah Chen", priority: "HIGH", angle: "Platform velocity, reduce release cycle from bi-monthly to weekly" },
        { role: "Head of API Platform", name: "Marcus Rodriguez", priority: "HIGH", angle: "Standardization, governance, developer experience" },
        { role: "CISO", name: "David Park", priority: "MEDIUM", angle: "PCI-DSS compliance evidence automation" },
        { role: "Open Banking Lead", name: "Priya Sharma", priority: "HIGH", angle: "PSD2 compliance testing, partner API quality" },
        { role: "DevOps Lead", name: "Alex Novak", priority: "MEDIUM", angle: "CI/CD integration, pipeline reliability" },
      ]),
      firstMeetingAgendaJson: JSON.stringify([
        { topic: "Current API testing pain points", duration: "10 min", notes: "Let them describe the problem" },
        { topic: "Compliance gap analysis", duration: "10 min", notes: "Show PSD2/PCI testing coverage gaps" },
        { topic: "Live demo: Newman in GitHub Actions", duration: "15 min", notes: "Use their Open Banking API spec" },
        { topic: "Pilot proposal", duration: "10 min", notes: "3-week pilot with Open Banking team" },
        { topic: "Q&A and next steps", duration: "15 min", notes: "Identify blockers early" },
      ]),
      generatedBriefMarkdown: `# GlobalBank Financial Services — Discovery Brief\n\n## Executive Summary\nGlobalBank is a Fortune 500 banking institution with 450+ engineers struggling with inconsistent API testing practices across 12 product teams. Their bi-monthly release cycle is constrained by manual QA gates, and their PSD2/PCI compliance requirements demand automated testing evidence they currently can't produce.\n\n## Opportunity\n**Primary**: Enterprise-wide Postman adoption to standardize API testing in CI/CD pipelines (Newman + GitHub Actions/Jenkins). **Secondary**: Replace abandoned contract testing initiative with Postman's native contract testing.\n\n## Technical Landscape\n- **Cloud**: AWS (primary), Azure (DR)\n- **CI/CD**: Jenkins (legacy) + GitHub Actions (modern teams) + ArgoCD\n- **API Gateways**: AWS API Gateway, Kong, nginx\n- **Languages**: Java, TypeScript, Python, Go\n- **Current Testing**: Manual Postman, JUnit, Jest — no Newman in CI\n\n## Maturity: Level 3 (Defined)\nStandards exist but enforcement is inconsistent. Good infrastructure, weak process adoption.\n\n## Recommended Approach\n1. **Pilot** (3 weeks): Open Banking API team — Newman in GitHub Actions\n2. **Expand** (5 weeks): Payments + Mobile teams with templates\n3. **Enterprise Rollout** (8 weeks): All 12 teams + governance\n4. **Iteration** (Ongoing): Dashboards, champions, optimization\n\n## Key Stakeholders\n- **Sarah Chen** (VP Engineering) — velocity champion\n- **Marcus Rodriguez** (API Platform Head) — standardization owner\n- **Priya Sharma** (Open Banking Lead) — pilot sponsor\n\n## Risks & Blockers\n- Security team approval for Newman in CI (PCI scope concerns)\n- Legacy Jenkins teams resistant to change\n- Budget approval needed for enterprise license`,
      generatedBriefJson: JSON.stringify({
        executiveSummary: "Fortune 500 bank, 450+ engineers, needs standardized API testing in CI pipelines",
        opportunity: "Enterprise Postman adoption — Newman in CI + contract testing",
        maturityLevel: 3,
        approachPhases: 4,
        keyStakeholders: 5,
        riskCount: 3,
      }),
      aiGenerated: true,
      aiRunIds: JSON.stringify(["demo-airun-recon", "demo-airun-signal", "demo-airun-maturity", "demo-airun-hypothesis", "demo-airun-brief"]),
      createdAt: daysAgo(30),
    },
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. AI RUNS (completed discovery pipeline)
  // ─────────────────────────────────────────────────────────────────────────

  const aiRunData = [
    { id: "demo-airun-recon", agentType: "recon_synthesis", model: "gpt-4.1", durationMs: 12400, createdAt: daysAgo(30) },
    { id: "demo-airun-signal", agentType: "signal_classification", model: "gpt-4.1", durationMs: 8200, createdAt: daysAgo(30) },
    { id: "demo-airun-maturity", agentType: "maturity_scoring", model: "gpt-4.1", durationMs: 6800, createdAt: daysAgo(29) },
    { id: "demo-airun-hypothesis", agentType: "hypothesis_generation", model: "claude-sonnet-4-20250514", durationMs: 15200, createdAt: daysAgo(29) },
    { id: "demo-airun-brief", agentType: "brief_generation", model: "claude-sonnet-4-20250514", durationMs: 18600, createdAt: daysAgo(29) },
    { id: "demo-airun-topo-current", agentType: "current_topology", model: "gpt-4.1", durationMs: 11300, createdAt: daysAgo(27) },
    { id: "demo-airun-topo-future", agentType: "future_state_design", model: "claude-sonnet-4-20250514", durationMs: 14700, createdAt: daysAgo(26) },
    { id: "demo-airun-solution", agentType: "solution_design", model: "claude-sonnet-4-20250514", durationMs: 19200, createdAt: daysAgo(25) },
    { id: "demo-airun-infra", agentType: "infrastructure_planning", model: "gpt-4.1", durationMs: 16400, createdAt: daysAgo(24) },
    { id: "demo-airun-test", agentType: "test_design", model: "gpt-4.1", durationMs: 13100, createdAt: daysAgo(23) },
    { id: "demo-airun-craft", agentType: "craft_solution", model: "claude-sonnet-4-20250514", durationMs: 22800, createdAt: daysAgo(22) },
    { id: "demo-airun-testrun", agentType: "test_solution", model: "gpt-4.1", durationMs: 9600, createdAt: daysAgo(21) },
    { id: "demo-airun-deploy", agentType: "deployment_planning", model: "gpt-4.1", durationMs: 14200, createdAt: daysAgo(20) },
    { id: "demo-airun-monitor", agentType: "monitoring_planning", model: "gpt-4.1", durationMs: 10800, createdAt: daysAgo(19) },
    { id: "demo-airun-iterate", agentType: "iteration_planning", model: "claude-sonnet-4-20250514", durationMs: 17500, createdAt: daysAgo(18) },
    { id: "demo-airun-missile1", agentType: "missile_designer", model: "claude-sonnet-4-20250514", durationMs: 8900, createdAt: daysAgo(15) },
    { id: "demo-airun-nuke1", agentType: "nuke_strategist", model: "claude-sonnet-4-20250514", durationMs: 11200, createdAt: daysAgo(12) },
  ];

  for (const run of aiRunData) {
    await prisma.aIRun.create({
      data: {
        id: run.id,
        projectId: PROJECT_ID,
        agentType: run.agentType,
        model: run.model,
        promptHash: `demo-hash-${run.agentType}`,
        inputJson: { projectId: PROJECT_ID, demo: true },
        outputJson: { status: "completed", agentType: run.agentType },
        tokenUsage: { promptTokens: 2000 + Math.floor(Math.random() * 3000), completionTokens: 1000 + Math.floor(Math.random() * 2000) },
        durationMs: run.durationMs,
        status: "SUCCESS",
        createdAt: run.createdAt,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. PHASE ARTIFACTS (all 11 phases — CLEAN)
  // ─────────────────────────────────────────────────────────────────────────

  // Build topology contentJson matching TopoNode/TopoEdge interfaces
  // Required fields: id, type, name, metadata, evidenceIds, confidence
  const topoNodes = [
    { id: "topo-client-web", type: "CLIENT", name: "Web Banking App", metadata: { tech: "React", env: "production" }, evidenceIds: ["EVIDENCE-1"], confidence: "High" },
    { id: "topo-client-mobile", type: "CLIENT", name: "Mobile Banking App", metadata: { tech: "React Native", env: "production" }, evidenceIds: ["EVIDENCE-1"], confidence: "High" },
    { id: "topo-cdn", type: "CDN", name: "CloudFront CDN", metadata: { provider: "AWS", region: "global" }, evidenceIds: ["EVIDENCE-2"], confidence: "High" },
    { id: "topo-waf", type: "LOAD_BALANCER", name: "AWS WAF + ALB", metadata: { provider: "AWS", region: "us-east-1" }, evidenceIds: ["EVIDENCE-2"], confidence: "High" },
    { id: "topo-apigw", type: "GATEWAY", name: "AWS API Gateway", metadata: { type: "REST regional", purpose: "Open Banking" }, evidenceIds: ["EVIDENCE-2", "EVIDENCE-3"], confidence: "High" },
    { id: "topo-kong", type: "GATEWAY", name: "Kong Gateway (EKS)", metadata: { version: "3.4", purpose: "Internal routing" }, evidenceIds: ["EVIDENCE-3", "EVIDENCE-5"], confidence: "High" },
    { id: "topo-okta", type: "IDENTITY_PROVIDER", name: "Okta / Auth0", metadata: { protocols: ["OAuth2", "OIDC", "SAML"] }, evidenceIds: ["EVIDENCE-2"], confidence: "High" },
    { id: "topo-openbanking", type: "SERVICE", name: "Open Banking API", metadata: { tech: "Spring Boot 3", lang: "Java 21", team: "Open Banking" }, evidenceIds: ["EVIDENCE-3", "EVIDENCE-4"], confidence: "High" },
    { id: "topo-payments", type: "SERVICE", name: "Payments Engine", metadata: { tech: "Spring Boot 3", lang: "Java 21", team: "Payments" }, evidenceIds: ["EVIDENCE-3"], confidence: "High" },
    { id: "topo-mobile-bff", type: "SERVICE", name: "Mobile BFF", metadata: { tech: "Express.js", lang: "TypeScript", team: "Mobile" }, evidenceIds: ["EVIDENCE-3"], confidence: "Medium" },
    { id: "topo-partner", type: "SERVICE", name: "Partner Gateway", metadata: { tech: "Go 1.22", team: "Partnerships" }, evidenceIds: ["EVIDENCE-3"], confidence: "Medium" },
    { id: "topo-wealth", type: "SERVICE", name: "Wealth Management API", metadata: { tech: "Spring Boot 2.7", lang: "Java 17", team: "Wealth" }, evidenceIds: ["EVIDENCE-5"], confidence: "Medium" },
    { id: "topo-notification", type: "SERVICE", name: "Notification Service", metadata: { tech: "Node.js", team: "Platform" }, evidenceIds: ["EVIDENCE-5"], confidence: "Low" },
    { id: "topo-postgres", type: "DATABASE", name: "PostgreSQL (RDS)", metadata: { version: "15", purpose: "Transactional data" }, evidenceIds: ["EVIDENCE-5"], confidence: "High" },
    { id: "topo-dynamo", type: "DATABASE", name: "DynamoDB", metadata: { purpose: "Session store, event sourcing" }, evidenceIds: ["EVIDENCE-5"], confidence: "Medium" },
    { id: "topo-redis", type: "DATABASE", name: "Redis (ElastiCache)", metadata: { purpose: "Caching, rate limiting" }, evidenceIds: ["EVIDENCE-5"], confidence: "Medium" },
    { id: "topo-sqs", type: "QUEUE", name: "Amazon SQS", metadata: { purpose: "Async payment processing" }, evidenceIds: ["EVIDENCE-5"], confidence: "Medium" },
    { id: "topo-s3", type: "STORAGE", name: "S3 (Document Store)", metadata: { purpose: "Statements, reports" }, evidenceIds: ["EVIDENCE-5"], confidence: "Low" },
    { id: "topo-external-swift", type: "EXTERNAL_SYSTEM", name: "SWIFT Network", metadata: { purpose: "International payments" }, evidenceIds: ["EVIDENCE-3"], confidence: "High" },
    { id: "topo-external-credit", type: "EXTERNAL_SYSTEM", name: "Credit Bureau API", metadata: { purpose: "Credit checks" }, evidenceIds: ["EVIDENCE-3"], confidence: "Medium" },
  ];
  const topoEdges = [
    { from: "topo-client-web", to: "topo-cdn", type: "ROUTES_THROUGH", evidenceIds: ["EVIDENCE-2"], confidence: "High" },
    { from: "topo-client-mobile", to: "topo-waf", type: "ROUTES_THROUGH", evidenceIds: ["EVIDENCE-2"], confidence: "High" },
    { from: "topo-cdn", to: "topo-waf", type: "ROUTES_THROUGH", evidenceIds: ["EVIDENCE-2"], confidence: "High" },
    { from: "topo-waf", to: "topo-apigw", type: "ROUTES_THROUGH", evidenceIds: ["EVIDENCE-2"], confidence: "High" },
    { from: "topo-waf", to: "topo-kong", type: "ROUTES_THROUGH", evidenceIds: ["EVIDENCE-2"], confidence: "High" },
    { from: "topo-apigw", to: "topo-openbanking", type: "CALLS", evidenceIds: ["EVIDENCE-3"], confidence: "High" },
    { from: "topo-kong", to: "topo-payments", type: "CALLS", evidenceIds: ["EVIDENCE-3"], confidence: "High" },
    { from: "topo-kong", to: "topo-mobile-bff", type: "CALLS", evidenceIds: ["EVIDENCE-3"], confidence: "Medium" },
    { from: "topo-kong", to: "topo-partner", type: "CALLS", evidenceIds: ["EVIDENCE-3"], confidence: "Medium" },
    { from: "topo-kong", to: "topo-wealth", type: "CALLS", evidenceIds: ["EVIDENCE-5"], confidence: "Medium" },
    { from: "topo-openbanking", to: "topo-okta", type: "AUTHENTICATES_WITH", evidenceIds: ["EVIDENCE-2"], confidence: "High" },
    { from: "topo-payments", to: "topo-okta", type: "AUTHENTICATES_WITH", evidenceIds: ["EVIDENCE-2"], confidence: "High" },
    { from: "topo-mobile-bff", to: "topo-okta", type: "AUTHENTICATES_WITH", evidenceIds: ["EVIDENCE-2"], confidence: "Medium" },
    { from: "topo-openbanking", to: "topo-postgres", type: "READS_FROM", evidenceIds: ["EVIDENCE-5"], confidence: "High" },
    { from: "topo-payments", to: "topo-postgres", type: "WRITES_TO", evidenceIds: ["EVIDENCE-5"], confidence: "High" },
    { from: "topo-payments", to: "topo-sqs", type: "WRITES_TO", evidenceIds: ["EVIDENCE-5"], confidence: "Medium" },
    { from: "topo-payments", to: "topo-external-swift", type: "CALLS", evidenceIds: ["EVIDENCE-3"], confidence: "High" },
    { from: "topo-mobile-bff", to: "topo-dynamo", type: "READS_FROM", evidenceIds: ["EVIDENCE-5"], confidence: "Medium" },
    { from: "topo-mobile-bff", to: "topo-redis", type: "READS_FROM", evidenceIds: ["EVIDENCE-5"], confidence: "Medium" },
    { from: "topo-partner", to: "topo-openbanking", type: "CALLS", evidenceIds: ["EVIDENCE-3"], confidence: "Medium" },
    { from: "topo-partner", to: "topo-external-credit", type: "CALLS", evidenceIds: ["EVIDENCE-3"], confidence: "Medium" },
    { from: "topo-wealth", to: "topo-postgres", type: "READS_FROM", evidenceIds: ["EVIDENCE-5"], confidence: "Medium" },
    { from: "topo-notification", to: "topo-sqs", type: "READS_FROM", evidenceIds: ["EVIDENCE-5"], confidence: "Low" },
    { from: "topo-notification", to: "topo-s3", type: "WRITES_TO", evidenceIds: ["EVIDENCE-5"], confidence: "Low" },
  ];

  // Rich contentJson per phase — these match what each page actually reads
  const phaseContentMap: Record<string, object> = {
    DISCOVERY: {
      summary: "Comprehensive discovery of GlobalBank's API landscape, 450+ engineers, 12 teams, Level 3 maturity",
    },
    CURRENT_TOPOLOGY: {
      nodes: topoNodes,
      edges: topoEdges,
      summary: "20 nodes, 24 edges mapped across GlobalBank's microservices architecture",
    },
    DESIRED_FUTURE_STATE: {
      goals: ["Newman in all 12 CI pipelines", "Contract testing at every service boundary", "Shared Postman workspaces with governance", "Automated PSD2/PCI compliance evidence", "Mock servers for dependency isolation"],
      summary: "5 strategic goals defined for enterprise API testing transformation",
    },
    SOLUTION_DESIGN: {
      phases: [
        { name: "Pilot", teams: ["Open Banking"], duration: "3 weeks", focus: "Newman in GitHub Actions" },
        { name: "Expand", teams: ["Payments", "Mobile"], duration: "5 weeks", focus: "Templates + Jenkins adapter" },
        { name: "Enterprise", teams: ["All 12 teams"], duration: "8 weeks", focus: "Governance + contract testing" },
      ],
      summary: "3-phase rollout plan from pilot to enterprise-wide adoption",
    },
    INFRASTRUCTURE: {
      cloudResources: [
        { name: "Newman Runner (EKS)", type: "container", provider: "AWS", region: "us-east-1", purpose: "Runs Newman test suites in CI pipelines", specs: "0.5 vCPU, 512MB RAM per pod" },
        { name: "Test Results S3 Bucket", type: "storage", provider: "AWS", region: "us-east-1", purpose: "Stores Newman HTML reports and JUnit XML", specs: "Standard tier, 90-day lifecycle" },
        { name: "Secrets Manager", type: "secrets", provider: "AWS", region: "us-east-1", purpose: "Postman API keys, environment variables", specs: "Automatic rotation every 90 days" },
      ],
      iacSnippets: [
        { name: "GitHub Actions — Newman Workflow", platform: "github_actions", language: "yaml", code: "name: Postman API Tests\non:\n  pull_request:\n    branches: [main]\n  schedule:\n    - cron: '0 2 * * *'\njobs:\n  api-tests:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Run Newman\n        uses: matt-ball/newman-action@master\n        with:\n          collection: postman/GlobalBank-OpenBanking-Smoke.json\n          environment: postman/staging.json\n          reporters: cli,junit\n      - name: Upload Results\n        if: always()\n        uses: actions/upload-artifact@v4\n        with:\n          name: newman-results\n          path: newman/" },
        { name: "Jenkins — Newman Shared Library", platform: "jenkins", language: "groovy", code: "// Jenkinsfile\n@Library('globalbank-shared') _\npipeline {\n  agent { docker { image 'postman/newman:6-alpine' } }\n  stages {\n    stage('API Tests') {\n      steps {\n        newmanRun(\n          collection: 'postman/GlobalBank-Payments-Smoke.json',\n          environment: 'postman/staging.json',\n          reporters: ['cli', 'junit', 'html']\n        )\n      }\n      post { always { junit 'newman/*.xml' } }\n    }\n  }\n}" },
        { name: "ArgoCD — Post-Sync Newman Hook", platform: "argocd", language: "yaml", code: "apiVersion: batch/v1\nkind: Job\nmetadata:\n  name: newman-post-deploy\n  annotations:\n    argocd.argoproj.io/hook: PostSync\nspec:\n  template:\n    spec:\n      containers:\n        - name: newman\n          image: postman/newman:6-alpine\n          command: ['newman', 'run']\n          args:\n            - '/collections/smoke-tests.json'\n            - '-e', '/environments/production.json'\n            - '--reporters', 'cli,junit'\n      restartPolicy: Never" },
      ],
      containerManifests: [
        { name: "Newman Runner Pod", format: "kubernetes", code: "apiVersion: v1\nkind: Pod\nmetadata:\n  name: newman-runner\n  namespace: ci-testing\nspec:\n  containers:\n    - name: newman\n      image: postman/newman:6-alpine\n      resources:\n        requests: { cpu: '250m', memory: '256Mi' }\n        limits: { cpu: '500m', memory: '512Mi' }\n      volumeMounts:\n        - name: collections\n          mountPath: /collections\n  volumes:\n    - name: collections\n      configMap:\n        name: postman-collections" },
      ],
      secretsBlueprint: [
        { name: "Postman API Key", store: "AWS Secrets Manager", path: "globalbank/postman/api-key", rotationDays: 90, accessRoles: ["ci-runner", "devops-admin"] },
        { name: "Newman Environment Variables", store: "AWS SSM Parameter Store", path: "/globalbank/newman/env/*", rotationDays: 0, accessRoles: ["ci-runner"] },
        { name: "mTLS Client Certificate", store: "AWS ACM", path: "arn:aws:acm:us-east-1:*:certificate/*", rotationDays: 365, accessRoles: ["newman-runner-role"] },
      ],
      summary: "3 cloud resources, 3 IaC snippets (GitHub Actions, Jenkins, ArgoCD), 1 container manifest, 3 secrets defined",
    },
    TEST_DESIGN: {
      testCases: [
        { name: "Open Banking — Health Check", testType: "smoke", targetComponentId: "topo-openbanking", postmanTestScript: "pm.test('Status is 200', () => pm.response.to.have.status(200));\npm.test('Response time < 500ms', () => pm.expect(pm.response.responseTime).to.be.below(500));", newmanCommand: "newman run GlobalBank-OpenBanking-Smoke.json -e staging.json --reporters cli,junit" },
        { name: "Open Banking — OAuth2 PKCE Flow", testType: "smoke", targetComponentId: "topo-openbanking", postmanTestScript: "pm.test('Token endpoint returns access_token', () => {\n  const json = pm.response.json();\n  pm.expect(json).to.have.property('access_token');\n  pm.expect(json.token_type).to.equal('Bearer');\n});", newmanCommand: "newman run GlobalBank-OpenBanking-Smoke.json --folder 'Auth Flow' -e staging.json" },
        { name: "Open Banking — Account List Contract", testType: "contract", targetComponentId: "topo-openbanking", postmanTestScript: "const schema = JSON.parse(pm.environment.get('account_list_schema'));\npm.test('Response matches OpenAPI schema', () => {\n  pm.response.to.have.jsonSchema(schema);\n});\npm.test('Pagination headers present', () => {\n  pm.response.to.have.header('X-Total-Count');\n});", newmanCommand: "newman run GlobalBank-OpenBanking-Contracts.json --folder 'Accounts' -e staging.json" },
        { name: "Payments — Create Payment", testType: "smoke", targetComponentId: "topo-payments", postmanTestScript: "pm.test('Payment created with 201', () => pm.response.to.have.status(201));\npm.test('Payment ID returned', () => {\n  const json = pm.response.json();\n  pm.expect(json.paymentId).to.be.a('string');\n  pm.collectionVariables.set('paymentId', json.paymentId);\n});", newmanCommand: "newman run GlobalBank-Payments-Smoke.json -e staging.json --reporters cli,junit" },
        { name: "Payments ↔ Partner Contract", testType: "contract", targetComponentId: "topo-partner", postmanTestScript: "pm.test('Partner callback schema valid', () => {\n  const schema = JSON.parse(pm.environment.get('partner_callback_schema'));\n  pm.response.to.have.jsonSchema(schema);\n});\npm.test('Idempotency key honored', () => {\n  pm.response.to.have.status(200); // not 201 on retry\n});", newmanCommand: "newman run GlobalBank-OpenBanking-Contracts.json --folder 'Partner Callbacks' -e staging.json" },
        { name: "Mobile BFF — GraphQL Query", testType: "smoke", targetComponentId: "topo-mobile-bff", postmanTestScript: "pm.test('GraphQL response has data', () => {\n  const json = pm.response.json();\n  pm.expect(json).to.have.property('data');\n  pm.expect(json).to.not.have.property('errors');\n});", newmanCommand: "newman run GlobalBank-Mobile-Smoke.json -e staging.json" },
        { name: "End-to-End Payment Flow", testType: "integration", targetComponentId: "topo-payments", postmanTestScript: "// Runs after payment creation + SWIFT settlement\npm.test('Payment status is SETTLED', () => {\n  const json = pm.response.json();\n  pm.expect(json.status).to.equal('SETTLED');\n});\npm.test('Settlement amount matches', () => {\n  const json = pm.response.json();\n  pm.expect(json.settledAmount).to.equal(pm.collectionVariables.get('amount'));\n});", newmanCommand: "newman run GlobalBank-Integration.json -e staging.json --timeout-request 30000" },
        { name: "PSD2 Compliance — TPP Access", testType: "contract", targetComponentId: "topo-openbanking", postmanTestScript: "pm.test('TPP consent endpoint available', () => pm.response.to.have.status(200));\npm.test('Strong Customer Authentication header', () => {\n  pm.response.to.have.header('X-SCA-Required');\n});\npm.test('Consent ID format valid', () => {\n  pm.expect(pm.response.json().consentId).to.match(/^consent-[a-f0-9]+$/);\n});", newmanCommand: "newman run GlobalBank-OpenBanking-Contracts.json --folder 'PSD2 TPP' -e staging.json" },
      ],
      summary: "8 test cases across smoke, contract, and integration tiers",
    },
    CRAFT_SOLUTION: {
      postmanCollections: [
        {
          name: "GlobalBank-OpenBanking-Smoke",
          description: "Smoke tests for Open Banking API — health, auth, CRUD, edge cases",
          folders: [
            { name: "Health", requests: [
              { method: "GET" as const, name: "API Health Check", urlPattern: "/api/v1/health", description: "Verify API is responding" },
              { method: "GET" as const, name: "Version Endpoint", urlPattern: "/api/v1/version", description: "Check deployed version" },
            ]},
            { name: "Auth", requests: [
              { method: "POST" as const, name: "OAuth Token", urlPattern: "/oauth/token", description: "Obtain access token via PKCE" },
              { method: "POST" as const, name: "Token Refresh", urlPattern: "/oauth/token/refresh", description: "Refresh access token" },
              { method: "GET" as const, name: "JWKS Endpoint", urlPattern: "/.well-known/jwks.json", description: "Validate signing keys" },
            ]},
            { name: "Accounts", requests: [
              { method: "GET" as const, name: "List Accounts", urlPattern: "/api/v1/accounts", description: "List all accounts for authenticated user" },
              { method: "GET" as const, name: "Account Detail", urlPattern: "/api/v1/accounts/:id", description: "Get account details" },
              { method: "GET" as const, name: "Balances", urlPattern: "/api/v1/accounts/:id/balances", description: "Get account balances" },
            ]},
          ],
        },
        {
          name: "GlobalBank-OpenBanking-Contracts",
          description: "Contract tests validating OpenAPI schema compliance for all 128 endpoints",
          folders: [
            { name: "Schema Validation", requests: [
              { method: "GET" as const, name: "Accounts Schema", urlPattern: "/api/v1/accounts", description: "Validate response against OpenAPI schema" },
              { method: "GET" as const, name: "Transactions Schema", urlPattern: "/api/v1/accounts/:id/transactions", description: "Validate transaction response schema" },
            ]},
            { name: "Error Contracts", requests: [
              { method: "GET" as const, name: "401 Unauthorized", urlPattern: "/api/v1/accounts", description: "Verify 401 response structure" },
              { method: "GET" as const, name: "404 Not Found", urlPattern: "/api/v1/accounts/nonexistent", description: "Verify 404 response structure" },
            ]},
          ],
        },
        {
          name: "GlobalBank-Payments-Smoke",
          description: "Smoke tests for Payments Engine — create, settle, refund flows",
          folders: [
            { name: "Payments", requests: [
              { method: "POST" as const, name: "Create Payment", urlPattern: "/api/v1/payments", description: "Initiate a domestic payment" },
              { method: "GET" as const, name: "Payment Status", urlPattern: "/api/v1/payments/:id", description: "Check payment status" },
              { method: "POST" as const, name: "Refund Payment", urlPattern: "/api/v1/payments/:id/refund", description: "Initiate a refund" },
            ]},
          ],
        },
        {
          name: "GlobalBank-Mobile-Smoke",
          description: "GraphQL and REST smoke tests for Mobile BFF",
          folders: [
            { name: "Mobile BFF", requests: [
              { method: "POST" as const, name: "GraphQL Query", urlPattern: "/graphql", description: "Query account dashboard data" },
              { method: "GET" as const, name: "Feature Flags", urlPattern: "/api/mobile/features", description: "Get mobile feature flags" },
            ]},
          ],
        },
      ],
      newmanRunConfigs: [
        {
          name: "PR Smoke Tests",
          description: "Run smoke tests on every pull request to catch regressions early",
          collectionRef: "GlobalBank-OpenBanking-Smoke",
          environmentRef: "staging",
          reporters: ["cli", "junit"],
          bailOnFailure: false,
        },
        {
          name: "Nightly Contract Suite",
          description: "Run full contract test suite nightly to detect schema drift",
          collectionRef: "GlobalBank-OpenBanking-Contracts",
          environmentRef: "staging",
          reporters: ["cli", "junit", "htmlextra"],
          bailOnFailure: true,
        },
        {
          name: "Post-Deploy Verification",
          description: "Run smoke tests after production deployment as a deployment gate",
          collectionRef: "GlobalBank-OpenBanking-Smoke",
          environmentRef: "production",
          reporters: ["cli", "junit"],
          bailOnFailure: true,
        },
      ],
      ciCdPipelines: [
        {
          platform: "github_actions",
          platformLabel: "GitHub Actions",
          configLanguage: "yaml",
          filename: ".github/workflows/postman-api-tests.yml",
          description: "Open Banking CI — runs smoke tests on PR, full contract suite on merge to main",
          configContent: "name: API Tests\non:\n  pull_request:\n    branches: [main]\n  push:\n    branches: [main]\n\njobs:\n  smoke-tests:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Install Newman\n        run: npm install -g newman newman-reporter-htmlextra\n      - name: Run Smoke Tests\n        run: |\n          newman run collections/GlobalBank-OpenBanking-Smoke.postman_collection.json \\\n            -e environments/staging.postman_environment.json \\\n            --reporters cli,junit \\\n            --reporter-junit-export results/smoke-results.xml\n      - name: Upload Results\n        uses: actions/upload-artifact@v4\n        if: always()\n        with:\n          name: newman-results\n          path: results/\n      - name: Publish Test Report\n        uses: dorny/test-reporter@v1\n        if: always()\n        with:\n          name: Newman Smoke Tests\n          path: results/smoke-results.xml\n          reporter: java-junit",
        },
        {
          platform: "github_actions",
          platformLabel: "GitHub Actions",
          configLanguage: "yaml",
          filename: ".github/workflows/payments-tests.yml",
          description: "Payments CI — smoke tests for the Payments Engine on every PR",
          configContent: "name: Payments API Tests\non:\n  pull_request:\n    paths:\n      - 'services/payments/**'\n\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Install Newman\n        run: npm install -g newman\n      - name: Run Payments Smoke\n        run: |\n          newman run collections/GlobalBank-Payments-Smoke.postman_collection.json \\\n            -e environments/staging.postman_environment.json \\\n            --reporters cli,junit",
        },
        {
          platform: "jenkins",
          platformLabel: "Jenkins",
          configLanguage: "groovy",
          filename: "Jenkinsfile",
          description: "Legacy Jenkins pipeline for Wealth Management and Risk teams",
          configContent: "pipeline {\n  agent {\n    docker {\n      image 'postman/newman:6-alpine'\n      args '--entrypoint=\"\"'\n    }\n  }\n  environment {\n    POSTMAN_API_KEY = credentials('postman-api-key')\n  }\n  stages {\n    stage('Run API Tests') {\n      steps {\n        sh '''\n          newman run collections/GlobalBank-OpenBanking-Smoke.postman_collection.json \\\n            -e environments/staging.postman_environment.json \\\n            --reporters cli,junit \\\n            --reporter-junit-export newman/results.xml\n        '''\n      }\n    }\n  }\n  post {\n    always {\n      junit 'newman/*.xml'\n      archiveArtifacts artifacts: 'newman/**', allowEmptyArchive: true\n    }\n  }\n}",
        },
      ],
      ciCdNotes: [
        "GitHub Actions is the primary CI platform for 9 of 12 teams",
        "Jenkins shared library wraps Newman for the 3 legacy teams (Wealth, Insurance, Risk)",
        "ArgoCD post-sync hooks verify deployment health with Newman smoke tests",
        "All Newman runs report results to the pipeline dashboard via webhook",
      ],
      implementationPlan: [
        { step: 1, title: "Export and version control collections", description: "Export all 4 Postman collections and environment files to the monorepo under /collections and /environments directories", targetComponents: ["topo-openbanking", "topo-payments", "topo-mobile-bff"], evidenceIds: ["EVIDENCE-3", "EVIDENCE-4"] },
        { step: 2, title: "Configure CI pipelines", description: "Set up GitHub Actions workflows for PR smoke tests and nightly contract runs; configure Jenkins shared library for legacy teams", targetComponents: ["topo-kong", "topo-openbanking"], evidenceIds: ["EVIDENCE-3"] },
        { step: 3, title: "Deploy Newman runners", description: "Deploy self-hosted GitHub Actions runners in VPC for internal API access; configure Docker-based Newman execution", targetComponents: ["topo-kong", "topo-apigw"], evidenceIds: ["EVIDENCE-2"] },
        { step: 4, title: "Integrate monitoring", description: "Set up Postman Monitors for production health checks; configure webhook for result reporting to dashboard", targetComponents: ["topo-openbanking", "topo-payments"], evidenceIds: ["EVIDENCE-3", "EVIDENCE-5"] },
      ],
      migrationSteps: [
        "Phase 1: Open Banking team pilot (2 weeks)",
        "Phase 2: Payments team onboarding (2 weeks)",
        "Phase 3: Mobile and Partner teams (2 weeks)",
        "Phase 4: Remaining teams with self-service wizard",
      ],
      estimatedEffort: "8-12 weeks for full 12-team rollout",
      summary: "4 collections, 3 Newman configs, 3 CI/CD pipelines",
    },
    TEST_SOLUTION: {
      results: { total: 524, passing: 518, failing: 6, passRate: 99.2 },
      performance: { smoke: "4m 12s", contract: "8m 47s", integration: "18m 33s" },
      failures: [
        { test: "OAuth token refresh", cause: "Environment variable REFRESH_TOKEN_URL misconfigured", resolved: true },
        { test: "Rate limit validation", cause: "Staging rate limit differs from production", resolved: true },
      ],
      summary: "524 tests, 99.2% pass rate, all failures resolved",
    },
    DEPLOYMENT_PLAN: {
      ciCdStages: [
        { name: "PR Validation", environment: "staging", triggerEvent: "pull_request", testSuite: "smoke", gateType: "required", rollbackStrategy: "block merge" },
        { name: "Nightly Regression", environment: "staging", triggerEvent: "cron (2am UTC)", testSuite: "contract + integration", gateType: "informational", rollbackStrategy: "alert on failure" },
        { name: "Post-Deploy Verify", environment: "production", triggerEvent: "deployment", testSuite: "smoke", gateType: "required", rollbackStrategy: "auto-rollback on failure" },
      ],
      environmentPromotionGates: [
        { from: "development", to: "staging", requiredChecks: ["unit tests pass", "smoke tests pass", "code review approved"], approvalRequired: false },
        { from: "staging", to: "production", requiredChecks: ["smoke tests pass", "contract tests pass", "integration tests pass", "security scan clean"], approvalRequired: true },
      ],
      rollout: [
        { week: "1-2", team: "Open Banking", platform: "GitHub Actions", status: "complete" },
        { week: "3-4", team: "Payments", platform: "GitHub Actions", status: "complete" },
        { week: "5-6", team: "Mobile", platform: "GitHub Actions", status: "in_progress" },
        { week: "7-8", team: "Partner Gateway", platform: "GitHub Actions", status: "planned" },
        { week: "9-12", team: "Remaining 8 teams", platform: "GitHub Actions + Jenkins", status: "planned" },
      ],
      summary: "3 CI/CD stages, 2 promotion gates, 5-phase team rollout",
    },
    MONITORING: {
      postmanMonitors: [
        { name: "Open Banking — Production Health", collectionRef: "GlobalBank-OpenBanking-Smoke", environmentRef: "production", schedule: "every 5 minutes", regions: ["us-east-1", "eu-west-1"], alertChannels: ["PagerDuty", "#api-alerts Slack"], targetComponentId: "topo-openbanking" },
        { name: "Payments — Settlement Flow", collectionRef: "GlobalBank-Payments-Smoke", environmentRef: "production", schedule: "every 10 minutes", regions: ["us-east-1"], alertChannels: ["PagerDuty", "#payments-ops Slack"], targetComponentId: "topo-payments" },
        { name: "Partner API — Contract Drift", collectionRef: "GlobalBank-OpenBanking-Contracts", environmentRef: "staging", schedule: "hourly", regions: ["us-east-1"], alertChannels: ["#partner-integrations Slack"], targetComponentId: "topo-partner" },
        { name: "PSD2 Compliance — TPP Access", collectionRef: "GlobalBank-OpenBanking-Contracts", environmentRef: "production", schedule: "every 15 minutes", regions: ["us-east-1", "eu-west-1", "ap-southeast-1"], alertChannels: ["PagerDuty", "compliance@globalbank.com"], targetComponentId: "topo-openbanking" },
      ],
      dashboards: [
        { name: "Pipeline Health", platform: "Datadog", metrics: ["pass rate", "duration trends", "flaky test count", "failure categories"] },
        { name: "Adoption Scorecard", platform: "Grafana", metrics: ["teams onboarded", "collections created", "CI pipelines active", "Newman runs/week"] },
        { name: "PSD2 Compliance", platform: "Custom", metrics: ["TPP endpoint coverage %", "SCA test results", "consent flow validation"] },
      ],
      summary: "4 Postman monitors, 3 dashboards, PagerDuty + Slack alerting",
    },
    ITERATION: {
      nextActions: [
        { action: "Wave 2 expansion to 6 more teams", status: "in_progress", owner: "Marcus Rodriguez" },
        { action: "Contract testing at all service boundaries", status: "planned", owner: "Alex Novak" },
        { action: "Governance rule enforcement in shared workspaces", status: "planned", owner: "Marcus Rodriguez" },
        { action: "Champion activation: 1 per team", status: "in_progress", owner: "Priya Sharma" },
        { action: "Self-service template collection wizard", status: "planned", owner: "DevOps Platform" },
      ],
      metrics: {
        teamsOnboarded: 3, teamsTotal: 12, testPassRate: 99.2,
        ciPipelinesActive: 3, collectionsCreated: 12, newmanRunsPerWeek: 82,
        releaseCycleImprovement: "bi-monthly → bi-weekly (pilot teams)",
      },
      summary: "3/12 teams onboarded, 99.2% pass rate, 5 iteration actions tracked",
    },
    ADOPTION: {
      adoptionStrategy: {
        vision: "100% of GlobalBank's 12 product teams running standardized API testing in CI by Q3, with self-service onboarding and a champion network driving organic growth",
        targetAdoptionRate: "100% of teams (12/12)",
        timeline: "16 weeks from pilot to full enterprise adoption",
      },
      championNetwork: [
        { name: "Priya Sharma", team: "Open Banking", role: "Lead Champion", status: "active", focus: "PSD2 compliance testing, pilot success stories" },
        { name: "Marcus Rodriguez", team: "API Platform", role: "Technical Champion", status: "active", focus: "Governance, shared workspaces, collection standards" },
        { name: "Alex Novak", team: "DevOps", role: "Infrastructure Champion", status: "active", focus: "CI/CD integration, Jenkins shared library, pipeline optimization" },
        { name: "TBD", team: "Payments", role: "Team Champion", status: "recruiting", focus: "Payment flow testing, settlement verification" },
        { name: "TBD", team: "Mobile", role: "Team Champion", status: "recruiting", focus: "GraphQL testing, mobile BFF smoke tests" },
      ],
      enablementProgram: [
        { name: "Postman 101 — Getting Started", format: "Self-paced workshop", duration: "2 hours", audience: "All engineers", completionTarget: "100%" },
        { name: "Newman in CI — Hands-On Lab", format: "Live workshop", duration: "90 min", audience: "Backend + DevOps", completionTarget: "80%" },
        { name: "Contract Testing Deep Dive", format: "Technical session", duration: "60 min", audience: "API leads", completionTarget: "100% of leads" },
        { name: "Postman Governance & Workspaces", format: "Admin workshop", duration: "60 min", audience: "Tech leads + managers", completionTarget: "All tech leads" },
        { name: "Office Hours", format: "Drop-in support", duration: "Weekly, 30 min", audience: "Anyone", completionTarget: "Ongoing" },
      ],
      adoptionWaves: [
        { wave: 1, teams: ["Open Banking"], status: "complete", startWeek: 1, endWeek: 3, milestone: "Pilot success — 47 tests in CI, 99.2% pass rate" },
        { wave: 2, teams: ["Payments", "Mobile BFF"], status: "in_progress", startWeek: 4, endWeek: 8, milestone: "Template collections deployed, Jenkins adapter live" },
        { wave: 3, teams: ["Partner Gateway", "Wealth Management", "Insurance"], status: "planned", startWeek: 9, endWeek: 12, milestone: "6 teams active, contract testing at boundaries" },
        { wave: 4, teams: ["Risk", "Compliance", "Data Platform", "ML Services", "Internal Tools", "DevPortal"], status: "planned", startWeek: 13, endWeek: 16, milestone: "Full enterprise adoption, governance enforced" },
      ],
      successMetrics: [
        { metric: "Team adoption rate", current: "25%", target: "100%", measurement: "Teams with Newman in CI" },
        { metric: "API test coverage", current: "35%", target: "85%", measurement: "% of API endpoints with automated tests" },
        { metric: "CI pipeline integration", current: "3 pipelines", target: "20+ pipelines", measurement: "Active Newman runs in CI/CD" },
        { metric: "Mean time to detect", current: "< 5 min", target: "< 5 min", measurement: "Time from regression to alert" },
        { metric: "Release frequency", current: "bi-weekly (pilot)", target: "weekly", measurement: "Average releases per team per month" },
        { metric: "Developer satisfaction", current: "4.2/5", target: "4.5+/5", measurement: "Quarterly survey of API developers" },
      ],
      executiveTalkingPoints: [
        "Open Banking pilot proved 3x faster regression detection — 12 issues caught in Week 1 that manual testing missed",
        "Release cycle improved from bi-monthly to bi-weekly for pilot teams, targeting weekly for all teams by Q3",
        "PSD2 compliance evidence now automated — eliminates 2 weeks of manual audit preparation per quarter",
        "Jenkins shared library enables zero-friction adoption for legacy teams — one Jenkinsfile line",
        "ROI projection: $2.4M annual savings from reduced production incidents, faster releases, and automated compliance",
      ],
      riskMitigation: [
        { risk: "Change fatigue — too many tools introduced at once", mitigation: "Phased rollout with team champions, not mandates. Self-service onboarding wizard." },
        { risk: "Knowledge silos — only champions know Postman", mitigation: "Recorded workshops + self-paced Postman 101. Pair programming sessions." },
        { risk: "Momentum loss between waves", mitigation: "Bi-weekly adoption reviews with VP Eng. Public dashboard showing team progress." },
        { risk: "Legacy team resistance persists", mitigation: "Jenkins shared library makes adoption invisible. Escalation path via VP Eng mandate." },
      ],
      summary: "4-wave adoption plan, 5 champions (3 active, 2 recruiting), 5 enablement programs, 6 success metrics tracked",
    },
  };

  const phaseMarkdowns: Record<string, string> = {
    DISCOVERY: "# Discovery\nFull outside-in analysis completed. See Discovery Brief for details.",
    CURRENT_TOPOLOGY: "# Current Topology\n## Services\n- Open Banking API (Spring Boot)\n- Payments Engine (Spring Boot)\n- Mobile BFF (Node.js)\n- Partner Gateway (Go)\n- Wealth Management API (Java)\n\n## Infrastructure\n- Kong Gateway on EKS\n- AWS API Gateway (regional)\n- PostgreSQL, DynamoDB, Redis\n- Okta IdP + Auth0 CIAM",
    DESIRED_FUTURE_STATE: "# Desired Future State\n## Goals\n1. Every API change triggers Newman test suite in CI\n2. Contract tests validate API compatibility before merge\n3. Shared Postman workspaces per domain with governance rules\n4. Compliance dashboard feeds PSD2/PCI audit evidence automatically\n5. Mock servers eliminate cross-team dependency blocking",
    SOLUTION_DESIGN: `# Solution Design

## Phased Rollout Strategy

### Phase 1: Pilot (Weeks 1-3)
- **Team**: Open Banking API
- **Focus**: Convert 47 manual Postman tests to Newman CI suite
- **CI Platform**: GitHub Actions
- **Success criteria**: 95%+ pass rate, < 5min run time, team satisfaction

### Phase 2: Expand (Weeks 4-8)
- **Teams**: Payments Engine, Mobile BFF
- **Focus**: Template collections + Jenkins shared library for legacy teams
- **CI Platform**: GitHub Actions (Payments), Jenkins (Mobile)
- **Success criteria**: 3 teams running Newman in CI, shared collection templates

### Phase 3: Enterprise (Weeks 9-16)
- **Teams**: All 12 product teams
- **Focus**: Governance rules, shared workspaces, contract testing, executive dashboard
- **CI Platform**: Mixed (GitHub Actions + Jenkins)
- **Success criteria**: 100% team adoption, governance policies enforced

## Key Decisions
- Newman over Postman CLI for CI (lighter, faster, Docker-friendly)
- JUnit reporter for CI integration, HTML for human review
- Shared library approach for Jenkins to minimize adoption friction
- Environment-specific configs managed via Postman environments`,

    INFRASTRUCTURE: `# Infrastructure Plan

## Cloud Resources

| Resource | Type | Provider | Region | Purpose |
|----------|------|----------|--------|---------|
| Newman Runner (EKS) | Container | AWS | us-east-1 | Runs Newman test suites in CI pipelines |
| Test Results S3 Bucket | Storage | AWS | us-east-1 | Stores Newman HTML reports and JUnit XML |
| Secrets Manager | Secrets | AWS | us-east-1 | Postman API keys, environment variables |

## CI/CD Templates
1. **GitHub Actions** — Newman workflow for PR smoke + nightly contract tests
2. **Jenkins Shared Library** — \`newmanRun()\` function, zero-config for legacy teams
3. **ArgoCD Post-Sync Hook** — Newman smoke tests after every deployment

## Secrets Management
- AWS Secrets Manager for Postman API keys (90-day rotation)
- SSM Parameter Store for Newman environment variables
- AWS ACM for mTLS client certificates (365-day rotation)

## Container Specs
- Newman Runner: \`postman/newman:6-alpine\`
- Resources: 0.5 vCPU, 512MB RAM per pod
- Namespace: \`ci-testing\``,

    TEST_DESIGN: `# Test Design

## Test Tiers

| Tier | Trigger | Tests | Duration | Gate Type |
|------|---------|-------|----------|-----------|
| Smoke | Every PR | 47 | ~5 min | Required (blocks merge) |
| Contract | Every PR | 128 | ~10 min | Required (blocks merge) |
| Integration | Nightly | 312 | ~20 min | Informational |
| Load | Weekly | 37 | ~60 min | Informational |

## Test Cases (8 designed)
1. Open Banking — Health Check (smoke)
2. Open Banking — OAuth2 PKCE Flow (smoke)
3. Open Banking — Account List Contract (contract)
4. Payments — Create Payment (smoke)
5. Payments ↔ Partner Contract (contract)
6. Mobile BFF — GraphQL Query (smoke)
7. End-to-End Payment Flow (integration)
8. PSD2 Compliance — TPP Access (contract)

## Coverage Targets
- API endpoint coverage: **85%** (Phase 1), **95%** (Phase 3)
- Critical path coverage: **100%**
- Error scenario coverage: **70%+**`,

    CRAFT_SOLUTION: `# Crafted Solution

## Postman Collections

| Collection | Requests | Purpose |
|-----------|----------|---------|
| GlobalBank-OpenBanking-Smoke | 8 folders, 47 requests | Smoke tests for Open Banking API |
| GlobalBank-OpenBanking-Contracts | 2 folders, 128 tests | Schema validation + error contracts |
| GlobalBank-Payments-Smoke | 1 folder, 34 requests | Payment create/settle/refund flows |
| GlobalBank-Mobile-Smoke | 1 folder, 29 requests | GraphQL + feature flag tests |

## Newman Run Configurations
1. **PR Smoke Tests** — \`GlobalBank-OpenBanking-Smoke\` against staging, JUnit + CLI reporters
2. **Nightly Contract Suite** — \`GlobalBank-OpenBanking-Contracts\` against staging, bail on failure
3. **Post-Deploy Verification** — \`GlobalBank-OpenBanking-Smoke\` against production, bail on failure

## CI/CD Pipelines
1. **GitHub Actions** — Open Banking CI (PR + nightly)
2. **GitHub Actions** — Payments CI (PR only)
3. **Jenkins** — Legacy teams (Wealth, Insurance, Risk)`,

    TEST_SOLUTION: `# Test Execution Results

## Summary
- **Total tests**: 524
- **Passing**: 518 (99.2%)
- **Failing**: 6 (all resolved)

## Performance by Suite

| Suite | Duration | Status |
|-------|----------|--------|
| Smoke | 4m 12s | ✅ Within target |
| Contract | 8m 47s | ✅ Within target |
| Integration | 18m 33s | ✅ Within target |

## Resolved Failures
1. **OAuth token refresh** — Environment variable \`REFRESH_TOKEN_URL\` was misconfigured → Fixed in environment file
2. **Rate limit validation** — Staging rate limit differs from production → Added conditional assertion

## Confidence
All 524 tests passing consistently across 5 consecutive runs. No flaky tests detected.`,
    DEPLOYMENT_PLAN: `# Deployment Plan

## CI/CD Pipeline Stages

| Stage | Environment | Trigger | Test Suite | Gate | Rollback |
|-------|------------|---------|------------|------|----------|
| PR Validation | Staging | pull_request | Smoke (47 tests) | Required — blocks merge | Block merge |
| Nightly Regression | Staging | cron (2am UTC) | Contract + Integration (440 tests) | Informational | Alert on failure |
| Post-Deploy Verify | Production | deployment | Smoke (47 tests) | Required — auto-rollback | Auto-rollback on failure |

## Environment Promotion Gates

### Development → Staging
- Unit tests pass ✅
- Smoke tests pass ✅
- Code review approved ✅
- *No manual approval required*

### Staging → Production
- Smoke tests pass ✅
- Contract tests pass ✅
- Integration tests pass ✅
- Security scan clean ✅
- **Manual approval required** (Tech Lead sign-off)

## Team Rollout Schedule

| Timeline | Team | CI Platform | Status |
|----------|------|-------------|--------|
| Week 1-2 | Open Banking | GitHub Actions | ✅ Complete |
| Week 3-4 | Payments | GitHub Actions | ✅ Complete |
| Week 5-6 | Mobile | GitHub Actions | 🔄 In Progress |
| Week 7-8 | Partner Gateway | GitHub Actions | 📋 Planned |
| Week 9-12 | Remaining 8 teams | GitHub Actions + Jenkins | 📋 Planned |

## Rollback Procedures
1. **Automated**: Newman smoke failure post-deploy triggers ArgoCD rollback within 2 minutes
2. **Manual**: PagerDuty alert → on-call engineer → rollback via ArgoCD UI or CLI
3. **Canary**: 10% traffic → smoke tests → 50% → full deploy (for critical services)`,

    MONITORING: `# Monitoring & Observability

## Postman Monitors

| Monitor | Collection | Schedule | Regions | Alerts |
|---------|-----------|----------|---------|--------|
| Open Banking — Production Health | GlobalBank-OpenBanking-Smoke | Every 5 min | us-east-1, eu-west-1 | PagerDuty, #api-alerts Slack |
| Payments — Settlement Flow | GlobalBank-Payments-Smoke | Every 10 min | us-east-1 | PagerDuty, #payments-ops Slack |
| Partner API — Contract Drift | GlobalBank-OpenBanking-Contracts | Hourly | us-east-1 | #partner-integrations Slack |
| PSD2 Compliance — TPP Access | GlobalBank-OpenBanking-Contracts | Every 15 min | us-east-1, eu-west-1, ap-southeast-1 | PagerDuty, compliance@globalbank.com |

## Dashboards

### Pipeline Health (Datadog)
- Test pass rate trends (7d / 30d)
- Average run duration by suite
- Flaky test detection and count
- Failure categorization (network, assertion, timeout)

### Adoption Scorecard (Grafana)
- Teams onboarded: **3 / 12**
- Collections created: **12**
- Active CI pipelines: **3**
- Newman runs/week: **82**

### PSD2 Compliance (Custom)
- TPP endpoint coverage: **94%**
- SCA test results: All passing ✅
- Consent flow validation: Verified ✅

## Alert Escalation
1. **P1** (Production down): PagerDuty → on-call → Slack war room → 5min SLA
2. **P2** (Degraded): Slack alert → team channel → 30min SLA
3. **P3** (Contract drift): Slack notification → next business day`,

    ITERATION: `# Iteration Plan

## Current Status

| Metric | Value | Target |
|--------|-------|--------|
| Teams onboarded | 3 / 12 | 12 / 12 by Q3 |
| Test pass rate | 99.2% | > 99% |
| CI pipelines active | 3 | 12 |
| Collections created | 12 | 50+ |
| Newman runs / week | 82 | 500+ |
| Release cycle | bi-monthly → bi-weekly | weekly |

## Active Iteration Items

| Action | Status | Owner | ETA |
|--------|--------|-------|-----|
| Wave 2: expand to 6 more teams | 🔄 In Progress | Marcus Rodriguez | Week 8 |
| Contract testing at all service boundaries | 📋 Planned | Alex Novak | Week 10 |
| Governance rule enforcement in shared workspaces | 📋 Planned | Marcus Rodriguez | Week 12 |
| Champion activation: 1 per team | 🔄 In Progress | Priya Sharma | Week 9 |
| Self-service template collection wizard | 📋 Planned | DevOps Platform | Q2 |

## Success Metrics

### Velocity
- **Before**: Bi-monthly releases, 3-day manual QA gates
- **After (pilot)**: Bi-weekly releases, 5-minute automated gates
- **Target**: Weekly releases with zero manual QA gates

### Quality
- API regression detection: **3x faster** (12 regressions caught in Week 1)
- Mean time to detect: **< 5 minutes** (was 2-3 days)
- False positive rate: **< 2%**

### Compliance
- PSD2 audit evidence: **Automated** (was manual spreadsheet)
- PCI-DSS testing proof: **Continuous** (was quarterly)

## Lessons Learned
1. Jenkins shared library was the key to legacy team adoption — zero workflow changes
2. "Lunch and learn" demos more effective than mandates
3. Open Banking pilot success created internal demand from other teams
4. Contract testing should be introduced after smoke tests are stable`,

    ADOPTION: `# Adoption Plan

## Vision
100% of GlobalBank's 12 product teams running standardized API testing in CI by Q3, with self-service onboarding and a champion network driving organic growth.

## Champion Network

| Name | Team | Role | Status | Focus Area |
|------|------|------|--------|------------|
| Priya Sharma | Open Banking | Lead Champion | ✅ Active | PSD2 compliance, pilot success stories |
| Marcus Rodriguez | API Platform | Technical Champion | ✅ Active | Governance, shared workspaces, standards |
| Alex Novak | DevOps | Infrastructure Champion | ✅ Active | CI/CD integration, Jenkins shared library |
| TBD | Payments | Team Champion | 🔍 Recruiting | Payment flow testing, settlement verification |
| TBD | Mobile | Team Champion | 🔍 Recruiting | GraphQL testing, mobile BFF smoke tests |

## Enablement Program

| Program | Format | Duration | Audience | Completion Target |
|---------|--------|----------|----------|-------------------|
| Postman 101 — Getting Started | Self-paced workshop | 2 hours | All engineers | 100% |
| Newman in CI — Hands-On Lab | Live workshop | 90 min | Backend + DevOps | 80% |
| Contract Testing Deep Dive | Technical session | 60 min | API leads | 100% of leads |
| Governance & Workspaces | Admin workshop | 60 min | Tech leads + managers | All tech leads |
| Office Hours | Drop-in support | Weekly, 30 min | Anyone | Ongoing |

## Adoption Waves

### Wave 1: Pilot ✅ (Weeks 1-3)
- **Teams**: Open Banking
- **Milestone**: 47 tests in CI, 99.2% pass rate
- **Key learning**: Small wins build momentum

### Wave 2: Expand 🔄 (Weeks 4-8)
- **Teams**: Payments, Mobile BFF
- **Milestone**: Template collections deployed, Jenkins adapter live
- **Key learning**: Jenkins shared library = zero-friction adoption

### Wave 3: Scale 📋 (Weeks 9-12)
- **Teams**: Partner Gateway, Wealth Management, Insurance
- **Milestone**: 6 teams active, contract testing at boundaries
- **Key action**: Champion activation in each team

### Wave 4: Enterprise 📋 (Weeks 13-16)
- **Teams**: Risk, Compliance, Data Platform, ML Services, Internal Tools, DevPortal
- **Milestone**: Full enterprise adoption, governance enforced
- **Key action**: Self-service wizard, automated compliance dashboards

## Success Metrics

| Metric | Current | Target | How Measured |
|--------|---------|--------|-------------|
| Team adoption rate | 25% (3/12) | 100% (12/12) | Teams with Newman in CI |
| API test coverage | 35% | 85% | % of endpoints with automated tests |
| CI pipeline integration | 3 pipelines | 20+ pipelines | Active Newman runs in CI/CD |
| Mean time to detect | < 5 min | < 5 min | Time from regression to alert |
| Release frequency | bi-weekly (pilot) | weekly | Releases per team per month |
| Developer satisfaction | 4.2/5 | 4.5+/5 | Quarterly survey |

## Executive Talking Points
1. **Proven ROI**: Open Banking pilot proved 3x faster regression detection — 12 issues caught in Week 1
2. **Velocity**: Release cycle improved from bi-monthly to bi-weekly, targeting weekly by Q3
3. **Compliance**: PSD2 evidence now automated — eliminates 2 weeks of manual audit prep per quarter
4. **Zero friction**: Jenkins shared library enables one-line adoption for legacy teams
5. **ROI projection**: $2.4M annual savings from reduced incidents, faster releases, automated compliance

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Change fatigue | Phased rollout with champions, not mandates. Self-service wizard. |
| Knowledge silos | Recorded workshops + Postman 101. Pair programming sessions. |
| Momentum loss between waves | Bi-weekly adoption reviews with VP Eng. Public progress dashboard. |
| Legacy team resistance | Jenkins shared library makes adoption invisible. VP Eng escalation path. |`,
  };

  const phaseCreatedDates: Record<string, Date> = {
    DISCOVERY: daysAgo(29), CURRENT_TOPOLOGY: daysAgo(27), DESIRED_FUTURE_STATE: daysAgo(26),
    SOLUTION_DESIGN: daysAgo(25), INFRASTRUCTURE: daysAgo(24), TEST_DESIGN: daysAgo(23),
    CRAFT_SOLUTION: daysAgo(22), TEST_SOLUTION: daysAgo(21), DEPLOYMENT_PLAN: daysAgo(20),
    MONITORING: daysAgo(19), ITERATION: daysAgo(18), ADOPTION: daysAgo(17),
  };

  const allPhases = ["DISCOVERY", "CURRENT_TOPOLOGY", "DESIRED_FUTURE_STATE", "SOLUTION_DESIGN", "INFRASTRUCTURE", "TEST_DESIGN", "CRAFT_SOLUTION", "TEST_SOLUTION", "DEPLOYMENT_PLAN", "MONITORING", "ITERATION", "ADOPTION"];

  for (const phase of allPhases) {
    await prisma.phaseArtifact.create({
      data: {
        projectId: PROJECT_ID,
        phase: phase as never,
        version: 1,
        status: "CLEAN",
        contentJson: phaseContentMap[phase] ?? { summary: phase },
        contentMarkdown: phaseMarkdowns[phase] ?? `# ${phase}`,
        lastComputedAt: phaseCreatedDates[phase],
        createdAt: phaseCreatedDates[phase],
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. TOPOLOGY (realistic architecture graph)
  // ─────────────────────────────────────────────────────────────────────────

  // Write topology nodes/edges to their own tables too (for any queries that read them directly)
  for (const n of topoNodes) {
    await prisma.topologyNode.create({
      data: { id: n.id, projectId: PROJECT_ID, type: n.type as never, name: n.name, metadataJson: n.metadata },
    });
  }

  for (const e of topoEdges) {
    await prisma.topologyEdge.create({
      data: { projectId: PROJECT_ID, fromNodeId: e.from, toNodeId: e.to, type: e.type as never },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 6. ASSUMPTIONS (mix of verified, corrected, and a couple pending)
  // ─────────────────────────────────────────────────────────────────────────

  const assumptions = [
    { phase: "DISCOVERY", category: "cloud_provider", claim: "GlobalBank's primary cloud is AWS with Azure as DR only", confidence: "High", status: "VERIFIED", reasoning: "DNS records, header analysis, and Kepler notes all confirm AWS us-east-1 as primary", impact: "Infrastructure templates would target wrong cloud if incorrect" },
    { phase: "DISCOVERY", category: "ci_cd_platform", claim: "Jenkins is used by legacy teams, GitHub Actions by newer teams", confidence: "High", status: "VERIFIED", reasoning: "Kepler notes mention both; GitHub org shows Actions workflows; Jenkins shared library references found", impact: "CI templates need to support both platforms" },
    { phase: "DISCOVERY", category: "auth_pattern", claim: "OAuth 2.0 with PKCE is the primary auth pattern for customer-facing APIs", confidence: "High", status: "VERIFIED", reasoning: "Auth forensics show PKCE flow, Okta CNAME, JWT RS256 tokens", impact: "Test collections need PKCE auth flow configured" },
    { phase: "DISCOVERY", category: "api_architecture", claim: "All teams use REST APIs — no GraphQL in production", confidence: "Medium", status: "CORRECTED", reasoning: "Public footprint shows REST APIs; no GraphQL endpoints detected", impact: "If GraphQL exists, need different testing approach", humanResponse: "Mobile team has a GraphQL gateway (Apollo Federation) behind Kong. It serves the mobile app. REST is still dominant for B2B." },
    { phase: "CURRENT_TOPOLOGY", category: "api_gateway", claim: "Kong Gateway handles all internal service routing", confidence: "Medium", status: "VERIFIED", reasoning: "Header analysis shows Kong headers on internal endpoints", impact: "Kong plugin configuration needed for Newman integration" },
    { phase: "CURRENT_TOPOLOGY", category: "database", claim: "PostgreSQL is the primary transactional database for all services", confidence: "Medium", status: "CORRECTED", reasoning: "Multiple services reference PostgreSQL", impact: "Test data setup needs to account for correct database", humanResponse: "Wealth Management still uses MongoDB for legacy reasons. Migration is planned but 6+ months out." },
    { phase: "SOLUTION_DESIGN", category: "team_readiness", claim: "Open Banking team has existing Postman collections ready for Newman conversion", confidence: "High", status: "VERIFIED", reasoning: "Public workspace shows 3 collections; Kepler notes confirm team uses Postman daily", impact: "Pilot timeline depends on existing collection quality" },
    { phase: "SOLUTION_DESIGN", category: "compliance", claim: "PSD2 compliance requires automated API testing evidence", confidence: "High", status: "VERIFIED", reasoning: "Regulatory requirement for PSD2 Article 30 — TPP access testing must be documented", impact: "Key value prop for executive sponsorship" },
    { phase: "INFRASTRUCTURE", category: "networking", claim: "Newman runner can access internal APIs from GitHub Actions via VPN", confidence: "Medium", status: "VERIFIED", reasoning: "GitHub Actions supports self-hosted runners; GlobalBank likely has VPN/VPC peering for CI", impact: "If no VPN access, need self-hosted runners in VPC" },
    { phase: "INFRASTRUCTURE", category: "secrets", claim: "AWS Secrets Manager is the standard secrets store", confidence: "Medium", status: "VERIFIED", reasoning: "AWS-centric infrastructure suggests Secrets Manager; common in regulated finance", impact: "Postman API keys and env vars storage location" },
    { phase: "TEST_DESIGN", category: "test_coverage", claim: "85% endpoint coverage is achievable within the pilot timeline", confidence: "Medium", status: "VERIFIED", reasoning: "Open Banking API has well-documented OpenAPI spec; 47 existing tests cover core flows", impact: "Unrealistic coverage target could delay pilot success metrics" },
    { phase: "DEPLOYMENT_PLAN", category: "rollout", claim: "Feature flags can control Newman test execution in CI", confidence: "High", status: "VERIFIED", reasoning: "Standard CI/CD pattern; GitHub Actions supports conditional steps", impact: "Rollback strategy depends on feature flag availability" },
    { phase: "ITERATION", category: "adoption", claim: "Champion network will self-organize once 3+ teams see value", confidence: "Low", status: "PENDING", reasoning: "Pattern seen in similar enterprise rollouts, but depends on culture", impact: "If champions don't emerge organically, need active cultivation program" },
    { phase: "ITERATION", category: "timeline", claim: "80% team adoption achievable within 16 weeks", confidence: "Medium", status: "PENDING", reasoning: "Based on pilot success rate and wave planning, 10 of 12 teams is realistic", impact: "May need to adjust executive expectations if pace is slower" },
  ];

  for (const a of assumptions) {
    await prisma.assumption.create({
      data: {
        projectId: PROJECT_ID,
        phase: a.phase as never,
        category: a.category,
        claim: a.claim,
        confidence: a.confidence,
        status: a.status as never,
        reasoning: a.reasoning,
        impact: a.impact,
        humanResponse: a.humanResponse ?? null,
        verifiedAt: a.status !== "PENDING" ? daysAgo(20) : null,
        verifiedBy: a.status !== "PENDING" ? user.id : null,
        blocksPhases: a.phase === "DISCOVERY" ? ["CURRENT_TOPOLOGY", "SOLUTION_DESIGN"] : undefined,
        createdAt: daysAgo(28),
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 7. BLOCKERS (mix of resolved and active)
  // ─────────────────────────────────────────────────────────────────────────

  // Blocker 1: Security approval — NEUTRALIZED (missile worked)
  const blocker1 = await prisma.blocker.create({
    data: {
      projectId: PROJECT_ID,
      title: "Security team won't approve Newman in CI pipeline",
      description: "The CISO's team has concerns about running external tools (Newman/Node.js) in the CI pipeline that has access to PCI-scoped environments. They want a full security review before any approval.",
      domain: "SECURITY",
      severity: "CRITICAL",
      status: "NEUTRALIZED",
      blockedPhases: ["INFRASTRUCTURE", "DEPLOYMENT_PLAN"],
      blockedCapabilities: ["Newman in CI", "Automated test execution", "Pipeline integration"],
      rootCause: "PCI-DSS scope concerns — any new tool in the payment processing pipeline requires a security assessment",
      rootCauseCategory: "org_policy",
      blockerOwner: "David Park (CISO)",
      decisionMaker: "David Park (CISO)",
      allies: JSON.stringify(["Sarah Chen (VP Engineering)", "Marcus Rodriguez (API Platform)", "Compliance team (wants automated evidence)"]),
      resistors: JSON.stringify(["Security ops team (more tools = more risk surface)"]),
      impactScore: 95,
      revenueImpact: "Blocks entire enterprise deal — no CI integration means no value prop",
      timelineImpact: "4-6 week delay for full security review process",
      cascadeImpact: "Blocks Infrastructure, Deployment, and all downstream phases",
      surfacedByPhase: "INFRASTRUCTURE",
      surfacedByAgent: "infrastructure_planning",
      notes: "Resolved by presenting Newman as a read-only testing tool with no write access to PCI data. Sandbox demo convinced security team.",
      resolvedAt: daysAgo(16),
      resolvedBy: user.id,
      resolutionNotes: "Security team approved after sandbox demo + restricted network policy. Newman runs in isolated container with read-only API access.",
      createdAt: daysAgo(22),
    },
  });

  await prisma.blockerMissile.create({
    data: {
      blockerId: blocker1.id,
      name: "Newman Security Sandbox Demo",
      strategy: "Create an isolated sandbox environment that demonstrates Newman running with zero write access to PCI-scoped systems. Show security team that Newman only reads API responses and validates assertions — no data mutation.",
      targetAudience: "David Park (CISO) + Security Ops team",
      talkingPoints: JSON.stringify([
        "Newman is a read-only CLI runner — it sends requests and validates responses",
        "Container runs with read-only filesystem and restricted network policy",
        "No PCI data leaves the VPC — results are assertion pass/fail only",
        "Alternative: self-hosted runner in their VPC with their security controls",
        "Compliance team actively wants this — automated testing evidence for PSD2 auditors",
      ]),
      evidence: JSON.stringify([
        "Newman GitHub repo — fully open source, auditable",
        "Docker image scan: zero CVEs in postman/newman:6-alpine",
        "Network policy: egress only to internal API endpoints",
        "3 Fortune 500 banks already using Newman in PCI environments",
      ]),
      actionSteps: JSON.stringify([
        "Build sandbox environment in dev VPC",
        "Configure Newman with restricted IAM role and network policy",
        "Prepare 30-minute demo with Open Banking API",
        "Schedule session with CISO + security ops lead",
        "Follow up with written security assessment document",
      ]),
      deliverables: JSON.stringify(["Sandbox environment", "Security assessment doc", "Network policy spec", "Live demo recording"]),
      estimatedEffort: "3 days",
      successCriteria: "CISO signs off on Newman in CI with defined security controls",
      fallbackPlan: "If sandbox demo doesn't convince, escalate to executive sponsor (VP Eng) for business case pressure",
      status: "hit",
      firedAt: daysAgo(18),
      resultNotes: "Demo was successful. CISO approved with conditions: isolated container, no PCI data in test assertions, quarterly security review.",
      aiGenerated: true,
      aiRunId: "demo-airun-missile1",
      createdAt: daysAgo(20),
    },
  });

  // Blocker 2: Jenkins legacy resistance — NEUTRALIZED (missile hit)
  const blocker2 = await prisma.blocker.create({
    data: {
      projectId: PROJECT_ID,
      title: "Legacy Jenkins teams refuse to adopt new testing workflow",
      description: "3 teams (Wealth Management, Insurance, Risk) are on Jenkins and their leads are resistant to adding Newman to their pipelines. They claim their existing JUnit tests are 'sufficient' and don't want to learn new tools.",
      domain: "CULTURAL",
      severity: "HIGH",
      status: "NEUTRALIZED",
      blockedPhases: ["DEPLOYMENT_PLAN", "ITERATION"],
      blockedCapabilities: ["Enterprise-wide adoption", "Consistent testing standards"],
      rootCause: "Change resistance — teams are comfortable with existing JUnit approach and see Postman as 'extra work'",
      rootCauseCategory: "person",
      blockerOwner: "Wealth Management team lead",
      decisionMaker: "Sarah Chen (VP Engineering)",
      allies: JSON.stringify(["Marcus Rodriguez (API Platform)", "Alex Novak (DevOps Lead)", "Open Banking team (pilot success)"]),
      resistors: JSON.stringify(["Wealth Mgmt lead (comfortable with status quo)", "Insurance lead (risk-averse)"]),
      impactScore: 72,
      revenueImpact: "Limits deal to partial adoption — reduces enterprise license value",
      timelineImpact: "Could delay full rollout by 4-8 weeks",
      cascadeImpact: "Iteration plan and adoption metrics affected",
      surfacedByPhase: "ITERATION",
      notes: "Missile hit: ROI demo convinced 2 of 3 teams. Wealth Mgmt and Risk teams adopted. Insurance team following next sprint.",
      resolvedAt: daysAgo(3),
      resolvedBy: user.id,
      resolutionNotes: "ROI comparison demo was decisive — Open Banking pilot metrics showed 3x faster regression detection. Jenkins shared library made adoption zero-friction (one Jenkinsfile line). VP Eng mandate helped accelerate holdouts.",
      createdAt: daysAgo(14),
    },
  });

  await prisma.blockerMissile.create({
    data: {
      blockerId: blocker2.id,
      name: "ROI Comparison: Newman vs JUnit-Only Testing",
      strategy: "Present data-driven comparison showing Newman catches API-level regressions 3x faster than JUnit alone. Use Open Banking pilot metrics as proof. Offer Jenkins shared library that requires zero workflow changes — just add one line to Jenkinsfile.",
      targetAudience: "Wealth Mgmt, Insurance, and Risk team leads",
      talkingPoints: JSON.stringify([
        "Open Banking team found 12 API regressions in first week that JUnit missed",
        "Jenkins shared library: literally one line added to existing Jenkinsfile",
        "No new tools to learn — same Postman they already use for manual testing",
        "VP Engineering has mandated consistent API testing by Q3",
      ]),
      actionSteps: JSON.stringify([
        "Compile Open Banking pilot metrics into case study",
        "Build Jenkins shared library with zero-config setup",
        "Demo to resistant teams in 30-minute lunch session",
        "Offer 1-week 'white glove' setup support per team",
        "Escalate to VP Eng if resistance continues after demo",
      ]),
      estimatedEffort: "1 week",
      successCriteria: "At least 2 of 3 resistant teams agree to try Newman in their Jenkins pipeline",
      status: "hit",
      firedAt: daysAgo(7),
      resultNotes: "2 of 3 teams adopted immediately after ROI demo. Insurance team committed to next sprint. Jenkins shared library was the key enabler — zero-friction adoption.",
      aiGenerated: true,
      aiRunId: "demo-airun-missile1",
      createdAt: daysAgo(10),
    },
  });

  // Blocker 3: Budget — ACCEPTED (workaround found)
  await prisma.blocker.create({
    data: {
      projectId: PROJECT_ID,
      title: "Q1 budget freeze blocks enterprise license procurement",
      description: "Finance has frozen all new software procurement until Q2 due to year-end budget reconciliation. Enterprise license needed for shared workspaces and governance features.",
      domain: "ORGANIZATIONAL",
      severity: "MEDIUM",
      status: "ACCEPTED",
      blockedPhases: ["ITERATION"],
      rootCause: "Annual budget cycle — procurement freeze is standard company policy",
      rootCauseCategory: "org_policy",
      blockerOwner: "Finance / Procurement",
      decisionMaker: "CFO",
      impactScore: 45,
      timelineImpact: "6-week delay on enterprise features, but pilot can continue on existing plan",
      notes: "Accepted: Using existing Professional plan for pilot teams. Enterprise license procurement starts Q2 week 1. Sarah Chen has pre-approved budget.",
      resolvedAt: daysAgo(10),
      resolutionNotes: "Workaround: pilot on Professional plan, enterprise procurement queued for Q2.",
      createdAt: daysAgo(18),
    },
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 8. ADOPTION WAVES (commented out — AdoptionWave model not in schema)
  // ─────────────────────────────────────────────────────────────────────────

  // AdoptionWave model does not exist in the current Prisma schema.
  // These seed entries are commented out to fix build errors.
  const wave1 = { id: "wave1-placeholder" };
  const wave2 = { id: "wave2-placeholder" };
  const wave3 = { id: "wave3-placeholder" };

  // ─────────────────────────────────────────────────────────────────────────
  // 9. ADOPTION TEAMS (commented out — AdoptionTeam model not in schema)
  // ─────────────────────────────────────────────────────────────────────────

  // AdoptionTeam model does not exist in the current Prisma schema.
  const teams = [] as { name: string }[];

  // ─────────────────────────────────────────────────────────────────────────
  // 10. DRIP CAMPAIGNS (commented out — DripCampaign model not in schema)
  // ─────────────────────────────────────────────────────────────────────────

  // DripCampaign model does not exist in the current Prisma schema.

  // ─────────────────────────────────────────────────────────────────────────
  // 11. MILESTONES (commented out — AdoptionMilestone model not in schema)
  // ─────────────────────────────────────────────────────────────────────────

  // AdoptionMilestone model does not exist in the current Prisma schema.
  const milestones = [] as { type: string }[];

  // ─────────────────────────────────────────────────────────────────────────
  // 12. PIPELINE DEPLOYMENTS
  // ─────────────────────────────────────────────────────────────────────────

  await prisma.pipelineDeployment.createMany({
    data: [
      { projectId: PROJECT_ID, platform: "github_actions", platformLabel: "GitHub Actions", repoUrl: "https://github.com/globalbank/open-banking-api", filename: ".github/workflows/postman-tests.yml", branchName: "main", lastStatus: "passing", lastRunAt: daysAgo(0), createdAt: daysAgo(22) },
      { projectId: PROJECT_ID, platform: "github_actions", platformLabel: "GitHub Actions", repoUrl: "https://github.com/globalbank/payments-engine", filename: ".github/workflows/postman-tests.yml", branchName: "main", lastStatus: "passing", lastRunAt: daysAgo(1), createdAt: daysAgo(6) },
      { projectId: PROJECT_ID, platform: "github_actions", platformLabel: "GitHub Actions", repoUrl: "https://github.com/globalbank/mobile-bff", filename: ".github/workflows/postman-tests.yml", branchName: "develop", lastStatus: "passing", lastRunAt: daysAgo(2), createdAt: daysAgo(4) },
    ],
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 13. NEWMAN TEST RESULTS
  // ─────────────────────────────────────────────────────────────────────────

  const testResults = [
    { collection: "GlobalBank-OpenBanking-Smoke", env: "staging", total: 47, assertions: 142, passed: 142, failed: 0, duration: 252000, status: "pass", at: daysAgo(0) },
    { collection: "GlobalBank-OpenBanking-Smoke", env: "staging", total: 47, assertions: 142, passed: 140, failed: 2, duration: 261000, status: "fail", at: daysAgo(1) },
    { collection: "GlobalBank-OpenBanking-Contracts", env: "staging", total: 128, assertions: 384, passed: 384, failed: 0, duration: 487000, status: "pass", at: daysAgo(0) },
    { collection: "GlobalBank-OpenBanking-Smoke", env: "production", total: 47, assertions: 142, passed: 142, failed: 0, duration: 198000, status: "pass", at: daysAgo(0) },
    { collection: "GlobalBank-Payments-Smoke", env: "staging", total: 34, assertions: 102, passed: 102, failed: 0, duration: 178000, status: "pass", at: daysAgo(1) },
    { collection: "GlobalBank-Payments-Smoke", env: "staging", total: 34, assertions: 102, passed: 99, failed: 3, duration: 192000, status: "fail", at: daysAgo(3) },
    { collection: "GlobalBank-Mobile-Smoke", env: "staging", total: 29, assertions: 87, passed: 85, failed: 2, duration: 145000, status: "fail", at: daysAgo(2) },
    { collection: "GlobalBank-Mobile-Smoke", env: "staging", total: 29, assertions: 87, passed: 87, failed: 0, duration: 138000, status: "pass", at: daysAgo(0) },
  ];

  for (const tr of testResults) {
    await prisma.newmanTestResult.create({
      data: {
        projectId: PROJECT_ID,
        collectionName: tr.collection,
        environmentName: tr.env,
        totalRequests: tr.total,
        totalAssertions: tr.assertions,
        passedAssertions: tr.passed,
        failedAssertions: tr.failed,
        totalDuration: tr.duration,
        status: tr.status,
        source: "ci",
        createdAt: tr.at,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 14. PROJECT NOTES
  // ─────────────────────────────────────────────────────────────────────────

  const noteTexts = [
    { text: "Discovery call went great. Sarah Chen (VP Eng) is very engaged — she's frustrated with the bi-monthly release cycle and sees API testing as the bottleneck. Wants a pilot proposal by next week.", at: daysAgo(30) },
    { text: "Priya Sharma (Open Banking lead) confirmed they have 47 Postman requests already. Quality is decent — mostly needs environment variables updated and assertions added.", at: daysAgo(28) },
    { text: "Security blocker emerged. David Park (CISO) wants a full review before Newman goes into CI. Need to prepare sandbox demo ASAP.", at: daysAgo(22) },
    { text: "CISO approved! Sandbox demo worked perfectly. Key condition: Newman runs in isolated container with no write access to PCI data. Totally reasonable.", at: daysAgo(16) },
    { text: "Wave 1 pilot complete. Exceeded all metrics. Open Banking team is now running Newman on every PR + nightly integration suite. Priya is becoming an internal champion.", at: daysAgo(11) },
    { text: "Wave 2 kicked off. Payments team onboarded smoothly. Mobile team is slower — they need GraphQL-specific guidance. Created custom drip content for them.", at: daysAgo(7) },
    { text: "Heads up: Wealth Management and Insurance team leads are resistant. Need to prepare the Jenkins shared library missile + ROI comparison. Might need VP Eng air cover.", at: daysAgo(5) },
    { text: "Budget freeze accepted as blocker. Professional plan works for now. Sarah confirmed Q2 budget is pre-approved for enterprise. No action needed.", at: daysAgo(4) },
  ];

  for (const n of noteTexts) {
    await prisma.projectNote.create({
      data: { projectId: PROJECT_ID, userId: user.id, content: n.text, createdAt: n.at },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 15. SOURCE DOCUMENTS (discovery evidence — no embeddings needed)
  // ─────────────────────────────────────────────────────────────────────────

  const sourceDocs = await prisma.sourceDocument.createManyAndReturn({
    data: [
      { projectId: PROJECT_ID, sourceType: "KEPLER", title: "Discovery Call Notes — GlobalBank", rawText: "Discovery call with Sarah Chen (VP Eng) and Marcus Rodriguez (API Platform). 450+ engineers, 12 teams, migrating from monolithic SOAP services to microservices architecture. Currently heavy REST + emerging GraphQL gateway. Key products: Open Banking API, Mobile Banking API, Wealth Management Platform, Payments Processing Engine.", contentHash: "demo-hash-kepler-1", createdAt: daysAgo(30) },
      { projectId: PROJECT_ID, sourceType: "DNS", title: "DNS/Infrastructure Scan", rawText: "api.globalbank.com → AWS ALB (us-east-1). open-banking.globalbank.com → CloudFront → API Gateway. partner-api.globalbank.com → AWS ALB (eu-west-1). developer.globalbank.com → Netlify. auth.globalbank.com → Okta CNAME.", contentHash: "demo-hash-dns-1", createdAt: daysAgo(30) },
      { projectId: PROJECT_ID, sourceType: "HEADERS", title: "HTTP Header Analysis", rawText: "Server: nginx/1.24, X-Request-Id: present (distributed tracing), Strict-Transport-Security: max-age=31536000, API-Version: 2024-01-15 (header-based versioning), X-RateLimit-Limit: 1000.", contentHash: "demo-hash-headers-1", createdAt: daysAgo(30) },
      { projectId: PROJECT_ID, sourceType: "GITHUB", title: "GitHub Organization Analysis", rawText: "12 public repos, Actions workflows in 4 repos, npm package @globalbank/sdk published but unmaintained. Primary languages: Java (Spring Boot), TypeScript (Node.js), Python (ML), Go (infrastructure).", contentHash: "demo-hash-github-1", createdAt: daysAgo(29) },
      { projectId: PROJECT_ID, sourceType: "MANUAL", title: "Architecture Diagram Review", rawText: "Reviewed architecture diagram from Marcus. Kong Gateway → 5 microservices. AWS API Gateway for Open Banking. Redis for caching. PostgreSQL (RDS) for primary data. DynamoDB for session management. Amazon SQS for async messaging.", contentHash: "demo-hash-manual-1", createdAt: daysAgo(28) },
      { projectId: PROJECT_ID, sourceType: "SLACK", title: "#engineering: Postman Discussion", rawText: "Thread about standardizing API testing. Several engineers excited about Newman in CI. DevOps lead Alex Novak: 'We need this yesterday.' Wealth Mgmt team lead skeptical: 'Our JUnit tests are sufficient.'", contentHash: "demo-hash-slack-1", createdAt: daysAgo(25) },
      { projectId: PROJECT_ID, sourceType: "GMAIL", title: "Re: Pilot Proposal — GlobalBank", rawText: "Sarah confirmed pilot approval. Open Banking team starts Monday. Budget pre-approved for Professional plan. Enterprise license discussion pushed to Q2.", contentHash: "demo-hash-gmail-1", createdAt: daysAgo(24) },
    ],
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 16. DOCUMENT CHUNKS + EVIDENCE SNAPSHOT (for cascade pipeline)
  // ─────────────────────────────────────────────────────────────────────────

  // Create document chunks with dummy embeddings using raw SQL (vector type)
  const chunkData = [
    { docIdx: 0, content: "Discovery call with Sarah Chen (VP Eng) and Marcus Rodriguez (API Platform). 450+ engineers, 12 teams.", label: "EVIDENCE-1" },
    { docIdx: 0, content: "Migrating from monolithic SOAP services to microservices architecture. Currently heavy REST + emerging GraphQL gateway.", label: "EVIDENCE-2" },
    { docIdx: 1, content: "api.globalbank.com → AWS ALB (us-east-1). open-banking.globalbank.com → CloudFront → API Gateway.", label: "EVIDENCE-3" },
    { docIdx: 2, content: "Server: nginx/1.24, X-Request-Id: present, API-Version: 2024-01-15 (header-based versioning).", label: "EVIDENCE-4" },
    { docIdx: 3, content: "12 public repos, Actions workflows in 4 repos, npm package @globalbank/sdk published but unmaintained.", label: "EVIDENCE-5" },
    { docIdx: 4, content: "Kong Gateway → 5 microservices. AWS API Gateway for Open Banking. Redis for caching. PostgreSQL (RDS) for primary data.", label: "EVIDENCE-6" },
    { docIdx: 5, content: "Thread about standardizing API testing. Several engineers excited about Newman in CI.", label: "EVIDENCE-7" },
    { docIdx: 6, content: "Sarah confirmed pilot approval. Open Banking team starts Monday. Budget pre-approved for Professional plan.", label: "EVIDENCE-8" },
    { docIdx: 4, content: "DynamoDB for session management. Amazon SQS for async messaging. SWIFT network integration for international payments.", label: "EVIDENCE-9" },
    { docIdx: 0, content: "Key products: Open Banking API (PSD2 compliant), Mobile Banking API, Wealth Management Platform, Payments Processing Engine.", label: "EVIDENCE-10" },
  ];

  // Insert chunks with a zero vector for the embedding column
  const chunkIds: string[] = [];
  for (let i = 0; i < chunkData.length; i++) {
    const c = chunkData[i];
    const doc = sourceDocs[c.docIdx];
    const chunkId = `demo-chunk-${i + 1}`;
    chunkIds.push(chunkId);
    // Use raw SQL because Prisma can't handle the vector(3072) type directly
    await prisma.$executeRawUnsafe(
      `INSERT INTO "DocumentChunk" (id, "documentId", "projectId", content, embedding, "tokenCount", "evidenceLabel", "createdAt")
       VALUES ($1, $2, $3, $4, $5::vector, $6, $7, $8)`,
      chunkId,
      doc.id,
      PROJECT_ID,
      c.content,
      `[${Array(3072).fill(0).map(() => (Math.random() * 0.02 - 0.01).toFixed(6)).join(",")}]`,
      Math.ceil(c.content.length / 4),
      c.label,
      daysAgo(30 - c.docIdx),
    );
  }

  // Evidence snapshot
  const snapshotHash = "demo-snapshot-hash-" + Date.now().toString(36);
  const snapshot = await prisma.evidenceSnapshot.create({
    data: {
      projectId: PROJECT_ID,
      chunkIdsJson: chunkIds,
      countsJson: {
        total: chunkIds.length,
        bySource: { KEPLER: 3, DNS: 1, HEADERS: 1, GITHUB: 1, MANUAL: 2, SLACK: 1, GMAIL: 1 },
      },
      hash: snapshotHash,
      createdAt: daysAgo(28),
    },
  });

  // Link all phase artifacts to this snapshot so they appear as "current"
  await prisma.phaseArtifact.updateMany({
    where: { projectId: PROJECT_ID },
    data: { snapshotId: snapshot.id },
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 17. RECOMPUTE JOB (completed cascade run)
  // ─────────────────────────────────────────────────────────────────────────

  const PHASES_ORDERED = [
    "DISCOVERY", "CURRENT_TOPOLOGY", "DESIRED_FUTURE_STATE", "SOLUTION_DESIGN",
    "INFRASTRUCTURE", "TEST_DESIGN", "CRAFT_SOLUTION", "TEST_SOLUTION",
    "DEPLOYMENT_PLAN", "MEETINGS", "WORKING_SESSIONS", "BUILD_LOG",
  ] as const;

  const recomputeJob = await prisma.recomputeJob.create({
    data: {
      projectId: PROJECT_ID,
      triggeredBy: "INGEST",
      snapshotId: snapshot.id,
      status: "COMPLETED",
      startedAt: daysAgo(28),
      finishedAt: daysAgo(28),
    },
  });

  for (const phase of PHASES_ORDERED) {
    await prisma.recomputeTask.create({
      data: {
        jobId: recomputeJob.id,
        phase,
        status: "COMPLETED",
        inputRefsJson: { snapshotId: snapshot.id },
        startedAt: daysAgo(28),
        finishedAt: daysAgo(28),
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 18. PROPOSALS (all accepted — fully validated pipeline)
  // ─────────────────────────────────────────────────────────────────────────

  const proposalPhases = [
    { phase: "DISCOVERY" as const, summary: "Initial discovery artifact generated from evidence. Identified 450+ engineers, 12 teams, Open Banking API as primary entry point, Kong Gateway + AWS API Gateway dual-gateway architecture." },
    { phase: "CURRENT_TOPOLOGY" as const, summary: "Mapped 20 nodes and 24 edges. Identified Kong Gateway as central hub with highest connectivity. PostgreSQL (RDS) and Redis as critical data stores." },
    { phase: "DESIRED_FUTURE_STATE" as const, summary: "Proposed unified API testing strategy: Newman in CI for all teams, contract testing with Postman, shared workspace governance, automated monitoring." },
    { phase: "SOLUTION_DESIGN" as const, summary: "Designed phased rollout: Wave 1 (Open Banking pilot), Wave 2 (Core Platform), Wave 3 (Enterprise). Jenkins shared library for legacy teams." },
    { phase: "INFRASTRUCTURE" as const, summary: "Infrastructure plan: GitHub Actions for new teams, Jenkins shared library for legacy, Postman CLI in Docker, environment-specific configs." },
    { phase: "TEST_DESIGN" as const, summary: "Test strategy: smoke tests (PR), regression suite (nightly), contract tests (deploy), performance baseline (weekly). 85% API coverage target." },
    { phase: "CRAFT_SOLUTION" as const, summary: "3 Postman collections created: Open Banking Smoke (42 requests), Core Platform Regression (128 requests), Partner API Contract Tests (56 requests)." },
    { phase: "TEST_SOLUTION" as const, summary: "Newman run configs for GitHub Actions and Jenkins. JUnit + CLI reporters. Bail-on-failure for smoke, continue for regression." },
    { phase: "DEPLOYMENT_PLAN" as const, summary: "3-wave deployment plan with rollback procedures. Wave 1 complete, Wave 2 in progress, Wave 3 scheduled for Q2." },
    { phase: "MEETINGS" as const, summary: "4 Postman monitors configured: Open Banking (5min), Core Platform (15min), Partner API (30min), Payments (5min). PagerDuty + Slack alerts." },
    { phase: "WORKING_SESSIONS" as const, summary: "Iteration plan: bi-weekly collection reviews, monthly coverage audits, quarterly architecture alignment. Success metrics: 95% uptime, <200ms P95, zero undetected breaking changes." },
    { phase: "BUILD_LOG" as const, summary: "4-wave adoption plan targeting 12/12 teams by Q3. Champion network (3 active, 2 recruiting), 5 enablement programs, 6 success metrics. Executive talking points and risk mitigation strategies defined." },
  ];

  for (const pp of proposalPhases) {
    await prisma.proposal.create({
      data: {
        projectId: PROJECT_ID,
        phase: pp.phase,
        snapshotId: snapshot.id,
        baseArtifactVersion: 0,
        patchJson: [{ op: "replace", path: "/content", value: "generated" }],
        proposedJson: { generated: true },
        proposedMarkdown: `## ${pp.phase.replace(/_/g, " ")} — Proposal\n\n${pp.summary}`,
        diffSummary: pp.summary,
        status: "ACCEPTED",
        createdAt: daysAgo(27),
        resolvedAt: daysAgo(26),
      },
    });
  }

  return NextResponse.json({
    success: true,
    message: "Demo project 'GlobalBank Financial Services' seeded successfully",
    project: {
      id: PROJECT_ID,
      name: "GlobalBank Financial Services",
    },
    stats: {
      discoveryArtifacts: 1,
      phaseArtifacts: 12,
      aiRuns: aiRunData.length,
      topologyNodes: topoNodes.length,
      topologyEdges: topoEdges.length,
      assumptions: assumptions.length,
      blockers: 3,
      missiles: 2,
      waves: 3,
      teams: teams.length,
      campaigns: 3,
      milestones: milestones.length,
      deployments: 3,
      testResults: testResults.length,
      notes: noteTexts.length,
      sourceDocuments: 7,
      documentChunks: chunkIds.length,
      evidenceSnapshots: 1,
      recomputeJobs: 1,
      proposals: proposalPhases.length,
    },
  });
}
