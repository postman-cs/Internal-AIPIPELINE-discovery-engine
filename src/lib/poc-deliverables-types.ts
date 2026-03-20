export interface PocDeliverable {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  completedAt: string | null;
  evidenceUrl: string | null;
  notes: string | null;
}

export const DEFAULT_POC_DELIVERABLES: PocDeliverable[] = [
  {
    id: "github-action",
    title: "Provisioning Automation",
    description:
      "Working GitHub Action (or equivalent) that provisions Postman workspace + collections + environments + tests from a single trigger",
    completed: false,
    completedAt: null,
    evidenceUrl: null,
    notes: null,
  },
  {
    id: "cicd-integration",
    title: "CI/CD Test Integration",
    description:
      "Working CI/CD integration that runs smoke + contract tests on push and reports results",
    completed: false,
    completedAt: null,
    evidenceUrl: null,
    notes: null,
  },
  {
    id: "infra-diagram",
    title: "Annotated Infrastructure Diagram",
    description:
      "Annotated infrastructure diagram showing the full integration (customer can present this internally)",
    completed: false,
    completedAt: null,
    evidenceUrl: null,
    notes: null,
  },
  {
    id: "postman-workspace",
    title: "Functional Postman Workspace",
    description:
      "Postman workspace with all generated artifacts visible and functional",
    completed: false,
    completedAt: null,
    evidenceUrl: null,
    notes: null,
  },
];
