import { z } from "zod";

// Auth
export const loginSchema = z.object({
  email: z.string().email("Invalid email").max(320),
  password: z.string().min(1, "Password is required").max(256),
});

// Project
export const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(200),
  primaryDomain: z.string().max(500).optional().or(z.literal("")),
  apiDomain: z.string().max(500).optional().or(z.literal("")),
  publicWorkspaceUrl: z.string().max(500).optional().or(z.literal("")).refine(
    (val) => !val || val.startsWith("https://") || val.startsWith("http://"),
    { message: "URL must start with http:// or https://" }
  ),
});

// Discovery Artifact
export const discoveryArtifactSchema = z.object({
  // Kepler
  keplerPaste: z.string().optional().or(z.literal("")),

  // Outside-In Terrain Map
  dnsFindings: z.string().optional().or(z.literal("")),
  headerFindings: z.string().optional().or(z.literal("")),
  publicFootprint: z.string().optional().or(z.literal("")),
  authForensics: z.string().optional().or(z.literal("")),
  cloudGatewaySignals: z.string().optional().or(z.literal("")),
  developerFrictionSignals: z.string().optional().or(z.literal("")),
  evidenceLinks: z.array(z.object({
    label: z.string(),
    url: z.string(),
  })).optional().default([]),

  // Company Snapshot
  industry: z.string().optional().or(z.literal("")),
  engineeringSize: z.string().optional().or(z.literal("")),
  publicApiPresence: z.enum(["Yes", "No", "Partial", ""]).optional().default(""),

  // Technical Landscape
  technicalLandscape: z.array(z.object({
    signal: z.string(),
    finding: z.string(),
    evidence: z.string(),
    confidence: z.enum(["High", "Med", "Low", ""]),
  })).optional().default([
    { signal: "Primary Cloud", finding: "", evidence: "", confidence: "" },
    { signal: "CDN / Edge", finding: "", evidence: "", confidence: "" },
    { signal: "Auth Pattern", finding: "", evidence: "", confidence: "" },
    { signal: "Backend Tech", finding: "", evidence: "", confidence: "" },
  ]),

  // Maturity
  maturityLevel: z.coerce.number().min(1).max(3).optional(),
  maturityJustification: z.string().optional().or(z.literal("")),

  // Hypothesis + Approach
  hypothesis: z.string().optional().or(z.literal("")),
  recommendedApproach: z.string().optional().or(z.literal("")),
  conversationAngle: z.string().optional().or(z.literal("")),

  // Stakeholders
  stakeholderTargets: z.array(z.object({
    role: z.string(),
    why: z.string(),
    firstMeetingGoal: z.string(),
  })).optional().default([]),

  // First Meeting Agenda
  firstMeetingAgenda: z.array(z.object({
    timeBlock: z.string(),
    topic: z.string(),
    detail: z.string(),
  })).optional().default([
    { timeBlock: "5 min", topic: "Validate assumptions", detail: "" },
    { timeBlock: "10 min", topic: "Pain point mapping", detail: "" },
    { timeBlock: "10 min", topic: "Quick win identification", detail: "" },
    { timeBlock: "5 min", topic: "Next steps", detail: "" },
  ]),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type DiscoveryArtifactInput = z.infer<typeof discoveryArtifactSchema>;
