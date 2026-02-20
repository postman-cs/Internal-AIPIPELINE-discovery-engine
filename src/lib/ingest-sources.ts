// Registry of all ingest source metadata - icons, descriptions, setup instructions, config fields

export type SourceKey =
  | "GMAIL"
  | "SLACK"
  | "NOTION"
  | "GCAL"
  | "GITHUB"
  | "CALL_TRANSCRIPTS"
  | "MANUAL_UPLOAD";

export interface SourceConfigField {
  key: string;
  label: string;
  type: "text" | "textarea" | "select";
  placeholder?: string;
  helpText?: string;
  options?: { label: string; value: string }[];
  required?: boolean;
}

export interface SourceMeta {
  key: SourceKey;
  label: string;
  shortLabel: string;
  description: string;
  icon: string; // SVG path or emoji for now
  color: string; // Tailwind color class
  bgColor: string;
  setupInstructions: string;
  configFields: SourceConfigField[];
  mockAvailable: boolean;
}

export const SOURCE_REGISTRY: Record<SourceKey, SourceMeta> = {
  GMAIL: {
    key: "GMAIL",
    label: "Gmail",
    shortLabel: "Gmail",
    description:
      "Ingest customer emails, threads, and attachments from Gmail labels.",
    icon: "📧",
    color: "text-red-600",
    bgColor: "bg-red-50 dark:bg-red-950/30",
    setupInstructions:
      "Connect your Google Workspace account. Select which labels to monitor (e.g. customer name, project tags). Emails matching these labels will be ingested.",
    configFields: [
      {
        key: "labels",
        label: "Gmail Labels to Monitor",
        type: "text",
        placeholder: "e.g. CSE/Acme, CSE/Prospects",
        helpText: "Comma-separated list of Gmail labels to watch",
      },
      {
        key: "maxAge",
        label: "Look-back Period",
        type: "select",
        options: [
          { label: "Last 7 days", value: "7d" },
          { label: "Last 30 days", value: "30d" },
          { label: "Last 90 days", value: "90d" },
          { label: "All time", value: "all" },
        ],
      },
    ],
    mockAvailable: true,
  },
  SLACK: {
    key: "SLACK",
    label: "Slack",
    shortLabel: "Slack",
    description:
      "Ingest messages and threads from Slack channels and DMs relevant to your accounts.",
    icon: "💬",
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
    setupInstructions:
      "Connect your Slack workspace via OAuth. Choose channels to monitor for customer signal. Bot will track threads and key messages.",
    configFields: [
      {
        key: "channels",
        label: "Channels to Monitor",
        type: "text",
        placeholder: "e.g. #cse-acme, #api-design, #deal-room-acme",
        helpText: "Comma-separated Slack channels (include #)",
      },
      {
        key: "includeDMs",
        label: "Include DMs",
        type: "select",
        options: [
          { label: "No", value: "false" },
          { label: "Yes — DMs with customer contacts", value: "true" },
        ],
      },
      {
        key: "keywords",
        label: "Keyword Filters (optional)",
        type: "text",
        placeholder: "e.g. API, integration, onboarding",
        helpText: "Only ingest messages containing these keywords",
      },
    ],
    mockAvailable: true,
  },
  NOTION: {
    key: "NOTION",
    label: "Notion",
    shortLabel: "Notion",
    description:
      "Ingest pages and databases from Notion workspaces — strategy docs, account plans, meeting notes.",
    icon: "📝",
    color: "text-gray-900 dark:text-gray-100",
    bgColor: "bg-gray-100 dark:bg-gray-800/50",
    setupInstructions:
      "Connect to Notion via integration token. Select which databases or pages to sync. Good for account plans, strategy docs, and shared meeting notes.",
    configFields: [
      {
        key: "databaseIds",
        label: "Notion Database IDs",
        type: "textarea",
        placeholder: "Paste Notion database IDs (one per line)",
        helpText: "Find these in the Notion page URL after the workspace name",
      },
      {
        key: "pageFilter",
        label: "Page Title Filter (optional)",
        type: "text",
        placeholder: "e.g. CSE, Account Plan",
        helpText: "Only sync pages whose title contains these keywords",
      },
    ],
    mockAvailable: true,
  },
  GCAL: {
    key: "GCAL",
    label: "Google Calendar",
    shortLabel: "GCal",
    description:
      "Ingest calendar events — meeting schedules, attendee lists, and event notes for tracking customer touchpoints.",
    icon: "📅",
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    setupInstructions:
      "Connect your Google Calendar. Events with customer contacts as attendees will be tracked automatically. Meeting notes from attached docs are also ingested.",
    configFields: [
      {
        key: "calendars",
        label: "Calendars to Sync",
        type: "text",
        placeholder: "e.g. primary, cse-shared@postman.com",
        helpText: "Comma-separated calendar IDs or 'primary'",
      },
      {
        key: "attendeeFilter",
        label: "Attendee Domain Filter",
        type: "text",
        placeholder: "e.g. acme.com, techstart.io",
        helpText: "Only ingest events with attendees from these domains",
      },
    ],
    mockAvailable: true,
  },
  GITHUB: {
    key: "GITHUB",
    label: "GitHub",
    shortLabel: "GitHub",
    description:
      "Track PRs, issues, and discussions in customer-relevant repos. Surface API-related development activity.",
    icon: "🐙",
    color: "text-gray-900 dark:text-gray-100",
    bgColor: "bg-gray-100 dark:bg-gray-800/50",
    setupInstructions:
      "Connect via GitHub App or PAT. Add repos to watch — these can be customer public repos or internal repos related to the engagement.",
    configFields: [
      {
        key: "repos",
        label: "Repositories to Watch",
        type: "textarea",
        placeholder: "e.g. acme/public-api\nacme/sdk-node\npostman/acme-integration",
        helpText: "One repo per line in owner/repo format",
      },
      {
        key: "eventTypes",
        label: "Event Types",
        type: "select",
        options: [
          { label: "PRs + Issues", value: "pr_issues" },
          { label: "PRs + Issues + Discussions", value: "all" },
          { label: "PRs only", value: "pr_only" },
        ],
      },
    ],
    mockAvailable: true,
  },
  CALL_TRANSCRIPTS: {
    key: "CALL_TRANSCRIPTS",
    label: "Call Transcripts",
    shortLabel: "Calls",
    description:
      "Ingest meeting transcripts from Gong, Fireflies, Otter.ai, or manual uploads. Captures discovery and deal-room conversations.",
    icon: "🎙️",
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950/30",
    setupInstructions:
      "Connect your transcript service (Gong, Fireflies, Otter.ai) or paste transcripts manually. Call intelligence is key signal for discovery.",
    configFields: [
      {
        key: "provider",
        label: "Transcript Provider",
        type: "select",
        options: [
          { label: "Gong", value: "gong" },
          { label: "Fireflies.ai", value: "fireflies" },
          { label: "Otter.ai", value: "otter" },
          { label: "Manual paste only", value: "manual" },
        ],
        required: true,
      },
      {
        key: "teamFilter",
        label: "Team / User Filter",
        type: "text",
        placeholder: "e.g. your email or team name",
        helpText: "Only ingest calls involving these participants",
      },
    ],
    mockAvailable: true,
  },
  MANUAL_UPLOAD: {
    key: "MANUAL_UPLOAD",
    label: "Manual Upload",
    shortLabel: "Upload",
    description:
      "Paste or upload any content — architecture diagrams, meeting notes, screenshots, competitive intel. Your catch-all source.",
    icon: "📎",
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950/30",
    setupInstructions:
      "No setup needed! Manual upload is always available. Use it for ad-hoc intel: pasting text from anywhere, uploading documents, or capturing notes.",
    configFields: [],
    mockAvailable: true,
  },
};

export const ALL_SOURCES: SourceKey[] = [
  "GMAIL",
  "SLACK",
  "NOTION",
  "GCAL",
  "GITHUB",
  "CALL_TRANSCRIPTS",
  "MANUAL_UPLOAD",
];

export function getSourceMeta(source: string): SourceMeta {
  return (
    SOURCE_REGISTRY[source as SourceKey] || {
      key: source as SourceKey,
      label: source,
      shortLabel: source,
      description: "",
      icon: "📄",
      color: "text-gray-500",
      bgColor: "bg-gray-50",
      setupInstructions: "",
      configFields: [],
      mockAvailable: false,
    }
  );
}
