"use server";

/**
 * Automated "Outside-In" Reconnaissance
 *
 * Runs DNS, HTTP header, and public footprint analysis on a project's
 * domain, then ingests the findings as evidence for the AI pipeline.
 */

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { ingestDocument } from "@/lib/ai/ingest";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// DNS via DNS-over-HTTPS (Cloudflare)
// ---------------------------------------------------------------------------

async function dnsLookup(domain: string, type: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`,
      { headers: { Accept: "application/dns-json" }, signal: AbortSignal.timeout(10_000) }
    );
    if (!res.ok) return [`DNS ${type} lookup failed: HTTP ${res.status}`];
    const data = await res.json() as { Answer?: Array<{ data: string }> };
    return data.Answer?.map((a) => a.data) ?? [`No ${type} records found`];
  } catch (err) {
    return [`DNS ${type} lookup error: ${err instanceof Error ? err.message : String(err)}`];
  }
}

// ---------------------------------------------------------------------------
// HTTP Header Probe
// ---------------------------------------------------------------------------

async function probeHeaders(url: string): Promise<Record<string, string>> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k] = v; });
    headers["_status"] = `${res.status} ${res.statusText}`;
    headers["_url"] = res.url;
    return headers;
  } catch (err) {
    return { _error: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// Header Analysis
// ---------------------------------------------------------------------------

function analyzeHeaders(headers: Record<string, string>): string[] {
  const findings: string[] = [];

  // CDN / Edge
  if (headers["server"]?.toLowerCase().includes("cloudfront")) findings.push("CDN: Amazon CloudFront detected");
  else if (headers["server"]?.toLowerCase().includes("cloudflare")) findings.push("CDN: Cloudflare detected");
  else if (headers["server"]?.toLowerCase().includes("akamai")) findings.push("CDN: Akamai detected");
  else if (headers["via"]?.includes("vegur")) findings.push("Platform: Heroku detected");
  else if (headers["server"]) findings.push(`Server: ${headers["server"]}`);

  // Gateway / Proxy
  if (headers["x-powered-by"]) findings.push(`Backend: ${headers["x-powered-by"]}`);
  if (headers["x-kong-request-id"] || headers["via"]?.includes("kong")) findings.push("Gateway: Kong API Gateway detected");
  if (headers["x-envoy-upstream-service-time"]) findings.push("Gateway: Envoy proxy detected");
  if (headers["server"]?.toLowerCase().includes("apigee")) findings.push("Gateway: Apigee detected");
  if (headers["x-azure-ref"]) findings.push("Cloud: Azure detected");

  // Rate Limiting
  const rl = headers["x-ratelimit-limit"] || headers["x-rate-limit-limit"] || headers["ratelimit-limit"];
  if (rl) findings.push(`Rate Limiting: ${rl} requests per window`);

  // Security
  if (headers["strict-transport-security"]) findings.push("Security: HSTS enabled");
  if (headers["content-security-policy"]) findings.push("Security: CSP configured");
  if (headers["x-frame-options"]) findings.push(`Security: X-Frame-Options = ${headers["x-frame-options"]}`);

  // Caching
  if (headers["cache-control"]) findings.push(`Caching: ${headers["cache-control"]}`);
  if (headers["x-cache"]) findings.push(`Cache Status: ${headers["x-cache"]}`);

  // CORS
  if (headers["access-control-allow-origin"]) findings.push(`CORS: Allow-Origin = ${headers["access-control-allow-origin"]}`);

  return findings;
}

// ---------------------------------------------------------------------------
// DNS Analysis
// ---------------------------------------------------------------------------

function analyzeDns(ns: string[], apiA: string[], wwwA: string[]): string[] {
  const findings: string[] = [];

  // NS provider detection
  const nsStr = ns.join(" ").toLowerCase();
  if (nsStr.includes("awsdns")) findings.push("DNS Provider: AWS Route53");
  else if (nsStr.includes("azure-dns")) findings.push("DNS Provider: Azure DNS");
  else if (nsStr.includes("ns-cloud") || nsStr.includes("google")) findings.push("DNS Provider: Google Cloud DNS");
  else if (nsStr.includes("cloudflare")) findings.push("DNS Provider: Cloudflare");
  else findings.push(`DNS Provider: ${ns[0] ?? "Unknown"}`);

  // API infrastructure
  const apiStr = apiA.join(" ").toLowerCase();
  if (apiStr.includes("cloudfront")) findings.push("API Edge: CloudFront CDN");
  else if (apiStr.includes("elb") || apiStr.includes("amazonaws")) findings.push("API Hosting: AWS (ELB/EC2)");
  else if (apiStr.includes("azure")) findings.push("API Hosting: Azure");
  else if (apiStr.includes("google")) findings.push("API Hosting: Google Cloud");
  else findings.push(`API resolves to: ${apiA[0] ?? "N/A"}`);

  // WWW infrastructure
  const wwwStr = wwwA.join(" ").toLowerCase();
  if (wwwStr.includes("cloudfront")) findings.push("Web Edge: CloudFront CDN");
  else if (wwwStr.includes("vercel")) findings.push("Web Hosting: Vercel");
  else if (wwwStr.includes("netlify")) findings.push("Web Hosting: Netlify");
  else findings.push(`WWW resolves to: ${wwwA[0] ?? "N/A"}`);

  return findings;
}

// ---------------------------------------------------------------------------
// Main Recon Action
// ---------------------------------------------------------------------------

export async function runAutoRecon(projectId: string) {
  const session = await requireAuth();

  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerUserId: session.userId },
    select: { id: true, name: true, primaryDomain: true, apiDomain: true },
  });
  if (!project) return { error: "Project not found" };

  const domain = project.primaryDomain?.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!domain) return { error: "No primary domain configured. Set it in project settings first." };

  const apiDomain = project.apiDomain?.replace(/^https?:\/\//, "").replace(/\/.*$/, "") || `api.${domain}`;

  const report: string[] = [];
  report.push(`# Outside-In Reconnaissance: ${project.name}`);
  report.push(`Domain: ${domain} | API Domain: ${apiDomain}`);
  report.push(`Generated: ${new Date().toISOString()}\n`);

  // --- Protocol 1: DNS Infrastructure ---
  report.push("## Protocol 1: DNS Infrastructure\n");

  const [ns, apiA, wwwA] = await Promise.all([
    dnsLookup(domain, "NS"),
    dnsLookup(apiDomain, "A"),
    dnsLookup(`www.${domain}`, "A"),
  ]);

  report.push(`### NS Records\n${ns.map((r) => `- ${r}`).join("\n")}`);
  report.push(`### API Domain (${apiDomain})\n${apiA.map((r) => `- ${r}`).join("\n")}`);
  report.push(`### WWW Domain\n${wwwA.map((r) => `- ${r}`).join("\n")}`);

  const dnsFindings = analyzeDns(ns, apiA, wwwA);
  report.push(`\n### DNS Analysis\n${dnsFindings.map((f) => `- ${f}`).join("\n")}`);

  // --- Protocol 2: HTTP Header Analysis ---
  report.push("\n## Protocol 2: HTTP Header Analysis\n");

  const [apiHeaders, wwwHeaders] = await Promise.all([
    probeHeaders(`https://${apiDomain}/`),
    probeHeaders(`https://www.${domain}`),
  ]);

  report.push(`### API Headers (${apiDomain})`);
  if (apiHeaders._error) {
    report.push(`- Error: ${apiHeaders._error}`);
  } else {
    report.push(`- Status: ${apiHeaders._status}`);
    const apiFindings = analyzeHeaders(apiHeaders);
    report.push(apiFindings.map((f) => `- ${f}`).join("\n"));
    // Raw key headers
    const interestingKeys = ["server", "x-powered-by", "x-request-id", "x-ratelimit-limit", "via", "x-cache", "content-type"];
    for (const key of interestingKeys) {
      if (apiHeaders[key]) report.push(`- ${key}: ${apiHeaders[key]}`);
    }
  }

  report.push(`\n### WWW Headers (www.${domain})`);
  if (wwwHeaders._error) {
    report.push(`- Error: ${wwwHeaders._error}`);
  } else {
    report.push(`- Status: ${wwwHeaders._status}`);
    const wwwFindings = analyzeHeaders(wwwHeaders);
    report.push(wwwFindings.map((f) => `- ${f}`).join("\n"));
  }

  // --- Protocol 3: Cloud & Gateway Identification ---
  report.push("\n## Protocol 3: Cloud & Gateway Identification\n");

  // Error probe — send malformed request to API
  let errorProbeFindings = "Could not probe";
  try {
    const errorRes = await fetch(`https://${apiDomain}/__health_check_nonexistent__`, {
      signal: AbortSignal.timeout(10_000),
    });
    const errorBody = await errorRes.text().catch(() => "");
    const errorHeaders: Record<string, string> = {};
    errorRes.headers.forEach((v, k) => { errorHeaders[k] = v; });

    if (errorBody.includes("CloudFront")) errorProbeFindings = "Error response from CloudFront → AWS infrastructure";
    else if (errorHeaders["server"]?.includes("cloudflare")) errorProbeFindings = "Error handled by Cloudflare → CDN/WAF layer";
    else if (errorBody.includes("Zuul")) errorProbeFindings = "Zuul gateway detected → Netflix OSS stack";
    else if (errorBody.includes("nginx")) errorProbeFindings = "nginx error page → reverse proxy layer";
    else if (errorBody.includes("Apache")) errorProbeFindings = "Apache error page → traditional web server";
    else errorProbeFindings = `${errorRes.status} response (${errorBody.slice(0, 100)}...)`;
  } catch (err) {
    errorProbeFindings = `Probe failed: ${err instanceof Error ? err.message : String(err)}`;
  }
  report.push(`### Error Probe\n- ${errorProbeFindings}`);

  // --- Compile Summary ---
  report.push("\n## Summary\n");
  report.push("### Infrastructure Signals");
  for (const f of dnsFindings) report.push(`- ${f}`);
  const allHeaderFindings = [
    ...analyzeHeaders(apiHeaders._error ? {} : apiHeaders),
    ...analyzeHeaders(wwwHeaders._error ? {} : wwwHeaders),
  ];
  for (const f of allHeaderFindings) report.push(`- ${f}`);

  const fullReport = report.join("\n");

  // --- Ingest as evidence ---
  try {
    const result = await ingestDocument({
      projectId,
      sourceType: "DNS",
      title: `Outside-In Recon: ${domain}`,
      rawText: fullReport,
    });

    revalidatePath(`/projects/${projectId}/discovery`);

    return {
      success: true,
      documentId: result.documentId,
      chunkCount: result.chunkCount,
      skipped: result.skipped,
      reportLength: fullReport.length,
      findings: [...dnsFindings, ...allHeaderFindings].length,
    };
  } catch (err) {
    return { error: `Recon completed but ingest failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}
