/**
 * CSE Engagement Lifecycle — 7 stages (0-6)
 *
 * CSEs are deployed when there is a clear, qualified path to embedding
 * Postman into a customer's engineering workflows. Engagement begins when
 * a customer is ready to move beyond feature exploration and embed Postman
 * into the systems that power their software development lifecycle.
 *
 * Qualification gates: clear advanced use case verified by SE, executive
 * sponsor with authority, technical counterpart, customer readiness &
 * resource commitment, and work that is truly CSE-shaped.
 */

export interface EngagementStage {
  stage: number;
  name: string;
  shortName: string;
  definition: string;
  triggerToAdvance: string;
  gateRequirements: string[];
  notes: string;
  color: string;
}

export const ENGAGEMENT_STAGES: readonly EngagementStage[] = [
  {
    stage: 0,
    name: "Intake Qualification",
    shortName: "INTAKE",
    definition:
      "A request for use case activation is qualified and converted into a processable CSE order. The SE submits the request tied to a clearly defined advanced use case that embeds Postman into engineering workflows through systems and automation.",
    triggerToAdvance: "SE-backed request passes all qualification gates",
    gateRequirements: [
      "Use case can be described clearly and activates an advanced capability (API Catalog, API Governance, CI/CD integration, Spec Hub)",
      "SE has endorsed the request and confirmed this is CSE-shaped work",
      "Executive sponsor or credible sponsor path exists with authority to keep initiative moving",
      "Customer-side technical owner exists (platform eng, DevEx, API leadership)",
      "Customer resources appear committed and ready to execute, not just explore",
      "Work is not generic adoption help, feature exploration, or execution-heavy rollout suited to PS",
    ],
    notes: "Disqualify if: no believable use case tied to workflow embedment, no technical counterpart, success depends on missing product capability, or work is clearly PS-shaped.",
    color: "#64748b",
  },
  {
    stage: 1,
    name: "Technical Discovery",
    shortName: "DISC",
    definition:
      "The use case is translated into a clear view of the customer's current state, desired future state, and the simplest path to proving value. CSE understands the customer's current workflow, tooling, architecture, pain points, ownership, and existing Postman usage.",
    triggerToAdvance: "Current state, future state, and success signals documented",
    gateRequirements: [
      "Current state and future state are documented",
      "The workflow change is clear and expressible in one sentence",
      "Systems, owners, and dependencies involved are known",
      "Blockers, dependencies, and environment constraints identified",
      "Success signals defined clearly enough to judge whether the use case is successfully activated",
    ],
    notes: "Identify where Postman should fit and what systems or teams are involved. If the use case involves CI/CD, gateway, or IDP, the team that owns that system must be engaged.",
    color: "#f59e0b",
  },
  {
    stage: 2,
    name: "Buy-in & Pilot Scoping",
    shortName: "SCOPE",
    definition:
      "A technical hypothesis is converted into a customer-approved pilot that is small enough to move quickly and meaningful enough to prove value. Scope is pressure-tested and cut to essentials.",
    triggerToAdvance: "Customer sponsor and technical owners approve the pilot scope",
    gateRequirements: [
      "Customer sponsor and technical owners approve the pilot",
      "Pilot scope is narrow enough to execute in <90 days",
      "In-scope systems, environments, and owners are agreed",
      "Technical prerequisites and dependencies are understood",
      "Success criteria are clear and objective",
      "Customer has agreed to a case study if success criteria are met",
      "Immediate next steps are scheduled",
    ],
    notes: "Position a case study upon successful completion. Set timeline, owners, and next steps.",
    color: "#3b82f6",
  },
  {
    stage: 3,
    name: "Internal Proof & Asset Prep",
    shortName: "PROOF",
    definition:
      "Postman proves the concept internally first and prepares reusable assets that help the customer get to value faster. The pilot pattern is built and tested in Postman's own environment or a controlled setup before customer implementation.",
    triggerToAdvance: "Concept proven internally with core assets prepared and cataloged",
    gateRequirements: [
      "Concept has been proven internally or in a controlled setup",
      "Core scripts, templates, collections, rulesets, and setup steps are prepared",
      "Reusable artifacts are captured in a form other CSEs can use again",
      "Assets are packaged so the customer can adapt and implement faster",
    ],
    notes: "Catalog artifacts internally for reuse with future customers. Produce scripts, templates, collections, rulesets, setup steps, and supporting assets.",
    color: "#8b5cf6",
  },
  {
    stage: 4,
    name: "Customer Implementation",
    shortName: "IMPL",
    definition:
      "The customer takes the proven pattern and implements it in their own environment with CSE guidance. CSE supports setup, integration, configuration, and troubleshooting while ensuring the customer team is doing the work and internalizing the why.",
    triggerToAdvance: "Use case operating in customer's system with measurable usage increases",
    gateRequirements: [
      "Customer-owned technical work has been completed",
      "Required setup and integration blockers are resolved or under control",
      "Use case is operating in the customer's system, not just in Postman's internal proof environment",
      "Measurable increases in usage metrics correlated with the targeted use case",
    ],
    notes: "Guide the customer technical team through the steps needed to replicate success. Remove blockers quickly and keep the work moving.",
    color: "#06b6d4",
  },
  {
    stage: 5,
    name: "Pilot Validation & Pattern Creation",
    shortName: "VALID",
    definition:
      "The implemented use case is confirmed to work as expected and deliver the intended value. The successful use case is then turned into a case study and repeatable implementation kit that others can use to scale.",
    triggerToAdvance: "Customer acknowledges value, implementation kit and case study documented",
    gateRequirements: [
      "Use case works in the customer's environment as expected",
      "Agreed success signals have moved or been achieved",
      "Customer acknowledges that value was delivered",
      "Pattern has been shown to work reliably enough to scale or hand off",
      "Repeatable implementation kit exists and is usable by others",
      "Pattern is documented clearly enough to scale (architecture, setup steps, templates, scripts, guardrails, rollout guidance, known failure points)",
      "Credible case study or internal success story has been documented",
      "Next motion is clear (customer self-service, PS, partner rollout, new CSE engagement, or transition back to Sales)",
    ],
    notes: "Finalize the implementation kit based on what worked. Capture customer feedback, technical findings, and product gaps.",
    color: "#22c55e",
  },
  {
    stage: 6,
    name: "Transition / Redeploy",
    shortName: "DONE",
    definition:
      "The use case no longer depends on day-to-day CSE involvement. The proven pattern is handed off to the next owner — whether that is the customer team, Professional Services, a partner, or a new scoped CSE phase. CSE capacity is freed for the next high-value engagement.",
    triggerToAdvance: "Ownership accepted by next motion, assets transferred, next action scheduled",
    gateRequirements: [
      "Use case no longer depends on day-to-day CSE involvement, or ownership has been explicitly accepted by the next motion",
      "Assets, context, and open risks are transferred",
      "Next action is scheduled",
      "Continuity is protected before exit",
    ],
    notes: "Transfer implementation kit, technical context, open risks, and next steps. Confirm who owns the next phase and when the next checkpoint will happen.",
    color: "#10b981",
  },
] as const;

export const MAX_STAGE = 6;

export function getEngagementStage(stage: number): EngagementStage {
  return ENGAGEMENT_STAGES[Math.max(0, Math.min(MAX_STAGE, stage))];
}

export function getEngagementColor(stage: number): string {
  return getEngagementStage(stage).color;
}

/**
 * Suggest the engagement stage based on pipeline progress signals.
 * Returns the highest stage the data supports.
 */
export interface StageSignals {
  hasDiscoveryArtifact: boolean;
  hasSolutionDesign: boolean;
  repoInitialized: boolean;
  craftSolutionClean: boolean;
  buildLogComplete: boolean;
  allDeliveryGatesPassed: boolean;
}

export function suggestEngagementStage(signals: StageSignals): number {
  if (signals.allDeliveryGatesPassed && signals.buildLogComplete) return 6; // Transition / Redeploy
  if (signals.craftSolutionClean && signals.buildLogComplete) return 5;     // Pilot Validation & Pattern Creation
  if (signals.repoInitialized && signals.craftSolutionClean) return 4;      // Customer Implementation
  if (signals.hasSolutionDesign) return 3;                                   // Internal Proof & Asset Prep
  if (signals.hasDiscoveryArtifact) return 1;                                // Technical Discovery
  return 0;                                                                  // Intake Qualification
}

export const BUILD_LOG_TEMPLATE = {
  context: {
    seCse: "",
    executiveSponsor: "",
    customerTechnicalLead: "",
    pilotTimeline: "",
  },
  useCase: "",
  useCaseOneSentence: "",
  successCriteria: [] as string[],
  environmentBaseline: {
    scm: "",
    ciCd: "",
    gateway: "",
    cloud: "",
    devPortal: "",
    secretsManagement: "",
    currentPostmanUsage: "",
    version: "",
  },
  internalProof: [] as string[],
  whatWeBuilt: [] as string[],
  valueUnlocked: [] as string[],
  reusablePatterns: [] as string[],
  implementationKit: [] as string[],
  productGapsRisks: [] as string[],
  caseStudySummary: "",
  nextMotion: "",
  nextSteps: [] as string[],
};

export type BuildLogData = typeof BUILD_LOG_TEMPLATE;
